import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../api/api';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user: authUser, fetchUserProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', email: '' });
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [showPwModal, setShowPwModal] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await userAPI.getProfile();
      if (res.data.success) {
        setProfile(res.data.data);
        setForm({
          fullName: res.data.data.fullName || '',
          phone: res.data.data.phone || '',
          email: res.data.data.email || '',
        });
      }
    } catch (err) {
      console.error('Lỗi lấy profile:', err);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await userAPI.updateProfile(form);
      if (res.data.success) {
        setMessage({ type: 'success', text: 'Cập nhật thành công!' });
        setEditing(false);
        fetchProfile();
        fetchUserProfile(); // Cập nhật lại AuthContext
      } else {
        setMessage({ type: 'error', text: res.data.message });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Cập nhật thất bại!' });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Vui lòng chọn file ảnh (JPG, PNG, GIF)!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      return;
    }

    // Validate size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Ảnh quá lớn! Vui lòng chọn ảnh dưới 2MB.' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      return;
    }

    setAvatarUploading(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target.result;
        try {
          const res = await userAPI.uploadAvatar(base64);
          if (res.data.success) {
            setMessage({ type: 'success', text: 'Cập nhật ảnh đại diện thành công!' });
            fetchProfile();
            fetchUserProfile(); // Cập nhật lại AuthContext
          } else {
            setMessage({ type: 'error', text: res.data.message });
          }
        } catch (err) {
          setMessage({ type: 'error', text: 'Upload ảnh thất bại!' });
        } finally {
          setAvatarUploading(false);
          setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setAvatarUploading(false);
      setMessage({ type: 'error', text: 'Lỗi đọc file ảnh!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }

    // Reset input
    e.target.value = '';
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp!' });
      return;
    }
    setLoading(true);
    try {
      const res = await userAPI.changePassword({
        oldPassword: pwForm.oldPassword,
        newPassword: pwForm.newPassword,
      });
      if (res.data.success) {
        setMessage({ type: 'success', text: 'Đổi mật khẩu thành công!' });
        setShowPwModal(false);
        setPwForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setMessage({ type: 'error', text: res.data.message });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Đổi mật khẩu thất bại!' });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const formatBalance = (balance) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(balance);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (!profile) {
    return (
      <div className="profile-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="profile-page fade-in">
      <div className="profile-header">
        <h2>Thông tin cá nhân</h2>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      <div className="profile-grid">
        {/* Profile Card */}
        <div className="card profile-card">
          <div className="profile-avatar-section">
            {/* Avatar Upload */}
            <div className="avatar-upload-wrapper" onClick={handleAvatarClick}>
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt="Avatar"
                  className="profile-avatar-img"
                />
              ) : (
                <div className="profile-avatar-large">
                  {(profile.fullName || profile.username).charAt(0).toUpperCase()}
                </div>
              )}
              <div className="avatar-overlay">
                {avatarUploading ? (
                  <div className="avatar-spinner"></div>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                      <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                    <span>Đổi ảnh</span>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
            </div>
            <h3>{profile.fullName || profile.username}</h3>
            <span className="role-badge">{profile.role}</span>
          </div>
          <div className="profile-stats">
            <div className="stat-item">
              <span className="stat-label">Số dư khả dụng</span>
              <span className="stat-value text-success">{formatBalance(profile.availableBalance)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Tổng tài khoản</span>
              <span className="stat-value text-muted" style={{fontSize: '18px'}}>{formatBalance(profile.balance)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Ngày tham gia</span>
              <span className="stat-value">{formatDate(profile.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="card profile-info-card">
          <div className="card-header">
            <h3>Chi tiết tài khoản</h3>
            {!editing && (
              <button className="btn btn-secondary" onClick={() => setEditing(true)}>
                Chỉnh sửa
              </button>
            )}
          </div>

          {editing ? (
            <form onSubmit={handleUpdateProfile}>
              <div className="form-group">
                <label className="form-label">Họ và tên</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Số điện thoại</label>
                <input
                  type="tel"
                  className="form-input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
                  Hủy
                </button>
              </div>
            </form>
          ) : (
            <div className="info-list">
              <div className="info-row">
                <span className="info-label">Username</span>
                <span className="info-value">{profile.username}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Họ và tên</span>
                <span className="info-value">{profile.fullName || '—'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Email</span>
                <span className="info-value">{profile.email}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Số điện thoại</span>
                <span className="info-value">{profile.phone || '—'}</span>
              </div>
            </div>
          )}

          <div className="card-divider"></div>

          <button className="btn btn-secondary" onClick={() => setShowPwModal(true)}>
            🔒 Đổi mật khẩu
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPwModal && (
        <div className="modal-overlay" onClick={() => setShowPwModal(false)}>
          <div className="modal-content card fade-in" onClick={(e) => e.stopPropagation()}>
            <h3>Đổi mật khẩu</h3>
            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label className="form-label">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  className="form-input"
                  value={pwForm.oldPassword}
                  onChange={(e) => setPwForm({ ...pwForm, oldPassword: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mật khẩu mới</label>
                <input
                  type="password"
                  className="form-input"
                  value={pwForm.newPassword}
                  onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  className="form-input"
                  value={pwForm.confirmPassword}
                  onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                  required
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Đang xử lý...' : 'Xác nhận'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPwModal(false)}>
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
