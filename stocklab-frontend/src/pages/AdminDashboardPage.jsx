import { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../api/api';
import { useWebSocket } from '../hooks/useWebSocket';
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
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Realtime: khi có giao dịch mới → cập nhật thống kê
  const handleTrade = useCallback(() => {
    fetchStats();
  }, [fetchStats]);

  useWebSocket('/topic/trades', handleTrade);

  if (loading) return <div className="admin-spinner">Loading dashboard...</div>;
  if (error) return <div className="admin-error">Lỗi: {error}</div>;

  // Cấu hình dữ liệu cho Biểu đồ Cột (Bar Chart)
  const chartData = {
    labels: stats?.topStocks?.map(ts => ts.ticker) || [],
    datasets: [
      {
        label: 'Khối Lượng Khớp Lệnh',
        data: stats?.topStocks?.map(ts => ts.volume) || [],
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Biểu Đồ Khối Lượng Top Cổ Phiếu' },
    },
  };

  return (
    <div className="admin-dashboard">
      <h1 className="dashboard-title">Dashboard Thống Kê</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Tổng Người Dùng</h3>
          <p className="stat-number">{stats?.totalUsers || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Tổng Giao Dịch</h3>
          <p className="stat-number">{stats?.totalTransactions || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Tổng Khối Lượng</h3>
          <p className="stat-number">{stats?.totalVolume?.toLocaleString('vi-VN') || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Tổng Doanh Thu</h3>
          <p className="stat-number">{stats?.totalRevenue?.toLocaleString('vi-VN')} VND</p>
        </div>
      </div>

      <div className="top-stocks-section">
        <h2>Top 5 Cổ Phiếu Giao Dịch Nhiều Nhất</h2>
        {stats?.topStocks && stats.topStocks.length > 0 ? (
          <div className="dashboard-content-split">
            <div className="chart-container" style={{ height: '300px', flex: 1, marginRight: '20px' }}>
              <Bar data={chartData} options={chartOptions} />
            </div>
            <div className="table-container" style={{ flex: 1 }}>
              <table className="top-stocks-table">
                <thead>
                  <tr>
                    <th>Mã Cổ Phiếu</th>
                    <th>Khối Lượng Khớp Lệnh</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topStocks.map((ts, idx) => (
                    <tr key={idx}>
                      <td className="ticker-col">{ts.ticker}</td>
                      <td>{ts.volume?.toLocaleString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p>Chưa có dữ liệu giao dịch.</p>
        )}
      </div>
    </div>
  );
}
