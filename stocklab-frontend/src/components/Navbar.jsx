import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Đóng dropdown khi click bên ngoài
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

  // Mega menu items cho "Giao Dịch Cơ Sở"
  const tradingMenuItems = [
    {
      icon: '📝',
      title: 'Đặt Lệnh',
      desc: 'Đặt lệnh mua/bán cổ phiếu',
      path: '/trading',
    },
    {
      icon: '⚡',
      title: 'Đặt Lệnh Điều Kiện',
      desc: 'Lệnh tự động theo điều kiện giá',
      path: '/conditional-order',
    },
    {
      icon: '💼',
      title: 'Danh Mục',
      desc: 'Xem danh mục, lãi/lỗ cổ phiếu',
      path: '/portfolio',
    },
    {
      icon: '📊',
      title: 'Sổ Lệnh',
      desc: 'Order book — bảng giá mua/bán',
      path: '/order-book',
    },
    {
      icon: '✅',
      title: 'Xác Nhận Lệnh',
      desc: 'Xác nhận và theo dõi lệnh đặt',
      path: '/orders',
    },
    {
      icon: '📋',
      title: 'Lịch Sử Giao Dịch',
      desc: 'Tra cứu lịch sử giao dịch',
      path: '/transactions',
    },
    {
      icon: '📄',
      title: 'Báo Cáo',
      desc: 'Xuất dữ liệu Excel/PDF',
      path: '/reports',
    },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <Link to="/dashboard" className="navbar-brand">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#2962ff" />
            <path d="M8 22L12 14L16 18L20 10L24 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>StockLab</span>
        </Link>

        {/* Nav Links */}
        <div className="navbar-links">
          {user?.role === 'ADMIN' ? (
            <>
              <Link to="/admin/stocks" className="nav-link">Quản lý Cổ Phiếu</Link>
              <Link to="/admin/users" className="nav-link">Quản lý Người Dùng</Link>
              <Link to="/admin/dashboard" className="nav-link">Thống Kê</Link>
              <Link to="/admin/orders" className="nav-link">Quản lý Lệnh</Link>
              <Link to="/admin/bot-activity" className="nav-link">Trading Bot</Link>
              <Link to="/admin/platform-token" className="nav-link">Token SLP</Link>
            </>
          ) : (
            <>
              <Link to="/stocks" className="nav-link">Bảng Giá</Link>
              <Link to="/watchlist" className="nav-link">Thông Tin Thị Trường</Link>

              {/* Mega Dropdown — Giao Dịch Cơ Sở */}
              <div className="nav-mega-wrapper">
                <button className="nav-link nav-mega-trigger">
                  Giao Dịch Cơ Sở
                  <svg className="nav-mega-chevron" width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
                <div className="mega-dropdown">
                  <div className="mega-dropdown-inner">
                    {tradingMenuItems.map((item, i) => (
                      <Link key={i} to={item.path} className="mega-item">
                        <span className="mega-item-icon">{item.icon}</span>
                        <div className="mega-item-text">
                          <span className="mega-item-title">{item.title}</span>
                          <span className="mega-item-desc">{item.desc}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <Link to="/wallet" className="nav-link">Giao Dịch Tiền</Link>
            </>
          )}
        </div>

        {/* User Menu */}
        <div className="navbar-user" ref={dropdownRef}>
          {user?.role !== 'ADMIN' && <NotificationBell />}
          <button className="user-trigger" onClick={() => setDropdownOpen(!dropdownOpen)}>
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="user-avatar user-avatar-img" />
            ) : (
              <div className="user-avatar">
                {(user?.fullName || user?.username || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <span className="user-name">{user?.fullName || user?.username}</span>
            <svg className={`chevron ${dropdownOpen ? 'open' : ''}`} width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="user-dropdown fade-in">
              <div className="dropdown-header">
                <div className="dropdown-name">{user?.fullName || user?.username}</div>
                <div className="dropdown-email">{user?.email}</div>

                {/* WAL-4: Hiển thị cả 2 số dư */}
                <div className="dropdown-balances">
                  <div className="balance-row">
                    <span className="balance-label">Khả dụng:</span>
                    <span className="balance-val text-success">
                      {new Intl.NumberFormat('vi-VN').format(user?.availableBalance || 0)} ₫
                    </span>
                  </div>
                  <div className="balance-row">
                    <span className="balance-label">Tổng tài khoản:</span>
                    <span className="balance-val text-muted">
                      {new Intl.NumberFormat('vi-VN').format(user?.balance || 0)} ₫
                    </span>
                  </div>
                </div>
              </div>
              <div className="dropdown-divider"></div>
              <Link to="/profile" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 8a3 3 0 100-6 3 3 0 000 6zm0 2c-3.3 0-6 1.34-6 3v1h12v-1c0-1.66-2.7-3-6-3z" />
                </svg>
                Thông tin cá nhân
              </Link>
              <button className="dropdown-item dropdown-item-danger" onClick={handleLogout}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6 2h6a2 2 0 012 2v8a2 2 0 01-2 2H6M2 8h8M7 5l3 3-3 3" />
                </svg>
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
