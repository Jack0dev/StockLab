import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { watchlistAPI } from '@/infrastructure/repositories/api';
import { usePageTour } from '@/presentation/controllers/usePageTour';
import { formatPrice, getTickerColor, getPriceClass } from '@/service/trading.service';
import './WatchlistPage.css';

export default function WatchlistPage() {
  const navigate = useNavigate();
  const { restartTour } = usePageTour('watchlist');
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    setLoading(true);
    try {
      const res = await watchlistAPI.getAll();
      if (res.data.success) setWatchlist(res.data.data);
    } catch (err) {
      console.error('Lỗi tải danh sách theo dõi:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (ticker) => {
    try {
      const res = await watchlistAPI.remove(ticker);
      if (res.data.success) {
        setWatchlist(prev => prev.filter(w => w.ticker !== ticker));
      }
    } catch (err) {
      console.error('Lỗi xóa:', err);
    }
  };

  if (loading) {
    return (
      <div className="watchlist-page">
        <div className="wl-loading">
          <div className="spinner"></div>
          <span>Đang tải danh sách theo dõi...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="watchlist-page fade-in">
      <div className="wl-header">
        <h2>⭐ Danh sách theo dõi</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="wl-count">{watchlist.length} cổ phiếu</span>
          <button className="page-tour-btn" onClick={restartTour} title="Hướng dẫn trang này">?</button>
        </div>
      </div>

      {watchlist.length === 0 ? (
        <div className="wl-empty">
          <span style={{ fontSize: '2rem' }}>⭐</span>
          <span>Chưa theo dõi cổ phiếu nào</span>
          <p>Vào trang chi tiết cổ phiếu và nhấn "Theo dõi" để thêm</p>
          <button className="btn-go-stocks" onClick={() => navigate('/stocks')}>
            Xem bảng giá →
          </button>
        </div>
      ) : (
        <div className="wl-grid">
          {watchlist.map(item => (
            <div key={item.ticker} className="wl-card">
              <div className="wl-card-header">
                <div className="wl-card-left" onClick={() => navigate(`/stocks/${item.ticker}`)} style={{ cursor: 'pointer' }}>
                  <div
                    className="wl-icon"
                    style={{ background: getTickerColor(item.ticker) }}
                  >
                    {item.ticker.substring(0, 2)}
                  </div>
                  <div>
                    <div className="wl-ticker">{item.ticker}</div>
                    <div className="wl-company">{item.companyName}</div>
                  </div>
                </div>
                <button className="wl-remove-btn" onClick={() => handleRemove(item.ticker)} title="Bỏ theo dõi">
                  ✕
                </button>
              </div>

              <div className="wl-card-body">
                <div className="wl-price">{formatPrice(item.currentPrice)} <span className="wl-currency">VND</span></div>
                <div className={`wl-change ${getPriceClass(item.change)}`}>
                  {item.change > 0 ? '+' : ''}{formatPrice(item.change)}
                  <span className="wl-change-pct">
                    ({item.changePercent > 0 ? '+' : ''}{item.changePercent?.toFixed(2)}%)
                  </span>
                </div>
              </div>

              <div className="wl-card-footer">
                <span className={`wl-exchange exchange-${item.exchange?.toLowerCase()}`}>{item.exchange}</span>
                <button className="wl-trade-btn" onClick={() => navigate('/trading')}>
                  Giao dịch
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
