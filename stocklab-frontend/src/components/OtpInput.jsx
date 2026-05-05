import { useState, useEffect, useRef } from 'react';
import './OtpInput.css';

export default function OtpInput({ 
  value, 
  onChange, 
  onSendOtp, 
  title = "Xác thực giao dịch", 
  desc = "Vui lòng kiểm tra email của bạn để lấy mã OTP và nhập vào ô bên dưới.",
  isSending = false,
  autoSend = false
}) {
  const [countdown, setCountdown] = useState(0);
  const autoSentRef = useRef(false);

  // Tự động gửi OTP khi component được mount (nếu autoSend = true)
  useEffect(() => {
    if (autoSend && !autoSentRef.current && onSendOtp) {
      autoSentRef.current = true;
      onSendOtp().then(success => {
        if (success) setCountdown(60);
      });
    }
  }, [autoSend, onSendOtp]);

  // Đếm ngược
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendClick = async () => {
    if (onSendOtp) {
      const success = await onSendOtp();
      if (success) setCountdown(60);
    }
  };

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const countdownDisplay = minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')}`
    : `${seconds}s`;

  return (
    <div className="otp-auth-layout">
      {title && <div className="otp-auth-title">{title}</div>}
      {desc && <div className="otp-auth-desc">{desc}</div>}

      {/* Hiển thị countdown nổi bật */}
      {countdown > 0 && (
        <div className="otp-countdown">
          <span className="otp-countdown-icon">⏱</span>
          Gửi lại mã sau <strong>{countdownDisplay}</strong>
        </div>
      )}

      <div className="otp-input-group">
        <input
          type="text"
          className="otp-input"
          placeholder="Nhập 6 số OTP..."
          maxLength="6"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          required
        />
        <button
          type="button"
          className="btn-resend-otp"
          onClick={handleSendClick}
          disabled={countdown > 0 || isSending}
          title={countdown > 0 ? `Vui lòng chờ ${countdownDisplay} để gửi lại` : 'Gửi mã OTP mới'}
        >
          {isSending ? (
            <span className="otp-sending-dots">Đang gửi<span>.</span><span>.</span><span>.</span></span>
          ) : countdown > 0 ? (
            `Gửi lại (${countdownDisplay})`
          ) : (
            'Gửi lại mã'
          )}
        </button>
      </div>
    </div>
  );
}
