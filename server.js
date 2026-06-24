import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { spawn } from 'child_process';


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DB_FILE = path.join(process.cwd(), 'db.json');
const LOGS_DIR = path.join(process.cwd(), 'logs');
const SITES_DIR = path.join(process.cwd(), 'sites');
const TEMPLATE_DIR = path.join(process.cwd(), 'templates', 'ngo-quyen');

// ============================================================
// TEMPLATE → GitHub Repo mapping
// ============================================================
const TEMPLATE_REPOS = {
  'ngo-quyen':   'https://github.com/tiensyk09/template-ngo-quyen.git',
  'korean-news': 'https://github.com/tiensyk09/template-korean-news.git',
  'commandcode': 'https://github.com/tiensyk09/template-commandcode.git',
};

// Local fallback nếu git clone thất bại
const TEMPLATE_LOCAL = {
  'ngo-quyen':   path.join(process.cwd(), 'templates', 'ngo-quyen'),
  'korean-news': path.join(process.cwd(), 'templates', 'korean-news'),
  'commandcode': path.join(process.cwd(), 'templates', 'commandcode'),
};

// Helper to construct environment variables for Cloudflare commands cleanly, preventing header conflicts
function getCloudflareEnv(creds) {
  const env = { ...process.env };
  
  if (creds.accountId) {
    env.CLOUDFLARE_ACCOUNT_ID = creds.accountId;
  } else {
    delete env.CLOUDFLARE_ACCOUNT_ID;
  }
  
  if (creds.apiToken) {
    env.CLOUDFLARE_API_TOKEN = creds.apiToken;
    delete env.CLOUDFLARE_API_KEY;
    delete env.CLOUDFLARE_EMAIL;
  } else {
    if (creds.apiKey) env.CLOUDFLARE_API_KEY = creds.apiKey;
    else delete env.CLOUDFLARE_API_KEY;

    if (creds.email) env.CLOUDFLARE_EMAIL = creds.email;
    else delete env.CLOUDFLARE_EMAIL;

    delete env.CLOUDFLARE_API_TOKEN;
  }
  
  return env;
}

// Ensure directories exist
await fs.mkdir(LOGS_DIR, { recursive: true });
await fs.mkdir(SITES_DIR, { recursive: true });

// Log Listeners for Server-Sent Events (SSE)
const logListeners = new Map();

// Helper to write logs to file and stream to clients
async function writeLog(siteName, text, isError = false) {
  const cleanText = text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{4,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${cleanText}`;
  
  // Append to file
  const logFilePath = path.join(LOGS_DIR, `${siteName}.log`);
  await fs.appendFile(logFilePath, logMessage);

  // Stream to SSE listeners
  const listeners = logListeners.get(siteName);
  if (listeners) {
    listeners.forEach((res) => {
      res.write(`data: ${JSON.stringify({ message: cleanText, isError })}\n\n`);
    });
  }
}

// Helper to execute processes with real-time log capture
// Returns combined stdout+stderr output; throws Error with .output attached on failure
function runCommand(command, args, options, siteName) {
  return new Promise((resolve, reject) => {
    writeLog(siteName, `Running: ${command} ${args.join(' ')}\n`);

    const child = spawn(command, args, {
      ...options,
      shell: true
    });

    let combinedOutput = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      combinedOutput += text;
      writeLog(siteName, text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      combinedOutput += text;
      writeLog(siteName, text);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(combinedOutput);
      } else {
        const err = new Error(`Command "${command} ${args.join(' ')}" failed with exit code ${code}`);
        err.output = combinedOutput;
        reject(err);
      }
    });

    child.on('error', (err) => {
      err.output = combinedOutput;
      reject(err);
    });
  });
}

// ============================================================
// Phân tích nguyên nhân lỗi từ output của wrangler/git/npm
// Trả về mô tả tiếng Việt dễ hiểu
// ============================================================
function analyzeError(err, context = '') {
  const output = (err.output || err.message || '').toLowerCase();

  // D1 Database limit
  if (output.includes('maximum number of d1') || output.includes('reached the maximum') && output.includes('d1')) {
    return '❌ Đã đạt giới hạn D1 databases trên tài khoản Cloudflare (free plan tối đa 10 DB). Hãy xóa bớt database không dùng trong Cloudflare Dashboard → D1 trước khi tạo website mới.';
  }

  // R2 not enabled
  if (output.includes('please enable r2') || output.includes('10042')) {
    return '⚠️ R2 Storage chưa được bật trên tài khoản này. Vào Cloudflare Dashboard → R2 để kích hoạt.';
  }

  // CF Pages reserved binding name
  if (output.includes('reserved') && output.includes('assets')) {
    return '❌ Lỗi cấu hình wrangler.toml: tên "ASSETS" bị reserved trong CF Pages. Đây là lỗi nội bộ — vui lòng thử lại, hệ thống đã được cập nhật để tránh lỗi này.';
  }

  // wrangler.toml config validation
  if (output.includes('usererror') || (output.includes('wrangler.toml') && output.includes('invalid'))) {
    return '❌ Lỗi cấu hình wrangler.toml. Vui lòng thử lại hoặc liên hệ hỗ trợ.';
  }

  // Auth errors
  if (output.includes('authentication') || output.includes('unauthorized') || output.includes('10000') || output.includes('invalid api token') || output.includes('authenticationerror')) {
    return '❌ Lỗi xác thực Cloudflare API. Kiểm tra lại API Token / Global API Key đã nhập trong Cấu hình CF.';
  }

  // Account ID wrong
  if (output.includes('account_id') || output.includes('could not find account')) {
    return '❌ Account ID Cloudflare không hợp lệ. Kiểm tra lại Account ID trong Cấu hình CF.';
  }

  // Pages project name conflict
  if (output.includes('already exists') && (output.includes('pages') || output.includes('project'))) {
    return '⚠️ Tên website đã tồn tại trên Cloudflare Pages. Chọn tên khác hoặc xóa project cũ trên CF Dashboard trước.';
  }

  // Pages project not found
  if (output.includes('project not found') || output.includes('8000007')) {
    return '❌ Project Cloudflare Pages không tồn tại hoặc không tìm thấy trên tài khoản của bạn.';
  }

  // Worker name conflict
  if (output.includes('already exists') && output.includes('worker')) {
    return '⚠️ Tên Worker đã tồn tại. Chọn tên khác hoặc xóa Worker cũ trên CF Dashboard.';
  }

  // D1 DB already exists (not an error, just info)
  if (output.includes('already exists') && output.includes('d1')) {
    return '⚠️ D1 database đã tồn tại, sẽ dùng lại database cũ.';
  }

  // Git clone failure
  if (output.includes('git') && (output.includes('clone') || output.includes('repository')) && (output.includes('failed') || output.includes('error'))) {
    return '❌ Không thể clone template từ GitHub. Kiểm tra kết nối internet hoặc repo URL.';
  }

  // npm install failure
  if ((context.includes('npm') || output.includes('npm warn') || output.includes('npm error')) && output.includes('err!')) {
    return '❌ Lỗi cài đặt dependencies (npm install thất bại). Kiểm tra kết nối mạng.';
  }

  // Build failure
  if (output.includes('opennext') || output.includes('build:cf')) {
    if (output.includes('error') || output.includes('failed')) {
      return '❌ Build Next.js thất bại. Xem chi tiết log phía trên để biết nguyên nhân cụ thể.';
    }
  }

  // Wrangler deploy failure
  if (output.includes('wrangler') && output.includes('deploy') && output.includes('error')) {
    return '❌ Deploy lên Cloudflare thất bại. Kiểm tra API credentials và thử lại.';
  }

  // Generic - no match
  return null;
}


// Deep copy folder recursively, ignoring build/node_modules directories
async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  const ignored = ['.git', 'node_modules', '.next', '.open-next', '.wrangler', 'out'];

  for (let entry of entries) {
    if (ignored.includes(entry.name)) continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// Database helper functions
async function readDb() {
  try {
    const data = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { sites: [] };
  }
}

async function writeDb(data) {
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// API Endpoints



// 1. Get all sites
app.get('/api/sites', async (req, res) => {
  const db = await readDb();
  res.json(db.sites);
});

// 2. Stream logs (SSE)
app.get('/api/sites/:name/logs', async (req, res) => {
  const { name } = req.params;
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  if (!logListeners.has(name)) {
    logListeners.set(name, new Set());
  }
  logListeners.get(name).add(res);

  // Send current file content first if it exists
  const logFilePath = path.join(LOGS_DIR, `${name}.log`);
  if (existsSync(logFilePath)) {
    try {
      const existingLogs = await fs.readFile(logFilePath, 'utf8');
      res.write(`data: ${JSON.stringify({ message: existingLogs, isHistory: true })}\n\n`);
    } catch (e) {
      // Ignore reading errors
    }
  }

  req.on('close', () => {
    const listeners = logListeners.get(name);
    if (listeners) {
      listeners.delete(res);
      if (listeners.size === 0) {
        logListeners.delete(name);
      }
    }
  });
});

// 3. Add & Deploy site
app.post('/api/sites', async (req, res) => {
  let { name, template, apiKey, email, apiToken, accountId, cfProfileId, title, adminPassword } = req.body;

  const db = await readDb();

  // Resolve credentials from cfProfileId if provided
  if (cfProfileId) {
    const profiles = db.cfProfiles || [];
    const profile = profiles.find(p => p.id === cfProfileId);
    if (!profile) {
      return res.status(400).json({ error: 'Cấu hình Cloudflare không tồn tại.' });
    }
    accountId = profile.accountId;
    apiKey = profile.apiKey || '';
    email = profile.email || '';
    apiToken = profile.apiToken || '';
  } else {
    // Legacy: direct credentials
    // Auto-detect if user entered an API Token (starting with cfut_) in the Global API Key field
    if (apiKey && apiKey.trim().startsWith('cfut_')) {
      apiToken = apiKey.trim();
      apiKey = '';
      email = '';
    }
    // Sanitize accountId
    if (accountId) {
      accountId = accountId.replace(/^\/+|\/+$/g, '').trim();
    }
  }

  if (!name || !/^[a-z0-9-]+$/.test(name)) {
    return res.status(400).json({ error: 'Invalid site name. Use lowercase, numbers, and hyphens only.' });
  }

  if (!accountId) {
    return res.status(400).json({ error: 'Cloudflare Account ID is required.' });
  }

  if (db.sites.find(s => s.name === name && s.status === 'deploying')) {
    return res.status(400).json({ error: 'This site is currently deploying.' });
  }

  // Check if site already exists
  let site = db.sites.find(s => s.name === name);
  const chosenTemplate = template || (site && site.template) || 'ngo-quyen';

  if (!site) {
    site = {
      name,
      title: title || name,
      template: chosenTemplate,
      status: 'deploying',
      deployUrl: '',
      databaseId: '',
      databaseName: `${name}-db`,
      bucketName: `${name}-bucket`,
      createdAt: new Date().toISOString(),
      cfProfileId: cfProfileId || null,
      accountId: accountId || '',
      apiKey: apiKey || '',
      email: email || '',
      apiToken: apiToken || ''
    };
    db.sites.push(site);
  } else {
    site.status = 'deploying';
    site.title = title || site.title || name;
    site.template = chosenTemplate;
    if (cfProfileId) site.cfProfileId = cfProfileId;
    site.accountId = accountId || site.accountId || '';
    site.apiKey = apiKey || site.apiKey || '';
    site.email = email || site.email || '';
    site.apiToken = apiToken || site.apiToken || '';
  }
  await writeDb(db);

  // Start background deploy task
  deploySite(name, {
    template: chosenTemplate,
    apiKey: site.apiKey || apiKey || '',
    email: site.email || email || '',
    apiToken: site.apiToken || apiToken || '',
    accountId: site.accountId || accountId || '',
    title: site.title || title || name,
    adminPassword: adminPassword || ''
  }).catch(async (err) => {
    await writeLog(name, `\nDEPLOYMENT FAILED: ${err.message}\n`, true);
    const currentDb = await readDb();
    const s = currentDb.sites.find(item => item.name === name);
    if (s) {
      s.status = 'failed';
      await writeDb(currentDb);
    }
  });

  res.json({ message: 'Deployment started', site });
});

// 4. Delete site
app.delete('/api/sites/:name', async (req, res) => {
  const { name } = req.params;
  const { deleteCloudflareResources, apiKey, email, apiToken, accountId } = req.body;

  const db = await readDb();
  const siteIndex = db.sites.findIndex(s => s.name === name);
  if (siteIndex === -1) {
    return res.status(404).json({ error: 'Site not found.' });
  }

  const site = db.sites[siteIndex];

  // Perform Cloudflare deletion in background if requested
  if (deleteCloudflareResources) {
    const resolvedCreds = {
      apiKey: apiKey || site.apiKey || '',
      email: email || site.email || '',
      apiToken: apiToken || site.apiToken || '',
      accountId: accountId || site.accountId || ''
    };
    deleteResourcesFromCloudflare(site, resolvedCreds).catch((err) => {
      console.error(`Failed to delete Cloudflare resources for ${name}:`, err);
    });
  }

  // Remove local files
  const sitePath = path.join(SITES_DIR, name);
  if (existsSync(sitePath)) {
    try {
      await fs.rm(sitePath, { recursive: true, force: true });
    } catch (err) {
      console.error(`Error deleting folder ${sitePath}:`, err);
    }
  }

  // Remove log file
  const logPath = path.join(LOGS_DIR, `${name}.log`);
  if (existsSync(logPath)) {
    try {
      await fs.rm(logPath, { force: true });
    } catch (err) {
      console.error(`Error deleting log ${logPath}:`, err);
    }
  }

  // Remove from DB
  db.sites.splice(siteIndex, 1);
  await writeDb(db);

  res.json({ message: 'Site deleted successfully.' });
});

// Cloudflare cleanup handler
async function deleteResourcesFromCloudflare(site, creds) {
  const envOptions = {
    env: getCloudflareEnv(creds)
  };

  // Delete D1 Database
  if (site.databaseId) {
    try {
      console.log(`Deleting D1 database ${site.databaseId} (${site.databaseName})`);
      await runCommand('npx', ['wrangler', 'd1', 'delete', site.databaseId, '--skip-confirmation'], envOptions, site.name);
    } catch (e) {
      console.error(`D1 deletion failed:`, e);
    }
  }

  // Delete R2 Bucket
  if (site.bucketName) {
    try {
      console.log(`Deleting R2 bucket ${site.bucketName}`);
      await runCommand('npx', ['wrangler', 'r2', 'bucket', 'delete', site.bucketName, '--force'], envOptions, site.name);
    } catch (e) {
      console.error(`R2 deletion failed:`, e);
    }
  }

  // Delete Pages project or Worker project
  if (site.deployType === 'pages') {
    try {
      console.log(`Deleting Pages project ${site.name}`);
      await runCommand('npx', ['wrangler', 'pages', 'project', 'delete', site.name, '--yes'], envOptions, site.name);
    } catch (e) {
      console.error(`Pages project deletion failed:`, e);
    }
  } else {
    try {
      console.log(`Deleting Worker project ${site.name}`);
      await runCommand('npx', ['wrangler', 'delete', '--name', site.name, '--skip-confirmation'], envOptions, site.name);
    } catch (e) {
      console.error(`Worker deletion failed:`, e);
    }
  }
}

// ============================================================
// Background deployment orchestrator — Phương án B: Git Clone → Build → CF Pages Upload
// ============================================================
async function deploySite(siteName, creds) {
  const logFilePath = path.join(LOGS_DIR, `${siteName}.log`);
  // Reset logs
  await fs.writeFile(logFilePath, '', 'utf8');

  await writeLog(siteName, `=== DEPLOYMENT START FOR WEBSITE: ${siteName} ===\n`);

  const templateName = creds.template || 'ngo-quyen';
  const sitePath = path.join(SITES_DIR, siteName);
  const dbName = `${siteName}-db`;
  const bucketName = `${siteName}-bucket`;

  const env = getCloudflareEnv(creds);
  env.NODE_OPTIONS = `--require ${path.join(process.cwd(), 'patch-symlink.cjs').replace(/\\/g, '/')}`;

  const envOptions = { cwd: sitePath, env };

  // ─── STEP 1: Clone template từ GitHub (hoặc fallback về local) ──────────
  if (existsSync(sitePath)) {
    await fs.rm(sitePath, { recursive: true, force: true });
  }
  await fs.mkdir(sitePath, { recursive: true });

  const repoUrl = TEMPLATE_REPOS[templateName];
  const localFallback = TEMPLATE_LOCAL[templateName];

  if (repoUrl) {
    await writeLog(siteName, `[GIT] Cloning template từ GitHub: ${repoUrl}...\n`);
    try {
      await runCommand('git', ['clone', '--depth=1', repoUrl, '.'], { cwd: sitePath }, siteName);
      await writeLog(siteName, `[GIT] Clone thành công!\n`);
    } catch (cloneErr) {
      await writeLog(siteName, `[GIT] Clone thất bại: ${cloneErr.message}. Dùng template local làm backup...\n`);
      if (existsSync(sitePath)) await fs.rm(sitePath, { recursive: true, force: true });
      await copyDir(localFallback, sitePath);
      await writeLog(siteName, `[LOCAL] Đã copy template local thành công.\n`);
    }
  } else {
    await writeLog(siteName, `[LOCAL] Không tìm thấy repo cho template "${templateName}", dùng template local...\n`);
    await copyDir(localFallback, sitePath);
  }

  // ─── STEP 2: Install dependencies ────────────────────────────────────────
  await writeLog(siteName, `[NPM] Cài đặt dependencies (npm install)...\n`);
  await runCommand('npm', ['install', '--prefer-offline'], { cwd: sitePath, env }, siteName);
  await writeLog(siteName, `[NPM] Dependencies đã được cài đặt.\n`);

  // ─── STEP 3: Tạo D1 Database ─────────────────────────────────────────────
  await writeLog(siteName, `[D1] Kiểm tra/Tạo Cloudflare D1 database "${dbName}"...\n`);
  let dbId = null;

  try {
    await runCommand('npx', ['wrangler', 'd1', 'create', dbName], envOptions, siteName);
    const currentLogs = await fs.readFile(logFilePath, 'utf8');
    const match = currentLogs.match(/database_id\s*=\s*"([^"]+)"/);
    if (match) dbId = match[1];
  } catch (err) {
    // Kiểm tra nguyên nhân cụ thể trước khi chuyển sang tìm DB hiện có
    const reason = analyzeError(err, 'd1 create');
    if (reason && reason.includes('giới hạn')) {
      // Đây là lỗi limit - dừng ngay, không cần tìm tiếp
      throw new Error(reason);
    }
    await writeLog(siteName, `[D1] Lỗi tạo DB (có thể đã tồn tại). Tìm kiếm trong danh sách...\n`);
  }

  if (!dbId) {
    dbId = await findExistingD1Database(dbName, envOptions, siteName);
  }

  if (!dbId) throw new Error(`Không thể tạo/tìm D1 database "${dbName}"`);
  await writeLog(siteName, `[D1] Database sẵn sàng: ID = ${dbId}\n`);

  // ─── STEP 4: Execute schema.sql ──────────────────────────────────────────
  await writeLog(siteName, `[D1] Chạy schema.sql trên remote D1...\n`);
  try {
    await runCommand('npx', ['wrangler', 'd1', 'execute', dbName, '--remote', '--file=schema.sql'], envOptions, siteName);
    await writeLog(siteName, `[D1] Schema được áp dụng thành công.\n`);

    if (creds.title) {
      const settingKey = templateName === 'ngo-quyen' ? 'header_main_title' : 'site_title';
      const escapedTitle = creds.title.replace(/'/g, "''");
      const sqlCommand = `INSERT OR REPLACE INTO settings (key, value) VALUES ('${settingKey}', '${escapedTitle}');`;
      await runCommand('npx', ['wrangler', 'd1', 'execute', dbName, '--remote', `--command=${JSON.stringify(sqlCommand)}`], envOptions, siteName);
      await writeLog(siteName, `[D1] Đã ghi tiêu đề website: "${creds.title}"\n`);
    }
  } catch (schemaErr) {
    await writeLog(siteName, `[D1] CẢNH BÁO: Schema thất bại: ${schemaErr.message}. Sẽ tự khởi tạo khi worker chạy lần đầu.\n`);
  }

  // ─── STEP 5: Tạo R2 Bucket ───────────────────────────────────────────────
  await writeLog(siteName, `[R2] Kiểm tra/Tạo R2 bucket "${bucketName}"...\n`);
  let hasR2 = true;
  try {
    await runCommand('npx', ['wrangler', 'r2', 'bucket', 'create', bucketName], envOptions, siteName);
    await writeLog(siteName, `[R2] Bucket sẵn sàng.\n`);
  } catch (err) {
    const currentLogs = await fs.readFile(logFilePath, 'utf8');
    if (currentLogs.includes('Please enable R2') || currentLogs.includes('10042')) {
      hasR2 = false;
      await writeLog(siteName, `[R2] CẢNH BÁO: R2 chưa được bật trên tài khoản này. Bỏ qua R2 binding.\n`);
    } else {
      await writeLog(siteName, `[R2] Bucket có thể đã tồn tại: ${err.message}. Tiếp tục...\n`);
    }
  }

  // ─── STEP 6: Viết wrangler.toml ──────────────────────────────────────────
  await writeLog(siteName, `[CONFIG] Tạo wrangler.toml cho Cloudflare Pages...\n`);
  let wranglerTomlContent = `name = "${siteName}"
compatibility_date = "2025-06-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".open-next/assets"

[[d1_databases]]
binding = "DB"
database_name = "${dbName}"
database_id = "${dbId}"
`;
  if (hasR2) {
    wranglerTomlContent += `
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "${bucketName}"
`;
  }
  await fs.writeFile(path.join(sitePath, 'wrangler.toml'), wranglerTomlContent, 'utf8');

  // ─── STEP 7: Build với OpenNext ───────────────────────────────────────────
  await writeLog(siteName, `[BUILD] Build project với OpenNext (opennextjs-cloudflare)...\n`);
  await writeLog(siteName, `[BUILD] Quá trình này có thể mất 3–5 phút, vui lòng chờ...\n`);
  try {
    await runCommand('npm', ['run', 'build:cf'], envOptions, siteName);
  } catch (err) {
    const reason = analyzeError(err, 'build:cf');
    throw new Error(reason || `Build thất bại: ${err.message}`);
  }
  await writeLog(siteName, `[BUILD] Build hoàn tất!\n`);

  // ─── STEP 7.5: Tạo Cloudflare Pages project nếu chưa có ──────────────────
  await writeLog(siteName, `[DEPLOY] Kiểm tra/Tạo Cloudflare Pages project "${siteName}"...\n`);
  try {
    await runCommand('npx', ['wrangler', 'pages', 'project', 'create', siteName,
      '--production-branch', 'main'
    ], envOptions, siteName);
  } catch (err) {
    const output = (err.output || err.message || '').toLowerCase();
    if (output.includes('already exists') || output.includes('project_already_exists') || output.includes('8000007')) {
      await writeLog(siteName, `[DEPLOY] Project Pages đã tồn tại hoặc đã được tạo.\n`);
    } else {
      const reason = analyzeError(err, 'pages project create');
      throw new Error(reason || `Không thể tạo project Pages: ${err.message}`);
    }
  }

  // ─── STEP 8: Deploy lên Cloudflare Pages (Direct Upload) ─────────────────
  await writeLog(siteName, `[DEPLOY] Uploading lên Cloudflare Pages...\n`);
  // Dùng wrangler pages deploy để upload trực tiếp (không cần Git integration)
  try {
    await runCommand('npx', ['wrangler', 'pages', 'deploy', '.open-next/assets',
      '--project-name', siteName,
      '--branch', 'main',
      '--commit-dirty', 'true'
    ], envOptions, siteName);
  } catch (err) {
    const reason = analyzeError(err, 'pages deploy');
    throw new Error(reason || `Deploy thất bại: ${err.message}`);
  }

  // ─── STEP 9: Bind D1 + R2 vào Pages project qua CF REST API ─────────────
  await writeLog(siteName, `[BIND] Gắn D1/R2 bindings vào Cloudflare Pages project...\n`);
  try {
    await bindPagesResources(siteName, dbId, dbName, bucketName, hasR2, creds);
    await writeLog(siteName, `[BIND] Bindings đã được cấu hình thành công.\n`);
  } catch (bindErr) {
    await writeLog(siteName, `[BIND] CẢNH BÁO: Không thể bind tự động: ${bindErr.message}\nBạn có thể cấu hình thủ công trong CF Dashboard → Pages → ${siteName} → Settings → Functions.\n`);
  }

  // ─── STEP 10: Extract deploy URL ─────────────────────────────────────────
  const deployLogs = await fs.readFile(logFilePath, 'utf8');
  // CF Pages URL pattern
  const pagesUrlMatch = deployLogs.match(/https:\/\/[a-zA-Z0-9-]+\.pages\.dev/);
  const workerUrlMatch = deployLogs.match(/https:\/\/[a-zA-Z0-9.-]+\.workers\.dev/);
  const deployUrl = pagesUrlMatch?.[0] || workerUrlMatch?.[0] || `https://${siteName}.pages.dev`;

  // ─── STEP 11: Trigger redeploy để áp dụng bindings ──────────────────────
  await writeLog(siteName, `[DEPLOY] Kích hoạt redeploy để áp dụng bindings D1/R2...\n`);
  try {
    await triggerPagesRedeploy(siteName, creds);
    await writeLog(siteName, `[DEPLOY] Redeploy đã được kích hoạt. Chờ CF build xong (~2 phút)...\n`);
    // Chờ 120 giây để CF build
    await new Promise(r => setTimeout(r, 120000));
  } catch (redeployErr) {
    await writeLog(siteName, `[DEPLOY] Không thể trigger redeploy tự động: ${redeployErr.message}\nBindings sẽ có hiệu lực ở lần deploy tiếp theo.\n`);
    // Chờ 60 giây để deploy đầu tiên xong
    await new Promise(r => setTimeout(r, 60000));
  }

  // ─── STEP 12: Seed database ───────────────────────────────────────────────
  await writeLog(siteName, `[SEED] Khởi tạo dữ liệu admin trong D1...\n`);
  let seedSuccess = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const initUrl = creds.adminPassword
        ? `${deployUrl}/api/admin/init?adminPassword=${encodeURIComponent(creds.adminPassword)}`
        : `${deployUrl}/api/admin/init`;
      const initRes = await fetch(initUrl, { signal: AbortSignal.timeout(30000) });
      const initData = await initRes.json();
      if (initRes.ok && initData.success) {
        await writeLog(siteName, `[SEED] Database đã được khởi tạo thành công: ${initData.message}\n`);
        seedSuccess = true;
        break;
      } else {
        await writeLog(siteName, `[SEED] Lần thử ${attempt}: ${initData.error || 'Chưa sẵn sàng'}. Thử lại sau 20s...\n`);
      }
    } catch (initErr) {
      await writeLog(siteName, `[SEED] Lần thử ${attempt} thất bại: ${initErr.message}. Thử lại sau 20s...\n`);
    }
    if (attempt < 5) await new Promise(r => setTimeout(r, 20000));
  }

  if (!seedSuccess) {
    await writeLog(siteName, `[SEED] Không thể seed tự động. Bạn có thể truy cập thủ công: ${deployUrl}/api/admin/init\n`);
  }

  // ─── DONE ─────────────────────────────────────────────────────────────────
  await writeLog(siteName, `\n=== DEPLOYMENT SUCCESSFUL ===\nDeployed URL: ${deployUrl}\n\nThông tin đăng nhập Admin:\n- Đường dẫn: ${deployUrl}/admin\n- Tài khoản: admin\n- Mật khẩu: ${creds.adminPassword || '[Mật khẩu bạn đã thiết lập]'}\n`);

  const currentDb = await readDb();
  const siteEntry = currentDb.sites.find(s => s.name === siteName);
  if (siteEntry) {
    siteEntry.status = 'active';
    siteEntry.deployUrl = deployUrl;
    siteEntry.databaseId = dbId;
    siteEntry.bucketName = bucketName;
    siteEntry.deployType = 'pages';
    await writeDb(currentDb);
  }

  // Cleanup
  try {
    await writeLog(siteName, `[CLEANUP] Xóa thư mục build tạm thời...\n`);
    await fs.rm(sitePath, { recursive: true, force: true });
    await writeLog(siteName, `[CLEANUP] Hoàn tất.\n`);
  } catch (cleanErr) {
    await writeLog(siteName, `[CLEANUP] CẢNH BÁO: Không thể xóa files tạm: ${cleanErr.message}\n`);
  }
}

// ============================================================
// CF Pages API: Bind D1 + R2 vào Pages project
// ============================================================
async function bindPagesResources(siteName, dbId, dbName, bucketName, hasR2, creds) {
  const accountId = creds.accountId;
  const apiToken = creds.apiToken;
  const apiKey = creds.apiKey;
  const email = creds.email;

  const headers = { 'Content-Type': 'application/json' };
  if (apiToken) {
    headers['Authorization'] = `Bearer ${apiToken}`;
  } else if (apiKey && email) {
    headers['X-Auth-Key'] = apiKey;
    headers['X-Auth-Email'] = email;
  } else {
    throw new Error('Không có thông tin xác thực Cloudflare để bind resources.');
  }

  // Build bindings object
  const bindings = [
    {
      name: 'DB',
      type: 'd1',
      id: dbId,
    }
  ];

  if (hasR2) {
    bindings.push({
      name: 'R2_BUCKET',
      type: 'r2_bucket',
      bucket_name: bucketName,
    });
  }

  // PATCH Pages project deployment config
  const patchUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${siteName}`;
  const patchBody = {
    deployment_configs: {
      production: {
        d1_databases: {
          DB: { id: dbId }
        },
        ...(hasR2 ? { r2_buckets: { R2_BUCKET: { name: bucketName } } } : {}),
        compatibility_date: '2025-06-01',
        compatibility_flags: ['nodejs_compat'],
      },
      preview: {
        d1_databases: {
          DB: { id: dbId }
        },
        ...(hasR2 ? { r2_buckets: { R2_BUCKET: { name: bucketName } } } : {}),
        compatibility_date: '2025-06-01',
        compatibility_flags: ['nodejs_compat'],
      }
    }
  };

  const patchRes = await fetch(patchUrl, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patchBody),
    signal: AbortSignal.timeout(30000)
  });

  const patchData = await patchRes.json();
  if (!patchData.success) {
    const errors = patchData.errors?.map(e => e.message).join(', ') || 'Unknown error';
    throw new Error(`CF Pages PATCH failed: ${errors}`);
  }
}

// ============================================================
// CF Pages API: Trigger redeploy để áp dụng bindings mới
// ============================================================
async function triggerPagesRedeploy(siteName, creds) {
  const accountId = creds.accountId;
  const apiToken = creds.apiToken;
  const apiKey = creds.apiKey;
  const email = creds.email;

  const headers = { 'Content-Type': 'application/json' };
  if (apiToken) {
    headers['Authorization'] = `Bearer ${apiToken}`;
  } else if (apiKey && email) {
    headers['X-Auth-Key'] = apiKey;
    headers['X-Auth-Email'] = email;
  } else {
    throw new Error('Không có thông tin xác thực.');
  }

  // Get latest deployment ID
  const listUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${siteName}/deployments?per_page=1`;
  const listRes = await fetch(listUrl, { headers, signal: AbortSignal.timeout(15000) });
  const listData = await listRes.json();

  if (!listData.success || !listData.result?.length) {
    throw new Error('Không tìm thấy deployment nào để retry.');
  }

  const latestDeployId = listData.result[0].id;

  // Retry deployment
  const retryUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${siteName}/deployments/${latestDeployId}/retry`;
  const retryRes = await fetch(retryUrl, { method: 'POST', headers, signal: AbortSignal.timeout(15000) });
  const retryData = await retryRes.json();

  if (!retryData.success) {
    const errors = retryData.errors?.map(e => e.message).join(', ') || 'Unknown';
    throw new Error(`Retry failed: ${errors}`);
  }
}

// Helper to query Wrangler API and find database ID
async function findExistingD1Database(dbName, envOptions, siteName) {
  let listOutput = '';
  try {
    const listProc = spawn('npx', ['wrangler', 'd1', 'list', '--json'], {
      ...envOptions,
      shell: true
    });
    
    await new Promise((resolve) => {
      listProc.stdout.on('data', (data) => {
        listOutput += data.toString();
      });
      listProc.on('close', resolve);
    });

    const jsonStart = listOutput.indexOf('[');
    if (jsonStart !== -1) {
      const jsonText = listOutput.substring(jsonStart);
      const dbs = JSON.parse(jsonText);
      const match = dbs.find(db => db.name === dbName);
      if (match) {
        return match.uuid;
      }
    }
  } catch (e) {
    await writeLog(siteName, `Error scanning wrangler d1 list: ${e.message}\n`);
  }
  return null;
}

// GET /api/sites/:name/settings — Fetch site configuration directly from remote D1
app.get('/api/sites/:name/settings', async (req, res) => {
  const { name } = req.params;
  const db = await readDb();
  const site = db.sites.find(s => s.name === name);
  if (!site || !site.databaseId) {
    return res.status(404).json({ error: 'Site or D1 database not configured.' });
  }

  const envOptions = {
    env: getCloudflareEnv(site)
  };

  try {
    let listOutput = '';
    const wranglerProc = spawn('npx', ['wrangler', 'd1', 'execute', site.databaseId, '--remote', '--command="SELECT * FROM settings;"', '--json'], {
      ...envOptions,
      shell: true
    });
    
    await new Promise((resolve, reject) => {
      wranglerProc.stdout.on('data', (data) => {
        listOutput += data.toString();
      });
      wranglerProc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Wrangler execution returned code ${code}`));
      });
    });

    const jsonStart = listOutput.indexOf('[');
    if (jsonStart !== -1) {
      const jsonText = listOutput.substring(jsonStart);
      const results = JSON.parse(jsonText);
      const rows = results[0]?.results || [];
      
      const config = {
        header_upper_title: '',
        header_main_title: '',
        header_description: '',
        homepage_seo_title: '',
        homepage_seo_description: '',
        header_logo_url: '',
        header_banner_url: ''
      };
      
      rows.forEach(r => {
        if (r.key in config) {
          config[r.key] = r.value || '';
        }
      });
      
      res.json(config);
    } else {
      res.json({
        header_upper_title: '',
        header_main_title: '',
        header_description: '',
        homepage_seo_title: '',
        homepage_seo_description: '',
        header_logo_url: '',
        header_banner_url: ''
      });
    }
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch settings from Cloudflare D1: ${err.message}` });
  }
});

// POST /api/sites/:name/settings — Save configuration directly to remote D1
app.post('/api/sites/:name/settings', async (req, res) => {
  const { name } = req.params;
  const body = req.body;
  const db = await readDb();
  const site = db.sites.find(s => s.name === name);
  if (!site || !site.databaseId) {
    return res.status(404).json({ error: 'Site or D1 database not configured.' });
  }

  const envOptions = {
    env: getCloudflareEnv(site)
  };

  const allowedKeys = [
    'header_upper_title',
    'header_main_title',
    'header_description',
    'homepage_seo_title',
    'homepage_seo_description',
    'header_logo_url',
    'header_banner_url'
  ];

  let sql = '';
  allowedKeys.forEach(key => {
    if (key in body) {
      const value = String(body[key] || '').replace(/'/g, "''");
      sql += `INSERT OR REPLACE INTO settings (\`key\`, \`value\`) VALUES ('${key}', '${value}'); `;
    }
  });

  if (!sql) {
    return res.status(400).json({ error: 'No valid settings variables provided.' });
  }

  try {
    let execError = '';
    const wranglerProc = spawn('npx', ['wrangler', 'd1', 'execute', site.databaseId, '--remote', `--command="${sql}"`, '--json'], {
      ...envOptions,
      shell: true
    });

    await new Promise((resolve, reject) => {
      wranglerProc.stderr.on('data', (data) => {
        execError += data.toString();
      });
      wranglerProc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(execError || `Wrangler execution returned code ${code}`));
      });
    });

    res.json({ success: true, message: 'Settings saved successfully in Cloudflare D1.' });
  } catch (err) {
    res.status(500).json({ error: `Failed to execute save command on Cloudflare D1: ${err.message}` });
  }
});

// POST /api/sites/:name/credentials — Save site credentials to db.json
app.post('/api/sites/:name/credentials', async (req, res) => {
  const { name } = req.params;
  let { accountId, apiKey, email, apiToken } = req.body;

  // Auto-detect if user entered an API Token (starting with cfut_) in the Global API Key field
  if (apiKey && apiKey.trim().startsWith('cfut_')) {
    apiToken = apiKey.trim();
    apiKey = '';
    email = '';
  }

  // Sanitize accountId (remove leading/trailing slashes, spaces)
  if (accountId) {
    accountId = accountId.replace(/^\/+|\/+$/g, '').trim();
  }

  const db = await readDb();
  const site = db.sites.find(s => s.name === name);
  if (!site) {
    return res.status(404).json({ error: 'Site not found.' });
  }

  site.accountId = accountId || '';
  site.apiKey = apiKey || '';
  site.email = email || '';
  site.apiToken = apiToken || '';

  await writeDb(db);
  res.json({ success: true, site });
});

// GET /api/sites/:name/api-keys — List API keys for site
app.get('/api/sites/:name/api-keys', async (req, res) => {
  const { name } = req.params;
  const db = await readDb();
  const site = db.sites.find(s => s.name === name);
  if (!site || !site.databaseId) {
    return res.status(404).json({ error: 'Site or D1 database not configured.' });
  }

  const envOptions = {
    env: getCloudflareEnv(site)
  };

  try {
    let listOutput = '';
    const wranglerProc = spawn('npx', ['wrangler', 'd1', 'execute', site.databaseId, '--remote', '--command="SELECT k.*, u.username FROM api_keys k LEFT JOIN users u ON k.user_id = u.id ORDER BY k.created_at DESC;"', '--json'], {
      ...envOptions,
      shell: true
    });
    
    await new Promise((resolve, reject) => {
      wranglerProc.stdout.on('data', (data) => {
        listOutput += data.toString();
      });
      wranglerProc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Wrangler execution returned code ${code}`));
      });
    });

    const jsonStart = listOutput.indexOf('[');
    if (jsonStart !== -1) {
      const jsonText = listOutput.substring(jsonStart);
      const results = JSON.parse(jsonText);
      const rows = results[0]?.results || [];
      res.json(rows);
    } else {
      res.json([]);
    }
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch API keys from Cloudflare D1: ${err.message}` });
  }
});

// POST /api/sites/:name/api-keys — Create new API key
app.post('/api/sites/:name/api-keys', async (req, res) => {
  const { name } = req.params;
  const { label, username } = req.body;
  const db = await readDb();
  const site = db.sites.find(s => s.name === name);
  if (!site || !site.databaseId) {
    return res.status(404).json({ error: 'Site or D1 database not configured.' });
  }

  const targetUser = username || 'admin';
  const targetLabel = label || 'Default API Key';

  const envOptions = {
    env: getCloudflareEnv(site)
  };

  try {
    // 1. Fetch user ID for the username
    let userOutput = '';
    const userProc = spawn('npx', ['wrangler', 'd1', 'execute', site.databaseId, '--remote', `--command="SELECT id FROM users WHERE username = '${targetUser}';"`, '--json'], {
      ...envOptions,
      shell: true
    });

    await new Promise((resolve, reject) => {
      userProc.stdout.on('data', (data) => {
        userOutput += data.toString();
      });
      userProc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error('Failed to query user details'));
      });
    });

    let userId = 1; // Default fallback to first admin
    const jsonStart = userOutput.indexOf('[');
    if (jsonStart !== -1) {
      const userResult = JSON.parse(userOutput.substring(jsonStart));
      const userRows = userResult[0]?.results || [];
      if (userRows.length > 0) {
        userId = userRows[0].id;
      }
    }

    // 2. Generate secure application password in wp_xxxx_xxxx_xxxx_xxxx format
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const block = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const generatedKey = `wp_${block()}_${block()}_${block()}_${block()}`;

    // 3. Insert generated key into remote D1 database
    const escapedLabel = targetLabel.replace(/'/g, "''");
    const sql = `INSERT INTO api_keys (name, api_key, user_id) VALUES ('${escapedLabel}', '${generatedKey}', ${userId});`;
    
    let execError = '';
    const wranglerProc = spawn('npx', ['wrangler', 'd1', 'execute', site.databaseId, '--remote', `--command="${sql}"`, '--json'], {
      ...envOptions,
      shell: true
    });

    await new Promise((resolve, reject) => {
      wranglerProc.stderr.on('data', (data) => {
        execError += data.toString();
      });
      wranglerProc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(execError || `Wrangler execution returned code ${code}`));
      });
    });

    res.json({ success: true, api_key: generatedKey, name: targetLabel, username: targetUser });
  } catch (err) {
    res.status(500).json({ error: `Failed to create API key in Cloudflare D1: ${err.message}` });
  }
});

// DELETE /api/sites/:name/api-keys/:id — Delete API key
app.delete('/api/sites/:name/api-keys/:id', async (req, res) => {
  const { name, id } = req.params;
  const db = await readDb();
  const site = db.sites.find(s => s.name === name);
  if (!site || !site.databaseId) {
    return res.status(404).json({ error: 'Site or D1 database not configured.' });
  }

  const envOptions = {
    env: getCloudflareEnv(site)
  };

  try {
    const sql = `DELETE FROM api_keys WHERE id = ${parseInt(id)};`;
    
    let execError = '';
    const wranglerProc = spawn('npx', ['wrangler', 'd1', 'execute', site.databaseId, '--remote', `--command="${sql}"`, '--json'], {
      ...envOptions,
      shell: true
    });

    await new Promise((resolve, reject) => {
      wranglerProc.stderr.on('data', (data) => {
        execError += data.toString();
      });
      wranglerProc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(execError || `Wrangler execution returned code ${code}`));
      });
    });

    res.json({ success: true, message: 'API Key deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: `Failed to delete API key: ${err.message}` });
  }
});

// ============================================================
// CF PROFILES — Quản lý nhiều tài khoản Cloudflare
// ============================================================

// GET /api/cf-profiles — Lấy danh sách profiles
app.get('/api/cf-profiles', async (req, res) => {
  const db = await readDb();
  const profiles = db.cfProfiles || [];
  // Tính websiteCount động từ sites
  const withCount = profiles.map(p => ({
    ...p,
    websiteCount: (db.sites || []).filter(s => s.cfProfileId === p.id).length
  }));
  res.json(withCount);
});

// POST /api/cf-profiles — Thêm profile mới
app.post('/api/cf-profiles', async (req, res) => {
  let { name, accountId, authType, apiKey, email, apiToken } = req.body;

  if (!name || !accountId) {
    return res.status(400).json({ error: 'Tên profile và Account ID là bắt buộc.' });
  }

  // Auto-detect token
  if (apiKey && apiKey.trim().startsWith('cfut_')) {
    apiToken = apiKey.trim();
    apiKey = '';
    email = '';
    authType = 'token';
  }

  if (accountId) {
    accountId = accountId.replace(/^\/+|\/+$/g, '').trim();
  }

  const db = await readDb();
  if (!db.cfProfiles) db.cfProfiles = [];

  const profile = {
    id: `cf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    accountId: accountId || '',
    authType: authType || 'key',
    apiKey: apiKey || '',
    email: email || '',
    apiToken: apiToken || '',
    createdAt: new Date().toISOString()
  };

  db.cfProfiles.push(profile);
  await writeDb(db);

  res.json({ success: true, profile });
});

// PUT /api/cf-profiles/:id — Cập nhật profile
app.put('/api/cf-profiles/:id', async (req, res) => {
  const { id } = req.params;
  let { name, accountId, authType, apiKey, email, apiToken } = req.body;

  const db = await readDb();
  if (!db.cfProfiles) db.cfProfiles = [];

  const profile = db.cfProfiles.find(p => p.id === id);
  if (!profile) {
    return res.status(404).json({ error: 'Profile không tồn tại.' });
  }

  // Auto-detect token
  if (apiKey && apiKey.trim().startsWith('cfut_')) {
    apiToken = apiKey.trim();
    apiKey = '';
    email = '';
    authType = 'token';
  }

  if (accountId) {
    accountId = accountId.replace(/^\/+|\/+$/g, '').trim();
  }

  if (name) profile.name = name.trim();
  if (accountId !== undefined) profile.accountId = accountId;
  if (authType) profile.authType = authType;
  if (apiKey !== undefined) profile.apiKey = apiKey;
  if (email !== undefined) profile.email = email;
  if (apiToken !== undefined) profile.apiToken = apiToken;

  await writeDb(db);
  res.json({ success: true, profile });
});

// DELETE /api/cf-profiles/:id — Xóa profile
app.delete('/api/cf-profiles/:id', async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  if (!db.cfProfiles) db.cfProfiles = [];

  const idx = db.cfProfiles.findIndex(p => p.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Profile không tồn tại.' });
  }

  // Check if profile is in use
  const inUse = (db.sites || []).filter(s => s.cfProfileId === id).length;
  if (inUse > 0) {
    return res.status(400).json({ error: `Profile đang được dùng bởi ${inUse} website. Không thể xóa.` });
  }

  db.cfProfiles.splice(idx, 1);
  await writeDb(db);
  res.json({ success: true });
});

// ============================================================
// TEMPLATES API
// ============================================================
app.get('/api/templates', async (req, res) => {
  const templates = [
    {
      id: 'ngo-quyen',
      name: 'Cổng thông tin trường học',
      description: 'Trang tin tức tiếng Việt, phù hợp cho trường học, cơ quan hành chính, tổ chức giáo dục.',
      thumbnail: '/themes/ngo-quyen.png',
      tags: ['Tiếng Việt', 'Tin tức', 'Giáo dục'],
      color: '#1a56a0'
    },
    {
      id: 'commandcode',
      name: 'Tech Landing Page',
      description: 'Landing page tiếng Anh phong cách hiện đại tối màu, dành cho sản phẩm công nghệ, SaaS.',
      thumbnail: '/themes/commandcode.png',
      tags: ['Tiếng Anh', 'Tech', 'SaaS'],
      color: '#7c3aed'
    },
    {
      id: 'korean-news',
      name: 'Báo điện tử Hàn Quốc',
      description: 'Portal tin tức tiếng Hàn chuyên nghiệp với đầy đủ chuyên mục và tích hợp nội dung tự động.',
      thumbnail: '/themes/korean-news.png',
      tags: ['Tiếng Hàn', 'Tin tức', 'Portal'],
      color: '#c0392b'
    }
  ];
  res.json(templates);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

