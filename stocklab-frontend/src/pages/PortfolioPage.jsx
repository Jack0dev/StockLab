import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { tradeAPI, userAPI } from '../api/api';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { usePageTour } from '../hooks/usePageTour';
import { useBatchWebSocket } from '../hooks/useBatchWebSocket';
import { useWebSocket } from '../context/WebSocketContext';
import './PortfolioPage.css';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function PortfolioPage() {
  const navigate = useNavigate();
  const { restartTour } = usePageTour('portfolio');
  const { lastResyncTime } = useWebSocket();
  const [portfolio, setPortfolio] = useState([]);
  const [summary, setSummary] = useState(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [lastResyncTime]);

  useBatchWebSocket('/user/queue/portfolio', (batches) => {
    if (batches.length > 0) {
      const latest = batches[batches.length - 1];
      setPortfolio(latest.portfolios || []);
      // Refetch summary as it contains calculated allocations
      tradeAPI.getPortfolioSummary().then(res => {
         if(res.data.success) setSummary(res.data.data);
      }).catch(err => console.error(err));
    }
  });

  useBatchWebSocket('/user/queue/balance', (batches) => {
    if (batches.length > 0) {
      const latest = batches[batches.length - 1];
      setBalance(latest.balance);
    }
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [portfolioRes, profileRes, summaryRes] = await Promise.all([
        tradeAPI.getPortfolio(),
        userAPI.getProfile(),
        tradeAPI.getPortfolioSummary(),
      ]);
      if (portfolioRes.data.success) setPortfolio(portfolioRes.data.data);
      if (profileRes.data.success) setBalance(profileRes.data.data.balance);
      if (summaryRes.data.success) setSummary(summaryRes.data.data);
    } catch (err) {
      console.error('Lỗi tải dữ liệu:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalValue = portfolio.reduce((sum, p) => sum + Number(p.totalValue), 0);
  const totalInvested = portfolio.reduce((sum, p) => sum + (Number(p.avgBuyPrice) * p.quantity), 0);
  const totalPnL = portfolio.reduce((sum, p) => sum + Number(p.profitLoss), 0);
  const totalPnLPercent = totalInvested > 0 ? ((totalPnL / totalInvested) * 100) : 0;
  const totalAssets = totalValue + Number(balance);

  const formatPrice = (price) => {
    if (!price && price !== 0) return '0';
    return Number(price).toLocaleString('vi-VN');
  };

  const getTickerColor = (ticker) => {
    const colors = ['#2962ff', '#00c853', '#ff6d00', '#aa00ff', '#d50000', '#00bfa5', '#6200ea', '#c51162'];
    let hash = 0;
    for (let i = 0; i < ticker.length; i++) hash = ticker.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  // Donut chart data
  const chartData = summary && summary.allocations?.length > 0 ? {
    labels: summary.allocations.map(a => a.ticker),
    datasets: [{
      data: summary.allocations.map(a => Number(a.value)),
      backgroundColor: summary.allocations.map(a => a.color),
      borderColor: 'rgba(0,0,0,0.3)',
      borderWidth: 2,
      hoverOffset: 8,
    }],
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e2235',
        titleFont: { family: "'Inter', sans-serif", size: 13 },
        bodyFont: { family: "'Inter', sans-serif", size: 12 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => {
            const alloc = summary.allocations[ctx.dataIndex];
            return `${alloc.ticker}: ${formatPrice(alloc.value)} VND (${alloc.percentage?.toFixed(1)}%)`;
          },
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="portfolio-page">
        <div className="pf-loading">
          <div className="spinner"></div>
          <span>Đang tải danh mục đầu tư...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="portfolio-page fade-in">
      <div className="pf-header">
        <h2>💼 Danh mục đầu tư</h2>
        <button className="page-tour-btn" onClick={restartTour} title="Hướng dẫn trang này">?</button>
      </div>

      {/* Summary Cards */}
      <div className="pf-summary-grid">
        <div className="pf-summary-card">
          <div className="pf-summary-label">Tổng tài sản</div>
          <div className="pf-summary-value">{formatPrice(totalAssets)} VND</div>
        </div>
        <div className="pf-summary-card">
          <div className="pf-summary-label">Giá trị CP</div>
          <div className="pf-summary-value accent">{formatPrice(totalValue)} VND</div>
        </div>
        <div className="pf-summary-card">
          <div className="pf-summary-label">Tiền mặt</div>
          <div className="pf-summary-value">{formatPrice(balance)} VND</div>
        </div>
        <div className="pf-summary-card">
          <div className="pf-summary-label">Tổng lãi/lỗ</div>
          <div className={`pf-summary-value ${totalPnL >= 0 ? 'up' : 'down'}`}>
            {totalPnL >= 0 ? '+' : ''}{formatPrice(totalPnL)} VND
            <span className="pf-pnl-pct">({totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%)</span>
          </div>
        </div>
      </div>

      {/* Allocation Chart + Legend */}
      {chartData && (
        <div className="pf-allocation-section">
          <h3>📊 Phân bổ tài sản</h3>
          <div className="pf-allocation-content">
            <div className="pf-chart-wrapper">
              <Doughnut data={chartData} options={chartOptions} />
              <div className="pf-chart-center">
                <div className="pf-chart-center-value">{portfolio.length}</div>
                <div className="pf-chart-center-label">Cổ phiếu</div>
              </div>
            </div>
            <div className="pf-allocation-legend">
              {summary.allocations.map(alloc => (
                <div key={alloc.ticker} className="pf-legend-item">
                  <div className="pf-legend-color" style={{ background: alloc.color }}></div>
                  <div className="pf-legend-info">
                    <span className="pf-legend-ticker">{alloc.ticker}</span>
                    <span className="pf-legend-name">{alloc.companyName}</span>
                  </div>
                  <div className="pf-legend-values">
                    <span className="pf-legend-pct">{alloc.percentage?.toFixed(1)}%</span>
                    <span className="pf-legend-value">{formatPrice(alloc.value)} VND</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Table */}
      {portfolio.length === 0 ? (
        <div className="pf-empty">
          <span style={{ fontSize: '2rem' }}>📦</span>
          <span>Chưa có cổ phiếu nào trong danh mục</span>
          <button className="btn-go-trade" onClick={() => navigate('/trading')}>
            Bắt đầu giao dịch →
          </button>
        </div>
      ) : (
        <div className="pf-table-wrapper">
          <table className="pf-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Mã CP</th>
                <th style={{ textAlign: 'left' }}>Tên công ty</th>
                <th>Sàn</th>
                <th>Số lượng</th>
                <th>Giá TB mua</th>
                <th>Giá hiện tại</th>
                <th>Giá trị</th>
                <th>Lãi/Lỗ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map(item => (
                <tr key={item.ticker}>
                  <td style={{ textAlign: 'left' }}>
                    <div className="pf-ticker-cell">
                      <div className="pf-ticker-icon" style={{ background: getTickerColor(item.ticker) }}>
                        {item.ticker.substring(0, 2)}
                      </div>
                      <span className="pf-ticker-symbol">{item.ticker}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <span className="pf-company">{item.companyName}</span>
                  </td>
                  <td>
                    <span className={`exchange-badge exchange-${item.exchange?.toLowerCase()}`}>
                      {item.exchange}
                    </span>
                  </td>
                  <td className="pf-num">{item.quantity.toLocaleString('vi-VN')}</td>
                  <td className="pf-num">{formatPrice(item.avgBuyPrice)}</td>
                  <td className="pf-num">{formatPrice(item.currentPrice)}</td>
                  <td className="pf-num pf-bold">{formatPrice(item.totalValue)}</td>
                  <td>
                    <div className={`pf-pnl-cell ${item.profitLoss >= 0 ? 'up' : 'down'}`}>
                      <span>{item.profitLoss >= 0 ? '+' : ''}{formatPrice(item.profitLoss)}</span>
                      <span className="pf-pnl-percent">
                        ({item.profitLossPercent >= 0 ? '+' : ''}{item.profitLossPercent?.toFixed(2)}%)
                      </span>
                    </div>
                  </td>
                  <td>
                    <button className="pf-sell-btn" onClick={() => navigate('/trading')}>
                      Bán
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
