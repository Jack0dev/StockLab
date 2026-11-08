import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI, adminNewsAPI } from '@/infrastructure/repositories/api';
import { useWebSocket } from '@/presentation/controllers/useWebSocket';
import './AdminDashboardPage.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Crawler states
  const [crawlerStats, setCrawlerStats] = useState(null);
  const [crawling, setCrawling] = useState(false);
  const [crawlMsg, setCrawlMsg] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminAPI.getAdminDashboard();
      if (res.data.success) {
        setStats(res.data.data);
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải dữ liệu thống kê');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCrawlerStats = useCallback(async () => {
    try {
      const res = await adminNewsAPI.getStats();
      if (res.data?.success) {
        setCrawlerStats(res.data.data);
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu crawler:', err);
    }
  }, []);

  const handleCrawlNow = async () => {
    setCrawling(true);
    setCrawlMsg(null);
    try {
      const res = await adminNewsAPI.crawlNow();
      if (res.data?.success) {
        const d = res.data.data;
        setCrawlMsg({
          type: 'success',
          text: `Đã cào tin thành công! Thu thập: ${d.totalFetched} tin | Lưu mới: ${d.newSaved} tin | Bỏ qua trùng lặp: ${d.duplicatesSkipped} (${d.durationMs}ms)`
        });
        fetchCrawlerStats();
      } else {
        setCrawlMsg({ type: 'error', text: res.data?.message || 'Không thể cào tin.' });
      }
    } catch (err) {
      setCrawlMsg({
        type: 'error',
        text: err.response?.data?.message || 'Có lỗi xảy ra khi thực hiện cào tin tức.'
      });
    } finally {
      setCrawling(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchCrawlerStats();
  }, [fetchStats, fetchCrawlerStats]);

  // Realtime: khi có giao dịch mới → cập nhật thống kê
  const handleTrade = useCallback(() => {
    fetchStats();
  }, [fetchStats]);

  useWebSocket('/topic/trades', handleTrade);

  if (loading) {
    return (
      <div className="admin-page-container">
        <div className="admin-loading-box">
          <div className="spinner"></div>
          <span>Đang tải số liệu tổng quan hệ thống...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page-container">
        <div className="admin-error-box">
          <strong>Thông báo lỗi:</strong> {error}
        </div>
      </div>
    );
  }

  // Cấu hình dữ liệu cho Biểu đồ Cột (Bar Chart)
  const chartData = {
    labels: stats?.topStocks?.map(ts => ts.ticker) || [],
    datasets: [
      {
        label: 'Khối Lượng Khớp Lệnh (CP)',
        data: stats?.topStocks?.map(ts => ts.volume) || [],
        backgroundColor: '#090d16',
        borderRadius: 6,
        borderSkipped: false,
        hoverBackgroundColor: '#1e40af',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#090d16',
        titleFont: { family: "'Inter', sans-serif", size: 12, weight: 'bold' },
        bodyFont: { family: "'Inter', sans-serif", size: 12 },
        padding: 10,
        cornerRadius: 6,
        callbacks: {
          label: (ctx) => ` ${ctx.parsed.y?.toLocaleString('vi-VN')} CP`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { family: "'Inter', sans-serif", weight: 'bold' }, color: '#475569' },
      },
      y: {
        grid: { color: '#f1f5f9' },
        ticks: { font: { family: "'Inter', sans-serif" }, color: '#94a3b8' },
      },
    },
  };

  return (
    <div className="admin-page-container fade-in">
      {/* Header */}
      <div className="admin-top-header">
        <div>
          <span className="admin-kicker">TRUNG TÂM QUẢN TRỊ</span>
          <h1 className="admin-title">Báo Cáo & Thống Kê Toàn Sàn</h1>
          <p className="admin-sub">
            Tổng quan hiệu suất giao dịch, khối lượng khớp lệnh và tình hình hoạt động của tài khoản người dùng
          </p>
        </div>
        <div className="admin-header-actions">
          <span className="live-status-pill">
            <span className="live-dot"></span>
            DỮ LIỆU REALTIME
          </span>
        </div>
      </div>
      
      {/* 4 Stat Cards */}
      <div className="admin-summary-grid">
        <div className="admin-stat-card">
          <div className="stat-card-top">
            <span className="stat-idx mono-num">01</span>
            <span className="stat-label">Tổng Người Dùng</span>
          </div>
          <p className="stat-number tabular-num">{stats?.totalUsers?.toLocaleString('vi-VN') || 0}</p>
          <span className="stat-foot">Tài khoản đã đăng ký</span>
        </div>

        <div className="admin-stat-card">
          <div className="stat-card-top">
            <span className="stat-idx mono-num">02</span>
            <span className="stat-label">Tổng Lệnh Khớp</span>
          </div>
          <p className="stat-number tabular-num">{stats?.totalTransactions?.toLocaleString('vi-VN') || 0}</p>
          <span className="stat-foot">Giao dịch đã thực thi</span>
        </div>

        <div className="admin-stat-card">
          <div className="stat-card-top">
            <span className="stat-idx mono-num">03</span>
            <span className="stat-label">Tổng Khối Lượng CP</span>
          </div>
          <p className="stat-number tabular-num">{stats?.totalVolume?.toLocaleString('vi-VN') || 0}</p>
          <span className="stat-foot">Cổ phiếu lưu chuyển</span>
        </div>

        <div className="admin-stat-card">
          <div className="stat-card-top">
            <span className="stat-idx mono-num">04</span>
            <span className="stat-label">Tổng Giá Trị Sàn</span>
          </div>
          <p className="stat-number tabular-num text-bullish">
            {stats?.totalRevenue?.toLocaleString('vi-VN')} <span className="stat-curr">₫</span>
          </p>
          <span className="stat-foot">Thanh khoản tích lũy</span>
        </div>
      </div>

      {/* Top 5 Stocks Section */}
      <div className="admin-panel-card">
        <div className="panel-card-header">
          <div>
            <span className="panel-kicker">THANH KHOẢN CAO NHẤT</span>
            <h3 className="panel-title">Top 5 Cổ Phiếu Giao Dịch Nhiều Nhất</h3>
          </div>
          <span className="panel-tag">Khối lượng khớp lệnh</span>
        </div>

        {stats?.topStocks && stats.topStocks.length > 0 ? (
          <div className="dashboard-content-split">
            <div className="chart-wrapper">
              <Bar data={chartData} options={chartOptions} />
            </div>

            <div className="table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Thứ Hạng</th>
                    <th>Mã Cổ Phiếu</th>
                    <th className="th-right">Khối Lượng Khớp</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topStocks.map((ts, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className="rank-badge mono-num">0{idx + 1}</span>
                      </td>
                      <td>
                        <span 
                          className="ticker-badge mono-num clickable-ticker"
                          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => navigate(`/stocks/${ts.ticker}`)}
                          title={`Xem biểu đồ giao dịch & phân tích kỹ thuật ${ts.ticker}`}
                        >
                          {ts.ticker} <span style={{ fontSize: '0.7rem', color: '#64748b' }}>↗</span>
                        </span>
                      </td>
                      <td className="th-right tabular-num font-bold">
                        {ts.volume?.toLocaleString('vi-VN')} <span className="unit-text">CP</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="panel-empty">
            <p>Chưa có dữ liệu giao dịch phát sinh trong phiên.</p>
          </div>
        )}
      </div>

      {/* News Crawler Management Section */}
      <div className="admin-panel-card crawler-card-wrap">
        <div className="panel-card-header">
          <div>
            <span className="panel-kicker">HỆ THỐNG CÀO DỮ LIỆU TỰ ĐỘNG</span>
            <h3 className="panel-title">Bộ Cào Tin Tức Tài Chính (News Crawler)</h3>
          </div>
          <div className="crawler-actions">
            <button
              type="button"
              className="crawler-btn-run"
              onClick={handleCrawlNow}
              disabled={crawling}
            >
              {crawling ? (
                <>
                  <span className="btn-spinner"></span>
                  Đang cào dữ liệu...
                </>
              ) : (
                'Kích hoạt cào tin ngay'
              )}
            </button>
          </div>
        </div>

        {crawlMsg && (
          <div className={`crawler-alert crawler-alert-${crawlMsg.type}`}>
            {crawlMsg.text}
          </div>
        )}

        <div className="crawler-info-grid">
          <div className="crawler-info-item">
            <span className="crawler-info-label">Chu kỳ tự động</span>
            <span className="crawler-info-value mono-num">3 giờ / lần</span>
            <span className="crawler-info-sub">Cron: 0 0 */3 * * *</span>
          </div>
          <div className="crawler-info-item">
            <span className="crawler-info-label">Giới hạn cào</span>
            <span className="crawler-info-value mono-num">5 bài / nguồn</span>
            <span className="crawler-info-sub">Lấy tin tức mới nhất</span>
          </div>
          <div className="crawler-info-item">
            <span className="crawler-info-label">Cơ chế khử trùng</span>
            <span className="crawler-info-value" style={{ fontSize: '1rem', fontWeight: '800' }}>SHA-256 Hash</span>
            <span className="crawler-info-sub">Chuẩn hóa URL + GUID</span>
          </div>
          <div className="crawler-info-item">
            <span className="crawler-info-label">Tổng bài trong CSDL</span>
            <span className="crawler-info-value mono-num">
              {crawlerStats?.totalArticles != null ? crawlerStats.totalArticles.toLocaleString('vi-VN') : '—'}
            </span>
            <span className="crawler-info-sub">Lưu trữ MySQL persistent</span>
          </div>
          <div className="crawler-info-item">
            <span className="crawler-info-label">Bài gắn mã cổ phiếu</span>
            <span className="crawler-info-value mono-num text-bullish">
              {crawlerStats?.articlesWithTickers != null ? crawlerStats.articlesWithTickers.toLocaleString('vi-VN') : '—'}
            </span>
            <span className="crawler-info-sub">Gắn ticker tự động</span>
          </div>
        </div>

        <div className="crawler-sources-box">
          <span className="crawler-sources-title">Nguồn báo chính thống đang theo dõi:</span>
          <div className="crawler-sources-chips">
            {(crawlerStats?.activeSources || ['CafeF', 'VnEconomy', 'VnExpress', 'Tuổi Trẻ']).map((s) => (
              <span key={s} className="crawler-source-chip">
                <span className="source-dot"></span>
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
