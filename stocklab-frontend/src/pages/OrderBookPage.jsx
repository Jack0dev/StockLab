import { useState, useEffect, useRef } from 'react';
import { orderAPI, stockAPI } from '../api/api';
import { usePageTour } from '../hooks/usePageTour';
import { useWebSocket } from '../hooks/useWebSocket';
import './OrderBookPage.css';

export default function OrderBookPage() {
  const { restartTour } = usePageTour('orderBook');
  const [ticker, setTicker] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [orderBook, setOrderBook] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const intervalRef = useRef(null);
  const debounceRef = useRef(null);

  // Fetch order book
  const fetchOrderBook = async (t) => {
    if (!t) return;
    setLoading(true);
    setError('');
    try {
      const res = await orderAPI.getOrderBook(t);
      if (res.data.success) {
        setOrderBook(res.data.data);
      } else {
        setError(res.data.message);
        setOrderBook(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi tải order book');
      setOrderBook(null);
    } finally {
      setLoading(false);
    }
  };

  // Realtime updates via WebSocket (with Debounce)
  const { connected } = useWebSocket('/topic/orderbook', (msg) => {
    if (ticker && msg && msg.ticker === ticker) {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchOrderBook(ticker);
      }, 300);
    }
  });

  // Search autocomplete
  const handleSearchChange = (val) => {
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    if (val.length < 1) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await stockAPI.search(val);
        if (res.data.success) {
          setSuggestions(res.data.data?.slice(0, 8) || []);
        }
      } catch { setSuggestions([]); }
    }, 300);
  };

  const selectStock = (t) => {
    setTicker(t);
    setSearchInput(t);
    setSuggestions([]);
    fetchOrderBook(t);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      selectStock(searchInput.trim().toUpperCase());
    }
  };

  const formatPrice = (p) => Number(p).toLocaleString('vi-VN');

  // Calculate max quantity for depth bars
  const maxQty = orderBook
    ? Math.max(
      ...orderBook.bids.map(b => b.totalQuantity),
      ...orderBook.asks.map(a => a.totalQuantity),
      1
    )
    : 1;

  return (
    <div className="order-book-page fade-in">
      <div className="ob-header">
        <h2>📊 Sổ lệnh</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="ob-subtitle">Sổ lệnh theo mã cổ phiếu</span>
          <button className="page-tour-btn" onClick={restartTour} title="Hướng dẫn trang này">?</button>
        </div>
      </div>

      {/* Search */}
      <div className="ob-search-section">
        <form onSubmit={handleSearchSubmit} className="ob-search-form">
          <div className="ob-search-wrapper">
            <svg className="ob-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              className="ob-search-input"
              placeholder="Nhập mã CP (VD: VNM, FPT, VIC...)"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value.toUpperCase())}
              autoComplete="off"
            />
            <button type="submit" className="ob-search-btn">Xem</button>
          </div>
          {suggestions.length > 0 && (
            <div className="ob-suggestions">
              {suggestions.map(s => (
                <div key={s.ticker} className="ob-suggestion-item" onClick={() => selectStock(s.ticker)}>
                  <span className="ob-sug-ticker">{s.ticker}</span>
                  <span className="ob-sug-name">{s.companyName}</span>
                </div>
              ))}
            </div>
          )}
        </form>

      </div>

      {/* Error */}
      {error && <div className="ob-error">{error}</div>}

      {/* Loading */}
      {loading && !orderBook && <div className="ob-loading">Đang tải...</div>}

      {/* Empty */}
      {!ticker && !loading && (
        <div className="ob-empty">
          <div className="ob-empty-icon">🔍</div>
          <div>Nhập mã cổ phiếu để xem Order Book</div>
        </div>
      )}

      {/* Order Book Table */}
      {orderBook && (
        <div className="ob-content">
          <div className="ob-stock-info">
            <h3>{orderBook.ticker}</h3>
            <span>{orderBook.companyName}</span>
          </div>

          <div className="ob-grid">
            {/* BID — Bên mua */}
            <div className="ob-side ob-bid-side">
              <div className="ob-side-header bid">
                <span>BID — Bên mua</span>
                <span className="ob-side-count">{orderBook.bids.length} mức giá</span>
              </div>
              <div className="ob-table-header">
                <span>Số lệnh</span>
                <span>Khối lượng</span>
                <span>Giá</span>
              </div>
              {orderBook.bids.length === 0 ? (
                <div className="ob-no-data">Không có lệnh mua</div>
              ) : (
                orderBook.bids.map((entry, i) => (
                  <div key={i} className="ob-row bid-row">
                    <div className="ob-depth-bar bid-bar" style={{ width: `${(entry.totalQuantity / maxQty) * 100}%` }} />
                    <span className="ob-cell ob-count">{entry.orderCount}</span>
                    <span className="ob-cell ob-qty">{entry.totalQuantity.toLocaleString()}</span>
                    <span className="ob-cell ob-price bid-price">{formatPrice(entry.price)}</span>
                  </div>
                ))
              )}
            </div>

            {/* ASK — Bên bán */}
            <div className="ob-side ob-ask-side">
              <div className="ob-side-header ask">
                <span>ASK — Bên bán</span>
                <span className="ob-side-count">{orderBook.asks.length} mức giá</span>
              </div>
              <div className="ob-table-header">
                <span>Giá</span>
                <span>Khối lượng</span>
                <span>Số lệnh</span>
              </div>
              {orderBook.asks.length === 0 ? (
                <div className="ob-no-data">Không có lệnh bán</div>
              ) : (
                orderBook.asks.map((entry, i) => (
                  <div key={i} className="ob-row ask-row">
                    <div className="ob-depth-bar ask-bar" style={{ width: `${(entry.totalQuantity / maxQty) * 100}%` }} />
                    <span className="ob-cell ob-price ask-price">{formatPrice(entry.price)}</span>
                    <span className="ob-cell ob-qty">{entry.totalQuantity.toLocaleString()}</span>
                    <span className="ob-cell ob-count">{entry.orderCount}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="ob-summary">
            <div className="ob-summary-item">
              <span className="ob-summary-label">Tổng KL mua</span>
              <span className="ob-summary-value bid-text">
                {orderBook.bids.reduce((s, b) => s + b.totalQuantity, 0).toLocaleString()}
              </span>
            </div>
            <div className="ob-summary-item">
              <span className="ob-summary-label">Tổng KL bán</span>
              <span className="ob-summary-value ask-text">
                {orderBook.asks.reduce((s, a) => s + a.totalQuantity, 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
