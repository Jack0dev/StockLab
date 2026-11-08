import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '@/presentation/controllers/useWebSocket';
import { formatPrice } from '@/service/trading.service';
import './PlatformTokenPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export default function PlatformTokenPage() {
  const [tokenData, setTokenData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTokenData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/platform-token`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setTokenData(data.data);
      }
    } catch (err) {
      setError('Không thể tải dữ liệu Token nền tảng');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokenData();
  }, [fetchTokenData]);

  // Realtime: khi có giao dịch mới → phí thay đổi → giá token thay đổi
  const handleTrade = useCallback(() => {
    fetchTokenData();
  }, [fetchTokenData]);

  const { connected } = useWebSocket('/topic/trades', handleTrade);

  const formatLargeNumber = (num) => {
    if (!num) return '0';
    const n = Number(num);
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + ' tỷ';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' triệu';
    if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
    return n.toLocaleString('vi-VN');
  };

  if (loading) {
    return (
      <div className="slp-page">
        <div className="slp-loading">
          <div className="spinner"></div>
          <span>Đang đồng bộ dữ liệu Token SLP...</span>
        </div>
      </div>
    );
  }

  if (error || !tokenData) {
    return (
      <div className="slp-page">
        <div className="slp-error">{error || 'Không tìm thấy dữ liệu'}</div>
      </div>
    );
  }

  const isPositive = tokenData.change > 0;
  const changeClass = isPositive ? 'positive' : tokenData.change < 0 ? 'negative' : 'neutral';

  return (
    <div className="slp-page">
      {/* Page Header */}
      <div className="slp-header">
        <div>
          <span className="slp-header-kicker">Phân hệ Tài sản & Doanh thu</span>
          <h1 className="slp-header-title">Chỉ Số Token Nền Tảng (SLP)</h1>
          <p className="slp-header-sub">
            Cơ chế gắn liền giá trị Token với hiệu quả hoạt động và dòng tiền phí giao dịch toàn sàn StockLab.
          </p>
        </div>
        <div>
          <span className="slp-live-badge">
            {connected ? 'Realtime Connected' : 'Đồng bộ định kỳ'}
          </span>
        </div>
      </div>

      {/* Hero Section */}
      <div className="slp-hero">
        <div className="slp-hero-content">
          <div className="slp-token-badge">
            <div className="slp-token-icon">
              SLP
            </div>
            <div className="slp-token-info">
              <h2>{tokenData.name}</h2>
              <span className="slp-ticker-pill">{tokenData.ticker}</span>
            </div>
          </div>

          <div className="slp-price-section">
            <div className="slp-current-price">
              {formatPrice(tokenData.currentPrice)}
              <span className="slp-currency">VND</span>
            </div>
            <div className={`slp-change-pill ${changeClass}`}>
              <span>{isPositive ? '+' : ''}{formatPrice(tokenData.change)}</span>
              <span>
                ({isPositive ? '+' : ''}{tokenData.changePercent?.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="slp-stats-grid">
        <div className="slp-stat-card">
          <span className="slp-stat-index">01</span>
          <div className="slp-stat-label">Mức giá cơ sở ban đầu</div>
          <div className="slp-stat-value">
            {formatPrice(tokenData.basePrice)} <span style={{ fontSize: '0.85rem', color: '#64748b' }}>đ</span>
          </div>
        </div>

        <div className="slp-stat-card">
          <span className="slp-stat-index">02</span>
          <div className="slp-stat-label">Vốn hóa thị trường</div>
          <div className="slp-stat-value">
            {formatLargeNumber(tokenData.marketCap)} <span style={{ fontSize: '0.85rem', color: '#64748b' }}>đ</span>
          </div>
        </div>

        <div className="slp-stat-card">
          <span className="slp-stat-index">03</span>
          <div className="slp-stat-label">Tổng lượng cung (Supply)</div>
          <div className="slp-stat-value">
            {formatPrice(tokenData.totalSupply)} <span style={{ fontSize: '0.85rem', color: '#64748b' }}>SLP</span>
          </div>
        </div>

        <div className="slp-stat-card">
          <span className="slp-stat-index">04</span>
          <div className="slp-stat-label">Tỷ lệ phí sàn áp dụng</div>
          <div className="slp-stat-value" style={{ color: '#090d16' }}>
            {formatPrice(tokenData.feeRate)}% <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>/ chiều</span>
          </div>
        </div>
      </div>

      {/* Revenue Section */}
      <div className="slp-section-block">
        <div className="slp-section-header">
          <h3 className="slp-section-title">Doanh Thu & Dòng Tiền Tích Lũy Sàn</h3>
          <p className="slp-section-desc">Toàn bộ phí giao dịch thu được từ nhà đầu tư và bot khớp lệnh được tự động phân bổ vào quỹ thanh khoản token.</p>
        </div>

        <div className="slp-revenue-grid">
          <div className="slp-revenue-card highlight-card">
            <div className="slp-revenue-card-header">
              <span className="slp-revenue-label">Tổng phí giao dịch tích lũy</span>
              <span className="slp-revenue-badge">Toàn sàn</span>
            </div>
            <div className="slp-revenue-value">
              {formatLargeNumber(tokenData.totalFeesCollected)} <span className="slp-revenue-unit">đ</span>
            </div>
            <div className="slp-progress-track">
              <div 
                className="slp-progress-fill" 
                style={{ 
                  width: `${Math.min(100, (Number(tokenData.totalFeesCollected) / (Number(tokenData.basePrice) * tokenData.totalSupply) * 100) * 10)}%` 
                }}
              ></div>
            </div>
          </div>

          <div className="slp-revenue-card">
            <div className="slp-revenue-card-header">
              <span className="slp-revenue-label">Phí thu trong ngày</span>
              <span className="slp-revenue-badge today">Hôm nay</span>
            </div>
            <div className="slp-revenue-value">
              {formatLargeNumber(tokenData.dailyFees)} <span className="slp-revenue-unit">đ</span>
            </div>
          </div>

          <div className="slp-revenue-card">
            <div className="slp-revenue-card-header">
              <span className="slp-revenue-label">Tổng lượt khớp lệnh</span>
            </div>
            <div className="slp-revenue-value">
              {formatPrice(tokenData.totalTradesCount)}
              <span className="slp-revenue-unit">lượt</span>
            </div>
          </div>

          <div className="slp-revenue-card">
            <div className="slp-revenue-card-header">
              <span className="slp-revenue-label">Tổng khối lượng giao dịch</span>
            </div>
            <div className="slp-revenue-value">
              {formatLargeNumber(tokenData.totalTradingVolume)} <span className="slp-revenue-unit">đ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mechanism Steps */}
      <div className="slp-section-block">
        <div className="slp-section-header">
          <h3 className="slp-section-title">Cơ Chế Định Giá Tự Động Token SLP</h3>
          <p className="slp-section-desc">Mô hình giá trị nội tại được bảo chứng bằng thanh khoản dòng tiền giao dịch thực tế.</p>
        </div>

        <div className="slp-steps-grid">
          <div className="slp-step-card">
            <div className="slp-step-num">01 / THU PHÍ KHỚP LỆNH</div>
            <h4>Thu phí giao dịch</h4>
            <p>Mỗi khi lệnh mua hoặc bán được khớp trên hệ thống, sàn tự động trích thu <strong>{tokenData.feeRate}%</strong> phí dịch vụ.</p>
          </div>

          <div className="slp-step-card">
            <div className="slp-step-num">02 / TÍCH LŨY DÒNG TIỀN</div>
            <h4>Tích lũy quỹ thanh khoản</h4>
            <p>Dòng tiền phí không phân tán mà được cộng dồn vào quỹ bảo chứng nền tảng, phản ánh quy mô giao dịch gia tăng.</p>
          </div>

          <div className="slp-step-card">
            <div className="slp-step-num">03 / ĐỊNH GIÁ TỰ ĐỘNG</div>
            <h4>Gia tăng giá trị SLP</h4>
            <p>Giá trị Token tỷ lệ thuận với dòng tiền tích lũy:
              <code>SLP = Base × (1 + Fees / MarketCap)</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
