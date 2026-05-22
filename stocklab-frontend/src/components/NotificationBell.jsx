import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import './NotificationBell.css';

export default function NotificationBell() {
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotification();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [isShaking, setIsShaking] = useState(false);
    const dropdownRef = useRef(null);
    const prevCountRef = useRef(unreadCount);

    // Xử lý đóng dropdown khi click outside
    useEffect(() => {
        function handleClickOutside(e) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Kích hoạt shake animation khi có thông báo mới
    useEffect(() => {
        if (unreadCount > prevCountRef.current) {
            setIsShaking(true);
            const timer = setTimeout(() => setIsShaking(false), 800);
            return () => clearTimeout(timer);
        }
        prevCountRef.current = unreadCount;
    }, [unreadCount]);

    const handleItemClick = (notif) => {
        markAsRead(notif.id);
        setIsOpen(false);
        if (notif.navigateTo) {
            navigate(notif.navigateTo);
        }
    };

    const formatTime = (timestamp) => {
        const now = Date.now();
        const diffInSeconds = Math.floor((now - timestamp) / 1000);
        
        if (diffInSeconds < 60) return 'Vừa xong';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
        return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
    };

    return (
        <div className="notif-bell-container" ref={dropdownRef}>
            <button 
                className={`notif-bell-btn ${isShaking ? 'bell-shake' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {unreadCount > 0 && (
                    <span className={`notif-badge ${isShaking ? 'notif-badge-new' : ''}`}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="notif-panel fade-in">
                    <div className="notif-header">
                        <div className="notif-title">
                            Thông báo 
                            {unreadCount > 0 && <span>({unreadCount})</span>}
                        </div>
                        {unreadCount > 0 && (
                            <button className="mark-read-btn" onClick={markAllAsRead}>
                                Đọc tất cả
                            </button>
                        )}
                    </div>

                    <div className="notif-list">
                        {notifications.length === 0 ? (
                            <div className="notif-empty">
                                <span style={{ fontSize: '2rem' }}>📭</span>
                                Không có thông báo nào
                            </div>
                        ) : (
                            notifications.map(notif => (
                                <div 
                                    key={notif.id} 
                                    className={`notif-item ${!notif.read ? 'notif-item-unread' : ''}`}
                                    onClick={() => handleItemClick(notif)}
                                >
                                    <div className="notif-icon">{notif.icon}</div>
                                    <div className="notif-content">
                                        <div className="notif-item-header">
                                            <span className="notif-item-title">{notif.title}</span>
                                            <span className="notif-item-time">{formatTime(notif.timestamp)}</span>
                                        </div>
                                        <div className="notif-item-body">{notif.body}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {notifications.length > 0 && (
                        <div className="notif-footer">
                            <button className="clear-all-btn" onClick={clearAll}>
                                Xóa tất cả thông báo
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
