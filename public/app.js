// App configuration & state
let sites = [];
let activeLogEventSource = null;
let activeLogSiteName = '';

// DOM Elements
const createModal = document.getElementById('create-modal');
const logModal = document.getElementById('log-modal');
const deleteModal = document.getElementById('delete-modal');
const settingsModal = document.getElementById('settings-modal');
const settingsForm = document.getElementById('settings-form');

const btnOpenModal = document.getElementById('btn-open-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelModal = document.getElementById('btn-cancel-modal');

const btnCloseLog = document.getElementById('btn-close-log');
const btnCloseLogFooter = document.getElementById('btn-close-log-footer');
const btnClearLog = document.getElementById('btn-clear-log');

const btnCloseDelete = document.getElementById('btn-close-delete');
const btnCancelDelete = document.getElementById('btn-cancel-delete');
const btnConfirmDelete = document.getElementById('btn-confirm-delete');

const createSiteForm = document.getElementById('create-site-form');
const cfAuthTypeSelect = document.getElementById('cf-auth-type');
const cfAccountIdInput = document.getElementById('cf-account-id');
const cfApiKeyInput = document.getElementById('cf-api-key');
const cfEmailInput = document.getElementById('cf-email');
const cfApiTokenInput = document.getElementById('cf-api-token');

const groupApiKey = document.getElementById('group-api-key');
const groupEmail = document.getElementById('group-email');
const groupApiToken = document.getElementById('group-api-token');

// Credentials Modal Elements
const credentialsModal = document.getElementById('credentials-modal');
const credsForm = document.getElementById('creds-form');
const credsAuthTypeSelect = document.getElementById('creds-auth-type');
const credsAccountIdInput = document.getElementById('creds-account-id');
const credsApiKeyInput = document.getElementById('creds-api-key');
const credsEmailInput = document.getElementById('creds-email');
const credsApiTokenInput = document.getElementById('creds-api-token');

const credsGroupApiKey = document.getElementById('creds-group-api-key');
const credsGroupEmail = document.getElementById('creds-group-email');
const credsGroupApiToken = document.getElementById('creds-group-api-token');

const btnCloseCreds = document.getElementById('btn-close-creds');
const btnCancelCreds = document.getElementById('btn-cancel-creds');

const sitesGrid = document.getElementById('sites-grid');
const searchInput = document.getElementById('search-input');
const emptyState = document.getElementById('empty-state');

// Stats elements
const statTotal = document.getElementById('stat-total');
const statActive = document.getElementById('stat-active');
const statDeploying = document.getElementById('stat-deploying');
const statFailed = document.getElementById('stat-failed');

// Terminal elements
const terminalContent = document.getElementById('terminal-content');
const logSiteNameText = document.getElementById('log-site-name');
const logStatusBadge = document.getElementById('log-status-badge');

// Delete elements
const deleteSiteNameText = document.getElementById('delete-site-name-text');
const deleteCfResourcesCheckbox = document.getElementById('delete-cf-resources');
let siteToDelete = '';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  loadCachedCredentials();
  toggleCredsFields();
  fetchSites();
  // Poll sites status every 5 seconds to keep status updated
  setInterval(fetchSites, 5000);
});

// Setup Event Listeners
function setupEventListeners() {
  // Modal open/close
  btnOpenModal.addEventListener('click', () => {
    createSiteForm.reset();
    loadCachedCredentials();
    toggleCredsFields();
    createModal.classList.add('open');
  });

  btnCloseModal.addEventListener('click', () => createModal.classList.remove('open'));
  btnCancelModal.addEventListener('click', () => createModal.classList.remove('open'));

  // Close log modal
  btnCloseLog.addEventListener('click', closeLogConsole);
  btnCloseLogFooter.addEventListener('click', closeLogConsole);
  btnClearLog.addEventListener('click', () => {
    terminalContent.textContent = '';
  });

  // Delete modal triggers
  btnCloseDelete.addEventListener('click', () => deleteModal.classList.remove('open'));
  btnCancelDelete.addEventListener('click', () => deleteModal.classList.remove('open'));
  btnConfirmDelete.addEventListener('click', executeDeleteSite);

  // Settings modal triggers
  document.getElementById('btn-close-settings').addEventListener('click', () => settingsModal.classList.remove('open'));
  document.getElementById('btn-cancel-settings').addEventListener('click', () => settingsModal.classList.remove('open'));
  settingsForm.addEventListener('submit', handleSettingsFormSubmit);

  // Toggle credential fields on auth type change
  cfAuthTypeSelect.addEventListener('change', toggleCredsFields);

  // Search filter
  searchInput.addEventListener('input', renderSites);

  // Create Form Submit
  createSiteForm.addEventListener('submit', handleFormSubmit);

  // Credentials Modal Triggers
  btnCloseCreds.addEventListener('click', closeCredentialsModal);
  btnCancelCreds.addEventListener('click', closeCredentialsModal);
  credsForm.addEventListener('submit', handleCredsFormSubmit);
  credsAuthTypeSelect.addEventListener('change', toggleEditCredsFields);
}

// Load credentials from browser localStorage
function loadCachedCredentials() {
  const cachedAccountId = localStorage.getItem('last_cf_account_id');
  const cachedAuthType = localStorage.getItem('last_cf_auth_type');
  const cachedApiKey = localStorage.getItem('last_cf_api_key');
  const cachedEmail = localStorage.getItem('last_cf_email');
  const cachedApiToken = localStorage.getItem('last_cf_api_token');

  if (cachedAccountId) cfAccountIdInput.value = cachedAccountId;
  if (cachedAuthType) cfAuthTypeSelect.value = cachedAuthType;
  if (cachedApiKey) cfApiKeyInput.value = cachedApiKey;
  if (cachedEmail) cfEmailInput.value = cachedEmail;
  if (cachedApiToken) cfApiTokenInput.value = cachedApiToken;
}

// Save credentials to browser localStorage
function saveCachedCredentials(accountId, authType, apiKey, email, apiToken) {
  localStorage.setItem('last_cf_account_id', accountId || '');
  localStorage.setItem('last_cf_auth_type', authType || 'key');
  localStorage.setItem('last_cf_api_key', apiKey || '');
  localStorage.setItem('last_cf_email', email || '');
  localStorage.setItem('last_cf_api_token', apiToken || '');
}

// Toggle Credential fields based on selections
function toggleCredsFields() {
  cfAccountIdInput.disabled = false;
  cfAuthTypeSelect.disabled = false;
  cfApiKeyInput.disabled = false;
  cfEmailInput.disabled = false;
  cfApiTokenInput.disabled = false;

  if (cfAuthTypeSelect.value === 'key') {
    groupApiKey.classList.remove('d-none');
    groupEmail.classList.remove('d-none');
    groupApiToken.classList.add('d-none');
    
    cfApiKeyInput.required = true;
    cfEmailInput.required = true;
    cfApiTokenInput.required = false;
  } else {
    groupApiKey.classList.add('d-none');
    groupEmail.classList.add('d-none');
    groupApiToken.classList.remove('d-none');
    
    cfApiKeyInput.required = false;
    cfEmailInput.required = false;
    cfApiTokenInput.required = true;
  }
}

// Toggle edit credentials fields in edit modal
function toggleEditCredsFields() {
  credsAccountIdInput.disabled = false;
  credsAuthTypeSelect.disabled = false;
  credsApiKeyInput.disabled = false;
  credsEmailInput.disabled = false;
  credsApiTokenInput.disabled = false;

  if (credsAuthTypeSelect.value === 'key') {
    credsGroupApiKey.classList.remove('d-none');
    credsGroupEmail.classList.remove('d-none');
    credsGroupApiToken.classList.add('d-none');
    
    credsApiKeyInput.required = true;
    credsEmailInput.required = true;
    credsApiTokenInput.required = false;
  } else {
    credsGroupApiKey.classList.add('d-none');
    credsGroupEmail.classList.add('d-none');
    credsGroupApiToken.classList.remove('d-none');
    
    credsApiKeyInput.required = false;
    credsEmailInput.required = false;
    credsApiTokenInput.required = true;
  }
}

// Fetch sites list from API
async function fetchSites() {
  try {
    const res = await fetch('/api/sites');
    const data = await res.json();
    sites = data;
    renderSites();
    updateStats();
    
    // If our active logging site status changed, update the console status badge
    if (activeLogSiteName) {
      const activeSite = sites.find(s => s.name === activeLogSiteName);
      if (activeSite) {
        updateConsoleStatusBadge(activeSite.status);
      }
    }
  } catch (err) {
    console.error('Error fetching sites:', err);
  }
}

// Update UI metrics cards
function updateStats() {
  statTotal.textContent = sites.length;
  statActive.textContent = sites.filter(s => s.status === 'active').length;
  statDeploying.textContent = sites.filter(s => s.status === 'deploying').length;
  statFailed.textContent = sites.filter(s => s.status === 'failed').length;
}

// Render dynamic website card grid
function renderSites() {
  const query = searchInput.value.toLowerCase().trim();
  const filtered = sites.filter(s => s.name.toLowerCase().includes(query));

  // Clear previous cards, keeping emptyState template
  const cards = sitesGrid.querySelectorAll('.site-card');
  cards.forEach(c => c.remove());

  if (filtered.length === 0) {
    emptyState.classList.remove('d-none');
    return;
  }

  emptyState.classList.add('d-none');

  filtered.forEach(site => {
    const card = document.createElement('div');
    card.className = `site-card status-${site.status}`;
    
    // Format timestamp
    const date = new Date(site.createdAt).toLocaleDateString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });

    const statusBadgeText = {
      'active': 'Hoạt động',
      'deploying': 'Đang triển khai',
      'failed': 'Thất bại'
    }[site.status] || site.status;

    card.innerHTML = `
      <div class="card-top">
        <div class="card-title">
          <h3>${site.name}</h3>
          <div class="card-date">Tạo ngày: ${date}</div>
        </div>
        <span class="badge badge-${site.status}">${statusBadgeText}</span>
      </div>

      <div class="card-meta">
        <div class="meta-row">
          <span class="meta-label">Deploy URL:</span>
          ${site.status === 'active' 
            ? `<a href="${site.deployUrl}" target="_blank" class="deploy-link">${site.deployUrl} ↗</a>` 
            : `<span class="meta-value">—</span>`}
        </div>
        <div class="meta-row">
          <span class="meta-label">D1 Database:</span>
          <span class="meta-value" title="${site.databaseId || ''}">${site.databaseId ? `${site.databaseName} (${site.databaseId})` : '—'}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">R2 Bucket:</span>
          <span class="meta-value">${site.bucketName || '—'}</span>
        </div>
      </div>

      <div class="card-actions">
        <button class="btn btn-secondary btn-sm" onclick="openLogConsole('${site.name}')">🔎 Xem Log</button>
        <button class="btn btn-secondary btn-sm" onclick="openCredentialsModal('${site.name}')">🔑 Cloudflare Key</button>
        <button class="btn btn-secondary btn-sm" onclick="openSettingsModal('${site.name}')" ${site.status !== 'active' ? 'disabled' : ''}>⚙️ Cấu hình</button>
        <button class="btn btn-secondary btn-sm" onclick="openApiKeysModal('${site.name}')" ${site.status !== 'active' ? 'disabled' : ''}>🔑 API Keys</button>
        <button class="btn btn-secondary btn-sm" onclick="triggerRedeploy('${site.name}')" ${site.status === 'deploying' ? 'disabled' : ''}>🔄 Re-deploy</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteSite('${site.name}')" ${site.status === 'deploying' ? 'disabled' : ''}>🗑️ Xóa</button>
      </div>
    `;
    sitesGrid.appendChild(card);
  });
}

// Create new site form handler
async function handleFormSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('site-name').value.trim();
  const template = document.getElementById('site-template').value;
  const authType = cfAuthTypeSelect.value;
  
  // Sanitize accountId (remove leading/trailing slashes, spaces)
  const rawAccountId = cfAccountIdInput.value.trim();
  const accountId = rawAccountId.replace(/^\/+|\/+$/g, '').trim();
  
  const apiKey = authType === 'key' ? cfApiKeyInput.value.trim() : '';
  const email = authType === 'key' ? cfEmailInput.value.trim() : '';
  const apiToken = authType === 'token' ? cfApiTokenInput.value.trim() : '';

  // Validate Google API Key copy-paste error
  if (authType === 'key' && apiKey.startsWith('AIza')) {
    alert('Lỗi: Khóa bạn nhập bắt đầu bằng "AIza" - đây là Google API Key (không phải Cloudflare API Key). Vui lòng lấy đúng Global API Key từ Cloudflare Dashboard (My Profile > API Tokens > Global API Key).');
    return;
  }

  // Validate API Token entered in Global API Key field
  if (authType === 'key' && apiKey.startsWith('cfut_')) {
    alert('Lỗi: Khóa bạn nhập bắt đầu bằng "cfut_" - đây là Cloudflare API Token chứ không phải Global API Key. Vui lòng đổi "Loại xác thực" thành "Scoped API Token" và nhập khóa này vào trường "API Token".');
    return;
  }

  const creds = {
    name,
    template,
    accountId,
    apiKey,
    email,
    apiToken
  };

  // Save to cache
  saveCachedCredentials(accountId, authType, apiKey, email, apiToken);

  const btnSubmit = document.getElementById('btn-submit-create');
  const loader = btnSubmit.querySelector('.btn-loader');
  
  btnSubmit.disabled = true;
  loader.classList.remove('d-none');

  try {
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds)
    });

    const data = await res.json();
    if (res.ok) {
      createModal.classList.remove('open');
      fetchSites();
      // Instantly open the log console for the newly deploying website
      openLogConsole(name);
    } else {
      alert(`Lỗi: ${data.error}`);
    }
  } catch (err) {
    alert(`Không thể gửi yêu cầu: ${err.message}`);
  } finally {
    btnSubmit.disabled = false;
    loader.classList.add('d-none');
  }
}

// Redeploy existing site using saved credentials
function triggerRedeploy(siteName) {
  const site = sites.find(s => s.name === siteName);
  if (!site) {
    alert('Không tìm thấy thông tin website.');
    return;
  }

  const creds = {
    name: siteName,
    accountId: site.accountId || '',
    apiKey: site.apiKey || '',
    email: site.email || '',
    apiToken: site.apiToken || ''
  };

  fetch('/api/sites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds)
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert(`Lỗi redeploy: ${data.error}`);
    } else {
      fetchSites();
      openLogConsole(siteName);
    }
  })
  .catch(err => {
    alert(`Không thể redeploy: ${err.message}`);
  });
}

// Open Live Log Console
function openLogConsole(siteName) {
  activeLogSiteName = siteName;
  logSiteNameText.textContent = `Website: ${siteName}`;
  terminalContent.textContent = 'Đang tải log...';
  
  const siteObj = sites.find(s => s.name === siteName);
  updateConsoleStatusBadge(siteObj ? siteObj.status : 'deploying');
  
  logModal.classList.add('open');

  // Close existing EventSource if active
  if (activeLogEventSource) {
    activeLogEventSource.close();
  }

  // Subscribe to Server Sent Events for log streaming
  activeLogEventSource = new EventSource(`/api/sites/${siteName}/logs`);

  activeLogEventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.isHistory) {
      terminalContent.textContent = data.message;
    } else {
      if (terminalContent.textContent === 'Đang tải log...') {
        terminalContent.textContent = '';
      }
      terminalContent.textContent += data.message;
    }
    
    // Auto scroll to bottom
    terminalContent.scrollTop = terminalContent.scrollHeight;
  };

  activeLogEventSource.onerror = (err) => {
    console.error('SSE Connection error:', err);
    logStatusBadge.textContent = 'Mất kết nối log';
    logStatusBadge.className = 'badge badge-failed';
    activeLogEventSource.close();
  };
}

function updateConsoleStatusBadge(status) {
  logStatusBadge.textContent = {
    'active': 'Hoạt động thành công',
    'deploying': 'Đang build & deploy',
    'failed': 'Thất bại'
  }[status] || status;
  
  logStatusBadge.className = `badge badge-${status}`;
}

// Close Log Console
function closeLogConsole() {
  if (activeLogEventSource) {
    activeLogEventSource.close();
    activeLogEventSource = null;
  }
  activeLogSiteName = '';
  logModal.classList.remove('open');
}

// Delete site prompt modal
function confirmDeleteSite(siteName) {
  siteToDelete = siteName;
  deleteSiteNameText.textContent = siteName;
  deleteCfResourcesCheckbox.checked = true;
  deleteModal.classList.add('open');
}

// Perform site deletion API call
async function executeDeleteSite() {
  if (!siteToDelete) return;

  const deleteCf = deleteCfResourcesCheckbox.checked;
  btnConfirmDelete.disabled = true;
  btnConfirmDelete.textContent = 'Đang xóa...';

  const site = sites.find(s => s.name === siteToDelete);
  const accountId = site ? (site.accountId || '') : '';
  const apiKey = site ? (site.apiKey || '') : '';
  const email = site ? (site.email || '') : '';
  const apiToken = site ? (site.apiToken || '') : '';

  try {
    const res = await fetch(`/api/sites/${siteToDelete}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deleteCloudflareResources: deleteCf,
        accountId,
        apiKey,
        email,
        apiToken
      })
    });

    if (res.ok) {
      deleteModal.classList.remove('open');
      fetchSites();
    } else {
      const data = await res.json();
      alert(`Lỗi khi xóa: ${data.error}`);
    }
  } catch (err) {
    alert(`Lỗi mạng: ${err.message}`);
  } finally {
    btnConfirmDelete.disabled = false;
    btnConfirmDelete.textContent = 'Xác nhận Xóa';
    siteToDelete = '';
  }
}

// Settings modal state
let activeSettingsSiteName = '';

// Open Settings Modal & load data
async function openSettingsModal(siteName) {
  activeSettingsSiteName = siteName;
  document.getElementById('settings-site-name-text').textContent = `Website: ${siteName}`;
  
  // Clear previous values
  document.getElementById('settings-main-title').value = '';
  document.getElementById('settings-upper-title').value = '';
  document.getElementById('settings-description').value = '';
  document.getElementById('settings-seo-title').value = '';
  document.getElementById('settings-seo-description').value = '';
  document.getElementById('settings-logo-url').value = '';
  document.getElementById('settings-banner-url').value = '';

  settingsModal.classList.add('open');

  try {
    const res = await fetch(`/api/sites/${siteName}/settings`);
    if (!res.ok) throw new Error('Không thể tải cấu hình từ D1');
    const data = await res.json();
    
    document.getElementById('settings-main-title').value = data.header_main_title || '';
    document.getElementById('settings-upper-title').value = data.header_upper_title || '';
    document.getElementById('settings-description').value = data.header_description || '';
    document.getElementById('settings-seo-title').value = data.homepage_seo_title || '';
    document.getElementById('settings-seo-description').value = data.homepage_seo_description || '';
    document.getElementById('settings-logo-url').value = data.header_logo_url || '';
    document.getElementById('settings-banner-url').value = data.header_banner_url || '';
  } catch (err) {
    alert(`Lỗi khi tải cấu hình: ${err.message}`);
    settingsModal.classList.remove('open');
  }
}

// Handle settings submission
async function handleSettingsFormSubmit(e) {
  e.preventDefault();

  const body = {
    header_main_title: document.getElementById('settings-main-title').value.trim(),
    header_upper_title: document.getElementById('settings-upper-title').value.trim(),
    header_description: document.getElementById('settings-description').value.trim(),
    homepage_seo_title: document.getElementById('settings-seo-title').value.trim(),
    homepage_seo_description: document.getElementById('settings-seo-description').value.trim(),
    header_logo_url: document.getElementById('settings-logo-url').value.trim(),
    header_banner_url: document.getElementById('settings-banner-url').value.trim()
  };

  const btnSubmit = document.getElementById('btn-submit-settings');
  const loader = btnSubmit.querySelector('.btn-loader');
  
  btnSubmit.disabled = true;
  loader.classList.remove('d-none');

  try {
    const res = await fetch(`/api/sites/${activeSettingsSiteName}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (res.ok) {
      alert('Cấu hình Website đã được cập nhật thành công lên Cloudflare D1!');
      settingsModal.classList.remove('open');
    } else {
      alert(`Lỗi: ${data.error}`);
    }
  } catch (err) {
    alert(`Lỗi mạng: ${err.message}`);
  } finally {
    btnSubmit.disabled = false;
    loader.classList.add('d-none');
  }
}

// ── API Key Management Logic ──────────────────────────────────────────────
let activeApiSiteName = '';
const apiModal = document.getElementById('api-modal');
const createApiKeyForm = document.getElementById('create-api-key-form');
const apiKeysTableBody = document.getElementById('api-keys-table-body');
const newKeyRevealBox = document.getElementById('new-key-reveal-box');
const generatedKeyDisplay = document.getElementById('generated-key-display');

// Attach listeners for closing API Modal
document.getElementById('btn-close-api').addEventListener('click', closeApiModal);
document.getElementById('btn-close-api-footer').addEventListener('click', closeApiModal);
createApiKeyForm.addEventListener('submit', handleCreateApiKey);

async function openApiKeysModal(siteName) {
  activeApiSiteName = siteName;
  document.getElementById('api-site-name-text').textContent = `Website: ${siteName}`;
  
  // Reset forms & display states
  createApiKeyForm.reset();
  newKeyRevealBox.classList.add('d-none');
  generatedKeyDisplay.value = '';
  
  // Set default active tab
  switchApiTab('manage-keys');
  
  // Open modal
  apiModal.classList.add('open');
  
  // Fetch active keys
  await fetchApiKeys();

  // Dynamically populate example scripts with the site's actual URL
  const siteObj = sites.find(s => s.name === siteName);
  const rawUrl = siteObj && siteObj.deployUrl ? siteObj.deployUrl : `https://${siteName}.zhenfai.workers.dev`;
  // Clean URL schema for display
  const cleanedUrl = rawUrl.replace(/^https?:\/\//, '');

  updateCodeExamples(cleanedUrl);
}

function closeApiModal() {
  activeApiSiteName = '';
  apiModal.classList.remove('open');
}

async function fetchApiKeys() {
  if (!activeApiSiteName) return;

  apiKeysTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Đang tải danh sách khóa API...</td></tr>';

  try {
    const res = await fetch(`/api/sites/${activeApiSiteName}/api-keys`);
    if (!res.ok) throw new Error('Không thể kết nối API máy chủ');
    const keys = await res.json();

    if (keys.length === 0) {
      apiKeysTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">Chưa có khóa API nào được tạo.</td></tr>';
      return;
    }

    apiKeysTableBody.innerHTML = '';
    keys.forEach(k => {
      const date = new Date(k.created_at).toLocaleDateString('vi-VN', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      });

      // Mask key for safety (e.g. wp_abcd_****_****_****)
      const parts = k.api_key.split('_');
      const maskedKey = parts.length > 1 ? `${parts[0]}_${parts[1]}_****_****` : 'wp_****_****';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(k.name)}</strong></td>
        <td><code style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">${escapeHtml(k.username || 'admin')}</code></td>
        <td><code style="font-family: var(--font-mono); color: var(--text-secondary);">${maskedKey}</code></td>
        <td>${date}</td>
        <td style="text-align: right;">
          <button class="btn btn-danger btn-xs" onclick="handleDeleteApiKey(${k.id})" style="padding: 4px 8px; font-size: 11px;">🗑️ Xóa</button>
        </td>
      `;
      apiKeysTableBody.appendChild(tr);
    });
  } catch (err) {
    apiKeysTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Lỗi tải danh sách: ${err.message}</td></tr>`;
  }
}

async function handleCreateApiKey(e) {
  e.preventDefault();
  
  const label = document.getElementById('api-key-label').value.trim();
  const username = document.getElementById('api-key-user').value;
  const btnSubmit = document.getElementById('btn-submit-api-key');

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Đang tạo...';

  try {
    const res = await fetch(`/api/sites/${activeApiSiteName}/api-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, username })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      // Display the generated secret key to the user
      generatedKeyDisplay.value = data.api_key;
      newKeyRevealBox.classList.remove('d-none');
      
      // Clear description box
      document.getElementById('api-key-label').value = '';
      
      // Refresh key table
      await fetchApiKeys();
    } else {
      alert(`Lỗi tạo khóa API: ${data.error}`);
    }
  } catch (err) {
    alert(`Lỗi mạng: ${err.message}`);
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Tạo Key';
  }
}

async function handleDeleteApiKey(keyId) {
  if (!confirm('Bạn có chắc chắn muốn xóa khóa API này? Các hệ thống sử dụng khóa này sẽ bị ngắt kết nối ngay lập tức.')) {
    return;
  }

  try {
    const res = await fetch(`/api/sites/${activeApiSiteName}/api-keys/${keyId}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      await fetchApiKeys();
    } else {
      const data = await res.json();
      alert(`Lỗi khi xóa: ${data.error}`);
    }
  } catch (err) {
    alert(`Lỗi mạng: ${err.message}`);
  }
}

// Switch tabs inside API modal
function switchApiTab(tabId) {
  const tabs = ['manage-keys', 'api-examples'];
  tabs.forEach(t => {
    const content = document.getElementById(`tab-${t}`);
    const btn = document.querySelector(`.tab-btn[onclick*="switchApiTab('${t}')"]`);
    
    if (t === tabId) {
      content.classList.remove('d-none');
      if (btn) btn.classList.add('active');
    } else {
      content.classList.add('d-none');
      if (btn) btn.classList.remove('active');
    }
  });
}
window.switchApiTab = switchApiTab;

// Switch example code block languages
function switchExampleLang(lang) {
  const langs = ['curl', 'js', 'python'];
  langs.forEach(l => {
    const codeBox = document.getElementById(`code-box-${l}`);
    const btn = document.getElementById(`btn-ex-${l}`);
    
    if (l === lang) {
      codeBox.classList.remove('d-none');
      if (btn) btn.classList.add('active');
    } else {
      codeBox.classList.add('d-none');
      if (btn) btn.classList.remove('active');
    }
  });
}
window.switchExampleLang = switchExampleLang;

// Copy functions
function copyGeneratedApiKey() {
  generatedKeyDisplay.select();
  generatedKeyDisplay.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(generatedKeyDisplay.value);
  
  const btn = document.getElementById('btn-copy-key');
  btn.textContent = '✅ Đã chép!';
  setTimeout(() => {
    btn.textContent = '📋 Sao chép';
  }, 2000);
}
window.copyGeneratedApiKey = copyGeneratedApiKey;

function copyCodeContent(elementId) {
  const codeText = document.getElementById(elementId).textContent;
  navigator.clipboard.writeText(codeText);
  
  const btn = document.querySelector(`.code-box-wrapper:not(.d-none) .btn-copy-code`);
  const originalText = btn.textContent;
  btn.textContent = 'Đã chép! ✅';
  setTimeout(() => {
    btn.textContent = originalText;
  }, 2000);
}
window.copyCodeContent = copyCodeContent;

// Helper to escape HTML characters
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Bind handleDeleteApiKey globally for dynamic onclick handling
window.handleDeleteApiKey = handleDeleteApiKey;

function updateCodeExamples(siteUrl) {
  // cURL
  document.getElementById('code-curl-text').textContent = `# 1. Lấy danh sách bài viết (Công khai)
curl -X GET "https://${siteUrl}/wp-json/wp/v2/posts"

# 2. Đăng bài viết mới (Cần Xác thực Basic HTTP)
curl -X POST "https://${siteUrl}/wp-json/wp/v2/posts" \\
  -u "[USERNAME]:[API_KEY]" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Tiêu đề bài viết mới",
    "content": "Nội dung bài viết bằng HTML hoặc text",
    "status": "publish",
    "summary": "Tóm tắt bài viết"
  }'

# 3. Cập nhật bài viết
curl -X POST "https://${siteUrl}/wp-json/wp/v2/posts/[POST_ID]" \\
  -u "[USERNAME]:[API_KEY]" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Tiêu đề cập nhật mới"
  }'

# 4. Xóa bài viết
curl -X DELETE "https://${siteUrl}/wp-json/wp/v2/posts/[POST_ID]" \\
  -u "[USERNAME]:[API_KEY]"`;

  // JS
  document.getElementById('code-js-text').textContent = `// 1. Đăng bài viết mới sử dụng Fetch API
const siteUrl = 'https://${siteUrl}/wp-json/wp/v2/posts';
const username = '[USERNAME]';
const apiKey = '[API_KEY]';

// Tạo mã token Basic Auth base64
const token = btoa(\`\${username}:\${apiKey}\`);

const payload = {
  title: 'Tiêu đề bài viết từ JavaScript',
  content: '&lt;p&gt;Nội dung bài viết hỗ trợ thẻ HTML.&lt;/p&gt;',
  status: 'publish', // 'publish' = đăng ngay, 'draft' = nháp
  summary: 'Tóm tắt bài viết mẫu'
};

fetch(siteUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Basic \${token}\`
  },
  body: JSON.stringify(payload)
})
.then(res => res.json())
.then(data => console.log('Đã đăng:', data))
.catch(err => console.error('Lỗi đăng bài:', err));`;

  // Python
  document.getElementById('code-python-text').textContent = `import requests
from requests.auth import HTTPBasicAuth

# Cấu hình endpoint của website
site_url = "https://${siteUrl}/wp-json/wp/v2/posts"
username = "[USERNAME]"
api_key = "[API_KEY]"

# Dữ liệu bài viết
payload = {
    "title": "Tiêu đề bài viết từ Python Requests",
    "content": "Nội dung bài viết của bạn.",
    "status": "publish"
}

# Thực hiện POST request với Basic Auth
response = requests.post(
    site_url,
    json=payload,
    auth=HTTPBasicAuth(username, api_key)
)

if response.status_code == 201:
    print("Đăng bài thành công:", response.json())
else:
      print("Thất bại:", response.status_code, response.text)`;
}

// ── Cloudflare Site Credentials Editing Logic ─────────────────────────────────
let activeCredsSiteName = '';

function openCredentialsModal(siteName) {
  activeCredsSiteName = siteName;
  document.getElementById('creds-site-name-text').textContent = `Website: ${siteName}`;
  
  const siteObj = sites.find(s => s.name === siteName);
  if (siteObj) {
    credsAccountIdInput.value = siteObj.accountId || '';
    if (siteObj.apiToken) {
      credsAuthTypeSelect.value = 'token';
      credsApiTokenInput.value = siteObj.apiToken;
      credsApiKeyInput.value = '';
      credsEmailInput.value = '';
    } else {
      credsAuthTypeSelect.value = 'key';
      credsApiKeyInput.value = siteObj.apiKey || '';
      credsEmailInput.value = siteObj.email || '';
      credsApiTokenInput.value = '';
    }
  } else {
    credsAccountIdInput.value = '';
    credsAuthTypeSelect.value = 'key';
    credsApiKeyInput.value = '';
    credsEmailInput.value = '';
    credsApiTokenInput.value = '';
  }
  
  toggleEditCredsFields();
  credentialsModal.classList.add('open');
}
window.openCredentialsModal = openCredentialsModal;

function closeCredentialsModal() {
  activeCredsSiteName = '';
  credentialsModal.classList.remove('open');
}

async function handleCredsFormSubmit(e) {
  e.preventDefault();
  
  const siteName = activeCredsSiteName;
  if (!siteName) return;

  const authType = credsAuthTypeSelect.value;
  
  // Sanitize accountId (remove leading/trailing slashes, spaces)
  const rawAccountId = credsAccountIdInput.value.trim();
  const accountId = rawAccountId.replace(/^\/+|\/+$/g, '').trim();
  
  const apiKey = authType === 'key' ? credsApiKeyInput.value.trim() : '';
  const email = authType === 'key' ? credsEmailInput.value.trim() : '';
  const apiToken = authType === 'token' ? credsApiTokenInput.value.trim() : '';

  // Validate Google API Key copy-paste error
  if (authType === 'key' && apiKey.startsWith('AIza')) {
    alert('Lỗi: Khóa bạn nhập bắt đầu bằng "AIza" - đây là Google API Key (không phải Cloudflare API Key). Vui lòng lấy đúng Global API Key từ Cloudflare Dashboard (My Profile > API Tokens > Global API Key).');
    return;
  }

  // Validate API Token entered in Global API Key field
  if (authType === 'key' && apiKey.startsWith('cfut_')) {
    alert('Lỗi: Khóa bạn nhập bắt đầu bằng "cfut_" - đây là Cloudflare API Token chứ không phải Global API Key. Vui lòng đổi "Loại xác thực" thành "Scoped API Token" và nhập khóa này vào trường "API Token".');
    return;
  }

  const creds = {
    accountId,
    apiKey,
    email,
    apiToken
  };

  const btnSubmit = document.getElementById('btn-submit-creds');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Đang lưu...';

  try {
    const res = await fetch(`/api/sites/${siteName}/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds)
    });

    const data = await res.json();
    if (res.ok) {
      closeCredentialsModal();
      fetchSites();
      alert('Đã cập nhật key Cloudflare thành công cho website ' + siteName);
    } else {
      alert(`Lỗi: ${data.error}`);
    }
  } catch (err) {
    alert(`Không thể lưu credentials: ${err.message}`);
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Lưu cấu hình';
  }
}
