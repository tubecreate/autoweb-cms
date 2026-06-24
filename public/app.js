/* ============================================================
   AutoWeb CMS — Frontend Application Logic
   ============================================================ */

'use strict';

// ============================================================
// UTILS
// ============================================================
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.textContent = isHidden ? '🙈' : '👁';
  btn.classList.toggle('active', isHidden);
  btn.title = isHidden ? 'Ẩn' : 'Hiện';
}

function slugify(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function generateRandomPassword(length = 12) {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const specials = '!@#$%^&*';
  const allChars = lowercase + uppercase + numbers + specials;
  
  let password = '';
  // Guarantee at least one of each class to satisfy strict validation
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += specials.charAt(Math.floor(Math.random() * specials.length));
  
  for (let i = 4; i < length; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  
  // Shuffle password characters
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

// ============================================================
// STATE
// ============================================================
let allSites = [];
let allTemplates = [];
let allProfiles = [];
let selectedProfileId = null;
let currentThemeForCreate = null;
let currentSiteForLog = null;
let logEventSource = null;
let currentSiteForDelete = null;
let currentSiteForSettings = null;
let currentSiteForApi = null;
let currentSiteForCreds = null;
let pollingInterval = null;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadAll();
  bindEvents();
  startPolling();
});

async function loadAll() {
  await Promise.all([loadTemplates(), loadSites(), loadProfiles()]);
}

function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(async () => {
    const hasDeploying = allSites.some(s => s.status === 'deploying');
    if (hasDeploying) {
      await loadSites(false);
    }
  }, 5000);
}

// ============================================================
// TAB NAVIGATION
// ============================================================
function switchTab(tab) {
  // Update nav
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`nav-${tab}`)?.classList.add('active');

  // Update panels
  document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.add('active');

  // Update topbar
  const titles = {
    themes: ['Chọn Theme', 'Chọn giao diện để bắt đầu tạo website của bạn'],
    sites:  ['Websites', 'Quản lý toàn bộ website đã deploy lên Cloudflare'],
    config: ['Cấu hình Cloudflare', 'Quản lý nhiều tài khoản Cloudflare API'],
  };
  document.getElementById('page-title').textContent = titles[tab][0];
  document.getElementById('page-subtitle').textContent = titles[tab][1];

  // Show/hide topbar elements
  const searchWrap = document.getElementById('search-wrap');
  const btnAddProfile = document.getElementById('btn-add-cf-profile');
  searchWrap.style.display = tab === 'sites' ? 'block' : 'none';
  btnAddProfile.style.display = tab === 'config' ? 'inline-flex' : 'none';
}

// ============================================================
// TEMPLATES
// ============================================================
async function loadTemplates() {
  try {
    const res = await fetch('/api/templates');
    allTemplates = await res.json();
    renderThemes();
  } catch (e) {
    console.error('Failed to load templates:', e);
  }
}

function renderThemes() {
  const grid = document.getElementById('themes-grid');
  if (!allTemplates.length) {
    grid.innerHTML = '<p class="empty-state">Không tìm thấy theme nào.</p>';
    return;
  }

  grid.innerHTML = allTemplates.map(t => {
    const siteCount = allSites.filter(s => s.template === t.id).length;
    return `
      <div class="theme-card" id="theme-card-${t.id}">
        <div class="theme-thumbnail-wrap">
          <img class="theme-thumbnail" src="${t.thumbnail}" alt="${t.name}" loading="lazy"
               onerror="this.style.background='#1c2030'; this.style.opacity='0.3'">
          <div class="theme-preview-overlay">
            <button class="btn-preview" onclick="previewTheme('${t.id}')">👁 Xem Demo</button>
          </div>
        </div>
        <div class="theme-info">
          <div class="theme-header">
            <div class="theme-name">${t.name}</div>
            <div class="theme-dot" style="background:${t.color}"></div>
          </div>
          <p class="theme-desc">${t.description}</p>
          <div class="theme-tags">
            ${t.tags.map(tag => `<span class="theme-tag">${tag}</span>`).join('')}
          </div>
          <div class="theme-footer">
            <span class="theme-site-count">🌐 ${siteCount} website đã tạo</span>
            <button class="btn-create-from-theme" onclick="openCreateFromTheme('${t.id}')">
              + Tạo Website
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function previewTheme(themeId) {
  // Find a deployed site with this theme
  const site = allSites.find(s => s.template === themeId && s.status === 'active' && s.deployUrl);
  if (site) {
    window.open(site.deployUrl, '_blank');
  } else {
    alert('Chưa có website nào với theme này được deploy thành công để xem demo.');
  }
}

// ============================================================
// SITES
// ============================================================
async function loadSites(showRender = true) {
  try {
    const res = await fetch('/api/sites');
    allSites = await res.json();
    if (showRender) {
      renderSites();
      updateStats();
      renderThemes(); // update counts
    } else {
      // Silently update stats and re-render if status changed
      updateStats();
      renderSites();
      renderThemes();
    }
  } catch (e) {
    console.error('Failed to load sites:', e);
  }
}

function updateStats() {
  const active    = allSites.filter(s => s.status === 'active').length;
  const deploying = allSites.filter(s => s.status === 'deploying').length;
  const failed    = allSites.filter(s => s.status === 'failed').length;
  const total     = allSites.length;

  document.getElementById('stat-active').textContent    = active;
  document.getElementById('stat-deploying').textContent = deploying;
  document.getElementById('stat-failed').textContent    = failed;

  document.getElementById('stat-total').textContent         = total;
  document.getElementById('stat-active-card').textContent   = active;
  document.getElementById('stat-deploying-card').textContent= deploying;
  document.getElementById('stat-failed-card').textContent   = failed;

  document.getElementById('nav-sites-count').textContent = total;
}

function renderSites() {
  const grid = document.getElementById('sites-grid');
  const emptyState = document.getElementById('empty-state');
  const searchQuery = document.getElementById('search-input').value.toLowerCase();

  const filtered = allSites.filter(s =>
    s.name.toLowerCase().includes(searchQuery) ||
    (s.template || '').toLowerCase().includes(searchQuery)
  );

  if (!allSites.length) {
    emptyState.style.display = '';
    // Remove existing cards but keep empty state
    Array.from(grid.children).forEach(el => {
      if (!el.classList.contains('empty-state')) el.remove();
    });
    return;
  }

  emptyState.style.display = 'none';

  // Remove old cards
  Array.from(grid.children).forEach(el => {
    if (!el.classList.contains('empty-state')) el.remove();
  });

  filtered.forEach(site => {
    const card = createSiteCard(site);
    grid.appendChild(card);
  });
}

function createSiteCard(site) {
  const el = document.createElement('div');
  el.className = 'site-card';
  el.id = `site-card-${site.name}`;

  const statusClass = {
    active: 'status-active',
    deploying: 'status-deploying',
    failed: 'status-failed'
  }[site.status] || 'status-failed';

  const statusLabel = {
    active: '✅ Hoạt động',
    deploying: '⚙️ Đang deploy…',
    failed: '❌ Thất bại'
  }[site.status] || 'Unknown';

  const templateLabel = {
    'ngo-quyen': '🏫 Ngô Quyền',
    'commandcode': '💻 CommandCode',
    'korean-news': '📰 Korean News'
  }[site.template] || site.template || '—';

  const createdAt = site.createdAt
    ? new Date(site.createdAt).toLocaleString('vi-VN')
    : '—';

  const deployUrl = site.deployUrl
    ? `<div class="site-url"><a href="${site.deployUrl}" target="_blank" rel="noopener">${site.deployUrl}</a></div>`
    : '';

  const displayTitle = site.title || site.name;
  const showSubName = site.title ? `<div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); margin-top: 2px;">${site.name}</div>` : '';

  el.innerHTML = `
    <div class="site-card-header">
      <div class="site-name-block">
        <div class="site-name">${displayTitle}</div>
        ${showSubName}
        <span class="site-template-badge" style="margin-top: 4px;">${templateLabel}</span>
      </div>
      <span class="site-status-badge ${statusClass}">${statusLabel}</span>
    </div>
    ${deployUrl}
    <div class="site-meta">📅 ${createdAt}</div>
    <div class="site-actions">
      ${site.status === 'active' ? `
        <button class="btn btn-ghost btn-sm" onclick="openSettingsModal('${site.name}')">⚙️ Cài đặt</button>
        <button class="btn btn-ghost btn-sm" onclick="openApiModal('${site.name}')">🔑 API Key</button>
        <button class="btn btn-ghost btn-sm" onclick="openLogModal('${site.name}')">📋 Log</button>
      ` : ''}
      ${site.status === 'failed' ? `
        <button class="btn btn-primary btn-sm" onclick="reDeploySite('${site.name}')">🔄 Retry Deploy</button>
        <button class="btn btn-ghost btn-sm" onclick="openLogModal('${site.name}')">📋 Log</button>
      ` : ''}
      ${site.status === 'deploying' ? `
        <button class="btn btn-ghost btn-sm" onclick="openLogModal('${site.name}')">📋 Xem Log</button>
      ` : ''}
      <button class="btn btn-ghost btn-sm" onclick="openCredsModal('${site.name}')">🔧 CF Keys</button>
      <button class="btn btn-danger btn-sm" onclick="openDeleteModal('${site.name}')">🗑️ Xóa</button>
    </div>
  `;
  return el;
}

// ============================================================
// CF PROFILES
// ============================================================
async function loadProfiles() {
  try {
    const res = await fetch('/api/cf-profiles');
    allProfiles = await res.json();
    renderProfiles();
    document.getElementById('nav-config-count').textContent = allProfiles.length;
  } catch (e) {
    console.error('Failed to load profiles:', e);
  }
}

function renderProfiles() {
  const list = document.getElementById('cf-profiles-list');
  const emptyState = document.getElementById('empty-profiles-state');

  if (!allProfiles.length) {
    list.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  list.innerHTML = allProfiles.map(p => {
    const authLabel = p.authType === 'token' ? 'API Token' : 'Global Key';
    const accountIdShort = p.accountId ? `${p.accountId.slice(0, 8)}…${p.accountId.slice(-4)}` : '—';
    const createdAt = p.createdAt ? new Date(p.createdAt).toLocaleDateString('vi-VN') : '—';

    return `
      <div class="cf-profile-card" id="profile-card-${p.id}">
        <div class="cf-profile-header">
          <div class="cf-profile-name">🔑 ${p.name}</div>
          <span class="cf-profile-auth-badge">${authLabel}</span>
        </div>
        <div class="cf-profile-detail"><span>Account ID:</span>${accountIdShort}</div>
        ${p.email ? `<div class="cf-profile-detail"><span>Email:</span>${p.email}</div>` : ''}
        <div class="cf-profile-detail"><span>Thêm lúc:</span>${createdAt}</div>
        <div class="cf-profile-stat">
          <div class="cf-profile-stat-num">${p.websiteCount || 0}</div>
          <div class="cf-profile-stat-lbl">website đã sử dụng cấu hình này</div>
        </div>
        <div class="cf-profile-actions">
          <button class="btn btn-ghost btn-sm" onclick="openEditProfileModal('${p.id}')">✏️ Chỉnh sửa</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProfile('${p.id}', '${p.name}')">🗑️ Xóa</button>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================
// PROFILE MODAL — ADD / EDIT
// ============================================================
function openAddProfileModal() {
  document.getElementById('profile-modal-title').textContent = 'Thêm cấu hình Cloudflare';
  document.getElementById('btn-submit-profile').textContent = 'Lưu cấu hình';
  document.getElementById('profile-edit-id').value = '';
  document.getElementById('profile-form').reset();
  document.getElementById('profile-group-key').classList.remove('d-none');
  document.getElementById('profile-group-token').classList.add('d-none');
  openModal('profile-modal');
}

function openEditProfileModal(profileId) {
  const p = allProfiles.find(x => x.id === profileId);
  if (!p) return;

  document.getElementById('profile-modal-title').textContent = 'Chỉnh sửa cấu hình';
  document.getElementById('btn-submit-profile').textContent = 'Cập nhật';
  document.getElementById('profile-edit-id').value = p.id;
  document.getElementById('profile-name').value = p.name;
  document.getElementById('profile-account-id').value = p.accountId || '';
  document.getElementById('profile-auth-type').value = p.authType || 'key';
  document.getElementById('profile-api-key').value = '';   // Don't pre-fill secrets
  document.getElementById('profile-email').value = p.email || '';
  document.getElementById('profile-api-token').value = '';

  onProfileAuthTypeChange();
  openModal('profile-modal');
}

function onProfileAuthTypeChange() {
  const type = document.getElementById('profile-auth-type').value;
  document.getElementById('profile-group-key').classList.toggle('d-none', type === 'token');
  document.getElementById('profile-group-token').classList.toggle('d-none', type === 'key');
}

document.getElementById('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-profile');
  btn.disabled = true;
  btn.textContent = 'Đang lưu…';

  const editId = document.getElementById('profile-edit-id').value;
  const body = {
    name:      document.getElementById('profile-name').value,
    accountId: document.getElementById('profile-account-id').value,
    authType:  document.getElementById('profile-auth-type').value,
    apiKey:    document.getElementById('profile-api-key').value,
    email:     document.getElementById('profile-email').value,
    apiToken:  document.getElementById('profile-api-token').value,
  };

  try {
    const url = editId ? `/api/cf-profiles/${editId}` : '/api/cf-profiles';
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi không xác định');
    closeModal('profile-modal');
    await loadProfiles();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = editId ? 'Cập nhật' : 'Lưu cấu hình';
  }
});

async function deleteProfile(profileId, name) {
  if (!confirm(`Xóa cấu hình "${name}"?`)) return;
  try {
    const res = await fetch(`/api/cf-profiles/${profileId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi không xác định');
    await loadProfiles();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

// ============================================================
// CREATE MODAL — OPEN FROM THEME
// ============================================================
function openCreateFromTheme(themeId) {
  currentThemeForCreate = themeId;
  const theme = allTemplates.find(t => t.id === themeId);

  // Update modal header
  document.getElementById('modal-theme-name-text').textContent = `Theme: ${theme?.name || themeId}`;
  
  const titleInput = document.getElementById('site-title');
  if (titleInput) titleInput.value = '';
  
  document.getElementById('site-name').value = '';
  
  const pwInput = document.getElementById('site-admin-password');
  if (pwInput) {
    pwInput.value = generateRandomPassword(12);
    pwInput.type = 'text';
  }
  const eyeBtn = pwInput?.nextElementSibling;
  if (eyeBtn) {
    eyeBtn.textContent = '👁';
    eyeBtn.classList.remove('active');
  }

  selectedProfileId = null;

  // Render profile selector
  renderProfileSelector();

  openModal('create-modal');
}

function renderProfileSelector() {
  const container = document.getElementById('cf-profile-selector');
  const noWarn = document.getElementById('no-profiles-warning');
  const submitBtn = document.getElementById('btn-submit-create');

  if (!allProfiles.length) {
    container.innerHTML = '';
    noWarn.style.display = 'block';
    submitBtn.disabled = true;
    return;
  }

  noWarn.style.display = 'none';
  submitBtn.disabled = false;

  // Auto-select first profile
  if (!selectedProfileId) {
    selectedProfileId = allProfiles[0].id;
  }

  container.innerHTML = allProfiles.map(p => {
    const isSelected = p.id === selectedProfileId;
    const authLabel = p.authType === 'token' ? 'API Token' : 'Global Key';
    const accountIdShort = p.accountId ? `${p.accountId.slice(0, 8)}…${p.accountId.slice(-4)}` : '—';
    return `
      <div class="profile-radio-item ${isSelected ? 'selected' : ''}" onclick="selectProfile('${p.id}')">
        <input type="radio" name="cf-profile" value="${p.id}" ${isSelected ? 'checked' : ''}>
        <div class="profile-radio-dot"></div>
        <div class="profile-radio-info">
          <div class="profile-radio-name">${p.name}</div>
          <div class="profile-radio-detail">${accountIdShort} · ${authLabel}</div>
        </div>
        <span class="profile-radio-count">🌐 ${p.websiteCount || 0} sites</span>
      </div>
    `;
  }).join('');
}

function selectProfile(profileId) {
  selectedProfileId = profileId;
  // Update visual selection
  document.querySelectorAll('.profile-radio-item').forEach(el => {
    const isThis = el.getAttribute('onclick').includes(profileId);
    el.classList.toggle('selected', isThis);
  });
}

// ============================================================
// CREATE SITE FORM SUBMIT
// ============================================================
document.getElementById('create-site-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedProfileId) {
    alert('Vui lòng chọn cấu hình Cloudflare trước khi tạo website.');
    return;
  }

  const btn = document.getElementById('btn-submit-create');
  const loader = btn.querySelector('.btn-loader');
  
  const adminPassword = document.getElementById('site-admin-password').value;
  const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  if (!passwordRegex.test(adminPassword)) {
    alert('Mật khẩu Admin phải có tối thiểu 8 ký tự, chứa ít nhất 1 chữ hoa (A-Z) và 1 ký tự đặc biệt (ví dụ: !, @, #, $, %).');
    return;
  }

  btn.disabled = true;
  loader.classList.remove('d-none');

  const body = {
    title:       document.getElementById('site-title').value.trim(),
    name:        document.getElementById('site-name').value.trim(),
    adminPassword: adminPassword,
    template:    currentThemeForCreate || 'ngo-quyen',
    cfProfileId: selectedProfileId,
  };

  try {
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi không xác định');

    closeModal('create-modal');
    await loadSites();
    await loadProfiles(); // update website counts

    // Switch to sites tab and open log
    switchTab('sites');
    setTimeout(() => openLogModal(body.name), 500);
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    btn.disabled = false;
    loader.classList.add('d-none');
  }
});

// ============================================================
// REDEPLOY
// ============================================================
async function reDeploySite(siteName) {
  const site = allSites.find(s => s.name === siteName);
  if (!site) return;

  const body = {
    name:     siteName,
    template: site.template,
    title:    site.title || siteName,
  };

  if (site.cfProfileId) {
    body.cfProfileId = site.cfProfileId;
  } else {
    body.accountId = site.accountId || '';
    body.apiKey    = site.apiKey    || '';
    body.email     = site.email     || '';
    body.apiToken  = site.apiToken  || '';
  }

  try {
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi không xác định');
    await loadSites();
    openLogModal(siteName);
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

// ============================================================
// LOG MODAL (SSE)
// ============================================================
function openLogModal(siteName) {
  currentSiteForLog = siteName;
  document.getElementById('log-site-name').textContent = `Website: ${siteName}`;
  document.getElementById('terminal-content').innerHTML = '';
  document.getElementById('log-status-badge').textContent = 'Đang kết nối…';
  document.getElementById('log-status-badge').className = 'badge';

  const visitBtn = document.getElementById('btn-visit-site');
  if (visitBtn) {
    const site = allSites.find(s => s.name === siteName);
    if (site && site.status === 'active' && site.deployUrl) {
      visitBtn.href = site.deployUrl;
      visitBtn.classList.remove('d-none');
    } else {
      visitBtn.classList.add('d-none');
    }
  }

  openModal('log-modal');

  // Close previous SSE
  if (logEventSource) { logEventSource.close(); logEventSource = null; }

  logEventSource = new EventSource(`/api/sites/${siteName}/logs`);

  logEventSource.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    const terminal = document.getElementById('terminal-content');

    if (data.isHistory) {
      // Render history in bulk
      const lines = data.message.split('\n');
      lines.forEach(line => appendTerminalLine(terminal, line));
    } else {
      appendTerminalLine(terminal, data.message, data.isError);
    }

    terminal.scrollTop = terminal.scrollHeight;

    // Reload sites list if deployment finished/failed to fetch new status/URL
    if (data.message.includes('DEPLOYMENT SUCCESSFUL') || data.message.includes('DEPLOYMENT FAILED')) {
      await loadSites();
      await loadProfiles();
    }

    // Update status badge
    const site = allSites.find(s => s.name === siteName);
    updateLogBadge(site?.status);

    // Update visit button
    if (visitBtn) {
      if (site && site.status === 'active' && site.deployUrl) {
        visitBtn.href = site.deployUrl;
        visitBtn.classList.remove('d-none');
      } else {
        visitBtn.classList.add('d-none');
      }
    }
  };

  logEventSource.onerror = () => {
    document.getElementById('log-status-badge').textContent = 'Kết nối bị ngắt';
    logEventSource?.close();
    logEventSource = null;
  };
}

function appendTerminalLine(terminal, text, isError = false) {
  const span = document.createElement('span');
  span.className = isError ? 'log-error' : '';
  if (text.includes('DEPLOYMENT SUCCESSFUL') || text.includes('successfully')) {
    span.className = 'log-success';
  }
  span.textContent = text + (text.endsWith('\n') ? '' : '\n');
  terminal.appendChild(span);
}

function updateLogBadge(status) {
  const badge = document.getElementById('log-status-badge');
  const map = {
    active:    ['✅ Thành công', 'status-active'],
    deploying: ['⚙️ Đang deploy…', 'status-deploying'],
    failed:    ['❌ Thất bại', 'status-failed']
  };
  if (map[status]) {
    badge.textContent = map[status][0];
    badge.className = 'badge ' + map[status][1];
  }
}

// ============================================================
// DELETE MODAL
// ============================================================
function openDeleteModal(siteName) {
  currentSiteForDelete = siteName;
  document.getElementById('delete-site-name-text').textContent = siteName;
  document.getElementById('delete-site-name-hint').textContent = siteName;
  
  const confirmInput = document.getElementById('delete-confirm-name');
  if (confirmInput) {
    confirmInput.value = '';
    confirmInput.disabled = false;
  }
  
  const btn = document.getElementById('btn-confirm-delete');
  if (btn) {
    btn.disabled = true;
    const loader = btn.querySelector('.btn-loader');
    if (loader) loader.classList.add('d-none');
  }

  const cancelBtn = document.getElementById('btn-cancel-delete');
  if (cancelBtn) cancelBtn.disabled = false;

  const closeBtn = document.getElementById('btn-close-delete');
  if (closeBtn) closeBtn.disabled = false;

  const deleteCfCheckbox = document.getElementById('delete-cf-resources');
  if (deleteCfCheckbox) deleteCfCheckbox.disabled = false;

  openModal('delete-modal');
}

document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
  if (!currentSiteForDelete) return;
  
  const confirmInput = document.getElementById('delete-confirm-name');
  if (confirmInput && confirmInput.value.trim() !== currentSiteForDelete) {
    alert('Tên website xác nhận không khớp.');
    return;
  }

  const btn = document.getElementById('btn-confirm-delete');
  const loader = btn.querySelector('.btn-loader');
  const cancelBtn = document.getElementById('btn-cancel-delete');
  const closeBtn = document.getElementById('btn-close-delete');
  const deleteCfCheckbox = document.getElementById('delete-cf-resources');

  const site = allSites.find(s => s.name === currentSiteForDelete);
  const deleteCloudflare = deleteCfCheckbox.checked;

  try {
    // Set loading state
    btn.disabled = true;
    loader.classList.remove('d-none');
    cancelBtn.disabled = true;
    closeBtn.disabled = true;
    deleteCfCheckbox.disabled = true;
    if (confirmInput) confirmInput.disabled = true;

    const res = await fetch(`/api/sites/${currentSiteForDelete}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deleteCloudflareResources: deleteCloudflare,
        accountId: site?.accountId || '',
        apiKey:    site?.apiKey    || '',
        email:     site?.email     || '',
        apiToken:  site?.apiToken  || '',
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi không xác định');
    closeModal('delete-modal');
    await loadSites();
    await loadProfiles();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    // Reset loading state
    loader.classList.add('d-none');
    cancelBtn.disabled = false;
    closeBtn.disabled = false;
    deleteCfCheckbox.disabled = false;
    if (confirmInput) {
      confirmInput.disabled = false;
      btn.disabled = (confirmInput.value.trim() !== currentSiteForDelete);
    } else {
      btn.disabled = false;
    }
  }
});

// ============================================================
// SETTINGS MODAL
// ============================================================
function openSettingsModal(siteName) {
  currentSiteForSettings = siteName;
  document.getElementById('settings-site-name-text').textContent = `Website: ${siteName}`;
  // Reset form
  document.getElementById('settings-form').reset();
  openModal('settings-modal');

  // Load current settings from D1
  fetch(`/api/sites/${siteName}/settings`)
    .then(r => r.json())
    .then(data => {
      document.getElementById('settings-main-title').value     = data.header_main_title || '';
      document.getElementById('settings-upper-title').value    = data.header_upper_title || '';
      document.getElementById('settings-description').value    = data.header_description || '';
      document.getElementById('settings-seo-title').value      = data.homepage_seo_title || '';
      document.getElementById('settings-seo-description').value= data.homepage_seo_description || '';
      document.getElementById('settings-logo-url').value       = data.header_logo_url || '';
      document.getElementById('settings-banner-url').value     = data.header_banner_url || '';
    })
    .catch(err => console.error('Settings load error:', err));
}

document.getElementById('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentSiteForSettings) return;

  const btn = document.getElementById('btn-submit-settings');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = true;
  loader.classList.remove('d-none');

  const body = {
    header_main_title:         document.getElementById('settings-main-title').value,
    header_upper_title:        document.getElementById('settings-upper-title').value,
    header_description:        document.getElementById('settings-description').value,
    homepage_seo_title:        document.getElementById('settings-seo-title').value,
    homepage_seo_description:  document.getElementById('settings-seo-description').value,
    header_logo_url:           document.getElementById('settings-logo-url').value,
    header_banner_url:         document.getElementById('settings-banner-url').value,
  };

  try {
    const res = await fetch(`/api/sites/${currentSiteForSettings}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi không xác định');
    closeModal('settings-modal');
    alert('✅ Đã lưu cấu hình thành công!');
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    btn.disabled = false;
    loader.classList.add('d-none');
  }
});

// ============================================================
// API KEY MODAL
// ============================================================
function openApiModal(siteName) {
  currentSiteForApi = siteName;
  document.getElementById('api-site-name-text').textContent = `Website: ${siteName}`;
  document.getElementById('new-key-reveal-box').classList.add('d-none');
  document.getElementById('api-key-label').value = '';
  loadApiKeys(siteName);
  openModal('api-modal');
}

async function loadApiKeys(siteName) {
  try {
    const res = await fetch(`/api/sites/${siteName}/api-keys`);
    const keys = await res.json();
    const tbody = document.getElementById('api-keys-table-body');
    if (!keys.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">Chưa có API Key nào</td></tr>';
      return;
    }
    tbody.innerHTML = keys.map(k => `
      <tr>
        <td>${k.name}</td>
        <td><code style="font-family:var(--font-mono);font-size:11px">${k.username || '—'}</code></td>
        <td><code style="font-family:var(--font-mono);font-size:11px">${k.api_key?.slice(0, 12)}…</code></td>
        <td>${k.created_at ? new Date(k.created_at).toLocaleDateString('vi-VN') : '—'}</td>
        <td style="text-align:right">
          <button class="btn btn-danger btn-sm" onclick="deleteApiKey('${siteName}', ${k.id})">Xóa</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Load API keys error:', err);
  }
}

document.getElementById('create-api-key-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentSiteForApi) return;

  const btn = document.getElementById('btn-submit-api-key');
  btn.disabled = true;
  btn.textContent = 'Đang tạo…';

  try {
    const res = await fetch(`/api/sites/${currentSiteForApi}/api-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label:    document.getElementById('api-key-label').value,
        username: document.getElementById('api-key-user').value,
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi không xác định');

    // Show generated key
    document.getElementById('generated-key-display').value = data.api_key;
    document.getElementById('new-key-reveal-box').classList.remove('d-none');
    document.getElementById('api-key-label').value = '';
    loadApiKeys(currentSiteForApi);
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Tạo Key';
  }
});

async function deleteApiKey(siteName, keyId) {
  if (!confirm('Xóa API Key này?')) return;
  try {
    const res = await fetch(`/api/sites/${siteName}/api-keys/${keyId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi không xác định');
    loadApiKeys(siteName);
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

function copyGeneratedApiKey() {
  const input = document.getElementById('generated-key-display');
  navigator.clipboard.writeText(input.value).then(() => {
    const btn = document.getElementById('btn-copy-key') || document.querySelector('[onclick="copyGeneratedApiKey()"]');
    if (btn) { const orig = btn.textContent; btn.textContent = '✅ Đã sao chép!'; setTimeout(() => btn.textContent = orig, 2000); }
  });
}

function switchApiTab(tabName) {
  document.getElementById('tab-manage-keys').classList.toggle('d-none', tabName !== 'manage-keys');
  document.getElementById('tab-api-examples').classList.toggle('d-none', tabName !== 'api-examples');
  document.querySelectorAll('.tab-btn').forEach((btn, i) => {
    btn.classList.toggle('active', (i === 0 && tabName === 'manage-keys') || (i === 1 && tabName === 'api-examples'));
  });
}

function switchExampleLang(lang) {
  ['curl', 'js', 'python'].forEach(l => {
    document.getElementById(`code-box-${l}`)?.classList.toggle('d-none', l !== lang);
    document.getElementById(`btn-ex-${l}`)?.classList.toggle('active', l === lang);
  });
}

function copyCodeContent(id) {
  const code = document.getElementById(id)?.textContent;
  if (code) navigator.clipboard.writeText(code).then(() => alert('Đã sao chép!'));
}

// ============================================================
// CREDENTIALS MODAL (per site)
// ============================================================
function openCredsModal(siteName) {
  currentSiteForCreds = siteName;
  const site = allSites.find(s => s.name === siteName);
  document.getElementById('creds-site-name-text').textContent = `Website: ${siteName}`;

  document.getElementById('creds-account-id').value = site?.accountId || '';
  document.getElementById('creds-api-key').value    = '';
  document.getElementById('creds-email').value      = site?.email     || '';
  document.getElementById('creds-api-token').value  = '';

  // Handle auth type display
  const authType = (site?.apiToken) ? 'token' : 'key';
  document.getElementById('creds-auth-type').value = authType;
  document.getElementById('creds-group-api-key').classList.toggle('d-none', authType === 'token');
  document.getElementById('creds-group-email').classList.toggle('d-none', authType === 'token');
  document.getElementById('creds-group-api-token').classList.toggle('d-none', authType === 'key');

  openModal('credentials-modal');
}

document.getElementById('creds-auth-type').addEventListener('change', function () {
  const isToken = this.value === 'token';
  document.getElementById('creds-group-api-key').classList.toggle('d-none', isToken);
  document.getElementById('creds-group-email').classList.toggle('d-none', isToken);
  document.getElementById('creds-group-api-token').classList.toggle('d-none', !isToken);
});

document.getElementById('creds-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentSiteForCreds) return;

  const body = {
    accountId: document.getElementById('creds-account-id').value,
    apiKey:    document.getElementById('creds-api-key').value,
    email:     document.getElementById('creds-email').value,
    apiToken:  document.getElementById('creds-api-token').value,
  };

  try {
    const res = await fetch(`/api/sites/${currentSiteForCreds}/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi không xác định');
    closeModal('credentials-modal');
    await loadSites();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
});

// ============================================================
// MODAL HELPERS
// ============================================================
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ============================================================
// EVENTS BINDING
// ============================================================
function bindEvents() {
  // Close modals on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target === el) closeModal(el.id);
    });
  });

  // Button closes
  const closes = {
    'btn-close-modal':    'create-modal',
    'btn-cancel-modal':   'create-modal',
    'btn-close-log':      'log-modal',
    'btn-close-log-footer':'log-modal',
    'btn-close-delete':   'delete-modal',
    'btn-cancel-delete':  'delete-modal',
    'btn-close-settings': 'settings-modal',
    'btn-cancel-settings':'settings-modal',
    'btn-close-api':      'api-modal',
    'btn-close-api-footer':'api-modal',
    'btn-close-creds':    'credentials-modal',
    'btn-cancel-creds':   'credentials-modal',
    'btn-close-profile':  'profile-modal',
  };

  for (const [btnId, modalId] of Object.entries(closes)) {
    document.getElementById(btnId)?.addEventListener('click', () => {
      closeModal(modalId);
      if (modalId === 'log-modal') {
        logEventSource?.close();
        logEventSource = null;
      }
    });
  }

  // Log clear
  document.getElementById('btn-clear-log')?.addEventListener('click', () => {
    document.getElementById('terminal-content').innerHTML = '';
  });

  // Search
  document.getElementById('search-input')?.addEventListener('input', () => renderSites());

  // Auto-slugify site-name from site-title
  const titleInput = document.getElementById('site-title');
  const nameInput = document.getElementById('site-name');
  titleInput?.addEventListener('input', () => {
    nameInput.value = slugify(titleInput.value);
  });

  // Delete modal name confirmation
  const confirmInput = document.getElementById('delete-confirm-name');
  confirmInput?.addEventListener('input', (e) => {
    const btn = document.getElementById('btn-confirm-delete');
    if (btn && currentSiteForDelete) {
      btn.disabled = (e.target.value.trim() !== currentSiteForDelete);
    }
  });
}
