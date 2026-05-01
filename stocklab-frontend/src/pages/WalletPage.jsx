import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { walletAPI, vnpayAPI } from '../api/api';
import { usePageTour } from '../hooks/usePageTour';
import './WalletPage.css';

export default function WalletPage() {
  const { user, fetchUserProfile } = useAuth();
  const { restartTour } = usePageTour('wallet');
  const [activeTab, setActiveTab] = useState('deposit');

  // Deposit state
  const [depositAmount, setDepositAmount] = useState('');
  const [pendingPayment, setPendingPayment] = useState(null); // {paymentUrl, txnRef, amount}

  const [withdrawStep, setWithdrawStep] = useState(1);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawBankName, setWithdrawBankName] = useState('VCB');
  const [withdrawBankAccount, setWithdrawBankAccount] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // History state
  const [historyItems, setHistoryItems] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN').format(amount || 0);
  };

  // ----- LOGIC RÚT TIỀN (CÓ OTP) -----
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendOtp = async () => {
    setIsSendingOtp(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await walletAPI.requestWithdrawOtp();
      if (res.data.success) {
        setMessage({ type: 'success', text: 'Đã gửi mã OTP về email của bạn!' });
        setCountdown(60);
        return true;
      } else {
        setMessage({ type: 'error', text: res.data.message });
        return false;
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Không thể gửi mã OTP lúc này.' });
      return false;
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleNextStep = async (e) => {
    if (e) e.preventDefault();
    const rawWithdrawAmount = withdrawAmount.replace(/\D/g, '');
    if (!rawWithdrawAmount || Number(rawWithdrawAmount) < 10000) {
      setMessage({ type: 'error', text: 'Số tiền rút tối thiểu là 10,000 VNĐ' });
      return;
    }
    if (!withdrawBankAccount) {
      setMessage({ type: 'error', text: 'Vui lòng nhập số tài khoản nhận' });
      return;
    }
    // Gửi OTP
    const isSuccess = await handleSendOtp();
    // Chỉ chuyển sang bước 2 (Xác nhận) nếu gửi OTP thực sự thành công
    if (isSuccess) {
      setWithdrawStep(2);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const rawWithdrawAmount = withdrawAmount.replace(/\D/g, '');
    if (!rawWithdrawAmount || Number(rawWithdrawAmount) < 10000) {
      setMessage({ type: 'error', text: 'Số tiền rút tối thiểu là 10,000 VNĐ' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const payload = {
        amount: Number(rawWithdrawAmount),
        bankName: withdrawBankName,
        bankAccount: withdrawBankAccount,
        otpCode: otpCode
      };
      const res = await walletAPI.withdraw(payload);
      if (res.data.success) {
        setMessage({ type: 'success', text: `Tạo lệnh rút ${formatCurrency(rawWithdrawAmount)}₫ thành công!` });
        setWithdrawAmount('');
        setWithdrawBankAccount('');
        setOtpCode('');
        setCountdown(0);
        if (fetchUserProfile) await fetchUserProfile();
        fetchHistory();
      } else {
        setMessage({ type: 'error', text: res.data.message || 'Lỗi khi rút tiền' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Không thể kết nối đến hệ thống.' });
    } finally {
      setLoading(false);
    }
  };


  // ----- LOGIC NẠP TIỀN QUA VNPAY -----
  const handleDeposit = async (e) => {
    e.preventDefault();
    const rawDepositAmount = depositAmount.replace(/\D/g, '');
    if (!rawDepositAmount || Number(rawDepositAmount) < 10000) {
      setMessage({ type: 'error', text: 'Số tiền nạp tối thiểu là 10.000 VNĐ' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await vnpayAPI.createPayment({ amount: Number(rawDepositAmount) });
      if (res.data.success) {
        setPendingPayment({
          paymentUrl: res.data.data.paymentUrl,
          txnRef: res.data.data.txnRef,
          amount: Number(rawDepositAmount),
        });
        setMessage({ type: '', text: '' });
        fetchHistory();
      } else {
        setMessage({ type: 'error', text: res.data.message || 'Lỗi khi tạo thanh toán' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Không thể kết nối đến máy chủ.' });
    } finally {
      setLoading(false);
    }
  };

  const [copiedField, setCopiedField] = useState('');
  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(''), 2000);
  };

  const VNPAY_BANK_INFO = {
    bankName: 'VNPay - Cổng thanh toán',
    accountName: user?.fullName || user?.username || 'StockLab User',
    accountNo: 'Thanh toán qua cổng VNPay',
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await walletAPI.getHistory(0, 50);
      if (res.data.success && res.data.data?.content) {
        setHistoryItems(res.data.data.content);
      }
    } catch (error) {
      console.error('Lỗi khi tải lịch sử:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
      if (fetchUserProfile) fetchUserProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);


  return (
    <div className="wallet-container fade-in">
      <div className="wallet-header">
        <div>
          <h1>Quản Lý Giao Dịch Tiền</h1>
          <p>Nạp thêm nguồn vốn hoặc rút lợi nhuận về tài khoản cá nhân</p>
        </div>
        <button className="page-tour-btn" onClick={restartTour} title="Hướng dẫn trang này">?</button>
      </div>

      <div className="wallet-grid">
        {/* Cột trái: Số dư */}
        <div className="wallet-sidebar">
          <div className="balance-card">
            <h3 className="balance-title">Số dư khả dụng</h3>
            <div className="balance-amount">{formatCurrency(user?.availableBalance)} <span className="currency">VNĐ</span></div>
            <div className="balance-sub">
              Tổng tài sản: {formatCurrency(user?.balance)} VNĐ
            </div>
            {/* Lệnh PENDING sẽ trừ tiền availableBalance (giữ lại balance ảo trên giao diện để rõ ràng) */}
            <div className="balance-sub text-warning" style={{ marginTop: '4px' }}>
              Bị giữ (chờ khớp): {formatCurrency((user?.balance || 0) - (user?.availableBalance || 0))} VNĐ
            </div>
          </div>
        </div>

        {/* Cột phải: Form */}
        <div className="wallet-main">
          <div className="wallet-tabs">
            <button
              className={`wallet-tab ${activeTab === 'deposit' ? 'active' : ''}`}
              onClick={() => { setActiveTab('deposit'); setMessage({ type: '', text: '' }); }}
            >
              Nạp tiền
            </button>
            <button
              className={`wallet-tab ${activeTab === 'withdraw' ? 'active' : ''}`}
              onClick={() => { setActiveTab('withdraw'); setMessage({ type: '', text: '' }); }}
            >
              Rút tiền
            </button>
            <button
              className={`wallet-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => { setActiveTab('history'); setMessage({ type: '', text: '' }); }}
            >
              Lịch sử
            </button>
          </div>

          <div className="wallet-content">
            {message.text && (
              <div className={`wallet-alert ${message.type}`}>
                {message.text}
              </div>
            )}

            {activeTab === 'deposit' && (
              <div className="deposit-section">
                {pendingPayment ? (
                  /* === GIAO DIỆN NẠP TIỀN QUA MÃ QR (SSI-STYLE) === */
                  <div className="deposit-qr-layout">
                    <h3 className="deposit-qr-title">NẠP TIỀN QUA MÃ QR</h3>

                    <div className="deposit-qr-grid">
                      {/* BÊN TRÁI: Thông tin chuyển khoản */}
                      <div className="deposit-info-panel">
                        {/* Tài khoản */}
                        <div className="info-row">
                          <span className="info-label">Tài khoản nạp tiền</span>
                          <div className="info-value-group">
                            <span className="info-value">{user?.username || 'StockLab'} - TK tiền mặt - {user?.fullName || user?.username}</span>
                          </div>
                        </div>

                        {/* Số tiền */}
                        <div className="info-row">
                          <span className="info-label">Số tiền</span>
                          <div className="info-value-group">
                            <span className="info-value highlight">{formatCurrency(pendingPayment.amount)} VNĐ</span>
                            <button className="copy-btn" onClick={() => copyToClipboard(String(pendingPayment.amount), 'amount')}>
                              {copiedField === 'amount' ? '✓' : '📋'}
                            </button>
                          </div>
                        </div>

                        {/* Ngân hàng */}
                        <div className="info-row">
                          <span className="info-label">Cổng thanh toán</span>
                          <div className="info-value-group">
                            <span className="info-value">VNPay - Cổng thanh toán trực tuyến</span>
                          </div>
                        </div>

                        {/* Tên chủ tài khoản */}
                        <div className="info-row">
                          <span className="info-label">Tên chủ tài khoản</span>
                          <div className="info-value-group">
                            <span className="info-value">{user?.fullName || user?.username || 'StockLab User'}</span>
                            <button className="copy-btn" onClick={() => copyToClipboard(user?.fullName || user?.username || '', 'name')}>
                              {copiedField === 'name' ? '✓' : '📋'}
                            </button>
                          </div>
                        </div>

                        {/* Mã giao dịch */}
                        <div className="info-row">
                          <span className="info-label">Mã giao dịch</span>
                          <div className="info-value-group">
                            <span className="info-value">{pendingPayment.txnRef}</span>
                            <button className="copy-btn" onClick={() => copyToClipboard(pendingPayment.txnRef, 'txnRef')}>
                              {copiedField === 'txnRef' ? '✓' : '📋'}
                            </button>
                          </div>
                        </div>

                        {/* Nội dung */}
                        <div className="info-row">
                          <span className="info-label">Nội dung</span>
                          <div className="info-value-group">
                            <span className="info-value">Nap tien {pendingPayment.txnRef} tai StockLab</span>
                            <button className="copy-btn" onClick={() => copyToClipboard(`Nap tien ${pendingPayment.txnRef} tai StockLab`, 'content')}>
                              {copiedField === 'content' ? '✓' : '📋'}
                            </button>
                          </div>
                        </div>

                        {/* Buttons */}
                        <div className="deposit-qr-actions">
                          <button
                            className="btn-create-qr"
                            onClick={async () => {
                              if (pendingPayment && pendingPayment.txnRef) {
                                try {
                                  await vnpayAPI.cancelPayment(pendingPayment.txnRef);
                                } catch (error) {
                                  console.error("Failed to cancel payment", error);
                                }
                              }
                              setPendingPayment(null);
                              setDepositAmount('');
                              fetchHistory();
                            }}
                          >
                            Tạo giao dịch mới
                          </button>
                          <a
                            href={pendingPayment.paymentUrl}
                            className="btn-direct-pay"
                          >
                            Thanh toán
                          </a>
                        </div>
                      </div>

                      {/* BÊN PHẢI: QR Code */}
                      <div className="deposit-qr-panel">
                        <div className="qr-code-wrapper">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(pendingPayment.paymentUrl)}`}
                            alt="Mã QR Thanh Toán VNPay"
                            className="qr-code-img"
                          />
                        </div>
                        <div className="qr-info-box">
                          <div className="qr-info-row">
                            <span className="qr-info-label">Tên chủ TK</span>
                            <span className="qr-info-value">{user?.fullName || user?.username}</span>
                          </div>
                          <div className="qr-info-row">
                            <span className="qr-info-label">Mã GD</span>
                            <span className="qr-info-value">{pendingPayment.txnRef}</span>
                          </div>
                          <div className="qr-info-row">
                            <span className="qr-info-label">Nội dung CK</span>
                            <span className="qr-info-value">Nap tien {pendingPayment.txnRef} tai StockLab</span>
                          </div>
                        </div>
                        <a
                          href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(pendingPayment.paymentUrl)}`}
                          download={`vnpay-qr-${pendingPayment.txnRef}.png`}
                          className="btn-download-qr"
                        >
                          ↓ Tải về
                        </a>
                      </div>
                    </div>

                    {/* Lưu ý */}
                    <div className="deposit-note">
                      <span>•</span> Quét mã QR bằng ứng dụng ngân hàng hoặc camera điện thoại để thanh toán qua VNPay. Tiền sẽ được cộng tự động sau khi thanh toán thành công.
                    </div>
                  </div>
                ) : (
                  /* === FORM NHẬP SỐ TIỀN === */
                  <form className="wallet-form form-box" onSubmit={handleDeposit} style={{ background: '#1a1d24', padding: '25px', borderRadius: '12px' }}>
                    <h4 className="mb-4 text-white" style={{ textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px' }}>Nạp Tiền Qua Mã QR</h4>

                    <div className="form-group mb-4">
                      <label className="text-muted">Số tiền (VNĐ)</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Nhập số tiền cần nạp"
                          value={depositAmount}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '');
                            if (raw) {
                              setDepositAmount(new Intl.NumberFormat('vi-VN').format(raw));
                            } else {
                              setDepositAmount('');
                            }
                          }}
                          required
                          style={{ fontSize: '1.1rem', padding: '12px 60px 12px 12px' }}
                        />
                        <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#718096', fontWeight: '600' }}>VND</span>
                      </div>
                      <small className="form-text text-muted mt-2">Tối thiểu: 10,000 VNĐ</small>
                    </div>

                    {/* Quick amount buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                      {[100000, 500000, 1000000, 5000000, 10000000].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDepositAmount(new Intl.NumberFormat('vi-VN').format(amt))}
                          style={{
                            background: depositAmount.replace(/\D/g, '') === String(amt) ? '#e53e3e' : '#2d3748',
                            color: depositAmount.replace(/\D/g, '') === String(amt) ? '#fff' : '#a0aec0',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px 14px',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          {formatCurrency(amt)}₫
                        </button>
                      ))}
                    </div>

                    <div className="form-actions mt-4">
                      <button type="submit" className="btn-create-qr" disabled={loading} style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }}>
                        {loading ? 'Đang tạo mã QR...' : 'Tạo mã QR'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {activeTab === 'withdraw' && (
              <div className="withdraw-container">
                <div className="withdraw-steps">
                  <div className={`withdraw-step ${withdrawStep >= 1 ? 'active' : ''}`}>
                    <div className="step-number">1</div>
                    <div className="step-text">Tạo yêu cầu</div>
                  </div>
                  <div className={`step-line ${withdrawStep >= 2 ? 'active' : ''}`}></div>
                  <div className={`withdraw-step ${withdrawStep >= 2 ? 'active' : ''}`}>
                    <div className="step-number">2</div>
                    <div className="step-text">Xác nhận</div>
                  </div>
                </div>

                {withdrawStep === 1 ? (
                  <form className="withdraw-horizontal-form" onSubmit={handleNextStep}>
                    {/* KHỐI 1 */}
                    <div className="form-section">
                      <div className="section-header-flex">
                        <h5 className="section-title">Thông tin người chuyển</h5>
                      </div>
                      <div className="hz-form-row">
                        <p className="hz-label">Tài khoản nguồn</p>
                        <div className="hz-value">
                          <select className="hz-select" disabled>
                            <option>G044181 - {user?.fullName || user?.username || 'Người dùng'}</option>
                          </select>
                        </div>
                      </div>
                      <div className="hz-form-row">
                        <p className="hz-label">Số tiền có thể chuyển</p>
                        <div className="hz-value font-weight-bold" style={{ color: '#52c41a' }}>
                          {formatCurrency(user?.availableBalance)} VND
                        </div>
                      </div>
                    </div>

                    {/* KHỐI 2 */}
                    <div className="form-section mt-3">
                      <div className="section-header-flex">
                        <h5 className="section-title">Thông tin người nhận & giao dịch</h5>
                        <a href="#" className="section-link">Quản lý TKNH và hạn mức</a>
                      </div>

                      <div className="hz-form-row">
                        <p className="hz-label">Loại tài khoản</p>
                        <div className="hz-value">
                          <select className="hz-select">
                            <option>Tài khoản ngân hàng đăng ký trước</option>
                          </select>
                        </div>
                      </div>

                      <div className="hz-form-row">
                        <p className="hz-label">Ngân hàng thụ hưởng</p>
                        <div className="hz-value">
                          <select
                            className="hz-select"
                            value={withdrawBankName}
                            onChange={(e) => setWithdrawBankName(e.target.value)}
                          >
                            <option value="VCB">Vietcombank</option>
                            <option value="TCB">Techcombank</option>
                            <option value="MB">MB Bank</option>
                            <option value="BIDV">BIDV</option>
                          </select>
                        </div>
                      </div>

                      <div className="hz-form-row">
                        <p className="hz-label">Số tài khoản nhận tiền</p>
                        <div className="hz-value">
                          <input
                            type="text"
                            className="hz-input"
                            placeholder="Nhập số tài khoản"
                            value={withdrawBankAccount}
                            onChange={(e) => setWithdrawBankAccount(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="hz-form-row">
                        <p className="hz-label">Tên người thụ hưởng</p>
                        <div className="hz-value">-</div>
                      </div>

                      <div className="hz-form-row" style={{ alignItems: 'flex-start' }}>
                        <p className="hz-label" style={{ marginTop: '8px' }}>Số tiền chuyển</p>
                        <div className="hz-value" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <input
                            type="text"
                            className="hz-input"
                            placeholder="Nhập số tiền chuyển"
                            value={withdrawAmount}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, '');
                              if (raw) {
                                setWithdrawAmount(new Intl.NumberFormat('vi-VN').format(raw));
                              } else {
                                setWithdrawAmount('');
                              }
                            }}
                            required
                          />
                          <small style={{ color: '#faad14', fontSize: '0.82rem', fontStyle: 'italic' }}>
                            * Hạn mức một lần rút tối đa là 50,000,000 VNĐ
                          </small>
                        </div>
                      </div>

                      <div className="hz-form-row">
                        <p className="hz-label">Loại phí</p>
                        <div className="hz-value">
                          <select className="hz-select" disabled>
                            <option>Phí ngoài</option>
                          </select>
                        </div>
                      </div>

                      <div className="hz-form-row">
                        <p className="hz-label">Phí chuyển tiền</p>
                        <div className="hz-value">0 VNĐ</div>
                      </div>

                      <div className="hz-form-row">
                        <p className="hz-label">Nội dung chuyển tiền</p>
                        <div className="hz-value">
                          <textarea
                            className="hz-textarea"
                            defaultValue="Chuyen tien StockLab"
                          ></textarea>
                        </div>
                      </div>
                    </div>

                    {/* KHỐI 3 */}
                    <div className="form-section mt-3">
                      <div className="hz-form-row">
                        <p className="hz-label">Kiểu xác thực</p>
                        <div className="hz-value font-weight-bold" style={{ color: '#fff' }}>Mã SMS OTP</div>
                      </div>
                    </div>

                    <div className="action-row mt-4">
                      <button type="submit" className="btn-withdraw-action" disabled={loading}>
                        Tiếp theo
                      </button>
                    </div>
                  </form>
                ) : (
                  <form className="withdraw-horizontal-form" onSubmit={handleWithdraw}>
                    <div className="otp-auth-layout">
                      <div className="otp-auth-title">Xác thực giao dịch</div>
                      <div className="otp-auth-desc">Vui lòng kiểm tra email của bạn để lấy mã OTP và nhập vào ô bên dưới.</div>

                      <div className="otp-input-group">
                        <input
                          type="text"
                          className="otp-input"
                          placeholder="Nhập 6 số OTP..."
                          maxLength="6"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="btn-otp-action"
                          onClick={handleSendOtp}
                          disabled={countdown > 0 || isSendingOtp}
                        >
                          {isSendingOtp ? 'Đang gửi...' : countdown > 0 ? `Chờ ${countdown}s` : 'Gửi mã OTP'}
                        </button>
                      </div>

                      <div className="action-row">
                        <button type="button" className="btn-withdraw-back" onClick={() => setWithdrawStep(1)}>
                          Quay lại
                        </button>
                        <button type="submit" className="btn-withdraw-action" disabled={loading || !otpCode}>
                          {loading ? 'Đang xử lý...' : 'Xác nhận Rút Lợi Nhuận'}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="history-section">
                {loadingHistory ? (
                  <p className="text-center text-muted py-4">Đang tải lịch sử...</p>
                ) : historyItems.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🕒</div>
                    <h4>Chưa có giao dịch nào</h4>
                    <p className="text-muted">Lịch sử nạp/rút sẽ hiển thị tại đây.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table wallet-table">
                      <thead>
                        <tr>
                          <th>Mã GD</th>
                          <th>Loại</th>
                          <th className="text-right">Số Tiền</th>
                          <th>Ngân hàng</th>
                          <th>Thời gian</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyItems.map((item) => (
                          <tr key={item.id}>
                            <td>
                              #{item.transactionCode || item.id}
                            </td>
                            <td>
                              <span className={`transaction-type ${item.type.toLowerCase()}`}>
                                {item.type === 'DEPOSIT' ? 'Nạp tiền' : 'Rút tiền'}
                              </span>
                            </td>
                            <td className={`text-right font-weight-bold ${item.type === 'DEPOSIT' ? 'text-success' : 'text-danger'}`}>
                              {item.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(item.amount)}₫
                            </td>
                            <td>
                              <div>{item.bankName}</div>
                              <small className="text-muted">{item.bankAccount}</small>
                            </td>
                            <td>{new Date(item.createdAt).toLocaleString('vi-VN')}</td>
                            <td>
                              <span className={`status-badge ${item.status.toLowerCase()}`}>
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
