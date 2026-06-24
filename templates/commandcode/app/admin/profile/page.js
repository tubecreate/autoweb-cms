'use client';
import { useState, useEffect } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import '@/app/admin/admin.css';

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
      console.error('Failed to fetch user profile info:', err);
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
        setErrorMsg('Passwords do not match.');
        return;
      }
      const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]).{8,}$/;
      if (!passwordRegex.test(newPassword)) {
        setErrorMsg('New password must be at least 8 characters long, contain at least 1 uppercase letter, and at least 1 special character.');
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
        setSuccessMsg('Profile settings updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (data.user) {
          setUser(data.user);
        }
      } else {
        setErrorMsg(data.error || 'Failed to update profile settings.');
      }
    } catch (err) {
      setErrorMsg('Connection error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminShell title="Loading Profile...">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(139, 92, 246, 0.2)', borderTopColor: 'var(--admin-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Profile Settings">
      <div className="adm-card">
        <div className="adm-card-header">
          <div className="adm-card-title">👤 Edit Profile Settings</div>
        </div>
        <div className="adm-card-body">
          {errorMsg && <div className="adm-alert adm-alert-error">⚠️ {errorMsg}</div>}
          {successMsg && <div className="adm-alert adm-alert-success">🎉 {successMsg}</div>}

          <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="adm-form-group">
              <label className="adm-label">Username</label>
              <input type="text" className="adm-input" value={user?.username || ''} disabled style={{ background: 'rgba(255, 255, 255, 0.02)', cursor: 'not-allowed', color: 'var(--admin-muted)' }} />
              <span style={{ fontSize: '11px', color: 'var(--admin-muted)' }}>Username cannot be changed.</span>
            </div>

            <div className="adm-form-group">
              <label className="adm-label">Display Name <span style={{ color: 'var(--admin-danger)' }}>*</span></label>
              <input type="text" className="adm-input" value={displayName} onChange={e => setDisplayName(e.target.value)} required placeholder="Your name..." />
            </div>

            <div className="adm-form-group">
              <label className="adm-label">Email Address</label>
              <input type="email" className="adm-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="yourname@example.com" />
            </div>

            <div style={{ borderTop: '1px solid var(--admin-border)', padding: '10px 0' }} />

            <h4 style={{ color: '#fff', fontSize: '16px', fontWeight: '700' }}>🔐 Change Password</h4>
            <span style={{ fontSize: '12px', color: 'var(--admin-muted)', display: 'block', lineHeight: '1.5' }}>
              Only fill out these fields if you want to update your current password. Passwords must be at least 8 characters long, contain at least 1 uppercase letter, and at least 1 special character.
            </span>

            <div className="adm-form-group">
              <label className="adm-label">Current Password</label>
              <input type="password" className="adm-input" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password..." autocomplete="current-password" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="adm-form-group">
                <label className="adm-label">New Password</label>
                <input type="password" className="adm-input" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password..." autocomplete="new-password" />
              </div>
              <div className="adm-form-group">
                <label className="adm-label">Confirm New Password</label>
                <input type="password" className="adm-input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-type new password..." autocomplete="new-password" />
              </div>
            </div>

            <div style={{ marginTop: '10px' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving changes...' : '💾 Save Settings'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminShell>
  );
}
