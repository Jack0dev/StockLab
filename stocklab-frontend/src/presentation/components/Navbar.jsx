import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/infrastructure/context/AuthContext';
import { useQuickTrade } from '@/infrastructure/context/QuickTradeContext';
import NotificationBell from './NotificationBell';
import StockLabLogo from './logo/StockLabLogo';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { openTrade } = useQuickTrade();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Typographic Mega Menu items (không lạm dụng icon)
  const tradingMenuItems = [
    {
      num: '01',
      title: 'Đặt Lệnh Cơ Sở',
      desc: 'Khớp lệnh liên tục LO, MP, ATO, ATC',
      path: '/trading',
    },
    {
      num: '02',
      title: 'Lệnh Điều Kiện',
      desc: 'Stop-loss, Take-profit, Trailing Stop tự động',
      path: '/conditional-order',
    },
    {
      num: '03',
      title: 'Danh Mục Nắm Giữ',
      desc: 'Tỷ trọng tài sản và hiệu suất lãi / lỗ',
      path: '/portfolio',
    },
    {
      num: '04',
      title: 'Sổ Lệnh Điện Tử',
      desc: 'Order book độ sâu 3 mức giá tốt nhất',
      path: '/order-book',
    },
    {
      num: '05',
      title: 'Trạng Thái Lệnh',
      desc: 'Theo dõi lệnh chờ khớp, đã khớp, đã hủy',
      path: '/orders',
    },
    {
      num: '06',
      title: 'Lịch Sử Giao Dịch',
      desc: 'Sao kê toàn bộ giao dịch đã thực hiện',
      path: '/transactions',
    },
    {
      num: '07',
      title: 'Báo Cáo Thuế Phí',
      desc: 'Xuất dữ liệu định dạng Excel & PDF',
      path: '/reports',
    },
    {
      num: '08',
      title: 'Danh Sách Theo Dõi',
      desc: 'Watchlist các mã cổ phiếu yêu thích',
      path: '/watchlist',
    },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <header className="navbar-light">
      <div className="navbar-inner">
        {/* Brand Group */}
        <div className="navbar-left">
          <Link to={user?.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'} className="navbar-brand">
            <StockLabLogo variant="badge" size={30} />
            <span className="brand-title">StockLab</span>
            <span className="brand-pill">{user?.role === 'ADMIN' ? 'QUẢN TRỊ' : 'GAME TRADING'}</span>
          </Link>

          <div className="live-status-chip">
            <span className="live-indicator-dot"></span>
            <span className="live-caption">PHIÊN LIÊN TỤC</span>
          </div>
        </div>

        {/* Navigation Menu (Text & Typography Focus) */}
        <nav className="navbar-links">
          {user?.role === 'ADMIN' ? (
            <>
              <Link to="/admin/stocks" className={`nav-link ${isActive('/admin/stocks') ? 'active' : ''}`}>Cổ Phiếu</Link>
              <Link to="/admin/news" className={`nav-link ${isActive('/admin/news') ? 'active' : ''}`}>Quản Lý Tin Tức</Link>
              <Link to="/admin/users" className={`nav-link ${isActive('/admin/users') ? 'active' : ''}`}>Người Dùng</Link>
              <Link to="/admin/dashboard" className={`nav-link ${isActive('/admin/dashboard') ? 'active' : ''}`}>Thống Kê</Link>
              <Link to="/admin/orders" className={`nav-link ${isActive('/admin/orders') ? 'active' : ''}`}>Quản Lý Lệnh</Link>
              <Link to="/admin/bot-activity" className={`nav-link ${isActive('/admin/bot-activity') ? 'active' : ''}`}>Trading Bot</Link>
              <Link to="/admin/platform-token" className={`nav-link ${isActive('/admin/platform-token') ? 'active' : ''}`}>Token SLP</Link>
            </>
          ) : (
            <>
              <Link to="/stocks" className={`nav-link ${isActive('/stocks') ? 'active' : ''}`}>
                Bảng Giá
              </Link>
              <Link to="/news" className={`nav-link ${isActive('/news') ? 'active' : ''}`}>
                Tin Tức
              </Link>

              {/* Mega Dropdown */}
              <div className="nav-mega-wrapper">
                <button className={`nav-link nav-mega-trigger ${['/trading', '/conditional-order', '/portfolio', '/order-book', '/orders', '/transactions', '/reports', '/watchlist'].some(p => isActive(p)) ? 'active' : ''}`}>
                  <span>Giao Dịch</span>
                  <span className="mega-chevron">▾</span>
                </button>

                <div className="mega-dropdown">
                  <div className="mega-dropdown-header">
                    <span className="mega-header-caption">NGHIỆP VỤ GIAO DỊCH CƠ SỞ (T+1.5)</span>
                    <span className="mega-counter">8 TÍNH NĂNG</span>
                  </div>
                  <div className="mega-dropdown-grid">
                    {tradingMenuItems.map((item) => (
                      <Link key={item.num} to={item.path} className="mega-item">
                        <span className="mega-item-num mono-num">{item.num}</span>
                        <div className="mega-item-text">
                          <span className="mega-item-title">{item.title}</span>
                          <span className="mega-item-desc">{item.desc}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <Link to="/wallet" className={`nav-link ${isActive('/wallet') ? 'active' : ''}`}>
                Ví Tiền
              </Link>
            </>
          )}
        </nav>

        {/* User Account Section */}
        <div className="navbar-right">
          {user?.role !== 'ADMIN' && (
            <button
              type="button"
              className="nav-quick-trade-trigger mono-num"
              onClick={() => openTrade()}
              title="Mở cửa sổ Đặt lệnh Nhanh toàn cục"
            >
              ĐẶT LỆNH
            </button>
          )}

          {user?.role !== 'ADMIN' && <NotificationBell />}

          <div className="navbar-user" ref={dropdownRef}>
            <button 
              className={`user-trigger-btn ${dropdownOpen ? 'active' : ''}`}
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <span className="user-avatar-initial">
                {(user?.fullName || user?.username || 'U').charAt(0).toUpperCase()}
              </span>
              <span className="user-display-name">{user?.fullName || user?.username}</span>
              <span className="user-chevron">▾</span>
            </button>

            {dropdownOpen && (
              <div className="user-dropdown-panel fade-in">
                <div className="user-card-header">
                  <div className="user-role-badge">{user?.role === 'ADMIN' ? 'HỆ THỐNG / ADMIN' : 'NHÀ ĐẦU TƯ / TRADER'}</div>
                  <div className="user-full-name">{user?.fullName || user?.username}</div>
                  <div className="user-email-text">{user?.email}</div>

                  <div className="balance-preview-box">
                    <div className="balance-line">
                      <span className="balance-label">Khả dụng</span>
                      <span className="balance-amt text-bullish tabular-num">
                        {new Intl.NumberFormat('vi-VN').format(user?.availableBalance || 0)} ₫
                      </span>
                    </div>
                    <div className="balance-line">
                      <span className="balance-label">Tổng tài sản</span>
                      <span className="balance-amt tabular-num">
                        {new Intl.NumberFormat('vi-VN').format(user?.balance || 0)} ₫
                      </span>
                    </div>
                  </div>

                  <Link to="/wallet" className="deposit-action-link" onClick={() => setDropdownOpen(false)}>
                    Nạp Tiền Vào Ví →
                  </Link>
                </div>

                <div className="user-dropdown-menu">
                  <Link to="/profile" className="dropdown-menu-link" onClick={() => setDropdownOpen(false)}>
                    Hồ sơ cá nhân & Bảo mật 2FA
                  </Link>
                  <button className="dropdown-menu-link logout-link" onClick={handleLogout}>
                    Đăng xuất tài khoản
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
