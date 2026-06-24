'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const navItems = [
  { section: 'TỔNG QUAN' },
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/profile', label: 'Thông tin cá nhân', icon: '👤' },
  { section: 'NỘI DUNG' },
  { href: '/admin/posts', label: 'Bài viết', icon: '📝' },
  { href: '/admin/notifications', label: 'Thông báo', icon: '🔔' },
  { href: '/admin/polls', label: 'Thăm dò ý kiến', icon: '📋' },
  { section: 'TRÌNH BÀY' },
  { href: '/admin/banners', label: 'Banner Slider', icon: '🖼️' },
  { section: 'QUẢN LÝ' },
  { href: '/admin/members', label: 'Thành viên', icon: '👥' },
  { href: '/admin/files', label: 'File & Tài nguyên', icon: '📁' },
  { href: '/admin/groups', label: 'Danh mục', icon: '🗂️' },
  { href: '/admin/themes', label: 'Thiết lập Giao diện', icon: '🎨' },
  { href: '/admin/settings', label: 'Cấu hình & Sao lưu', icon: '⚙️' },
];

export default function AdminShell({ children, title = 'Dashboard' }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/login');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        router.push('/admin/login');
      }
    } catch {
      router.push('/admin/login');
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/login', { method: 'DELETE' });
    router.push('/admin/login');
  }

  const isActive = (href) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const roleLabel = { admin: 'Quản trị viên', mod: 'Điều hành viên', member: 'Thành viên' };
  const roleBadge = { admin: 'badge-red', mod: 'badge-blue', member: 'badge-green' };

  return (
    <div className="admin-layout">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:99 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
        <Link href="/admin" className="sidebar-brand" onClick={() => setSidebarOpen(false)}>
          <img src="/logos/logo_ngo_quyen.png" alt="Logo" className="sidebar-brand-logo"
            onError={e => { e.target.src='https://upload.wikimedia.org/wikipedia/commons/4/47/Logo_TH_Ngo_Quyen.png'; }} />
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-title">Trang Quản Trị</div>
            <div className="sidebar-brand-sub">Trường TH Ngô Quyền · Đà Nẵng</div>
          </div>
        </Link>

        <nav className="sidebar-nav">
          {navItems.map((item, i) => {
            if (item.section) {
              return <div key={i} className="sidebar-section-label">{item.section}</div>;
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive(item.href) ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
                target={item.external ? '_blank' : undefined}
              >
                <span className="sidebar-icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-user">
          {user ? (
            <div>
              <div className="sidebar-user-info">
                <div className="sidebar-avatar">{initials}</div>
                <div style={{flex:1,overflow:'hidden'}}>
                  <div className="sidebar-user-name" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {user.displayName}
                  </div>
                  <div className="sidebar-user-role">{roleLabel[user.role] || user.role}</div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                style={{
                  width:'100%', marginTop:8,
                  padding:'8px 12px',
                  background:'rgba(255,255,255,0.06)',
                  border:'1px solid rgba(255,255,255,0.1)',
                  borderRadius:8, color:'rgba(255,255,255,0.65)',
                  fontSize:12, fontWeight:600, cursor:'pointer',
                  fontFamily:'inherit', transition:'all 0.2s',
                }}
              >
                {loggingOut ? '...' : '⎋ Đăng xuất'}
              </button>
            </div>
          ) : (
            <div style={{height:60,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <div className="skeleton" style={{width:'80%',height:40}} />
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="admin-main">
        {/* Floating mobile toggle button */}
        <button
          className="sidebar-mobile-toggle-floating"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Menu"
        >
          ☰
        </button>

        <main className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}
