'use client';
import { useState, useEffect } from 'react';
import AdminShell from '@/components/admin/AdminShell';

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch('/api/auth/login');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setDisplayName(data.user.displayName || '');
        setEmail(data.user.email || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateProfile(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPassword) {
      if (newPassword !== confirmPassword) {
        setErrorMsg('Mật khẩu xác nhận không khớp');
        return;
      }
      const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
      if (!passwordRegex.test(newPassword)) {
        setErrorMsg('Mật khẩu mới phải có tối thiểu 8 ký tự, chứa ít nhất 1 chữ hoa (A-Z) và 1 ký tự đặc biệt (ví dụ: !, @, #, $, %).');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = { displayName, email };
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('Cập nhật thông tin cá nhân thành công!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (data.user) {
          setUser(data.user);
        }
      } else {
        setErrorMsg(data.error || 'Có lỗi xảy ra');
      }
    } catch (err) {
      setErrorMsg('Lỗi kết nối: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminShell title="Thông tin cá nhân">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(0, 86, 179, 0.2)', borderTopColor: 'var(--adm-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Thông tin cá nhân">
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title">👤 Chỉnh sửa thông tin cá nhân</h3>
        </div>
        <div className="adm-card-body">
          {errorMsg && <div className="adm-alert adm-alert-error">⚠️ {errorMsg}</div>}
          {successMsg && <div className="adm-alert adm-alert-success">✅ {successMsg}</div>}

          <form onSubmit={handleUpdateProfile}>
            <div className="adm-form-group">
              <label className="adm-label">Tên tài khoản</label>
              <input type="text" className="adm-input" value={user?.username || ''} disabled style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }} />
              <small className="adm-input-hint">Tên tài khoản không thể thay đổi</small>
            </div>

            <div className="adm-form-group">
              <label className="adm-label">Tên hiển thị <span>*</span></label>
              <input type="text" className="adm-input" value={displayName} onChange={e => setDisplayName(e.target.value)} required placeholder="Ví dụ: Admin" />
            </div>

            <div className="adm-form-group">
              <label className="adm-label">Email</label>
              <input type="email" className="adm-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="Ví dụ: admin@example.com" />
            </div>

            <div className="adm-divider" />

            <h4 style={{ marginBottom: 12, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>🔐 Đổi mật khẩu</h4>
            <small style={{ display: 'block', marginBottom: 16, color: '#64748b', fontSize: 12, lineHeight: 1.5 }}>
              Chỉ điền các ô dưới đây nếu bạn muốn thay đổi mật khẩu đăng nhập. Mật khẩu mới phải có tối thiểu 8 ký tự, chứa ít nhất 1 chữ hoa (A-Z) và 1 ký tự đặc biệt.
            </small>

            <div className="adm-form-group">
              <label className="adm-label">Mật khẩu hiện tại</label>
              <input type="password" className="adm-input" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Nhập mật khẩu hiện tại..." autocomplete="current-password" />
            </div>

            <div className="adm-row">
              <div className="adm-form-group">
                <label className="adm-label">Mật khẩu mới</label>
                <input type="password" className="adm-input" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nhập mật khẩu mới..." autocomplete="new-password" />
              </div>
              <div className="adm-form-group">
                <label className="adm-label">Xác nhận mật khẩu mới</label>
                <input type="password" className="adm-input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Nhập lại mật khẩu mới..." autocomplete="new-password" />
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Đang lưu...' : '💾 Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminShell>
  );
}
