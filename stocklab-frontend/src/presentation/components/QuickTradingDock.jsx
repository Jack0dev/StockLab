import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuickTrade } from '@/infrastructure/context/QuickTradeContext';
import { stockAPI, orderAPI, conditionalOrderAPI, otpAPI } from '@/infrastructure/repositories/api';
import './QuickTradingDock.css';

const ORDER_TYPE_OPTIONS = [
  { group: 'LỆNH CƠ SỞ', value: 'LIMIT', label: 'LO — Lệnh giới hạn' },
  { group: 'LỆNH CƠ SỞ', value: 'MARKET', label: 'MP — Lệnh thị trường' },
  { group: 'LỆNH ĐIỀU KIỆN', value: 'STOP', label: 'STOP — Lệnh dừng thị trường' },
  { group: 'LỆNH ĐIỀU KIỆN', value: 'STOP_LIMIT', label: 'STOP LIMIT — Dừng giới hạn' },
  { group: 'LỆNH ĐIỀU KIỆN', value: 'TRAILING_STOP', label: 'TRAILING — Chặn lãi động' },
  { group: 'LỆNH ĐIỀU KIỆN', value: 'OCO', label: 'OCO — Lệnh kép một hủy một' },
  { group: 'LỆNH ĐIỀU KIỆN', value: 'SL_TP', label: 'SL/TP — Cắt lỗ và chốt lời' },
];

export default function QuickTradingDock() {
  const {
    isOpen,
    isMinimized,
    ticker,
    setTicker,
    side,
    setSide,
    orderType,
    setOrderType,
    price,
    setPrice,
    quantity,
    setQuantity,
    stopPrice,
    setStopPrice,
    limitPrice,
    setLimitPrice,
    trailingType,
    setTrailingType,
    trailingAmount,
    setTrailingAmount,
    ocoPrice1,
    setOcoPrice1,
    ocoPrice2,
    setOcoPrice2,
    stopLossPrice,
    setStopLossPrice,
    takeProfitPrice,
    setTakeProfitPrice,
    effectiveDate,
    expiryDate,
    stockInfo,
    holdingQuantity,
    availableBalance,
    refreshBalance,
    refreshStockAndHoldings,
    closeTrade,
    minimizeTrade,
    maximizeTrade,
  } = useQuickTrade();

  // Ticker Autocomplete / Search
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchTimerRef = useRef(null);

  // Submission & OTP state
  const [submitting, setSubmitting] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text: '' }

  // Clear feedback after 6s
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Handle ticker typing & search suggestion
  const handleTickerChange = (e) => {
    const val = e.target.value.toUpperCase().trim();
    setTicker(val);
    setFeedback(null);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (val.length >= 1) {
      searchTimerRef.current = setTimeout(async () => {
        try {
          const res = await stockAPI.search(val);
          if (res.data.success && Array.isArray(res.data.data)) {
            setSearchResults(res.data.data.slice(0, 5));
            setShowSearchDropdown(true);
          }
        } catch {
          setSearchResults([]);
        }
      }, 250);
    } else {
      setSearchResults([]);
      setShowSearchDropdown(false);
    }
  };

  const handleSelectSearchResult = (stock) => {
    setTicker(stock.ticker);
    setPrice(String(stock.currentPrice || stock.referencePrice || ''));
    setShowSearchDropdown(false);
    setSearchResults([]);
    refreshStockAndHoldings(stock.ticker);
  };

  // OTP Countdown timer
  useEffect(() => {
    let interval = null;
    if (otpCountdown > 0) {
      interval = setInterval(() => {
        setOtpCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpCountdown]);

  const handleRequestOtp = async () => {
    setOtpLoading(true);
    try {
      const res = await otpAPI.sendOtp();
      if (res.data.success) {
        setOtpCountdown(60);
        setFeedback({ type: 'success', text: 'Mã OTP đã được gửi đến email đăng ký' });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Không thể gửi mã OTP' });
    } finally {
      setOtpLoading(false);
    }
  };

  // Calculation helpers
  const numPrice = useMemo(() => {
    if (orderType === 'MARKET') return stockInfo?.currentPrice || stockInfo?.referencePrice || 0;
    return Number(price) || 0;
  }, [orderType, price, stockInfo]);

  const numQty = Number(quantity) || 0;
  const orderValue = numPrice * numQty;
  const feeRate = 0.0015; // 0.15% phí giao dịch
  const estFee = orderValue * feeRate;
  const totalRequired = side === 'BUY' ? orderValue + estFee : orderValue - estFee;

  // Quick percentage allocation
  const handleQuickPercent = (pct) => {
    if (side === 'BUY') {
      if (numPrice <= 0) return;
      const budget = availableBalance * (pct / 100);
      const rawQty = Math.floor(budget / (numPrice * (1 + feeRate)));
      // Lô 100 theo quy định HOSE/HNX
      const roundedQty = Math.floor(rawQty / 100) * 100;
      setQuantity(String(Math.max(100, roundedQty)));
    } else {
      const rawQty = Math.floor(holdingQuantity * (pct / 100));
      setQuantity(String(rawQty > 0 ? rawQty : 0));
    }
  };

  // Determine if it's conditional order
  const isConditional = ['STOP', 'STOP_LIMIT', 'TRAILING_STOP', 'OCO', 'SL_TP'].includes(orderType);

  // Submit Order Execution
  const handleSubmitOrder = async (e) => {
    if (e) e.preventDefault();
    setFeedback(null);

    if (!ticker) {
      setFeedback({ type: 'error', text: 'Vui lòng nhập mã cổ phiếu' });
      return;
    }
    if (numQty <= 0) {
      setFeedback({ type: 'error', text: 'Khối lượng đặt phải lớn hơn 0' });
      return;
    }

    if (side === 'BUY' && totalRequired > availableBalance) {
      setFeedback({ type: 'error', text: 'Sức mua không đủ cho giá trị lệnh này' });
      return;
    }

    if (side === 'SELL' && holdingQuantity > 0 && numQty > holdingQuantity) {
      setFeedback({ type: 'error', text: `Khối lượng bán vượt quá số lượng sở hữu (${holdingQuantity})` });
      return;
    }

    // Nếu là lệnh Bán và chưa qua bước OTP (nếu cần theo luồng)
    setSubmitting(true);
    try {
      if (!isConditional) {
        // LỆNH CƠ SỞ (LO / MP)
        const payload = {
          ticker,
          side,
          orderType: orderType === 'MARKET' ? 'MARKET' : 'LIMIT',
          quantity: numQty,
          otpCode: otpCode || undefined,
        };
        if (orderType === 'LIMIT') {
          payload.price = numPrice;
        }

        const res = await orderAPI.placeOrder(payload);
        if (res.data.success) {
          setFeedback({
            type: 'success',
            text: `Đặt lệnh ${side === 'BUY' ? 'MUA' : 'BÁN'} ${ticker} thành công! Mã lệnh #${res.data.data?.id || ''}`,
          });
          setQuantity('');
          setOtpCode('');
          setOtpMode(false);
          refreshBalance();
          refreshStockAndHoldings(ticker);
        } else {
          setFeedback({ type: 'error', text: res.data.message || 'Lỗi khi gửi lệnh' });
        }
      } else {
        // LỆNH ĐIỀU KIỆN
        const condPayload = {
          ticker,
          side,
          conditionType: orderType,
          quantity: numQty,
          effectiveDate,
          expiryDate,
          otpCode: otpCode || undefined,
        };

        if (orderType === 'STOP') {
          condPayload.stopPrice = Number(stopPrice) || numPrice;
        } else if (orderType === 'STOP_LIMIT') {
          condPayload.stopPrice = Number(stopPrice) || numPrice;
          condPayload.limitPrice = Number(limitPrice) || numPrice;
        } else if (orderType === 'TRAILING_STOP') {
          condPayload.trailingType = trailingType;
          condPayload.trailingAmount = Number(trailingAmount) || 0;
          if (limitPrice) condPayload.limitPrice = Number(limitPrice);
        } else if (orderType === 'OCO') {
          condPayload.ocoPrice1 = Number(ocoPrice1) || numPrice;
          condPayload.ocoPrice2 = Number(ocoPrice2) || numPrice;
        } else if (orderType === 'SL_TP') {
          condPayload.stopLossPrice = Number(stopLossPrice) || 0;
          condPayload.takeProfitPrice = Number(takeProfitPrice) || 0;
        }

        const res = await conditionalOrderAPI.placeOrder(condPayload);
        if (res.data.success) {
          setFeedback({
            type: 'success',
            text: `Kích hoạt lệnh điều kiện ${orderType} ${ticker} thành công!`,
          });
          setQuantity('');
          setOtpCode('');
          setOtpMode(false);
          refreshBalance();
          refreshStockAndHoldings(ticker);
        } else {
          setFeedback({ type: 'error', text: res.data.message || 'Lỗi đặt lệnh điều kiện' });
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Có lỗi xảy ra trong quá trình khớp lệnh';
      // Nếu yêu cầu OTP
      if (errMsg.toLowerCase().includes('otp') || err.response?.status === 403) {
        setOtpMode(true);
        handleRequestOtp();
      }
      setFeedback({ type: 'error', text: errMsg });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // MINIMIZED DOCK BAR (Sleek Bottom-Right Pill, No icons)
  if (isMinimized) {
    return (
      <aside className="quick-dock-minimized" aria-label="Thanh lệnh thu nhỏ">
        <div className="qdm-summary" onClick={maximizeTrade}>
          <span className={`qdm-side-badge qdm-side-${side.toLowerCase()}`}>
            {side === 'BUY' ? 'MUA' : 'BÁN'}
          </span>
          <span className="qdm-ticker mono-num">{ticker || '---'}</span>
          <span className="qdm-price mono-num">
            {orderType === 'MARKET' ? 'MP' : numPrice > 0 ? numPrice.toLocaleString('vi-VN') : '—'}
          </span>
        </div>
        <div className="qdm-actions">
          <button className="qdm-btn" onClick={maximizeTrade} title="Bung mở cửa sổ đặt lệnh">
            MỞ RỘNG
          </button>
          <button className="qdm-btn qdm-btn-close" onClick={closeTrade} title="Đóng cửa sổ">
            ĐÓNG
          </button>
        </div>
      </aside>
    );
  }

  // EXPANDED FLOATING DOCK WINDOW (Swiss Modernist Light, Strictly No Icons)
  return (
    <section className="quick-dock-window" aria-label="Cửa sổ đặt lệnh nhanh">
      {/* 1. Header Bar */}
      <header className="qdw-header">
        <div className="qdw-header-left">
          <span className="qdw-title-label">ĐẶT LỆNH NHANH</span>
          <span className="qdw-exchange-badge mono-num">
            {stockInfo?.exchange || 'HOSE'}
          </span>
        </div>
        <div className="qdw-header-right">
          <button className="qdw-ctrl-btn" onClick={minimizeTrade} title="Thu nhỏ thanh dock">
            THU NHỎ
          </button>
          <button className="qdw-ctrl-btn qdw-ctrl-close" onClick={closeTrade} title="Đóng cửa sổ">
            ĐÓNG
          </button>
        </div>
      </header>

      {/* 2. Side Segmented Control: [ MUA ] / [ BÁN ] */}
      <nav className="qdw-side-switcher" aria-label="Chọn chiều giao dịch">
        <button
          type="button"
          className={`qdw-side-btn qdw-side-buy ${side === 'BUY' ? 'active' : ''}`}
          onClick={() => { setSide('BUY'); setFeedback(null); }}
        >
          MUA
        </button>
        <button
          type="button"
          className={`qdw-side-btn qdw-side-sell ${side === 'SELL' ? 'active' : ''}`}
          onClick={() => { setSide('SELL'); setFeedback(null); }}
        >
          BÁN
        </button>
      </nav>

      {/* 3. Market Quote Ribbon (Ceil / Floor / Ref / Matched) */}
      <div className="qdw-quote-ribbon">
        <div className="qdw-quote-col">
          <span className="qdw-qlabel">TRẦN</span>
          <span className="qdw-qval text-purple mono-num">
            {stockInfo?.ceilingPrice ? stockInfo.ceilingPrice.toLocaleString('vi-VN') : '—'}
          </span>
        </div>
        <div className="qdw-quote-col">
          <span className="qdw-qlabel">SÀN</span>
          <span className="qdw-qval text-cyan mono-num">
            {stockInfo?.floorPrice ? stockInfo.floorPrice.toLocaleString('vi-VN') : '—'}
          </span>
        </div>
        <div className="qdw-quote-col">
          <span className="qdw-qlabel">THAM CHIẾU</span>
          <span className="qdw-qval text-amber mono-num">
            {stockInfo?.referencePrice ? stockInfo.referencePrice.toLocaleString('vi-VN') : '—'}
          </span>
        </div>
        <div className="qdw-quote-col">
          <span className="qdw-qlabel">GIÁ KHỚP</span>
          <span className={`qdw-qval mono-num font-bold ${
            (stockInfo?.change || 0) > 0 ? 'text-green' : (stockInfo?.change || 0) < 0 ? 'text-red' : 'text-amber'
          }`}>
            {stockInfo?.currentPrice ? stockInfo.currentPrice.toLocaleString('vi-VN') : '—'}
          </span>
        </div>
      </div>

      {/* 4. Main Order Form */}
      <form className="qdw-form" onSubmit={handleSubmitOrder}>
        {/* Ticker Row */}
        <div className="qdw-field-group relative-wrap">
          <div className="qdw-label-row">
            <label className="qdw-label">MÃ CHỨNG KHOÁN</label>
            <span className="qdw-sub-label">
              {side === 'SELL' ? `Khả dụng: ${holdingQuantity.toLocaleString('vi-VN')} CP` : (stockInfo?.companyName || '')}
            </span>
          </div>
          <input
            type="text"
            className="qdw-input mono-num uppercase"
            placeholder="VD: FPT, VNM, HPG..."
            value={ticker}
            onChange={handleTickerChange}
            onFocus={() => { if (searchResults.length > 0) setShowSearchDropdown(true); }}
            maxLength={10}
          />

          {showSearchDropdown && searchResults.length > 0 && (
            <div className="qdw-search-dropdown">
              {searchResults.map((s) => (
                <div
                  key={s.ticker}
                  className="qdw-search-item"
                  onClick={() => handleSelectSearchResult(s)}
                >
                  <span className="qdw-si-ticker mono-num">{s.ticker}</span>
                  <span className="qdw-si-name">{s.companyName}</span>
                  <span className="qdw-si-price mono-num font-bold">
                    {(s.currentPrice || s.referencePrice || 0).toLocaleString('vi-VN')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unified Order Type Row */}
        <div className="qdw-field-group">
          <div className="qdw-label-row">
            <label className="qdw-label">LOẠI LỆNH GIAO DỊCH</label>
            <span className="qdw-sub-label">
              {isConditional ? 'LỆNH ĐIỀU KIỆN' : 'KHỚP LIÊN TỤC'}
            </span>
          </div>
          <select
            className="qdw-select"
            value={orderType}
            onChange={(e) => {
              setOrderType(e.target.value);
              setFeedback(null);
            }}
          >
            <optgroup label="— LỆNH CƠ SỞ (T+1.5) —">
              <option value="LIMIT">LO — Lệnh giới hạn</option>
              <option value="MARKET">MP — Lệnh thị trường</option>
            </optgroup>
            <optgroup label="— LỆNH ĐIỀU KIỆN TỰ ĐỘNG —">
              <option value="STOP">STOP — Lệnh dừng thị trường</option>
              <option value="STOP_LIMIT">STOP LIMIT — Dừng giới hạn</option>
              <option value="TRAILING_STOP">TRAILING — Chặn lãi trượt</option>
              <option value="OCO">OCO — Lệnh kép một hủy một</option>
              <option value="SL_TP">SL/TP — Cắt lỗ & Chốt lời</option>
            </optgroup>
          </select>
        </div>

        {/* Dynamic Condition Fields */}
        {orderType === 'LIMIT' && (
          <div className="qdw-field-group">
            <label className="qdw-label">GIÁ ĐẶT (VND)</label>
            <input
              type="number"
              step="100"
              className="qdw-input mono-num font-bold"
              placeholder="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        )}

        {orderType === 'MARKET' && (
          <div className="qdw-field-group">
            <label className="qdw-label">GIÁ ĐẶT</label>
            <div className="qdw-static-box mono-num">
              GIÁ THỊ TRƯỜNG TỐT NHẤT (MP)
            </div>
          </div>
        )}

        {orderType === 'STOP' && (
          <div className="qdw-field-group">
            <label className="qdw-label">GIÁ KÍCH HOẠT DỪNG (STOP PRICE)</label>
            <input
              type="number"
              step="100"
              className="qdw-input mono-num"
              placeholder="VD: 120000"
              value={stopPrice}
              onChange={(e) => setStopPrice(e.target.value)}
            />
          </div>
        )}

        {orderType === 'STOP_LIMIT' && (
          <div className="qdw-field-row">
            <div className="qdw-field-col">
              <label className="qdw-label">GIÁ KÍCH HOẠT</label>
              <input
                type="number"
                step="100"
                className="qdw-input mono-num"
                placeholder="Giá kích hoạt"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
              />
            </div>
            <div className="qdw-field-col">
              <label className="qdw-label">GIÁ ĐẶT GIỚI HẠN</label>
              <input
                type="number"
                step="100"
                className="qdw-input mono-num"
                placeholder="Giá đặt"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
              />
            </div>
          </div>
        )}

        {orderType === 'TRAILING_STOP' && (
          <div className="qdw-field-row">
            <div className="qdw-field-col">
              <label className="qdw-label">LOẠI BIÊN ĐỘ</label>
              <select
                className="qdw-select"
                value={trailingType}
                onChange={(e) => setTrailingType(e.target.value)}
              >
                <option value="PERCENT">PHẦN TRĂM (%)</option>
                <option value="AMOUNT">SỐ TIỀN (VND)</option>
              </select>
            </div>
            <div className="qdw-field-col">
              <label className="qdw-label">BIÊN ĐỘ TRƯỢT</label>
              <input
                type="number"
                step="0.1"
                className="qdw-input mono-num"
                placeholder={trailingType === 'PERCENT' ? 'VD: 5%' : 'VD: 3000'}
                value={trailingAmount}
                onChange={(e) => setTrailingAmount(e.target.value)}
              />
            </div>
          </div>
        )}

        {orderType === 'OCO' && (
          <div className="qdw-field-row">
            <div className="qdw-field-col">
              <label className="qdw-label">MỨC CHỐT LỜI (TP)</label>
              <input
                type="number"
                step="100"
                className="qdw-input mono-num"
                placeholder="Mức chốt lời"
                value={ocoPrice1}
                onChange={(e) => setOcoPrice1(e.target.value)}
              />
            </div>
            <div className="qdw-field-col">
              <label className="qdw-label">MỨC CẮT LỖ (SL)</label>
              <input
                type="number"
                step="100"
                className="qdw-input mono-num"
                placeholder="Mức cắt lỗ"
                value={ocoPrice2}
                onChange={(e) => setOcoPrice2(e.target.value)}
              />
            </div>
          </div>
        )}

        {orderType === 'SL_TP' && (
          <div className="qdw-field-row">
            <div className="qdw-field-col">
              <label className="qdw-label">GIÁ CẮT LỖ</label>
              <input
                type="number"
                step="100"
                className="qdw-input mono-num"
                placeholder="Cắt lỗ"
                value={stopLossPrice}
                onChange={(e) => setStopLossPrice(e.target.value)}
              />
            </div>
            <div className="qdw-field-col">
              <label className="qdw-label">GIÁ CHỐT LỜI</label>
              <input
                type="number"
                step="100"
                className="qdw-input mono-num"
                placeholder="Chốt lời"
                value={takeProfitPrice}
                onChange={(e) => setTakeProfitPrice(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Quantity Row & Percentage Quick Buttons */}
        <div className="qdw-field-group">
          <div className="qdw-label-row">
            <label className="qdw-label">KHỐI LƯỢNG (LÔ 100)</label>
            <div className="qdw-pct-actions">
              <button type="button" className="qdw-pct-btn mono-num" onClick={() => handleQuickPercent(25)}>25%</button>
              <button type="button" className="qdw-pct-btn mono-num" onClick={() => handleQuickPercent(50)}>50%</button>
              <button type="button" className="qdw-pct-btn mono-num" onClick={() => handleQuickPercent(75)}>75%</button>
              <button type="button" className="qdw-pct-btn mono-num" onClick={() => handleQuickPercent(100)}>100%</button>
            </div>
          </div>
          <input
            type="number"
            step="100"
            className="qdw-input mono-num font-bold"
            placeholder="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>

        {/* Financial Summary Table */}
        <div className="qdw-summary-panel">
          <div className="qdw-summary-row">
            <span className="qdw-sum-label">SỨC MUA KHẢ DỤNG</span>
            <span className="qdw-sum-val mono-num">
              {availableBalance.toLocaleString('vi-VN')} đ
            </span>
          </div>
          <div className="qdw-summary-row">
            <span className="qdw-sum-label">GIÁ TRỊ LỆNH DỰ KIẾN</span>
            <span className="qdw-sum-val mono-num font-bold">
              {orderValue.toLocaleString('vi-VN')} đ
            </span>
          </div>
          <div className="qdw-summary-row">
            <span className="qdw-sum-label">PHÍ GIAO DỊCH (0.15%)</span>
            <span className="qdw-sum-val mono-num">
              {estFee.toLocaleString('vi-VN')} đ
            </span>
          </div>
        </div>

        {/* Feedback Alert if any */}
        {feedback && (
          <div className={`qdw-alert qdw-alert-${feedback.type}`}>
            <span className="qdw-alert-tag">
              {feedback.type === 'success' ? 'THÀNH CÔNG' : 'CẢNH BÁO'}
            </span>
            <span className="qdw-alert-msg">{feedback.text}</span>
          </div>
        )}

        {/* Inline OTP Section (When requested) */}
        {otpMode && (
          <div className="qdw-otp-inline">
            <div className="qdw-label-row">
              <label className="qdw-label">XÁC THỰC MÃ OTP (EMAIL)</label>
              <button
                type="button"
                className="qdw-otp-resend-btn"
                onClick={handleRequestOtp}
                disabled={otpLoading || otpCountdown > 0}
              >
                {otpCountdown > 0 ? `GỬI LẠI (${otpCountdown}S)` : 'GỬI LẠI MÃ'}
              </button>
            </div>
            <input
              type="text"
              className="qdw-input mono-num font-bold"
              placeholder="Nhập 6 số OTP..."
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.trim())}
              maxLength={6}
            />
          </div>
        )}

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={submitting}
          className={`qdw-submit-btn qdw-btn-${side.toLowerCase()}`}
        >
          {submitting
            ? 'ĐANG XỬ LÝ LỆNH...'
            : `${side === 'BUY' ? 'XÁC NHẬN MUA' : 'XÁC NHẬN BÁN'} ${ticker || 'MÃ'}`}
        </button>
      </form>
    </section>
  );
}
