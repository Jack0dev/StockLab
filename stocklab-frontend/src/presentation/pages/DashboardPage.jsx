import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/infrastructure/context/AuthContext';
import { stockAPI, userAPI } from '@/infrastructure/repositories/api';
import { usePageTour } from '@/presentation/controllers/usePageTour';
import './DashboardPage.css';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { restartTour } = usePageTour('dashboard');
  const [profile, setProfile] = useState(null);
  const [topStocks, setTopStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [profileRes, stocksRes] = await Promise.all([
          userAPI.getProfile().catch(() => null),
          stockAPI.getAll(0, 5, 'volume,desc', '').catch(() => null)
        ]);

        if (profileRes?.data?.success) {
          setProfile(profileRes.data.data);
        }
        if (stocksRes?.data?.success) {
          setTopStocks(stocksRes.data.data.content || []);
        }
      } catch (err) {
        console.error('Lỗi nạp dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const formatVND = (num) => {
    return new Intl.NumberFormat('vi-VN').format(num || 0);
  };

  const currentBalance = profile?.balance ?? user?.balance ?? 0;
  const availableBal = profile?.availableBalance ?? user?.availableBalance ?? currentBalance;

  return (
    <div className="dashboard-editorial fade-in">
      {/* 1. Platinum Wealth Statement Card */}
      <section className="dashboard-upper-grid">
        <div className="wealth-platinum-card">
          <div className="card-top-row">
            <div>
              <span className="card-eyebrow">TÀI KHOẢN GIAO DỊCH MÔ PHỎNG</span>
              <h1 className="card-user-title">Xin chào, {user?.fullName || user?.username}</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="card-status-badge">TÀI KHOẢN CHUẨN</span>
              <button className="help-text-btn" onClick={restartTour} title="Hướng dẫn sử dụng">
                Trợ giúp
              </button>
            </div>
          </div>

          <div className="wealth-tally-grid">
            <div className="tally-box">
              <span className="tally-caption">Tổng Tài Sản Ròng</span>
              <div className="tally-val-row">
                <span className="tally-val-huge tabular-num">{formatVND(currentBalance)}</span>
                <span className="tally-currency">VND</span>
              </div>
            </div>

            <div className="tally-box">
              <span className="tally-caption">Số Dư Tiền Khả Dụng</span>
              <div className="tally-val-row text-bullish">
                <span className="tally-val-medium tabular-num">{formatVND(availableBal)}</span>
                <span className="tally-currency">VND</span>
              </div>
            </div>

            <div className="tally-box">
              <span className="tally-caption">Trạng Thái Sàn Khớp Lệnh</span>
              <div className="tally-status-row">
                <span className="status-indicator-dot"></span>
                <span className="status-caption-text">Chu kỳ quét 1.0 giây (Tự động)</span>
              </div>
            </div>
          </div>

          <div className="wealth-button-row">
            <button className="btn btn-primary" onClick={() => navigate('/trading')}>
              Đặt Lệnh Ngay
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/wallet')}>
              Ví Tiền & Nạp Rút
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/portfolio')}>
              Danh Mục Đầu Tư
            </button>
          </div>
        </div>

        {/* AI Financial Copilot Card (Typographic) */}
        <div className="ai-editorial-card">
          <div className="ai-card-top">
            <span className="ai-tag">GOOGLE GEMINI 2.5</span>
            <h2 className="ai-headline">Trợ Lý Tư Vấn Thị Trường</h2>
          </div>
          <p className="ai-body-copy">
            Hỗ trợ phân tích kỹ thuật, đọc hiểu chỉ số tài chính doanh nghiệp và trả lời các thắc mắc về cơ chế khớp lệnh của sàn StockLab.
          </p>
          <div className="ai-query-prompts">
            <div className="query-prompt-item" onClick={() => navigate('/trading')}>
              "Cổ phiếu nào đang có khối lượng mua chủ động cao?"
            </div>
            <div className="query-prompt-item" onClick={() => navigate('/trading')}>
              "Cách đặt lệnh Trailing Stop để chặn lỗ hiệu quả?"
            </div>
          </div>
          <div className="ai-note-foot">
            ● Trợ lý AI luôn sẵn sàng tại biểu tượng trò chuyện góc phải
          </div>
        </div>
      </section>

      {/* 2. Creative Bento Grid: Top Movers & Core Modules */}
      <section className="dashboard-lower-bento">
        {/* Left: Top Traded Table */}
        <div className="bento-card bento-movers">
          <div className="bento-card-header">
            <div>
              <span className="bento-sub-tag">GIAO DỊCH NHIỀU NHẤT</span>
              <h2 className="bento-title">Cổ Phiếu Thanh Khoản Hàng Đầu</h2>
            </div>
            <Link to="/stocks" className="bento-arrow-link">
              Xem toàn bộ sàn →
            </Link>
          </div>

          <div className="movers-data-list">
            {topStocks.map((stock) => {
              const isBull = stock.change > 0;
              const isBear = stock.change < 0;
              return (
                <div 
                  key={stock.id} 
                  className="mover-row"
                  onClick={() => navigate(`/stocks/${stock.ticker}`)}
                >
                  <div className="mover-identity">
                    <span className="mover-ticker mono-num">{stock.ticker}</span>
                    <span className="mover-name">{stock.companyName}</span>
                  </div>

                  <div className="mover-price-wrap">
                    <span className="mover-price tabular-num">{formatVND(stock.currentPrice)} ₫</span>
                    <span className={`mover-badge ${isBull ? 'badge-bull' : isBear ? 'badge-bear' : 'badge-ref'} tabular-num`}>
                      {isBull ? '↑ ' : isBear ? '↓ ' : '— '}
                      {stock.changePercent?.toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: 4 Typographic Feature Tiles (Numbered 01 to 04) */}
        <div className="bento-card bento-modules">
          <div className="bento-card-header">
            <div>
              <span className="bento-sub-tag">TRUNG TÂM TIỆN ÍCH</span>
              <h2 className="bento-title">Nghiệp Vụ Giao Dịch</h2>
            </div>
          </div>

          <div className="modules-quad-grid">
            <Link to="/conditional-order" className="module-quad-item">
              <span className="quad-index mono-num">01</span>
              <div className="quad-text">
                <span className="quad-name">Lệnh Điều Kiện</span>
                <span className="quad-desc">Trailing stop, Take-profit, OCO tự động kích hoạt</span>
              </div>
            </Link>

            <Link to="/order-book" className="module-quad-item">
              <span className="quad-index mono-num">02</span>
              <div className="quad-text">
                <span className="quad-name">Sổ Lệnh Điện Tử</span>
                <span className="quad-desc">Bảng giá 3 mức sâu mua / bán thời gian thực</span>
              </div>
            </Link>

            <Link to="/reports" className="module-quad-item">
              <span className="quad-index mono-num">03</span>
              <div className="quad-text">
                <span className="quad-name">Sao Kê & Báo Cáo</span>
                <span className="quad-desc">Xuất dữ liệu lãi / lỗ định dạng Excel và PDF</span>
              </div>
            </Link>

            <Link to="/profile" className="module-quad-item">
              <span className="quad-index mono-num">04</span>
              <div className="quad-text">
                <span className="quad-name">Bảo Mật Xác Thực</span>
                <span className="quad-desc">Cấu hình Google Authenticator OTP 2FA</span>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
