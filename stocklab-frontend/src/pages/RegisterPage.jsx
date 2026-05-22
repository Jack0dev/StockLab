import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/api';
import './RegisterPage.css';

export default function RegisterPage() {
  const navigate = useNavigate();
  
  // States
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
  });
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Timer for Resend OTP
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp!');
      setLoading(false);
      return;
    }

    try {
      const { confirmPassword, ...data } = form;
      const res = await authAPI.register(data);
      if (res.data.success) {
        setSuccess('Đăng ký thành công! Đã gửi mã OTP đến email của bạn.');
        setStep(2);
        setCountdown(60); // 60 seconds cooldown for resend
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký thất bại!');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (otp.length !== 6) {
      setError('Mã OTP phải bao gồm 6 chữ số!');
      setLoading(false);
      return;
    }

    try {
      const res = await authAPI.verifyRegistration({ email: form.email, otpCode: otp });
      if (res.data.success) {
        setSuccess('Xác thực thành công! Đang chuyển đến trang đăng nhập...');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Xác thực OTP thất bại!');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await authAPI.resendOtp(form.email);
      if (res.data.success) {
        setSuccess('Đã gửi lại mã OTP. Vui lòng kiểm tra email.');
        setCountdown(60);
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Gửi lại OTP thất bại!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-container fade-in">
        {/* Logo */}
        <div className="register-logo">
          <div className="logo-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#2962ff"/>
              <path d="M8 22L12 14L16 18L20 10L24 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="logo-text">{step === 1 ? 'Tạo tài khoản' : 'Xác thực Email'}</h1>
          <p className="logo-subtitle">
            {step === 1 
              ? 'Đăng ký để bắt đầu giao dịch trên StockLab' 
              : `Mã xác thực đã được gửi đến ${form.email}`}
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {step === 1 && (
          <form onSubmit={handleRegisterSubmit} className="register-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="fullName">Họ và tên</label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  className="form-input"
                  placeholder="Nguyễn Văn A"
                  value={form.fullName}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="phone">Số điện thoại</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  className="form-input"
                  placeholder="0123456789"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-username">Tên đăng nhập *</label>
              <input
                id="reg-username"
                name="username"
                type="text"
                className="form-input"
                placeholder="Tối thiểu 3 ký tự"
                value={form.username}
                onChange={handleChange}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">Email *</label>
              <input
                id="reg-email"
                name="email"
                type="email"
                className="form-input"
                placeholder="example@email.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="reg-password">Mật khẩu *</label>
                <input
                  id="reg-password"
                  name="password"
                  type="password"
                  className="form-input"
                  placeholder="Tối thiểu 6 ký tự"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="confirmPassword">Xác nhận mật khẩu *</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  className="form-input"
                  placeholder="Nhập lại mật khẩu"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Đang xử lý...
                </>
              ) : (
                'Đăng ký'
              )}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleOtpSubmit} className="register-form">
            <div className="form-group">
              <label className="form-label" htmlFor="otp">Nhập mã OTP 6 chữ số *</label>
              <input
                id="otp"
                name="otp"
                type="text"
                maxLength="6"
                className="form-input"
                placeholder="000000"
                value={otp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setOtp(val);
                  setError('');
                }}
                required
                autoFocus
                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.2rem' }}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading || otp.length < 6}>
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Đang xác thực...
                </>
              ) : (
                'Xác thực'
              )}
            </button>

            <div className="resend-container" style={{ marginTop: '1rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                Chưa nhận được mã?
              </p>
              <button 
                type="button" 
                className="btn btn-outline btn-block" 
                onClick={handleResendOtp}
                disabled={countdown > 0 || loading}
              >
                {countdown > 0 ? `Chờ ${countdown}s để nhận lại mã` : 'Gửi lại mã OTP'}
              </button>
            </div>
          </form>
        )}

        <div className="register-footer">
          <p>Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
        </div>
      </div>

      {/* Background decoration */}
      <div className="login-bg-decoration">
        <div className="bg-circle bg-circle-1"></div>
        <div className="bg-circle bg-circle-2"></div>
      </div>
    </div>
  );
}
