import { useState, useEffect, useRef } from 'react';
import { stockAPI, userAPI, otpAPI, conditionalOrderAPI } from '../api/api';
import { usePageTour } from '../hooks/usePageTour';
import './ConditionalOrderPage.css';

const CONDITION_TYPES = [
  { value: 'GTD', label: 'GTD', desc: 'Good Till Date — Lệnh Limit có hiệu lực đến ngày hết hạn' },
  { value: 'STOP', label: 'Stop', desc: 'Kích hoạt khi giá chạm mức Stop → đặt lệnh Market' },
  { value: 'STOP_LIMIT', label: 'Stop Limit', desc: 'Kích hoạt Stop rồi đặt lệnh Limit' },
  { value: 'TRAILING_STOP', label: 'Trailing Stop', desc: 'Stop di chuyển theo giá thị trường' },
  { value: 'TRAILING_STOP_LIMIT', label: 'Trailing Stop Limit', desc: 'Trailing Stop kết hợp Limit' },
  { value: 'OCO', label: 'OCO', desc: 'One Cancels Other — Hủy lệnh còn lại khi 1 lệnh khớp' },
  { value: 'SL_TP', label: 'Stop Loss / Take Profit', desc: 'Cắt lỗ và chốt lời tự động' },
];

// Field visibility config per condition type
const FIELD_CONFIG = {
  GTD:                 { limitPrice: true },
  STOP:                { stopPrice: true },
  STOP_LIMIT:          { stopPrice: true, limitPrice: true },
  TRAILING_STOP:       { trailing: true },
  TRAILING_STOP_LIMIT: { trailing: true, limitPrice: true },
  OCO:                 { ocoPrice: true },
  SL_TP:               { sltp: true },
};

export default function ConditionalOrderPage() {
  const { restartTour } = usePageTour('conditionalOrder');
  const [activeTab, setActiveTab] = useState('BUY');
  const [conditionType, setConditionType] = useState('GTD');
  const [conditionDropdownOpen, setConditionDropdownOpen] = useState(false);

  // Common fields
  const [ticker, setTicker] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [balance, setBalance] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  // Condition-specific fields
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [trailingType, setTrailingType] = useState('PERCENT'); // PERCENT or AMOUNT
  const [trailingAmount, setTrailingAmount] = useState('');
  const [ocoPrice1, setOcoPrice1] = useState('');
  const [ocoPrice2, setOcoPrice2] = useState('');
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');

  // Date fields
  const [effectiveDate, setEffectiveDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  // OTP
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const conditionRef = useRef(null);

  useEffect(() => {
    fetchBalance();
    const now = new Date();
    setEffectiveDate(now.toISOString().slice(0, 10));
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + 30);
    setExpiryDate(expiry.toISOString().slice(0, 16));
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (conditionRef.current && !conditionRef.current.contains(e.target)) {
        setConditionDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchBalance = async () => {
    try {
      const res = await userAPI.getProfile();
      if (res.data.success) {
        setBalance(res.data.data.balance);
        setLockedBalance(res.data.data.lockedBalance || 0);
      }
    } catch { }
  };

  const availableBalance = balance - lockedBalance;

  // Search stocks
  useEffect(() => {
    if (ticker.length >= 1) {
      const timer = setTimeout(async () => {
        try {
          const res = await stockAPI.search(ticker);
          if (res.data.success) {
            setSearchResults(res.data.data);
            setShowDropdown(true);
          }
        } catch { }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [ticker]);

  const handleSelectStock = (stock) => {
    setSelectedStock(stock);
    setTicker(stock.ticker);
    setLimitPrice(String(stock.currentPrice));
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleConditionChange = (value) => {
    setConditionType(value);
    setConditionDropdownOpen(false);
    // Reset condition-specific fields
    setLimitPrice(selectedStock ? String(selectedStock.currentPrice) : '');
    setStopPrice('');
    setTrailingType('PERCENT');
    setTrailingAmount('');
    setOcoPrice1('');
    setOcoPrice2('');
    setStopLossPrice('');
    setTakeProfitPrice('');
  };

  const handleSendOtp = async () => {
    setOtpLoading(true);
    try {
      const res = await otpAPI.sendOtp();
      if (res.data.success) {
        setOtpSent(true);
        setMessage({ type: 'success', text: 'Đã gửi mã OTP! (Mock: 123456)' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Lỗi gửi OTP' });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = {
        ticker: selectedStock.ticker,
        side: activeTab,
        conditionType: conditionType,
        quantity: Number(quantity),
        effectiveDate: effectiveDate,
        expiryDate: expiryDate,
        otpCode: otpCode,
      };

      // Set condition-specific fields
      if (fields.limitPrice && limitPrice) data.limitPrice = Number(limitPrice);
      if (fields.stopPrice && stopPrice) data.stopPrice = Number(stopPrice);
      if (fields.trailing) {
        data.trailingType = trailingType;
        data.trailingAmount = Number(trailingAmount);
        if (fields.limitPrice && limitPrice) data.limitPrice = Number(limitPrice);
      }
      if (fields.ocoPrice) {
        data.ocoPrice1 = Number(ocoPrice1);
        data.ocoPrice2 = Number(ocoPrice2);
      }
      if (fields.sltp) {
        data.stopLossPrice = Number(stopLossPrice);
        data.takeProfitPrice = Number(takeProfitPrice);
      }

      const res = await conditionalOrderAPI.placeOrder(data);
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        // Reset form
        setQuantity('');
        setLimitPrice('');
        setStopPrice('');
        setTrailingAmount('');
        setOcoPrice1('');
        setOcoPrice2('');
        setStopLossPrice('');
        setTakeProfitPrice('');
        setOtpCode('');
        setOtpSent(false);
      } else {
        setMessage({ type: 'error', text: res.data.message });
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Có lỗi xảy ra';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (p) => {
    if (!p) return '0';
    return Number(p).toLocaleString('vi-VN');
  };

  const getTickerColor = (t) => {
    const colors = ['#2962ff', '#00c853', '#ff6d00', '#aa00ff', '#d50000', '#00bfa5', '#6200ea', '#c51162'];
    let hash = 0;
    for (let i = 0; i < t.length; i++) hash = t.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const selectedCondition = CONDITION_TYPES.find(c => c.value === conditionType);
  const fields = FIELD_CONFIG[conditionType] || {};

  // Estimate total
  const getEstimatedPrice = () => {
    if (fields.limitPrice && limitPrice) return Number(limitPrice);
    if (fields.stopPrice && stopPrice) return Number(stopPrice);
    if (fields.ocoPrice && ocoPrice1) return Number(ocoPrice1);
    if (fields.sltp && stopLossPrice) return Number(stopLossPrice);
    return selectedStock?.currentPrice || 0;
  };
  const totalAmount = selectedStock && quantity ? getEstimatedPrice() * Number(quantity) : 0;

  const canSubmit = selectedStock && quantity > 0 && otpCode.length === 6;

  return (
    <div className="cond-order-page fade-in">
      <div className="cond-header">
        <h2>⚡ Đặt Lệnh Điều Kiện</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="balance-display">
            <div className="balance-item">
              <span className="balance-label">Tổng tài sản</span>
              <span className="balance-value">{formatPrice(balance)} VND</span>
            </div>
            <div className="balance-item">
              <span className="balance-label">Khả dụng</span>
              <span className="balance-value available">{formatPrice(availableBalance)} VND</span>
            </div>
          </div>
          <button className="page-tour-btn" onClick={restartTour} title="Hướng dẫn trang này">?</button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`trade-message ${message.type}`}>
          <span>{message.type === 'success' ? '✅' : message.type === 'error' ? '❌' : 'ℹ️'}</span>
          <span>{message.text}</span>
          <button className="msg-close" onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      <div className="cond-content">
        <div className="cond-form-card">
          {/* Tabs */}
          <div className="trade-tabs">
            <button className={`trade-tab ${activeTab === 'BUY' ? 'active buy' : ''}`}
              onClick={() => setActiveTab('BUY')}>MUA</button>
            <button className={`trade-tab ${activeTab === 'SELL' ? 'active sell' : ''}`}
              onClick={() => setActiveTab('SELL')}>BÁN</button>
          </div>

          <div className="form-body">
            {/* Condition Type Selector */}
            <div className="form-group">
              <label>Loại điều kiện</label>
              <div className="cond-select-wrapper" ref={conditionRef}>
                <button className="cond-select-trigger"
                  onClick={() => setConditionDropdownOpen(!conditionDropdownOpen)}>
                  <div className="cond-select-value">
                    <span className="cond-select-label">{selectedCondition.label}</span>
                    <span className="cond-select-desc">{selectedCondition.desc}</span>
                  </div>
                  <svg className={`cond-chevron ${conditionDropdownOpen ? 'open' : ''}`} width="16" height="16" viewBox="0 0 16 16">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                  </svg>
                </button>
                {conditionDropdownOpen && (
                  <div className="cond-select-dropdown fade-in">
                    {CONDITION_TYPES.map(c => (
                      <button key={c.value}
                        className={`cond-select-option ${conditionType === c.value ? 'selected' : ''}`}
                        onClick={() => handleConditionChange(c.value)}>
                        <span className="cond-opt-label">{c.label}</span>
                        <span className="cond-opt-desc">{c.desc}</span>
                        {conditionType === c.value && <span className="cond-opt-check">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stock Search */}
            <div className="form-group">
              <label>Mã cổ phiếu</label>
              <div className="stock-search-wrapper">
                <input type="text" placeholder="Nhập mã CP (VD: VNM, FPT...)"
                  value={ticker} onChange={(e) => { setTicker(e.target.value.toUpperCase()); setSelectedStock(null); }}
                  className="form-input" autoComplete="off" />
                {showDropdown && searchResults.length > 0 && (
                  <div className="stock-dropdown">
                    {searchResults.slice(0, 8).map(s => (
                      <div key={s.ticker} className="stock-dropdown-item" onClick={() => handleSelectStock(s)}>
                        <div className="sd-icon" style={{ background: getTickerColor(s.ticker) }}>
                          {s.ticker.substring(0, 2)}
                        </div>
                        <div className="sd-info">
                          <span className="sd-ticker">{s.ticker}</span>
                          <span className="sd-name">{s.companyName}</span>
                        </div>
                        <span className="sd-price">{formatPrice(s.currentPrice)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Selected Stock Info */}
            {selectedStock && (
              <div className="selected-stock-info">
                <div className="ssi-header">
                  <div className="ssi-icon" style={{ background: getTickerColor(selectedStock.ticker) }}>
                    {selectedStock.ticker.substring(0, 2)}
                  </div>
                  <div>
                    <div className="ssi-ticker">{selectedStock.ticker}</div>
                    <div className="ssi-name">{selectedStock.companyName}</div>
                  </div>
                </div>
                <div className="ssi-price">{formatPrice(selectedStock.currentPrice)} VND</div>
              </div>
            )}

            {/* Quantity — always shown */}
            <div className="form-group">
              <label>Khối lượng</label>
              <input type="number" min="1" placeholder="Nhập số lượng CP"
                value={quantity} onChange={(e) => setQuantity(e.target.value)} className="form-input" />
            </div>

            {/* ===== DYNAMIC FIELDS BASED ON CONDITION TYPE ===== */}

            {/* GTD / Stop Limit / Trailing Stop Limit: Limit Price */}
            {fields.limitPrice && (
              <div className="form-group">
                <label>💰 Giá đặt (Limit Price)</label>
                <input type="number" min="0" step="100" placeholder="Nhập giá Limit"
                  value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} className="form-input" />
                {selectedStock && (
                  <div className="price-hint">
                    Giá hiện tại: <strong>{formatPrice(selectedStock.currentPrice)} VND</strong>
                    <button className="price-fill-btn" onClick={() => setLimitPrice(String(selectedStock.currentPrice))}>
                      Dùng giá hiện tại
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Stop / Stop Limit: Stop Price */}
            {fields.stopPrice && (
              <div className="form-group">
                <label>🎯 Giá kích hoạt (Stop Price)</label>
                <input type="number" min="0" step="100" placeholder="Giá khi chạm sẽ trigger lệnh"
                  value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} className="form-input" />
                <div className="field-hint">
                  {activeTab === 'BUY'
                    ? '⬆️ Lệnh kích hoạt khi giá tăng lên bằng hoặc vượt mức này'
                    : '⬇️ Lệnh kích hoạt khi giá giảm xuống bằng hoặc dưới mức này'}
                </div>
              </div>
            )}

            {/* Trailing Stop / Trailing Stop Limit */}
            {fields.trailing && (
              <>
                <div className="form-group">
                  <label>📏 Khoảng cách Trailing</label>
                  <div className="trailing-toggle">
                    <button className={`tt-btn ${trailingType === 'PERCENT' ? 'active' : ''}`}
                      onClick={() => setTrailingType('PERCENT')}>%</button>
                    <button className={`tt-btn ${trailingType === 'AMOUNT' ? 'active' : ''}`}
                      onClick={() => setTrailingType('AMOUNT')}>VND</button>
                  </div>
                  <input type="number" min="0"
                    step={trailingType === 'PERCENT' ? '0.5' : '100'}
                    placeholder={trailingType === 'PERCENT' ? 'VD: 5 (tức 5%)' : 'VD: 1000 (1,000 VND)'}
                    value={trailingAmount} onChange={(e) => setTrailingAmount(e.target.value)}
                    className="form-input" />
                  <div className="field-hint">
                    🔄 Stop Price sẽ tự động điều chỉnh theo giá thị trường,
                    cách {trailingType === 'PERCENT' ? 'một khoảng %' : 'một khoảng VND'} đã đặt
                  </div>
                </div>
              </>
            )}

            {/* OCO: Dual Price */}
            {fields.ocoPrice && (
              <>
                <div className="form-group">
                  <label>📈 Giá lệnh 1 — Take Profit</label>
                  <input type="number" min="0" step="100" placeholder="Giá chốt lời (phía trên)"
                    value={ocoPrice1} onChange={(e) => setOcoPrice1(e.target.value)} className="form-input" />
                  <div className="field-hint">⬆️ Lệnh bán khi giá tăng lên mức này</div>
                </div>
                <div className="form-group">
                  <label>📉 Giá lệnh 2 — Stop Loss</label>
                  <input type="number" min="0" step="100" placeholder="Giá cắt lỗ (phía dưới)"
                    value={ocoPrice2} onChange={(e) => setOcoPrice2(e.target.value)} className="form-input" />
                  <div className="field-hint">⬇️ Lệnh bán khi giá giảm xuống mức này. Khi 1 lệnh khớp → lệnh còn lại tự hủy</div>
                </div>
              </>
            )}

            {/* SL/TP */}
            {fields.sltp && (
              <>
                <div className="form-group">
                  <label>🛑 Giá Stop Loss (Cắt lỗ)</label>
                  <input type="number" min="0" step="100" placeholder="Giá cắt lỗ"
                    value={stopLossPrice} onChange={(e) => setStopLossPrice(e.target.value)} className="form-input" />
                  <div className="field-hint">⬇️ Tự động bán khi giá giảm xuống mức này</div>
                </div>
                <div className="form-group">
                  <label>🎯 Giá Take Profit (Chốt lời)</label>
                  <input type="number" min="0" step="100" placeholder="Giá chốt lời"
                    value={takeProfitPrice} onChange={(e) => setTakeProfitPrice(e.target.value)} className="form-input" />
                  <div className="field-hint">⬆️ Tự động bán khi giá tăng lên mức này</div>
                </div>
              </>
            )}

            {/* Effective Date */}
            <div className="form-group">
              <label>📅 Ngày hiệu lực</label>
              <input type="date" value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)} className="form-input" />
            </div>

            {/* Expiry Date */}
            <div className="form-group">
              <label>⏰ Ngày hết hạn</label>
              <input type="datetime-local" value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)} className="form-input" />
            </div>

            {/* OTP */}
            <div className="form-group otp-section">
              <label>🔐 Xác thực OTP</label>
              <div className="otp-row">
                <input type="text" className="form-input otp-input"
                  placeholder="Nhập mã OTP" value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} maxLength={6} />
                <button type="button"
                  className={`otp-send-btn ${otpSent ? 'sent' : ''}`}
                  onClick={handleSendOtp} disabled={otpLoading}>
                  {otpLoading ? '...' : otpSent ? '✓ Đã gửi' : 'Gửi mã'}
                </button>
              </div>
              {otpSent && (
                <div className="otp-hint">💡 Mock OTP: <strong>123456</strong></div>
              )}
            </div>

            {/* Summary */}
            {selectedStock && quantity > 0 && (
              <div className="trade-summary">
                <div className="summary-row">
                  <span>Loại điều kiện</span>
                  <span className="order-type-badge">⚡ {selectedCondition.label}</span>
                </div>
                {fields.stopPrice && stopPrice && (
                  <div className="summary-row">
                    <span>Giá kích hoạt</span>
                    <span>{formatPrice(stopPrice)} VND</span>
                  </div>
                )}
                {fields.limitPrice && limitPrice && (
                  <div className="summary-row">
                    <span>Giá Limit</span>
                    <span>{formatPrice(limitPrice)} VND</span>
                  </div>
                )}
                {fields.trailing && trailingAmount && (
                  <div className="summary-row">
                    <span>Trailing</span>
                    <span>{trailingAmount}{trailingType === 'PERCENT' ? '%' : ' VND'}</span>
                  </div>
                )}
                {fields.ocoPrice && (
                  <>
                    <div className="summary-row">
                      <span>Take Profit</span>
                      <span>{formatPrice(ocoPrice1)} VND</span>
                    </div>
                    <div className="summary-row">
                      <span>Stop Loss</span>
                      <span>{formatPrice(ocoPrice2)} VND</span>
                    </div>
                  </>
                )}
                {fields.sltp && (
                  <>
                    <div className="summary-row">
                      <span>Stop Loss</span>
                      <span className="text-danger">{formatPrice(stopLossPrice)} VND</span>
                    </div>
                    <div className="summary-row">
                      <span>Take Profit</span>
                      <span className="text-success">{formatPrice(takeProfitPrice)} VND</span>
                    </div>
                  </>
                )}
                <div className="summary-row">
                  <span>Số lượng</span>
                  <span>{Number(quantity).toLocaleString()} CP</span>
                </div>
                <div className="summary-divider"></div>
                <div className="summary-row total">
                  <span>Tổng tiền (ước tính)</span>
                  <span className={activeTab === 'BUY' ? 'text-danger' : 'text-success'}>
                    {activeTab === 'BUY' ? '-' : '+'}{formatPrice(totalAmount)} VND
                  </span>
                </div>
              </div>
            )}

            {/* Submit */}
            <button className={`trade-btn ${activeTab === 'BUY' ? 'buy' : 'sell'}`}
              onClick={handleSubmit} disabled={!canSubmit}>
              ĐẶT LỆNH ĐIỀU KIỆN {selectedCondition.label} {selectedStock?.ticker || ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
