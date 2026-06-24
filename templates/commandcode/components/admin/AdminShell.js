'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const navItems = [
  { section: 'ANALYTICS' },
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/profile', label: 'Profile Settings', icon: '👤' },
  { section: 'MANAGEMENT' },
  { href: '/admin/posts', label: 'Changelog / Posts', icon: '📝' },
  { href: '/admin/files', label: 'Files / Media', icon: '📁' },
  { href: '/admin/members', label: 'Member Directory', icon: '👥' },
  { href: '/admin/pages', label: 'Page Builder', icon: '🎨' },
  { href: '/admin/settings', label: 'Global Settings', icon: '⚙️' },
  { section: 'NAVIGATION' },
  { href: '/', label: 'Return to Homepage', icon: '⚡' },
];

export default function AdminShell({ children, title = 'Dashboard' }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/login');
      if (res.ok) {
        const data = await res.json();
        // Allow mod & admin roles to access administrative dashboards
        if (data.user.role === 'admin' || data.user.role === 'mod') {
          setUser(data.user);
        } else {
          // Normal members get redirected or we can show them a profile page.
          // Let's allow members to see their profile page on `/admin` but block them from other pages
          setUser(data.user);
        }
      } else {
        router.push('/login');
      }
    } catch {
      router.push('/login');
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/login', { method: 'DELETE' });
    router.push('/login');
  }

  const isActive = (href) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const roleLabel = { admin: 'Administrator', mod: 'Moderator', member: 'Member' };
  
  // Custom dashboard for normal members
  const isStaff = user?.role === 'admin' || user?.role === 'mod';

  return (
    <div className="admin-layout-root">
      {/* Background neon glows */}
      <div className="glow-bg-admin"></div>
      <div className="noise-overlay-admin"></div>

      {sidebarOpen && (
        <div
          className="sidebar-overlay-mobile"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar navigation */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
        <Link href="/admin" className="sidebar-brand" onClick={() => setSidebarOpen(false)}>
          <span className="logo-icon">⚡</span>
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-title">Command Code</div>
            <div className="sidebar-brand-sub">Control Center</div>
          </div>
        </Link>

        <nav className="sidebar-nav">
          {navItems.map((item, i) => {
            if (item.section) {
              // Hide management section for non-staff
              if (item.section === 'MANAGEMENT' && !isStaff) return null;
              return <div key={i} className="sidebar-section-label">{item.section}</div>;
            }
            if (item.href === '/admin/posts' && !isStaff) return null;
            if (item.href === '/admin/files' && !isStaff) return null;
            if (item.href === '/admin/members' && !isStaff) return null;
            if (item.href === '/admin/pages' && !isStaff) return null;
            if (item.href === '/admin/settings' && !isStaff) return null;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive(item.href) ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User profile card */}
        <div className="sidebar-user">
          {user ? (
            <div>
              <div className="sidebar-user-info">
                <div className="sidebar-avatar">{initials}</div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div className="sidebar-user-name" title={user.displayName}>
                    {user.displayName}
                  </div>
                  <div className="sidebar-user-role">
                    {roleLabel[user.role] || user.role} <span className="tier-tag">{user.tier}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="btn-logout"
              >
                {loggingOut ? 'Logging out...' : '⎋ Sign Out'}
              </button>
            </div>
          ) : (
            <div className="sidebar-loading-user">
              <div className="skeleton-line" />
            </div>
          )}
        </div>
      </aside>

      {/* Main content body */}
      <div className="admin-main">
        {/* Floating mobile toggle button */}
        <button
          className="sidebar-mobile-toggle-floating"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Menu"
        >
          ☰
        </button>

        <header className="admin-content-header">
          <h2>{title}</h2>
        </header>

        <main className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}
