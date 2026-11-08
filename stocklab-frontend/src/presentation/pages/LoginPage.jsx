import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '@/infrastructure/repositories/api';
import { useAuth } from '@/infrastructure/context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState('login'); // 'login', 'forgot_request', 'forgot_reset', '2fa'
  const [tempToken, setTempToken] = useState('');
  const [qrCodeBase64, setQrCodeBase64] = useState('');
  const [form, setForm] = useState({ username: '', password: '', email: '', otpCode: '', newPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
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

  const fillQuickAccount = (uname, pwd) => {
    setForm(prev => ({ ...prev, username: uname, password: pwd }));
    setError('');
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
    <div className="login-editorial-page">
      {/* Left Column: Creative Editorial Brand Showcase */}
      <div className="editorial-showcase-panel">
        <div className="showcase-content">
          <div className="showcase-brand-tag">
            <span className="brand-dot-black"></span>
            <span className="brand-name-bold">StockLab</span>
            <span className="edition-badge">PHIÊN BẢN 2026</span>
          </div>

          <div className="showcase-hero-statement">
            <h1>Nền tảng giao dịch mô phỏng định lượng thế hệ mới</h1>
            <p className="statement-sub">
              Trải nghiệm khớp lệnh liên tục FIFO, quản lý rủi ro danh mục và hệ thống khuyến nghị dữ liệu chuyên sâu từ mô hình AI Gemini.
            </p>
          </div>

          {/* Typographic numbered features - No icons */}
          <div className="editorial-pillars">
            <div className="pillar-block">
              <span className="pillar-index mono-num">01</span>
              <div className="pillar-body">
                <h3>Matching Engine Tốc Độ Cao</h3>
                <p>Khớp lệnh liên tục với cơ chế ưu tiên Giá / Thời gian (FIFO), mô phỏng trọn vẹn quy chế khớp lệnh HOSE & HNX.</p>
              </div>
            </div>

            <div className="pillar-block">
              <span className="pillar-index mono-num">02</span>
              <div className="pillar-body">
                <h3>Trí Tuệ Nhân Tạo & Dự Báo ML</h3>
                <p>Tích hợp trợ lý tư vấn tài chính Google Gemini 2.5 và pipeline tính toán chỉ báo kỹ thuật RSI, MACD, Bollinger Bands.</p>
              </div>
            </div>

            <div className="pillar-block">
              <span className="pillar-index mono-num">03</span>
              <div className="pillar-body">
                <h3>Bảo Mật Xác Thực Đa Lớp</h3>
                <p>Cơ chế xác thực hai bước (2FA TOTP), quản lý phân quyền chặt chẽ giữa Quản trị viên và Nhà đầu tư cá nhân.</p>
              </div>
            </div>
          </div>

          <div className="showcase-footer-strip">
            <div className="strip-item">
              <span className="strip-val mono-num">21</span>
              <span className="strip-label">MÃ VN30 ĐANG NIÊM YẾT</span>
            </div>
            <div className="strip-item">
              <span className="strip-val mono-num">1.0s</span>
              <span className="strip-label">CHU KỲ QUÉT LỆNH TỰ ĐỘNG</span>
            </div>
            <div className="strip-item">
              <span className="strip-val mono-num">T+1.5</span>
              <span className="strip-label">CHU KỲ THANH TOÁN TIỀN/CK</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Clean White Form */}
      <div className="editorial-auth-panel">
        <div className="auth-card-light fade-in">
          <div className="auth-header-group">
            <h2 className="auth-title">
              {mode === 'login' && 'Đăng nhập'}
              {mode === '2fa' && 'Xác thực 2FA'}
              {mode === 'forgot_request' && 'Khôi phục mật khẩu'}
              {mode === 'forgot_reset' && 'Đặt lại mật khẩu'}
            </h2>
            <p className="auth-desc">
              {mode === 'login' && 'Truy cập tài khoản giao dịch chứng khoán của bạn'}
              {mode === '2fa' && 'Nhập mã 6 chữ số từ Google Authenticator'}
              {mode === 'forgot_request' && 'Nhập tên tài khoản để nhận mã khôi phục qua email'}
              {mode === 'forgot_reset' && 'Nhập mã OTP đã nhận và mật khẩu mới'}
            </p>
          </div>

          {/* Quick-Fill Demo Pills */}
          {mode === 'login' && (
            <div className="quick-access-box">
              <span className="quick-access-title">Tài khoản thử nghiệm nhanh:</span>
              <div className="quick-access-chips">
                <button 
                  type="button" 
                  className="quick-chip-btn" 
                  onClick={() => fillQuickAccount('admin', 'Admin@123')}
                >
                  <span className="chip-tag tag-admin">Admin</span>
                  <span>admin / Admin@123</span>
                </button>
                <button 
                  type="button" 
                  className="quick-chip-btn" 
                  onClick={() => fillQuickAccount('user1', 'user123')}
                >
                  <span className="chip-tag tag-user">Trader</span>
                  <span>user1 / user123</span>
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form-light">
            {mode === 'login' && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="username">Tên đăng nhập</label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    className="form-input"
                    placeholder="VD: user1 hoặc admin"
                    value={form.username}
                    onChange={handleChange}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <div className="label-with-action">
                    <label className="form-label" htmlFor="password">Mật khẩu</label>
                    <button 
                      type="button" 
                      className="text-sub-link"
                      onClick={() => setMode('forgot_request')}
                    >
                      Quên mật khẩu?
                    </button>
                  </div>
                  <div className="password-input-wrap">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Nhập mật khẩu"
                      value={form.password}
                      onChange={handleChange}
                      required
                    />
                    <button 
                      type="button" 
                      className="pwd-toggle-text-btn"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary btn-block btn-lg mt-2"
                  disabled={loading}
                >
                  {loading ? 'Đang xác thực thông tin...' : 'Đăng Nhập Vào Sàn'}
                </button>
              </>
            )}

            {mode === '2fa' && (
              <div className="form-group">
                {qrCodeBase64 && (
                  <div className="qr-light-box">
                    <p className="qr-guide-text">
                      Quét mã QR bằng ứng dụng <strong>Google Authenticator</strong>:
                    </p>
                    <img src={qrCodeBase64} alt="QR Code" className="qr-view" />
                  </div>
                )}
                <label className="form-label" htmlFor="otpCode">Mã OTP (6 chữ số)</label>
                <input
                  id="otpCode"
                  name="otpCode"
                  type="text"
                  className="form-input otp-field"
                  placeholder="000000"
                  value={form.otpCode}
                  onChange={handleChange}
                  required
                  maxLength={6}
                  autoFocus
                />
                <button 
                  type="submit" 
                  className="btn btn-primary btn-block btn-lg mt-2"
                  disabled={loading}
                >
                  {loading ? 'Đang xác thực...' : 'Xác Nhận OTP'}
                </button>
              </div>
            )}

            {mode === 'forgot_request' && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="username">Tên đăng nhập</label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    className="form-input"
                    placeholder="Nhập tên đăng nhập để gửi mã"
                    value={form.username}
                    onChange={handleChange}
                    required
                    autoFocus
                  />
                </div>
                <button 
                  type="submit" 
                  className="btn btn-primary btn-block btn-lg mt-2"
                  disabled={loading}
                >
                  {loading ? 'Đang xử lý...' : 'Gửi Mã Xác Nhận'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-outline btn-block mt-1"
                  onClick={() => setMode('login')}
                >
                  Quay lại
                </button>
              </>
            )}

            {mode === 'forgot_reset' && (
              <>
                <div className="form-group">
                  <label className="form-label">Tài khoản</label>
                  <input
                    name="username"
                    type="text"
                    className="form-input"
                    value={form.username}
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
                    placeholder="Nhập 6 số OTP"
                    value={form.otpCode}
                    onChange={handleChange}
                    required
                    autoFocus
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
                <button 
                  type="submit" 
                  className="btn btn-primary btn-block btn-lg mt-2"
                  disabled={loading}
                >
                  {loading ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-outline btn-block mt-1"
                  onClick={() => setMode('login')}
                >
                  Quay lại
                </button>
              </>
            )}
          </form>

          {mode === 'login' && (
            <div className="auth-footer-prompt">
              <span>Chưa có tài khoản? </span>
              <Link to="/register" className="auth-signup-link">
                Tạo tài khoản giao dịch mới
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
