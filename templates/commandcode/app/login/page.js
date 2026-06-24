'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import '@/app/admin/admin.css';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Authentication failed');
        return;
      }
      router.push('/admin');
    } catch {
      setError('Could not connect to authentication server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-page">
      <div className="glow-bg-admin"></div>
      <div className="noise-overlay-admin"></div>

      <div className="login-card">
        <div className="login-logo-wrap">
          <div className="login-logo">⚡</div>
          <div className="login-title">Sign In</div>
          <div className="login-sub">Command Code Control Dashboard</div>
        </div>

        {error && (
          <div className="adm-alert adm-alert-error" style={{ fontSize: '13px', padding: '10px 14px' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="adm-form-group" style={{ margin: 0 }}>
            <label className="adm-label">Username</label>
            <div className="login-input-wrap">
              <span className="login-input-icon">👤</span>
              <input
                id="login-username"
                type="text"
                className="login-input"
                placeholder="Enter username..."
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                required
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          <div className="adm-form-group" style={{ margin: 0 }}>
            <label className="adm-label">Password</label>
            <div className="login-input-wrap">
              <span className="login-input-icon">🔒</span>
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                className="login-input"
                placeholder="Enter password..."
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
                autoComplete="current-password"
                style={{ paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af',
                  outline: 'none'
                }}
              >
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={loading} style={{ marginTop: '8px' }}>
            {loading ? 'Signing in...' : '🔐 Sign In'}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }} className="login-back">
          <Link href="/">← Go Back</Link>
          <Link href="/register" style={{ color: 'var(--admin-primary)', fontWeight: '600' }}>Create account →</Link>
        </div>
      </div>
    </div>
  );
}
