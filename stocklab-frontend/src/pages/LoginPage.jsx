import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState('login'); // 'login', 'forgot_request', 'forgot_reset', '2fa'
  const [tempToken, setTempToken] = useState('');
  const [qrCodeBase64, setQrCodeBase64] = useState('');
  const [form, setForm] = useState({ username: '', password: '', email: '', otpCode: '', newPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleLoginSuccess = (data) => {
    const { token, username, email, fullName, role } = data;
    login({ username, email, fullName, role }, token);
    navigate('/dashboard');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'login') {
        const res = await authAPI.login({ username: form.username, password: form.password });
        if (res.data.success) {
          if (res.data.data.is2faRequired) {
            setMode('2fa');
            setTempToken(res.data.data.tempToken);
            setQrCodeBase64(res.data.data.qrCodeBase64 || '');
            setSuccess(res.data.message);
            setForm({ ...form, otpCode: '' });
          } else {
            handleLoginSuccess(res.data.data);
          }
        } else {
          setError(res.data.message);
        }
      } else if (mode === '2fa') {
        const res = await authAPI.verify2fa({ tempToken, otpCode: form.otpCode });
        if (res.data.success) {
          handleLoginSuccess(res.data.data);
        } else {
          setError(res.data.message);
        }
      } else if (mode === 'forgot_request') {
        const res = await authAPI.forgotPasswordRequest({ username: form.username });
        if (res.data.success) {
          setSuccess(res.data.message);
          setMode('forgot_reset');
        } else {
          setError(res.data.message);
        }
      } else if (mode === 'forgot_reset') {
        const res = await authAPI.forgotPasswordReset({
          username: form.username,
          otpCode: form.otpCode,
          newPassword: form.newPassword
        });
        if (res.data.success) {
          setSuccess(res.data.message + ' Vui lòng đăng nhập lại.');
          setMode('login');
          setForm({ ...form, password: '' });
        } else {
          setError(res.data.message);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Thao tác thất bại!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container fade-in">
        {/* Logo */}
        <div className="login-logo">
          <div className="logo-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#2962ff"/>
              <path d="M8 22L12 14L16 18L20 10L24 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="logo-text">StockLab</h1>
          <p className="logo-subtitle">
            {mode === 'login' ? 'Hệ thống mô phỏng sàn giao dịch chứng khoán' : 
             mode === '2fa' ? 'Xác thực 2 bước (SMS)' :
             mode === 'forgot_request' ? 'Khôi phục mật khẩu' : 'Đặt lại mật khẩu mới'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="alert alert-error">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 10a.75.75 0 100 1.5.75.75 0 000-1.5zM8 4a.75.75 0 00-.75.75v4a.75.75 0 001.5 0v-4A.75.75 0 008 4z"/>
              </svg>
              {error}
            </div>
          )}
          {success && (
            <div className="alert alert-success" style={{ backgroundColor: 'rgba(76, 175, 80, 0.1)', color: '#4caf50', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm3 4a.75.75 0 01.02 1.06L7.47 9.82a.75.75 0 01-1.08-.02L4.97 8.3a.75.75 0 111.06-1.06l1.23 1.23 3.48-3.48A.75.75 0 0111 5z"/>
              </svg>
              {success}
            </div>
          )}

          {mode === 'login' && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="username">Tên đăng nhập</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  className="form-input"
                  placeholder="Nhập tên đăng nhập"
                  value={form.username}
                  onChange={handleChange}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" htmlFor="password">Mật khẩu</label>
                  <button 
                    type="button" 
                    className="btn-link" 
                    style={{ fontSize: '0.85rem', marginBottom: '8px', color: '#2962ff', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    onClick={() => setMode('forgot_request')}
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="form-input"
                  placeholder="Nhập mật khẩu"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </>
          )}

          {mode === '2fa' && (
            <div className="form-group">
              {qrCodeBase64 && (
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <p style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '12px' }}>
                    Quét mã QR bên dưới bằng ứng dụng <strong style={{ color: '#fff' }}>Google Authenticator</strong>
                  </p>
                  <img
                    src={qrCodeBase64}
                    alt="QR Code"
                    style={{
                      width: '220px',
                      height: '220px',
                      borderRadius: '12px',
                      border: '2px solid rgba(41, 98, 255, 0.5)',
                      padding: '8px',
                      background: '#fff'
                    }}
                  />
                </div>
              )}
              <label className="form-label" htmlFor="otpCode">Mã OTP từ Google Authenticator (6 chữ số)</label>
              <input
                id="otpCode"
                name="otpCode"
                type="text"
                className="form-input"
                placeholder="Nhập mã 6 chữ số từ ứng dụng"
                value={form.otpCode}
                onChange={handleChange}
                required
                maxLength={6}
                autoFocus
                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '8px', fontWeight: 'bold' }}
              />
              <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '10px', textAlign: 'center' }}>
                Mở Google Authenticator trên điện thoại → Nhập mã 6 số hiển thị
              </p>
            </div>
          )}

          {mode === 'forgot_request' && (
            <div className="form-group">
              <label className="form-label" htmlFor="username">Tên đăng nhập</label>
              <input
                id="username"
                name="username"
                type="text"
                className="form-input"
                placeholder="Nhập tên đăng nhập để lấy OTP"
                value={form.username}
                onChange={handleChange}
                required
                autoFocus
              />
            </div>
          )}

          {mode === 'forgot_reset' && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="username">Tên đăng nhập</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  className="form-input"
                  value={form.username}
                  onChange={handleChange}
                  disabled
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="otpCode">Mã OTP (từ Email)</label>
                <input
                  id="otpCode"
                  name="otpCode"
                  type="text"
                  className="form-input"
                  placeholder="Nhập mã OTP nhận được"
                  value={form.otpCode}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="newPassword">Mật khẩu mới</label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  className="form-input"
                  placeholder="Nhập mật khẩu mới"
                  value={form.newPassword}
                  onChange={handleChange}
                  required
                />
              </div>
            </>
          )}

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? (
              <>
                <div className="spinner"></div>
                Đang xử lý...
              </>
            ) : (
              mode === 'login' ? 'Đăng nhập' : 
              mode === '2fa' ? 'Xác nhận OTP' :
              mode === 'forgot_request' ? 'Gửi mã OTP' : 'Xác nhận đặt lại'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link></p>
        </div>
      </div>

      {/* Background decoration */}
      <div className="login-bg-decoration">
        <div className="bg-circle bg-circle-1"></div>
        <div className="bg-circle bg-circle-2"></div>
        <div className="bg-line bg-line-1"></div>
        <div className="bg-line bg-line-2"></div>
      </div>
    </div>
  );
}
