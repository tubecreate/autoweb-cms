import { query } from './db';
import { hashPassword } from './auth';

export async function initDatabase() {
  // Signups table
  await query(`
    CREATE TABLE IF NOT EXISTS signups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email VARCHAR(255) NOT NULL UNIQUE,
      created_at VARCHAR(100) NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Settings table
  await query(`
    CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(255) NOT NULL PRIMARY KEY,
      \`value\` TEXT
    )
  `);

  // Users table
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username VARCHAR(255) NOT NULL UNIQUE,
      password TEXT NOT NULL,
      display_name TEXT,
      email TEXT,
      role VARCHAR(50) NOT NULL DEFAULT 'member',
      tier VARCHAR(50) NOT NULL DEFAULT 'Free',
      active INTEGER NOT NULL DEFAULT 1,
      created_at VARCHAR(100) NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Posts/Changelog table
  await query(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug VARCHAR(255) NOT NULL UNIQUE,
      title TEXT NOT NULL,
      summary TEXT,
      content TEXT,
      image TEXT,
      author_id INTEGER,
      author_name TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'draft',
      views INTEGER DEFAULT 0,
      created_at VARCHAR(100) NOT NULL DEFAULT (datetime('now')),
      updated_at VARCHAR(100) NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Pages table
  await query(`
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug VARCHAR(255) NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      layout TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'published',
      created_at VARCHAR(100) NOT NULL DEFAULT (datetime('now')),
      updated_at VARCHAR(100) NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // API Keys table
  await query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      api_key VARCHAR(255) NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      created_at VARCHAR(100) NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // File Categories table
  await query(`
    CREATE TABLE IF NOT EXISTS file_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      created_at VARCHAR(100) NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Files table
  await query(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(500) NOT NULL,
      file_type VARCHAR(50),
      url LONGTEXT NOT NULL,
      file_size VARCHAR(50),
      folder VARCHAR(200) DEFAULT 'general',
      uploaded_at VARCHAR(100) NOT NULL DEFAULT (datetime('now')),
      uploaded_by INT,
      description TEXT,
      is_public INT DEFAULT 1,
      downloads INT DEFAULT 0,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Post Attachments table
  await query(`
    CREATE TABLE IF NOT EXISTS post_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INT,
      name VARCHAR(500) NOT NULL,
      original_name VARCHAR(500),
      file_type VARCHAR(100),
      file_size BIGINT DEFAULT 0,
      file_size_label VARCHAR(50),
      url LONGTEXT NOT NULL,
      uploaded_at VARCHAR(100) NOT NULL DEFAULT (datetime('now')),
      uploaded_by INT,
      downloads INT DEFAULT 0,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Download tokens tracking table
  await query(`
    CREATE TABLE IF NOT EXISTS download_tokens (
      token VARCHAR(200) PRIMARY KEY,
      use_count INT DEFAULT 0,
      expires_at BIGINT NOT NULL
    )
  `);

  // Stored files table (fallback for hosting uploads in database when filesystem is read-only)
  await query(`
    CREATE TABLE IF NOT EXISTS stored_files (
      \`key\` VARCHAR(255) PRIMARY KEY,
      content LONGTEXT NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      created_at VARCHAR(100) NOT NULL DEFAULT (datetime('now'))
    )
  `);


  // Alter tables to add SEO columns dynamically if they do not exist
  const addColumns = [
    { table: 'pages', column: 'meta_title', type: 'TEXT' },
    { table: 'pages', column: 'meta_description', type: 'TEXT' },
    { table: 'pages', column: 'meta_keywords', type: 'TEXT' },
    { table: 'posts', column: 'meta_title', type: 'TEXT' },
    { table: 'posts', column: 'meta_description', type: 'TEXT' },
    { table: 'posts', column: 'meta_keywords', type: 'TEXT' }
  ];

  for (const item of addColumns) {
    try {
      await query(`ALTER TABLE ${item.table} ADD COLUMN ${item.column} ${item.type}`);
      console.log(`Added column ${item.column} to table ${item.table}`);
    } catch (err) {
      // Column already exists or error
    }
  }

  console.log('✅ Database tables created and migrated');
}

export async function seedData(adminPassword) {
  const passwordToSeed = adminPassword || 'admin123';
  // Seed Settings
  const defaultSettings = [
    ['site_title', 'Command Code - AI coding agent with taste'],
    ['site_description', 'The first AI coding agent that learns your coding taste. Powered by taste-1, a meta neuro-symbolic model.'],
    ['site_keywords', 'ai coding agent, taste-1, neuro-symbolic AI, code assistant'],
    ['header_logo_text', 'Command Code'],
    ['header_logo_icon', '⚡'],
    ['header_links', JSON.stringify([
      { label: 'Docs', href: '/#docs' },
      { label: 'Features', href: '/#features' },
      { label: 'Pricing', href: '/#pricing' },
      { label: 'Posts', href: '/#posts' }
    ])],
    ['footer_copyright', '© 2026 Command Code, 2261 Market St #5698, San Francisco, CA 94114. All rights reserved.'],
    ['footer_columns', JSON.stringify([
      {
        title: 'Product',
        links: [
          { label: 'Docs', href: '/#docs' },
          { label: 'Features', href: '/#features' },
          { label: 'Pricing', href: '/#pricing' },
          { label: 'Posts', href: '/#posts' }
        ]
      },
      {
        title: 'Company',
        links: [
          { label: 'About Us', href: '/about' },
          { label: 'Privacy Policy', href: '#' },
          { label: 'Terms of Service', href: '#' }
        ]
      }
    ])]
  ];

  for (const [key, val] of defaultSettings) {
    try {
      await query('INSERT OR IGNORE INTO settings (`key`, `value`) VALUES (?, ?)', [key, val]);
    } catch (err) {
      console.error(`Failed to seed setting key ${key}:`, err);
    }
  }

  // Seed default admin and moderator users
  try {
    const adminExists = await query('SELECT id FROM users WHERE username = ?', ['admin']);
    if (adminExists.length === 0) {
      const hashedAdminPw = await hashPassword(passwordToSeed);
      await query(
        'INSERT INTO users (username, password, display_name, email, role, tier, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
        ['admin', hashedAdminPw, 'Administrator', 'admin@commandcode.ai', 'admin', 'Enterprise']
      );
      console.log('👑 Default admin user seeded');
    }

    const modExists = await query('SELECT id FROM users WHERE username = ?', ['moderator']);
    if (modExists.length === 0) {
      const hashedModPw = await hashPassword('mod123');
      await query(
        'INSERT INTO users (username, password, display_name, email, role, tier, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
        ['moderator', hashedModPw, 'Staff Moderator', 'mod@commandcode.ai', 'mod', 'Pro']
      );
      console.log('🛡️ Default moderator user seeded');
    }
  } catch (err) {
    console.error('Failed to seed default users:', err);
  }

  // Seed default dynamic pages
  try {
    const pageExists = await query('SELECT id FROM pages WHERE slug = ?', ['about']);
    if (pageExists.length === 0) {
      const defaultLayout = [
        {
          id: 'b_hero_1',
          type: 'hero',
          visible: true,
          configs: {
            title: 'About Command Code',
            description: 'We are on a mission to build the first neuro-symbolic coding agent that learns your personal programming taste.',
            buttonText: 'Try Free CLI',
            buttonLink: '/'
          }
        },
        {
          id: 'b_feat_1',
          type: 'features',
          visible: true,
          configs: {
            tag: 'values',
            title: 'Our Core Principles',
            description: 'What drives our engineering team.',
            items: [
              { title: 'Developer Autonomy', desc: 'Run locally, work headless, save conventions.' },
              { title: 'Privacy First', desc: 'Memory stays local. We never train models on your private repository.' },
              { title: 'AST-Guided Reasoning', desc: 'Injecting local static code analysis context directly into model reasoning loops.' }
            ]
          }
        }
      ];
      await query(
        'INSERT INTO pages (slug, title, description, layout, status) VALUES (?, ?, ?, ?, ?)',
        ['about', 'About Us', 'Learn about the team behind Command Code and our vision.', JSON.stringify(defaultLayout), 'published']
      );
      console.log('📄 Default about page seeded');
    }

    const indexExists = await query('SELECT id FROM pages WHERE slug = ?', ['index']);
    if (indexExists.length === 0) {
      const indexLayout = [
        {
          id: 'b_hero_index',
          type: 'hero',
          visible: true,
          configs: {
            tag: '🎉',
            tagText: 'Command Code raised $5M seed.',
            tagLink: '#',
            title: 'Command Code with your taste',
            description: 'The coding agent that does it all. Learns the way you code. Until coding feels like thinking. Powered by taste-1 meta neuro-symbolic AI.',
            buttonText: 'npm i -g command-code',
            buttonLink: 'npm i -g command-code',
            secondaryButtonText: 'Video Demo',
            secondaryButtonLink: '#',
            metricsText: 'Code 10× faster • Reviews 2× quicker • Bugs 5× fewer'
          }
        },
        {
          id: 'b_terminal_index',
          type: 'terminal',
          visible: true,
          configs: {
            tag: '// stop patching AI slop',
            title: 'Coding agent that learns you',
            description: 'Code you don\'t fix. The best DX for coding with AI. Command continuously learns your conventions and forgets what you delete.',
            leftTitle: 'other-agents.log',
            rightTitle: 'command-code.log'
          }
        },
        {
          id: 'b_feat_index',
          type: 'features',
          visible: true,
          configs: {
            tag: '// features',
            title: 'A mode for every developer',
            description: 'Built out of the box to fit your architecture, conventions, and style.',
            items: [
              { title: 'Always learning', desc: 'Every accept, reject, and edit is a signal — auto-generates into project-level convention skills.' },
              { title: 'Modes for moments', desc: 'Interactive CLI, Headless runs via `-p`, `--yolo`, and sandboxed background runners.' },
              { title: 'Pro tools built in', desc: 'File operations, ripgrep searches, sandbox shell runs, and multi-file code editing integrations.' },
              { title: 'Memory carryover', desc: 'Custom `/agents` profiles and persistent `/memory` context settings preserved across coding sessions.' },
              { title: 'Highly Hackable', desc: 'Supports reusable custom skills, custom terminal commands, MCP servers, and editor plugins.' },
              { title: 'Better together', desc: 'Share sessions with team members easily. Run `npx taste push` or `pull` to sync developer conventions.' }
            ]
          }
        },
        {
          id: 'b_stats_index',
          type: 'stats',
          visible: true,
          configs: {
            tag: '// metrics',
            title: 'The math of developer DX',
            description: 'Faster code, cleaner reviews, and fewer bugs for a dollar plan.',
            items: [
              { val: '10×', lbl: 'Faster Code', desc: 'Keystroke to pull request in a fraction of the time.' },
              { val: '2×', lbl: 'Quicker Reviews', desc: 'Cleaner diffs without chasing formatting nits.' },
              { val: '5×', lbl: 'Fewer Bugs', desc: 'Code compiles and builds safely on the first merge.' }
            ]
          }
        },
        {
          id: 'b_pricing_index',
          type: 'pricing',
          visible: true,
          configs: {
            tag: '// pricing',
            title: 'Go Plan',
            description: 'Everything unlocked. For a dollar.',
            price: '$1',
            period: '/mo',
            subtext: 'Cancel any time · $10 in free startup API credits included',
            credits: 'DeepSeek V4 Pro 4× · Nemotron 3 Ultra 2.3× · Qwen 3.7 Max 2× · MiniMax M3 20×',
            showSignup: true
          }
        },
        {
          id: 'b_test_index',
          type: 'testimonials',
          visible: true,
          configs: {
            tag: '// community',
            title: 'Loved by engineers and founders',
            items: [
              {
                quote: '“ Command Code learns my taste. After a week, it stopped making the mistakes I kept fixing in other agents. The diffs feel like a senior engineer who already read the codebase. ”',
                author: 'Zeno Rocha',
                title: 'Founder & CEO · Resend'
              },
              {
                quote: '“ Command Code is the first agent where I trust open models in production. The harness is so solid I had to double check I was still on DeepSeek Flash. Shipped multiple CLIs for $2. ”',
                author: 'David Thyresson',
                title: 'RedwoodSDK Contributor'
              }
            ]
          }
        },
        {
          id: 'b_posts_index',
          type: 'posts',
          visible: true,
          configs: {
            title: 'What\'s new in Command Code',
            description: 'Latest improvements, models updates, and feature releases.',
            limit: 5,
            layoutStyle: 'list'
          }
        },
        {
          id: 'b_faq_index',
          type: 'faq',
          visible: true,
          configs: {
            tag: '// faq',
            title: 'Questions, answered.',
            description: 'Everything that usually comes up before a developer team installs.',
            items: [
              {
                q: 'How is Command Code different from Cursor or Copilot?',
                a: 'Command Code is a frontier coding agent that lives in your terminal and continuously learns your coding taste. Powered by taste-1, it ships, fixes, tests, and refactors with the patterns you keep — and forgets the ones you delete.'
              },
              {
                q: 'What does \'learns my taste\' actually mean?',
                a: 'Every accept, reject, and edit is a signal. Command Code distills those into project-level /skills and personal /memory, so the next session opens with the conventions you already prefer. No rules to write, no prompts to maintain.'
              },
              {
                q: 'Which models can I use? Can I bring my own?',
                a: 'Every model listed in our docs ships out of the box — Anthropic, OpenAI, Google, xAI, DeepSeek, Qwen, Kimi, GLM, MiniMax, and more. New vendors land regularly.'
              },
              {
                q: 'Is my code used for training?',
                a: 'No. Never. Your code, your skills, and your memory stay on your machine. Command Code never trains on your work. See our Privacy Policy.'
              },
              {
                q: 'How do teams share taste?',
                a: 'npx taste push to publish a project skill, npx taste pull to install one. Skills are open files in your repo — review them in PRs like any other code.'
              },
              {
                q: 'What does it cost?',
                a: 'We offer a Free tier for solo developers. Pro and Team plans add seats, more compute credits, and shared team taste registries. See Pricing for details.'
              }
            ]
          }
        }
      ];
      await query(
        'INSERT INTO pages (slug, title, description, layout, status) VALUES (?, ?, ?, ?, ?)',
        ['index', 'Homepage', 'The coding agent that learns the way you code.', JSON.stringify(indexLayout), 'published']
      );
      console.log('📄 Default index/homepage seeded');
    }
  } catch (err) {
    console.error('Failed to seed default pages:', err);
  }

  // Seed default file categories
  try {
    const existingFileCats = await query('SELECT COUNT(*) as cnt FROM file_categories');
    if (existingFileCats[0].cnt === 0) {
      const defaultFileCats = [
        { name: 'Chưa phân loại', slug: 'general' },
        { name: 'Ảnh minh họa', slug: 'images' },
        { name: 'Tài liệu hướng dẫn', slug: 'documents' },
        { name: 'Mã nguồn / Code', slug: 'code' },
        { name: 'Khác', slug: 'other' }
      ];
      for (const c of defaultFileCats) {
        await query('INSERT OR IGNORE INTO file_categories (name, slug) VALUES (?, ?)', [c.name, c.slug]);
      }
      console.log('📁 Default file categories seeded');
    }
  } catch (err) {
    console.error('Failed to seed default file categories:', err);
  }

  console.log('✅ Seed data complete');
}
