import { useState, useEffect } from 'react';
import { useAuth } from '@/infrastructure/context/AuthContext';
import { walletAPI, vnpayAPI, bankAPI } from '@/infrastructure/repositories/api';
import { usePageTour } from '@/presentation/controllers/usePageTour';
import OtpInput from '@/presentation/components/OtpInput';
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
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
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

  const handleLookupAccount = async () => {
    if (!withdrawBankAccount || !withdrawBankName) return;
    setIsLookupLoading(true);
    setLookupError('');
    setBeneficiaryName('');

    try {
      const res = await bankAPI.lookupAccount(withdrawBankName, withdrawBankAccount);
      if (res.data.success) {
        setBeneficiaryName(res.data.data);
      } else {
        setLookupError(res.data.message || 'Số tài khoản không hợp lệ');
      }
    } catch (err) {
      if (err.response?.data?.message) {
        setLookupError(err.response.data.message);
      } else {
        setLookupError('Lỗi kết nối. Vui lòng thử lại sau.');
      }
    } finally {
      setIsLookupLoading(false);
    }
  };

  const handleNextStep = async (e) => {
    if (e) e.preventDefault();
    const rawWithdrawAmount = withdrawAmount.replace(/\D/g, '');
    if (!rawWithdrawAmount || Number(rawWithdrawAmount) < 10000) {
      setMessage({ type: 'error', text: 'Số tiền rút tối thiểu là 10.000 VNĐ' });
      return;
    }
    if (!withdrawBankAccount) {
      setMessage({ type: 'error', text: 'Vui lòng nhập số tài khoản nhận tiền' });
      return;
    }
    if (!beneficiaryName) {
      setMessage({ type: 'error', text: 'Tên người thụ hưởng không hợp lệ. Vui lòng kiểm tra lại số tài khoản.' });
      return;
    }
    const isSuccess = await handleSendOtp();
    if (isSuccess) {
      setWithdrawStep(2);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const rawWithdrawAmount = withdrawAmount.replace(/\D/g, '');
    if (!rawWithdrawAmount || Number(rawWithdrawAmount) < 10000) {
      setMessage({ type: 'error', text: 'Số tiền rút tối thiểu là 10.000 VNĐ' });
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
        setBeneficiaryName('');
        setLookupError('');
        setOtpCode('');
        setCountdown(0);
        setWithdrawStep(1);
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

  const lockedAmt = (user?.balance || 0) - (user?.availableBalance || 0);

  return (
    <div className="wallet-editorial-page fade-in">
      {/* Header */}
      <div className="wallet-top-header">
        <div>
          <span className="wallet-page-tag">TRUNG TÂM TÀI CHÍNH</span>
          <h1 className="wallet-page-title">Quản Lý Nguồn Vốn & Ví Tiền</h1>
          <p className="wallet-page-sub">Nạp tiền ký quỹ giao dịch chứng khoán hoặc rút lợi nhuận về tài khoản ngân hàng</p>
        </div>
        <button className="help-text-btn" onClick={restartTour} title="Hướng dẫn sử dụng ví">
          Trợ giúp
        </button>
      </div>

      <div className="wallet-editorial-grid">
        {/* Cột trái: Thẻ Tài Khoản Sáng Sang Trọng */}
        <aside className="wallet-account-column">
          <div className="account-statement-card">
            <div className="statement-card-top">
              <span className="statement-eyebrow">TÀI KHOẢN TIỀN MẶT</span>
              <span className="account-status-tag">HOẠT ĐỘNG</span>
            </div>

            <div className="statement-owner">
              <span className="owner-title">Chủ tài khoản:</span>
              <strong className="owner-name">{user?.fullName || user?.username || 'Trader'}</strong>
              <span className="owner-sub mono-num">ID: {user?.username}</span>
            </div>

            <div className="statement-balances">
              <div className="balance-node main-node">
                <span className="node-caption">Số Dư Tiền Khả Dụng</span>
                <div className="node-number-row text-bullish">
                  <span className="node-amt tabular-num">{formatCurrency(user?.availableBalance)}</span>
                  <span className="node-curr">₫</span>
                </div>
              </div>

              <div className="balance-node sub-node">
                <span className="node-caption">Tổng Tài Sản Tài Khoản</span>
                <div className="node-number-row">
                  <span className="node-amt tabular-num">{formatCurrency(user?.balance)}</span>
                  <span className="node-curr">₫</span>
                </div>
              </div>

              {lockedAmt > 0 && (
                <div className="balance-node lock-node">
                  <span className="node-caption">Đang tạm giữ (lệnh chờ khớp)</span>
                  <div className="node-number-row text-ref">
                    <span className="node-amt tabular-num">{formatCurrency(lockedAmt)}</span>
                    <span className="node-curr">₫</span>
                  </div>
                </div>
              )}
            </div>

            <div className="statement-policy">
              <p>• Rút tiền miễn phí giao dịch 100%</p>
              <p>• Hỗ trợ nạp tiền tức thì qua cổng VNPay Sandbox</p>
            </div>
          </div>
        </aside>

        {/* Cột phải: Form Nghiệp Vụ */}
        <main className="wallet-actions-column">
          <div className="wallet-tab-strip">
            <button
              className={`wallet-action-tab ${activeTab === 'deposit' ? 'active' : ''}`}
              onClick={() => { setActiveTab('deposit'); setMessage({ type: '', text: '' }); }}
            >
              <span className="tab-idx mono-num">01</span>
              <span>Nạp Tiền (VNPay)</span>
            </button>
            <button
              className={`wallet-action-tab ${activeTab === 'withdraw' ? 'active' : ''}`}
              onClick={() => { setActiveTab('withdraw'); setMessage({ type: '', text: '' }); }}
            >
              <span className="tab-idx mono-num">02</span>
              <span>Rút Tiền Về Ngân Hàng</span>
            </button>
            <button
              className={`wallet-action-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => { setActiveTab('history'); setMessage({ type: '', text: '' }); }}
            >
              <span className="tab-idx mono-num">03</span>
              <span>Lịch Sử Giao Dịch Ví</span>
            </button>
          </div>

          <div className="wallet-panel-surface">
            {message.text && (
              <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                {message.text}
              </div>
            )}

            {/* TAB 1: NẠP TIỀN */}
            {activeTab === 'deposit' && (
              <div className="deposit-layout-block">
                {pendingPayment ? (
                  /* Giao diện QR Code Nạp Tiền */
                  <div className="qr-checkout-view fade-in">
                    <div className="qr-checkout-header">
                      <h3>Thanh Toán Ký Quỹ Qua Mã QR</h3>
                      <p>Quét mã bằng ứng dụng ngân hàng hoặc nhấn "Thanh toán ngay" để chuyển hướng tới cổng VNPay</p>
                    </div>

                    <div className="qr-checkout-grid">
                      {/* Bảng chi tiết */}
                      <div className="qr-detail-list">
                        <div className="qr-detail-item">
                          <span className="detail-tag">Tài khoản thụ hưởng:</span>
                          <strong className="detail-val">{user?.fullName || user?.username} ({user?.username})</strong>
                        </div>
                        <div className="qr-detail-item">
                          <span className="detail-tag">Số tiền nạp:</span>
                          <strong className="detail-val amount-highlight text-bullish tabular-num">
                            {formatCurrency(pendingPayment.amount)} VNĐ
                          </strong>
                        </div>
                        <div className="qr-detail-item">
                          <span className="detail-tag">Cổng thanh toán:</span>
                          <span className="detail-val">VNPay Sandbox</span>
                        </div>
                        <div className="qr-detail-item">
                          <span className="detail-tag">Mã giao dịch:</span>
                          <span className="detail-val mono-num">{pendingPayment.txnRef}</span>
                        </div>
                        <div className="qr-detail-item">
                          <span className="detail-tag">Nội dung chuyển khoản:</span>
                          <span className="detail-val">Nap tien {pendingPayment.txnRef} tai StockLab</span>
                        </div>
                      </div>

                      {/* Mã QR */}
                      <div className="qr-image-card">
                        <div className="qr-frame">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(pendingPayment.paymentUrl)}`}
                            alt="Mã QR VNPay"
                            className="qr-img-render"
                          />
                        </div>
                        <a
                          href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(pendingPayment.paymentUrl)}`}
                          download={`vnpay-qr-${pendingPayment.txnRef}.png`}
                          className="qr-download-link"
                        >
                          Tải ảnh QR về máy
                        </a>
                      </div>
                    </div>

                    {/* Nút thao tác */}
                    <div className="qr-action-buttons">
                      <button
                        className="btn btn-secondary"
                        onClick={async () => {
                          if (pendingPayment && pendingPayment.txnRef) {
                            try {
                              await vnpayAPI.cancelPayment(pendingPayment.txnRef);
                            } catch (e) {
                              console.error(e);
                            }
                          }
                          setPendingPayment(null);
                          setDepositAmount('');
                          fetchHistory();
                        }}
                      >
                        Huỷ & Tạo Giao Dịch Mới
                      </button>
                      <a
                        href={pendingPayment.paymentUrl}
                        className="btn btn-primary"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Thanh Toán Trực Tiếp Cổng VNPay →
                      </a>
                    </div>
                  </div>
                ) : (
                  /* Form nhập số tiền nạp */
                  <form className="deposit-amount-form" onSubmit={handleDeposit}>
                    <div className="form-group">
                      <label className="form-label">Số tiền muốn nạp (VNĐ)</label>
                      <div className="currency-input-wrap">
                        <input
                          type="text"
                          className="form-input currency-input tabular-num"
                          placeholder="0"
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
                          autoFocus
                        />
                        <span className="currency-suffix">VND</span>
                      </div>
                      <span className="input-hint-sub">Hạn mức nạp: Tối thiểu 10.000 VNĐ / Không giới hạn tối đa</span>
                    </div>

                    {/* Quick Presets (Numbered Pills) */}
                    <div className="amount-preset-group">
                      <span className="preset-label">Mốc nạp nhanh:</span>
                      <div className="preset-pill-list">
                        {[100000, 500000, 1000000, 5000000, 10000000].map(amt => (
                          <button
                            key={amt}
                            type="button"
                            className={`preset-pill ${depositAmount.replace(/\D/g, '') === String(amt) ? 'active' : ''} tabular-num`}
                            onClick={() => setDepositAmount(new Intl.NumberFormat('vi-VN').format(amt))}
                          >
                            {formatCurrency(amt)}₫
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary btn-block btn-lg"
                      disabled={loading || !depositAmount}
                    >
                      {loading ? 'Đang tạo giao dịch...' : 'Tiếp Tục Tạo Mã QR VNPay →'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* TAB 2: RÚT TIỀN */}
            {activeTab === 'withdraw' && (
              <div className="withdraw-layout-block">
                {/* Stepper */}
                <div className="withdraw-phase-indicator">
                  <div className={`phase-node ${withdrawStep >= 1 ? 'active' : ''}`}>
                    <span className="phase-num mono-num">01</span>
                    <span className="phase-text">Thông tin rút tiền</span>
                  </div>
                  <div className="phase-divider">—</div>
                  <div className={`phase-node ${withdrawStep >= 2 ? 'active' : ''}`}>
                    <span className="phase-num mono-num">02</span>
                    <span className="phase-text">Xác thực OTP Email</span>
                  </div>
                </div>

                {withdrawStep === 1 ? (
                  <form className="withdraw-form" onSubmit={handleNextStep}>
                    <div className="form-sub-section">
                      <h4 className="sub-section-title">1. Thông tin tài khoản nhận tiền</h4>

                      <div className="form-grid-2">
                        <div className="form-group">
                          <label className="form-label">Ngân hàng thụ hưởng</label>
                          <select
                            className="form-input select-clean"
                            value={withdrawBankName}
                            onChange={(e) => {
                              setWithdrawBankName(e.target.value);
                              setBeneficiaryName('');
                              setLookupError('');
                            }}
                          >
                            <option value="VCB">Vietcombank</option>
                            <option value="TCB">Techcombank</option>
                            <option value="MB">MB Bank</option>
                            <option value="BIDV">BIDV</option>
                            <option value="CTG">VietinBank</option>
                            <option value="ACB">ACB</option>
                            <option value="VPB">VPBank</option>
                            <option value="TPB">TPBank</option>
                            <option value="STB">Sacombank</option>
                            <option value="VIB">VIB</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Số tài khoản ngân hàng</label>
                          <input
                            type="text"
                            className="form-input mono-num"
                            placeholder="Nhập số tài khoản"
                            value={withdrawBankAccount}
                            onChange={(e) => {
                              setWithdrawBankAccount(e.target.value);
                              setBeneficiaryName('');
                              setLookupError('');
                            }}
                            onBlur={handleLookupAccount}
                            required
                          />
                          {lookupError && <span className="error-text">{lookupError}</span>}
                        </div>
                      </div>

                      <div className="beneficiary-preview-box">
                        <span className="preview-label">Người thụ hưởng:</span>
                        {isLookupLoading ? (
                          <span className="preview-status">Đang tra cứu tên chủ tài khoản...</span>
                        ) : beneficiaryName ? (
                          <strong className="preview-name text-bullish">{beneficiaryName}</strong>
                        ) : (
                          <span className="preview-muted">Nhập số tài khoản và bấm ra ngoài để kiểm tra</span>
                        )}
                      </div>
                    </div>

                    <div className="form-sub-section">
                      <h4 className="sub-section-title">2. Số tiền chuyển khoản</h4>

                      <div className="form-group">
                        <label className="form-label">Số tiền rút (VNĐ)</label>
                        <div className="currency-input-wrap">
                          <input
                            type="text"
                            className="form-input currency-input tabular-num"
                            placeholder="0"
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
                          <span className="currency-suffix">VND</span>
                        </div>
                        <div className="withdraw-limit-note">
                          <span>Số dư có thể rút: <strong>{formatCurrency(user?.availableBalance)} ₫</strong></span>
                          <span>Phí giao dịch: <strong>Miễn phí</strong></span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary btn-block btn-lg"
                      disabled={loading || !withdrawBankAccount || !beneficiaryName || !withdrawAmount}
                    >
                      Tiếp Tục Xác Thực OTP →
                    </button>
                  </form>
                ) : (
                  <form className="withdraw-otp-form" onSubmit={handleWithdraw}>
                    <OtpInput
                      value={otpCode}
                      onChange={setOtpCode}
                      onSendOtp={handleSendOtp}
                      isSending={isSendingOtp}
                      title="Xác thực lệnh rút tiền"
                      desc="Mã xác nhận bảo mật đã được gửi về địa chỉ email của bạn."
                    />

                    <div className="form-actions-split">
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setWithdrawStep(1)}
                      >
                        ← Quay lại
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading || !otpCode}
                      >
                        {loading ? 'Đang xử lý...' : 'Xác Nhận Rút Tiền Về Ngân Hàng'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TAB 3: LỊCH SỬ NẠP RÚT */}
            {activeTab === 'history' && (
              <div className="wallet-history-view">
                {loadingHistory ? (
                  <div className="history-loading-box">
                    <div className="spinner"></div>
                    <span>Đang tải lịch sử giao dịch nạp rút...</span>
                  </div>
                ) : historyItems.length === 0 ? (
                  <div className="history-empty-box">
                    <p>Chưa có giao dịch nạp hoặc rút tiền nào được ghi nhận</p>
                  </div>
                ) : (
                  <div className="history-table-scroll">
                    <table className="editorial-wallet-table">
                      <thead>
                        <tr>
                          <th>Mã Giao Dịch</th>
                          <th>Loại Lệnh</th>
                          <th className="th-right">Số Tiền</th>
                          <th>Kênh Giao Dịch</th>
                          <th>Thời Gian</th>
                          <th>Trạng Thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyItems.map((item) => {
                          const isDeposit = item.type === 'DEPOSIT';
                          return (
                            <tr key={item.id}>
                              <td className="mono-num font-bold">
                                #{item.transactionCode || item.id}
                              </td>
                              <td>
                                <span className={`type-tag ${isDeposit ? 'tag-deposit' : 'tag-withdraw'}`}>
                                  {isDeposit ? 'Nạp tiền' : 'Rút tiền'}
                                </span>
                              </td>
                              <td className={`th-right font-bold tabular-num ${isDeposit ? 'text-bullish' : 'text-bearish'}`}>
                                {isDeposit ? '+' : '-'}{formatCurrency(item.amount)} ₫
                              </td>
                              <td>
                                <div className="channel-cell">
                                  <span>{item.bankName || 'Cổng VNPay'}</span>
                                  {item.bankAccount && <small className="mono-num text-muted">{item.bankAccount}</small>}
                                </div>
                              </td>
                              <td className="tabular-num text-secondary">
                                {new Date(item.createdAt).toLocaleString('vi-VN')}
                              </td>
                              <td>
                                <span className={`status-pill pill-${item.status?.toLowerCase()}`}>
                                  {item.status === 'SUCCESS' ? 'Hoàn tất' : item.status === 'PENDING' ? 'Chờ duyệt' : item.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
