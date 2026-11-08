import { useWebSocket } from '@/infrastructure/context/WebSocketContext';
import { usePageTour } from '@/presentation/controllers/usePageTour';
import { useTradingOrders } from '@/presentation/controllers/useTradingOrders';
import { useTradingForm } from '@/presentation/controllers/useTradingForm';
import { formatPrice } from '@/service/trading.service';
import TradingFormCard from '@/presentation/components/trading/TradingFormCard';
import TradingSidebarCard from '@/presentation/components/trading/TradingSidebarCard';
import './TradingPage.css';

export default function TradingPage() {
  const { lastResyncTime } = useWebSocket();
  const { restartTour } = usePageTour('trading');

  // 1. Data Hook: Quản lý số dư, danh mục và lịch sử lệnh qua API + WebSocket
  const {
    balance,
    availableBalance,
    portfolio,
    recentOrders,
    refreshBalance,
    refreshPortfolio,
    refreshOrders,
  } = useTradingOrders({ lastResyncTime, activeTab: 'BUY' });

  // 2. Logic Hook: Quản lý nhập liệu, validation, OTP, và gọi API đặt lệnh
  const formProps = useTradingForm({
    availableBalance,
    portfolio,
    onOrderSuccess: () => {
      refreshBalance();
      refreshPortfolio();
      refreshOrders();
    },
  });

  return (
    <div className="trading-page fade-in">
      {/* Header Bar */}
      <div className="trading-header">
        <h2>Đặt lệnh giao dịch</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="balance-display">
            <div className="balance-item">
              <span className="balance-label">Tổng tài sản</span>
              <span className="balance-value">{formatPrice(balance)} VND</span>
            </div>
            <div className="balance-item">
              <span className="balance-label">Số dư khả dụng</span>
              <span className="balance-value available">{formatPrice(availableBalance)} VND</span>
            </div>
          </div>
          <button className="page-tour-btn" onClick={restartTour} title="Hướng dẫn trang này">?</button>
        </div>
      </div>

      {/* Notification Message */}
      {formProps.message && (
        <div className={`trade-message ${formProps.message.type}`}>
          <span className={`msg-status-dot ${formProps.message.type}`}></span>
          <span>{formProps.message.text}</span>
          <button className="msg-close" onClick={() => formProps.setMessage(null)}>×</button>
        </div>
      )}

      {/* Main Content: Left Form + Right Sidebar */}
      <div className="trading-content">
        <TradingFormCard
          {...formProps}
          portfolio={portfolio}
          availableBalance={availableBalance}
        />
        <TradingSidebarCard
          recentOrders={recentOrders}
          portfolio={portfolio}
        />
      </div>
    </div>
  );
}
