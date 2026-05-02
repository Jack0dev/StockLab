import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
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
      setError('Không thể tải dữ liệu token');
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

  const formatPrice = (price) => {
    if (!price) return '0';
    return Number(price).toLocaleString('vi-VN');
  };

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
      <div className="slp-page fade-in">
        <div className="slp-loading">
          <div className="spinner"></div>
          <span>Đang tải dữ liệu Token SLP...</span>
        </div>
      </div>
    );
  }

  if (error || !tokenData) {
    return (
      <div className="slp-page fade-in">
        <div className="slp-error">{error || 'Không có dữ liệu'}</div>
      </div>
    );
  }

  const isPositive = tokenData.change > 0;
  const changeClass = isPositive ? 'positive' : tokenData.change < 0 ? 'negative' : 'neutral';

  return (
    <div className="slp-page fade-in">
      {/* Hero Section */}
      <div className="slp-hero">
        <div className="slp-hero-bg"></div>
        <div className="slp-hero-content">
          <div className="slp-token-badge">
            <div className="slp-token-icon">
              <span className="slp-icon-text">SLP</span>
              <div className="slp-icon-glow"></div>
            </div>
            <div className="slp-token-info">
              <h1 className="slp-title">{tokenData.name}</h1>
              <span className="slp-ticker">{tokenData.ticker}</span>
            </div>
          </div>

          <div className="slp-price-section">
            <div className="slp-current-price">
              {formatPrice(tokenData.currentPrice)}
              <span className="slp-currency">VND</span>
            </div>
            <div className={`slp-change ${changeClass}`}>
              <span className="slp-change-icon">
                {isPositive ? '▲' : tokenData.change < 0 ? '▼' : '–'}
              </span>
              <span>{isPositive ? '+' : ''}{formatPrice(tokenData.change)}</span>
              <span className="slp-change-pct">
                ({isPositive ? '+' : ''}{tokenData.changePercent?.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="slp-stats-grid">
        <div className="slp-stat-card">
          <div className="slp-stat-icon">💰</div>
          <div className="slp-stat-content">
            <span className="slp-stat-label">Giá ban đầu</span>
            <span className="slp-stat-value">{formatPrice(tokenData.basePrice)} ₫</span>
          </div>
        </div>

        <div className="slp-stat-card">
          <div className="slp-stat-icon">📊</div>
          <div className="slp-stat-content">
            <span className="slp-stat-label">Vốn hoá</span>
            <span className="slp-stat-value">{formatLargeNumber(tokenData.marketCap)} ₫</span>
          </div>
        </div>

        <div className="slp-stat-card">
          <div className="slp-stat-icon">🪙</div>
          <div className="slp-stat-content">
            <span className="slp-stat-label">Tổng Supply</span>
            <span className="slp-stat-value">{formatPrice(tokenData.totalSupply)} SLP</span>
          </div>
        </div>

        <div className="slp-stat-card">
          <div className="slp-stat-icon">💸</div>
          <div className="slp-stat-content">
            <span className="slp-stat-label">Phí GD ({tokenData.feeRate}%/bên)</span>
            <span className="slp-stat-value highlight">{formatPrice(tokenData.feeRate)}%</span>
          </div>
        </div>
      </div>

      {/* Platform Revenue Section */}
      <div className="slp-revenue-section">
        <h2 className="slp-section-title">
          <span className="slp-section-icon">🏦</span>
          Lợi Nhuận Sàn
        </h2>

        <div className="slp-revenue-grid">
          <div className="slp-revenue-card total-fees">
            <div className="slp-revenue-header">
              <span className="slp-revenue-label">Tổng phí thu được</span>
              <span className="slp-revenue-badge">Tích lũy</span>
            </div>
            <div className="slp-revenue-value">
              {formatLargeNumber(tokenData.totalFeesCollected)} ₫
            </div>
            <div className="slp-revenue-bar">
              <div className="slp-revenue-bar-fill" style={{ 
                width: `${Math.min(100, (Number(tokenData.totalFeesCollected) / (Number(tokenData.basePrice) * tokenData.totalSupply) * 100) * 10)}%` 
              }}></div>
            </div>
          </div>

          <div className="slp-revenue-card daily-fees">
            <div className="slp-revenue-header">
              <span className="slp-revenue-label">Phí hôm nay</span>
              <span className="slp-revenue-badge today">Hôm nay</span>
            </div>
            <div className="slp-revenue-value">
              {formatLargeNumber(tokenData.dailyFees)} ₫
            </div>
          </div>

          <div className="slp-revenue-card trades-count">
            <div className="slp-revenue-header">
              <span className="slp-revenue-label">Tổng giao dịch</span>
            </div>
            <div className="slp-revenue-value">
              {formatPrice(tokenData.totalTradesCount)}
              <span className="slp-revenue-unit">lệnh</span>
            </div>
          </div>

          <div className="slp-revenue-card volume">
            <div className="slp-revenue-header">
              <span className="slp-revenue-label">Tổng KLGD</span>
            </div>
            <div className="slp-revenue-value">
              {formatLargeNumber(tokenData.totalTradingVolume)} ₫
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="slp-info-section">
        <h2 className="slp-section-title">
          <span className="slp-section-icon">⚙️</span>
          Cơ Chế Token SLP
        </h2>
        <div className="slp-info-cards">
          <div className="slp-info-card">
            <div className="slp-info-step">1</div>
            <h3>Thu phí giao dịch</h3>
            <p>Mỗi lệnh khớp, sàn thu <strong>{tokenData.feeRate}%</strong> phí từ cả người mua lẫn người bán.</p>
          </div>
          <div className="slp-info-card">
            <div className="slp-info-step">2</div>
            <h3>Tích lũy lợi nhuận</h3>
            <p>Tổng phí được tích lũy vào quỹ sàn, phản ánh sức khoẻ và hoạt động giao dịch.</p>
          </div>
          <div className="slp-info-card">
            <div className="slp-info-step">3</div>
            <h3>Giá SLP tăng</h3>
            <p>Công thức: <code>SLP = Base × (1 + Fees / MarketCap)</code>. Càng nhiều GD → SLP tăng giá.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
