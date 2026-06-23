import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DB_FILE = path.join(process.cwd(), 'db.json');
const LOGS_DIR = path.join(process.cwd(), 'logs');
const SITES_DIR = path.join(process.cwd(), 'sites');
const TEMPLATE_DIR = path.join(process.cwd(), 'templates', 'ngo-quyen');

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
function runCommand(command, args, options, siteName) {
  return new Promise((resolve, reject) => {
    writeLog(siteName, `Running: ${command} ${args.join(' ')}\n`);
    
    const child = spawn(command, args, {
      ...options,
      shell: true
    });

    child.stdout.on('data', (data) => {
      writeLog(siteName, data.toString());
    });

    child.stderr.on('data', (data) => {
      writeLog(siteName, data.toString());
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command "${command} ${args.join(' ')}" failed with exit code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
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
  const { name, template, apiKey, email, apiToken, accountId } = req.body;

  if (!name || !/^[a-z0-9-]+$/.test(name)) {
    return res.status(400).json({ error: 'Invalid site name. Use lowercase, numbers, and hyphens only.' });
  }

  if (!accountId) {
    return res.status(400).json({ error: 'Cloudflare Account ID is required.' });
  }

  const db = await readDb();
  if (db.sites.find(s => s.name === name && s.status === 'deploying')) {
    return res.status(400).json({ error: 'This site is currently deploying.' });
  }

  // Check if site already exists
  let site = db.sites.find(s => s.name === name);
  const chosenTemplate = template || (site && site.template) || 'ngo-quyen';

  if (!site) {
    site = {
      name,
      template: chosenTemplate,
      status: 'deploying',
      deployUrl: '',
      databaseId: '',
      databaseName: `${name}-db`,
      bucketName: `${name}-bucket`,
      createdAt: new Date().toISOString(),
      accountId: accountId || '',
      apiKey: apiKey || '',
      email: email || '',
      apiToken: apiToken || ''
    };
    db.sites.push(site);
  } else {
    site.status = 'deploying';
    site.template = chosenTemplate;
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
    accountId: site.accountId || accountId || ''
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

  // Delete Worker Project
  try {
    console.log(`Deleting Worker project ${site.name}`);
    await runCommand('npx', ['wrangler', 'delete', '--name', site.name, '--skip-confirmation'], envOptions, site.name);
  } catch (e) {
    console.error(`Worker deletion failed:`, e);
  }
}

// Background deployment orchestrator
async function deploySite(siteName, creds) {
  const logFilePath = path.join(LOGS_DIR, `${siteName}.log`);
  // Reset logs
  await fs.writeFile(logFilePath, '', 'utf8');

  await writeLog(siteName, `=== DEPLOYMENT START FOR WEBSITE: ${siteName} ===\n`);

  const templateName = creds.template || 'ngo-quyen';
  const templatePath = path.join(process.cwd(), 'templates', templateName);

  const envOptions = {
    cwd: path.join(SITES_DIR, siteName),
    env: getCloudflareEnv(creds)
  };

  // 1. Check if template node_modules exists
  const templateModules = path.join(templatePath, 'node_modules');
  if (!existsSync(templateModules)) {
    await writeLog(siteName, `Template node_modules not found. Installing dependencies in template first...\n`);
    await runCommand('npm', ['install'], { cwd: templatePath }, siteName);
  }

  // 2. Clone Next.js source code to site directory
  await writeLog(siteName, `Copying template files to sites/${siteName}...\n`);
  const sitePath = path.join(SITES_DIR, siteName);
  if (existsSync(sitePath)) {
    await fs.rm(sitePath, { recursive: true, force: true });
  }
  await copyDir(templatePath, sitePath);

  // 3. Install dependencies in the site directory
  await writeLog(siteName, `Installing site dependencies (npm install)...\n`);
  await runCommand('npm', ['install'], envOptions, siteName);

  // 4. Provision D1 database
  await writeLog(siteName, `Checking/Creating Cloudflare D1 database...\n`);
  let dbId = null;
  const dbName = `${siteName}-db`;

  try {
    let createOutput = '';
    await runCommand('npx', ['wrangler', 'd1', 'create', dbName], envOptions, siteName);
    
    // Read the log file to parse database_id (since runCommand writes to log file)
    const currentLogs = await fs.readFile(logFilePath, 'utf8');
    const match = currentLogs.match(/database_id\s*=\s*"([^"]+)"/);
    if (match) {
      dbId = match[1];
    }
  } catch (err) {
    await writeLog(siteName, `D1 create command returned error (db may already exist). Searching database list...\n`);
  }

  if (!dbId) {
    // Search list for existing DB
    dbId = await findExistingD1Database(dbName, envOptions, siteName);
  }

  if (!dbId) {
    throw new Error(`Failed to configure D1 database ${dbName}`);
  }

  await writeLog(siteName, `Configured D1 Database: ID = ${dbId}\n`);

  // Execute schema.sql on the remote D1 database directly using wrangler to bypass DNS propagation issues
  await writeLog(siteName, `Executing schema.sql on D1 database directly...\n`);
  try {
    await runCommand('npx', ['wrangler', 'd1', 'execute', dbName, '--remote', '--file=schema.sql'], envOptions, siteName);
    await writeLog(siteName, `D1 database schema executed successfully.\n`);
  } catch (schemaErr) {
    await writeLog(siteName, `WARNING: Direct schema execution failed: ${schemaErr.message}. Custom tables will attempt to initialize on worker load.\n`);
  }

  // 5. Provision R2 bucket
  await writeLog(siteName, `Checking/Creating Cloudflare R2 bucket...\n`);
  const bucketName = `${siteName}-bucket`;
  let hasR2 = true;
  try {
    await runCommand('npx', ['wrangler', 'r2', 'bucket', 'create', bucketName], envOptions, siteName);
  } catch (err) {
    const currentLogs = await fs.readFile(logFilePath, 'utf8');
    if (currentLogs.includes('Please enable R2') || currentLogs.includes('10042')) {
      hasR2 = false;
      await writeLog(siteName, `WARNING: R2 is not enabled on this Cloudflare account. Disabling R2 bucket binding in wrangler.toml to allow deployment...\n`);
    } else {
      await writeLog(siteName, `R2 bucket may already exist or create failed: ${err.message}. Proceeding with binding...\n`);
    }
  }

  // 6. Write custom wrangler.toml
  await writeLog(siteName, `Writing custom wrangler.toml...\n`);
  let wranglerTomlContent = `name = "${siteName}"
main = ".open-next/worker.js"
compatibility_date = "2025-06-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = ".open-next/assets"
binding = "ASSETS"

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

  // Inject credentials as environment variables in Cloudflare production environment
  wranglerTomlContent += `
[vars]
CLOUDFLARE_ACCOUNT_ID = "${creds.accountId || ''}"
CLOUDFLARE_EMAIL = "${creds.email || ''}"
CLOUDFLARE_API_KEY = "${creds.apiKey || ''}"
CLOUDFLARE_API_TOKEN = "${creds.apiToken || ''}"
`;

  await fs.writeFile(path.join(sitePath, 'wrangler.toml'), wranglerTomlContent, 'utf8');

  // Also write .env file locally in the site directory so local next.js builds have access
  const siteEnvContent = `CLOUDFLARE_ACCOUNT_ID=${creds.accountId || ''}
CLOUDFLARE_API_KEY=${creds.apiKey || ''}
CLOUDFLARE_EMAIL=${creds.email || ''}
CLOUDFLARE_API_TOKEN=${creds.apiToken || ''}
`;
  await fs.writeFile(path.join(sitePath, '.env'), siteEnvContent, 'utf8');

  // 7. Build using OpenNext
  await writeLog(siteName, `Building project with OpenNext...\n`);
  await runCommand('npm', ['run', 'build:cf'], envOptions, siteName);

  // 8. Deploy to Cloudflare Workers & Pages
  await writeLog(siteName, `Deploying worker to Cloudflare...\n`);
  await runCommand('npx', ['wrangler', 'deploy'], envOptions, siteName);

  // 9. Extract deploy URL
  const deployLogs = await fs.readFile(logFilePath, 'utf8');
  // Match standard workers deployment URL
  const urlMatch = deployLogs.match(/https:\/\/[a-zA-Z0-9.-]+\.workers\.dev/);
  const deployUrl = urlMatch ? urlMatch[0] : `https://${siteName}.${creds.accountId}.workers.dev`;

  // 10. Automatically initialize and seed the database using Next.js backend API
  await writeLog(siteName, `Initializing D1 database schema and seeding default admin users...\n`);
  try {
    const initRes = await fetch(`${deployUrl}/api/admin/init`);
    const initData = await initRes.json();
    if (initRes.ok && initData.success) {
      await writeLog(siteName, `D1 database successfully initialized and seeded: ${initData.message}\n`);
    } else {
      await writeLog(siteName, `D1 database initialization warning: ${initData.error || 'Unknown error'}\n`);
    }
  } catch (initErr) {
    await writeLog(siteName, `Failed to call database init API: ${initErr.message}. You can manually initialize the DB by visiting ${deployUrl}/api/admin/init in your browser.\n`);
  }

  await writeLog(siteName, `=== DEPLOYMENT SUCCESSFUL ===\nDeployed URL: ${deployUrl}\n`);

  // Update DB entry
  const currentDb = await readDb();
  const siteEntry = currentDb.sites.find(s => s.name === siteName);
  if (siteEntry) {
    siteEntry.status = 'active';
    siteEntry.deployUrl = deployUrl;
    siteEntry.databaseId = dbId;
    await writeDb(currentDb);
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
  const { accountId, apiKey, email, apiToken } = req.body;

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

