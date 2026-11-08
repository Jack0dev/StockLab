import { useState, useEffect, useCallback, useMemo } from 'react';
import { botAPI } from '@/infrastructure/repositories/api';
import { useMultiWebSocket } from '@/presentation/controllers/useWebSocket';
import { usePageTour } from '@/presentation/controllers/usePageTour';
import { formatPrice } from '@/service/trading.service';
import './BotActivityPage.css';

const MAX_ACTIVITY = 100;

export default function BotActivityPage() {
  const { restartTour } = usePageTour('botActivity');
  const [status, setStatus] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load dữ liệu ban đầu
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusRes, activityRes] = await Promise.all([
          botAPI.getStatus(),
          botAPI.getActivity(),
        ]);
        setStatus(statusRes.data);
        setActivity(activityRes.data || []);
      } catch (err) {
        console.error('Bot API error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // WebSocket realtime: nhận lệnh bot mới qua /topic/bot
  const handleBotOrder = useCallback((order) => {
    setActivity(prev => {
      const next = [order, ...prev];
      return next.length > MAX_ACTIVITY ? next.slice(0, MAX_ACTIVITY) : next;
    });
  }, []);

  // WebSocket realtime: nhận trạng thái bot qua /topic/bot-status
  const handleBotStatus = useCallback((data) => {
    setStatus(data);
  }, []);

  const subscriptions = useMemo(() => [
    { topic: '/topic/bot', handler: handleBotOrder },
    { topic: '/topic/bot-status', handler: handleBotStatus },
  ], [handleBotOrder, handleBotStatus]);

  const { connected } = useMultiWebSocket(subscriptions);

  const handleToggleBot = async () => {
    try {
      const res = await botAPI.toggle();
      setStatus(prev => ({ ...prev, enabled: res.data.enabled }));
    } catch (err) {
      console.error('Failed to toggle bot', err);
    }
  };

  const formatTime = (t) => {
    if (!t) return '—';
    const d = new Date(t);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (loading) {
    return (
      <div className="bot-page">
        <div className="bot-loading">
          <div className="bot-loading-spinner"></div>
          <span>Đang đồng bộ dữ liệu bot thanh khoản...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bot-page">
      {/* Header */}
      <div className="bot-header">
        <div>
          <span className="bot-header-kicker">Phân hệ Tạo lập thị trường</span>
          <h1 className="bot-header-title">Giám sát Bot Giao Dịch Tự Động</h1>
          <p className="bot-subtitle">
            Hệ thống tạo thanh khoản ngẫu nhiên (Market Maker Bot). Tự động khớp và kích hoạt biên độ biến động giá trên toàn sàn.
          </p>
        </div>
        <div className="bot-header-actions">
          <button 
            className={`bot-toggle-btn ${status?.enabled ? 'btn-stop' : 'btn-start'}`}
            onClick={handleToggleBot}
          >
            {status?.enabled ? 'Tắt Bot' : 'Kích hoạt Bot'}
          </button>
          <span className={`bot-live-badge ${connected ? 'live' : 'offline'}`}>
            {connected ? 'LIVE WS' : 'Mất kết nối'}
          </span>
          <button className="page-tour-btn" onClick={restartTour} title="Hướng dẫn chức năng">?</button>
        </div>
      </div>

      {/* Bento Grid 4 Cards */}
      <div className="bot-stats-grid">
        <div className="bot-stat-card">
          <span className="bot-stat-index">01</span>
          <div className="bot-stat-label">Trạng thái vận hành</div>
          <div>
            <span className={`bot-status-tag ${status?.enabled ? 'active' : 'inactive'}`}>
              {status?.enabled ? 'Đang chạy' : 'Đã dừng'}
            </span>
          </div>
        </div>

        <div className="bot-stat-card">
          <span className="bot-stat-index">02</span>
          <div className="bot-stat-label">Tổng lệnh đã phát sinh</div>
          <div className="bot-stat-value tabular-num">
            {status?.totalOrdersPlaced?.toLocaleString('vi-VN') || 0}
          </div>
        </div>

        <div className="bot-stat-card">
          <span className="bot-stat-index">03</span>
          <div className="bot-stat-label">Tần suất chu kỳ</div>
          <div className="bot-stat-value tabular-num">
            {(status?.intervalMs / 1000)?.toFixed(0) || 5}s <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>/ lệnh</span>
          </div>
        </div>

        <div className="bot-stat-card">
          <span className="bot-stat-index">04</span>
          <div className="bot-stat-label">Tài khoản điều phối</div>
          <div>
            <span className="bot-username-pill">{status?.username || 'bot_liquidity'}</span>
          </div>
        </div>
      </div>

      {/* Activity Table Card */}
      <div className="bot-activity-card">
        <div className="bot-activity-header">
          <h3>Nhật ký phát sinh lệnh (Thời gian thực)</h3>
          <span className="bot-activity-count">{activity.length} lệnh gần nhất</span>
        </div>

        {activity.length === 0 ? (
          <div className="bot-empty">
            <p>Hệ thống chưa ghi nhận lượt đặt lệnh nào. Hãy đợi chu kỳ tiếp theo...</p>
          </div>
        ) : (
          <div className="bot-table-wrapper">
            <table className="bot-table">
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>Thời gian</th>
                  <th style={{ width: '100px' }}>Mã CP</th>
                  <th style={{ width: '100px' }}>Chiều lệnh</th>
                  <th className="th-right" style={{ width: '110px' }}>Khối lượng</th>
                  <th className="th-right" style={{ width: '130px' }}>Mức giá</th>
                  <th className="th-right">Tổng giá trị</th>
                  <th style={{ width: '120px' }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((order, i) => (
                  <tr key={i} className={i === 0 ? 'bot-row-new' : ''}>
                    <td className="bot-time">{formatTime(order.timestamp)}</td>
                    <td>
                      <span className="bot-ticker-pill">{order.ticker}</span>
                    </td>
                    <td>
                      <span className={`bot-side-badge ${order.side === 'BUY' ? 'buy' : 'sell'}`}>
                        {order.side === 'BUY' ? 'MUA' : 'BÁN'}
                      </span>
                    </td>
                    <td className="th-right tabular-num font-bold">
                      {order.quantity?.toLocaleString('vi-VN')}
                    </td>
                    <td className="th-right tabular-num">
                      {formatPrice(order.price)} đ
                    </td>
                    <td className="th-right tabular-num font-bold" style={{ color: '#090d16' }}>
                      {formatPrice(order.price * order.quantity)} đ
                    </td>
                    <td>
                      <span className="bot-status-badge success">{order.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
