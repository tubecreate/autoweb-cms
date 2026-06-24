import { query } from './db';
import bcrypt from 'bcryptjs';
import { categories as defaultCategories, news as defaultNews } from '../data/news';

// ─── CREATE TABLES ────────────────────────────────────────────────────────────
export async function initDatabase() {
  // Users / Members
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      display_name VARCHAR(200) NOT NULL,
      email VARCHAR(200),
      role VARCHAR(50) NOT NULL DEFAULT 'member',
      avatar TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      join_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Categories / Groups
  await query(`
    CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      slug VARCHAR(200) NOT NULL UNIQUE,
      sort_order INT NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Posts / Articles
  await query(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug VARCHAR(500) NOT NULL UNIQUE,
      title VARCHAR(500) NOT NULL,
      summary TEXT,
      content LONGTEXT,
      category_id VARCHAR(100),
      category_name VARCHAR(200),
      image LONGTEXT,
      author VARCHAR(200),
      status VARCHAR(50) NOT NULL DEFAULT 'draft',
      featured INTEGER NOT NULL DEFAULT 0,
      views INT NOT NULL DEFAULT 0,
      post_date TEXT,
      date_display VARCHAR(100),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by INT,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Polls
  await query(`
    CREATE TABLE IF NOT EXISTS polls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by INT,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS poll_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poll_id INT NOT NULL,
      option_text VARCHAR(500) NOT NULL,
      votes INT NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
    )
  `);

  // Notifications (marquee bar)
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text_content TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      priority INT NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by INT,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Files
  await query(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(500) NOT NULL,
      file_type VARCHAR(50),
      url LONGTEXT NOT NULL,
      file_size VARCHAR(50),
      folder VARCHAR(200) DEFAULT 'general',
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      uploaded_by INT,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Post Attachments
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
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      uploaded_by INT,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Banners
  await query(`
    CREATE TABLE IF NOT EXISTS banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title VARCHAR(500) NOT NULL,
      caption TEXT,
      big_text VARCHAR(300),
      image_url LONGTEXT,
      link VARCHAR(500) DEFAULT '#',
      bg_color VARCHAR(200) DEFAULT 'linear-gradient(135deg,#c8001a,#e31837)',
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Settings
  await query(`
    CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(100) PRIMARY KEY,
      \`value\` TEXT
    )
  `);

  // File Categories
  await query(`
    CREATE TABLE IF NOT EXISTS file_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(200) NOT NULL,
      slug VARCHAR(200) NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Download tokens tracking
  await query(`
    CREATE TABLE IF NOT EXISTS download_tokens (
      token VARCHAR(200) PRIMARY KEY,
      use_count INT DEFAULT 0,
      expires_at BIGINT NOT NULL
    )
  `);

  // Pages table
  await query(`
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      layout TEXT,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);


  // Alter tables to add new columns dynamically if they do not exist
  try {
    await query('ALTER TABLE files ADD COLUMN downloads INT DEFAULT 0');
  } catch (e) {}
  try {
    await query('ALTER TABLE files ADD COLUMN description TEXT');
  } catch (e) {}
  try {
    await query('ALTER TABLE files ADD COLUMN is_public INT DEFAULT 1');
  } catch (e) {}
  try {
    await query('ALTER TABLE post_attachments ADD COLUMN downloads INT DEFAULT 0');
  } catch (e) {}
  try {
    await query('ALTER TABLE post_attachments ADD COLUMN is_public INT DEFAULT 1');
  } catch (e) {}
  try {
    await query('ALTER TABLE posts ADD COLUMN seo_title VARCHAR(500)');
  } catch (e) {}
  try {
    await query('ALTER TABLE posts ADD COLUMN seo_description TEXT');
  } catch (e) {}
  try {
    await query('ALTER TABLE posts ADD COLUMN tags TEXT');
  } catch (e) {}

  console.log('✅ Database tables created');
}

// ─── SEED DATA ────────────────────────────────────────────────────────────────
export async function seedData(adminPassword) {
  const passwordToSeed = adminPassword || 'admin123';
  // Seed admin user
  const existingAdmin = await query('SELECT id FROM users WHERE username = ?', ['admin']);
  if (existingAdmin.length === 0) {
    const hashed = await bcrypt.hash(passwordToSeed, 10);
    await query(
      'INSERT INTO users (username, password, display_name, email, role, active, join_date) VALUES (?,?,?,?,?,1,?)',
      ['admin', hashed, 'Quản trị viên', 'admin@ngo-quyen.edu.vn', 'admin', '2026-01-01']
    );
    const modHashed = await bcrypt.hash('mod123', 10);
    await query(
      'INSERT INTO users (username, password, display_name, email, role, active, join_date) VALUES (?,?,?,?,?,1,?)',
      ['moderator', modHashed, 'Điều hành viên', 'mod@ngo-quyen.edu.vn', 'mod', '2026-01-15']
    );
    console.log('✅ Default users seeded');
  }

  // Seed categories
  for (let i = 0; i < defaultCategories.length; i++) {
    const cat = defaultCategories[i];
    await query(
      'INSERT OR IGNORE INTO categories (id, name, slug, sort_order, active) VALUES (?,?,?,?,1)',
      [cat.id, cat.name, cat.slug, i + 1]
    );
  }
  console.log('✅ Categories seeded');

  // Seed posts (from static data, skip if already exists)
  const existingPosts = await query('SELECT COUNT(*) as cnt FROM posts');
  if (existingPosts[0].cnt === 0) {
    for (const n of defaultNews) {
      await query(
        `INSERT OR IGNORE INTO posts
          (slug, title, summary, content, category_id, category_name, image, author, status, featured, views, post_date, date_display)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          n.slug, n.title, n.summary || '', n.content || '',
          n.category, n.categoryName, n.image || '',
          n.author || 'Trường TH Ngô Quyền',
          'published', n.featured ? 1 : 0, n.views || 0,
          n.date, n.dateDisplay || ''
        ]
      );
    }
    console.log('✅ Posts seeded');
  }

  // Seed default notifications
  const existingNotifs = await query('SELECT COUNT(*) as cnt FROM notifications');
  if (existingNotifs[0].cnt === 0) {
    await query(
      'INSERT INTO notifications (text_content, active, priority) VALUES (?,1,1)',
      ['Trường Tiểu học Ngô Quyền thông báo kế hoạch kiểm tra định kỳ học kỳ II']
    );
    await query(
      'INSERT INTO notifications (text_content, active, priority) VALUES (?,1,2)',
      ['Thông báo thời gian nộp hồ sơ tuyển sinh trực tuyến lớp 1 năm học mới']
    );
    console.log('✅ Notifications seeded');
  }

  // Seed default poll
  const existingPolls = await query('SELECT COUNT(*) as cnt FROM polls');
  if (existingPolls[0].cnt === 0) {
    const pollResult = await query(
      'INSERT INTO polls (question, active) VALUES (?,1)',
      ['Khảo sát ý kiến của phụ huynh học sinh về các hoạt động giáo dục và bán trú']
    );
    const pollId = pollResult.insertId;
    const opts = ['Rất hài lòng', 'Hài lòng', 'Bình thường', 'Cần cải thiện'];
    const votes = [64, 28, 6, 2];
    for (let i = 0; i < opts.length; i++) {
      await query(
        'INSERT INTO poll_options (poll_id, option_text, votes, sort_order) VALUES (?,?,?,?)',
        [pollId, opts[i], votes[i], i + 1]
      );
    }
    console.log('✅ Default poll seeded');
  }

  // Seed default file categories
  const existingFileCats = await query('SELECT COUNT(*) as cnt FROM file_categories');
  if (existingFileCats[0].cnt === 0) {
    const defaultFileCats = [
      { name: 'Tài liệu & Công văn', slug: 'documents' },
      { name: 'Hình ảnh & Banner', slug: 'images' },
      { name: 'Video & Media', slug: 'videos' },
      { name: 'Biểu mẫu & Học liệu', slug: 'forms' },
      { name: 'Chưa phân loại', slug: 'general' }
    ];
    for (const c of defaultFileCats) {
      await query('INSERT OR IGNORE INTO file_categories (name, slug) VALUES (?, ?)', [c.name, c.slug]);
    }
    console.log('✅ File categories seeded');
  }

  // Seed default files
  const existingFiles = await query('SELECT COUNT(*) as cnt FROM files');
  if (existingFiles[0].cnt === 0) {
    await query(
      'INSERT INTO files (name, file_type, url, file_size, folder) VALUES (?,?,?,?,?)',
      ['logo_ngo_quyen.png', 'image', '/logos/logo_ngo_quyen.png', '48KB', 'logos']
    );
    await query(
      'INSERT INTO files (name, file_type, url, file_size, folder) VALUES (?,?,?,?,?)',
      ['so_do_truong.png', 'image', '/logos/so_do_truong.png', '156KB', 'logos']
    );
    console.log('✅ Default files seeded');
  }

  // Seed default settings for theme and homepage layout
  const existingTheme = await query('SELECT 1 FROM settings WHERE \`key\` = ?', ['theme_preset']);
  if (existingTheme.length === 0) {
    await query("INSERT INTO settings (\`key\`, \`value\`) VALUES ('theme_preset', 'cyan')");
    await query("INSERT INTO settings (\`key\`, \`value\`) VALUES ('theme_custom_colors', '{}')");
    
    const defaultLayout = [
      { id: 'block_tabbed_news', type: 'tabbed_news', title: 'Tin tức nổi bật', visible: true },
      { id: 'block_shortcuts', type: 'shortcuts', title: 'Liên kết nhanh', visible: true },
      { id: 'block_banner_slider', type: 'banner_slider', title: 'Banner giới thiệu', visible: true },
      { id: 'block_categories', type: 'categories', title: 'Danh mục tin tức', visible: true, configs: [
          { title: 'TIN TỨC - SỰ KIỆN', cat: 'hoat-dong-dang-uy', color: 'red' },
          { title: 'THÔNG BÁO NHÀ TRƯỜNG', cat: 'chi-dao-dieu-hanh', color: 'blue' },
          { title: 'HOẠT ĐỘNG CHUYÊN MÔN', cat: 'chinh-quyen-nha-nuoc', color: 'red' },
          { title: 'PHONG TRÀO ĐOÀN - ĐỘI', cat: 'mat-tran-doan-the', color: 'blue' },
          { title: 'TUYỂN SINH ĐẦU CẤP', cat: 'cai-cach-hanh-chinh', color: 'red' },
          { title: 'ỨNG DỤNG CNTT - CHUYỂN ĐỔI SỐ', cat: 'chuyen-doi-so', color: 'blue' },
          { title: 'TÀI NGUYÊN HỌC TẬP', cat: 'kinh-te-moi-truong', color: 'red' },
          { title: 'GÓC PHỤ HUYNH', cat: 'van-hoa-xa-hoi', color: 'blue' }
        ]
      }
    ];
    await query("INSERT INTO settings (\`key\`, \`value\`) VALUES ('homepage_layout', ?)", [JSON.stringify(defaultLayout)]);
    console.log('✅ Default theme and homepage layout settings seeded');
  }

  console.log('✅ All seed data complete');
}
