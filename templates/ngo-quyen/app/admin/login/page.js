'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLoginPage() {
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
      if (!res.ok) { setError(data.error || 'Đăng nhập thất bại'); return; }
      router.push('/admin');
    } catch {
      setError('Không thể kết nối server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-page">
      <div className="login-card">
        <div className="login-logo-wrap">
          <div className="login-logo">
            <img src="/logos/logo_ngo_quyen.png" alt="Logo"
              onError={e => { e.target.style.display='none'; }} />
          </div>
          <div className="login-title">Trang Quản Trị</div>
          <div className="login-sub">Trường TH Ngô Quyền — Đà Nẵng</div>
        </div>

        {error && (
          <div className="adm-alert adm-alert-error">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="adm-form-group">
            <label className="adm-label">Tên đăng nhập</label>
            <div className="login-input-wrap">
              <span className="login-input-icon">👤</span>
              <input
                id="login-username"
                type="text"
                className="login-input"
                placeholder="Nhập tên đăng nhập..."
                value={form.username}
                onChange={e => setForm({...form, username: e.target.value})}
                required
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          <div className="adm-form-group">
            <label className="adm-label">Mật khẩu</label>
            <div className="login-input-wrap">
              <span className="login-input-icon">🔒</span>
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                className="login-input"
                placeholder="Nhập mật khẩu..."
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                required
                autoComplete="current-password"
                style={{paddingRight:44}}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{
                  position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', cursor:'pointer', fontSize:16, color:'#9ca3af',
                }}
              >
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <span style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{width:16,height:16,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite',display:'inline-block'}} />
                Đang đăng nhập...
              </span>
            ) : '🔐 Đăng nhập'}
          </button>
        </form>

        <div className="login-back" style={{marginTop:20}}>
          <Link href="/">← Về trang chủ</Link>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
