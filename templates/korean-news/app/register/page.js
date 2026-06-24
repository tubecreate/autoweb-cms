'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import '@/app/admin/admin.css';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '', displayName: '', email: '', tier: 'Free' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(form.password)) {
      setError('Password must be at least 8 characters long, contain at least 1 uppercase letter, and at least 1 special character.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }
      router.push('/admin');
    } catch {
      setError('Could not connect to registration server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-page">
      <div className="glow-bg-admin"></div>
      <div className="noise-overlay-admin"></div>

      <div className="login-card" style={{ width: '460px', padding: '36px' }}>
        <div className="login-logo-wrap">
          <div className="login-logo">⚡</div>
          <div className="login-title">Create Account</div>
          <div className="login-sub">Start coding with your taste today</div>
        </div>

        {error && (
          <div className="adm-alert adm-alert-error" style={{ fontSize: '13px', padding: '10px 14px' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="adm-form-group" style={{ margin: 0 }}>
            <label className="adm-label">Username <span style={{ color: 'var(--admin-danger)' }}>*</span></label>
            <div className="login-input-wrap">
              <span className="login-input-icon">👤</span>
              <input
                type="text"
                className="login-input"
                placeholder="Choose username..."
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                required
                minLength={3}
              />
            </div>
          </div>

          <div className="adm-form-group" style={{ margin: 0 }}>
            <label className="adm-label">Display Name</label>
            <div className="login-input-wrap">
              <span className="login-input-icon">📝</span>
              <input
                type="text"
                className="login-input"
                placeholder="Your name..."
                value={form.displayName}
                onChange={e => setForm({ ...form, displayName: e.target.value })}
              />
            </div>
          </div>

          <div className="adm-form-group" style={{ margin: 0 }}>
            <label className="adm-label">Email Address <span style={{ color: 'var(--admin-danger)' }}>*</span></label>
            <div className="login-input-wrap">
              <span className="login-input-icon">✉️</span>
              <input
                type="email"
                className="login-input"
                placeholder="Enter email..."
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="adm-form-group" style={{ margin: 0 }}>
            <label className="adm-label">Password <span style={{ color: 'var(--admin-danger)' }}>*</span></label>
            <div className="login-input-wrap">
              <span className="login-input-icon">🔒</span>
              <input
                type="password"
                className="login-input"
                placeholder="Min 8 chars, 1 upper, 1 special..."
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="adm-form-group" style={{ margin: 0 }}>
            <label className="adm-label">Subscription Plan Tier</label>
            <select
              className="adm-select"
              value={form.tier}
              onChange={e => setForm({ ...form, tier: e.target.value })}
              style={{ paddingLeft: '14px', background: 'rgba(0,0,0,0.4)' }}
            >
              <option value="Free">Free Developer Plan ($0/mo)</option>
              <option value="Pro">Pro Taste-1 Plan ($1/mo)</option>
              <option value="Enterprise">Enterprise Team Plan (Custom)</option>
            </select>
          </div>

          <button type="submit" className="login-btn" disabled={loading} style={{ marginTop: '8px' }}>
            {loading ? 'Creating account...' : '🚀 Create Account'}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }} className="login-back">
          <Link href="/">← Go Back</Link>
          <Link href="/login" style={{ color: 'var(--admin-primary)', fontWeight: '600' }}>Sign in instead →</Link>
        </div>
      </div>
    </div>
  );
}
