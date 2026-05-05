import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useWebSocket } from './WebSocketContext';
import { useAuth } from './AuthContext';
import { useNotificationSound } from '../hooks/useNotificationSound';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
    const { connected, subscribe } = useWebSocket();
    const { isAuthenticated } = useAuth();
    const { playBeep } = useNotificationSound();

    const [notifications, setNotifications] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('stocklab_notifs') || '[]');
            return saved.filter(n => n.ttl > Date.now());
        } catch (e) {
            return [];
        }
    });

    const [unreadCount, setUnreadCount] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('stocklab_notifs') || '[]');
            return saved.filter(n => n.ttl > Date.now() && !n.read).length;
        } catch (e) {
            return 0;
        }
    });

    // Tracking for partially filled orders to avoid spam
    const partialOrdersNotified = useRef(new Set());
    const bc = useRef(null);

    // Save to localStorage when notifications change
    useEffect(() => {
        localStorage.setItem('stocklab_notifs', JSON.stringify(notifications));
        setUnreadCount(notifications.filter(n => !n.read).length);
    }, [notifications]);

    // Setup BroadcastChannel for multi-tab sync
    useEffect(() => {
        bc.current = new BroadcastChannel('stocklab_notifications');
        bc.current.onmessage = (e) => {
            if (e.data.type === 'NEW_NOTIF') {
                setNotifications(prev => {
                    if (prev.find(n => n.id === e.data.notification.id)) return prev;
                    const filtered = prev.filter(n => n.ttl > Date.now());
                    return [e.data.notification, ...filtered].slice(0, 50);
                });
            } else if (e.data.type === 'MARK_READ') {
                setNotifications(prev => prev.map(n => n.id === e.data.id ? { ...n, read: true } : n));
            } else if (e.data.type === 'MARK_ALL_READ') {
                setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            } else if (e.data.type === 'CLEAR_ALL') {
                setNotifications([]);
            }
        };

        return () => {
            if (bc.current) bc.current.close();
        };
    }, []);

    const addNotification = (notif) => {
        setNotifications(prev => {
            if (prev.find(n => n.id === notif.id)) return prev; // deduplicate
            const filtered = prev.filter(n => n.ttl > Date.now());
            const updated = [notif, ...filtered].slice(0, 50); // cap to 50
            
            // Broadcast to other tabs
            if (bc.current) bc.current.postMessage({ type: 'NEW_NOTIF', notification: notif });
            
            // Play sound
            playBeep();
            
            return updated;
        });
    };

    // Subscriptions
    useEffect(() => {
        if (!connected || !isAuthenticated) return;

        const subs = [
            subscribe('/user/queue/orders', (message) => {
                try {
                    const data = JSON.parse(message.body);
                    const order = data.order;
                    const eventId = data.eventId;
                    
                    if (order.status === 'ACTIVE') return; // ignore initial active

                    let title = '';
                    let body = '';
                    let icon = '';
                    let shouldNotify = true;

                    if (order.status === 'FILLED') {
                        title = 'Lệnh khớp hoàn toàn';
                        body = `${order.side === 'BUY' ? 'MUA' : 'BÁN'} ${order.quantity} ${order.ticker} @ ${order.price.toLocaleString('vi-VN')} VND`;
                        icon = '✅';
                    } else if (order.status === 'PARTIALLY_FILLED') {
                        if (partialOrdersNotified.current.has(order.id)) {
                            shouldNotify = false;
                        } else {
                            title = 'Lệnh khớp một phần';
                            body = `${order.side === 'BUY' ? 'MUA' : 'BÁN'} ${order.filledQuantity}/${order.quantity} ${order.ticker}`;
                            icon = '🔶';
                            partialOrdersNotified.current.add(order.id);
                        }
                    } else if (order.status === 'CANCELLED') {
                        title = 'Lệnh bị hủy';
                        body = `${order.side === 'BUY' ? 'MUA' : 'BÁN'} ${order.quantity} ${order.ticker}`;
                        icon = '❌';
                        partialOrdersNotified.current.delete(order.id);
                    } else {
                        shouldNotify = false;
                    }

                    if (shouldNotify) {
                        // Tạo deterministic ID để deduplicate nếu backend gửi nhiều event giống hệt nhau
                        // (Ví dụ: order match nhiều lần trong cùng 1 second loop)
                        const notifId = `order-${order.id}-${order.status}`;
                        addNotification({
                            id: notifId,
                            type: 'ORDER_UPDATE',
                            title,
                            body,
                            icon,
                            timestamp: data.timestamp || Date.now(),
                            read: false,
                            navigateTo: '/orders',
                            ttl: Date.now() + 7 * 24 * 3600 * 1000
                        });
                    }
                } catch (e) {
                    console.error('Error parsing order notification', e);
                }
            }),

            subscribe('/user/queue/balance', (message) => {
                try {
                    const data = JSON.parse(message.body);
                    const eventId = data.eventId;
                    const reason = data.reason;

                    if (reason === 'ORDER_LOCK' || reason === 'ORDER_UNLOCK') return; // skip noise

                    let title = '';
                    let body = '';
                    let icon = '';
                    let shouldNotify = true;
                    let navPath = '/wallet';

                    if (reason === 'DEPOSIT') {
                        title = 'Nạp tiền thành công';
                        body = 'Tài khoản của bạn vừa được cộng tiền';
                        icon = '💰';
                    } else if (reason === 'WITHDRAW') {
                        title = 'Rút tiền thành công';
                        body = 'Giao dịch rút tiền đã hoàn tất';
                        icon = '💸';
                    } else if (reason === 'TRADE') {
                        title = 'Biến động số dư';
                        body = 'Số dư thay đổi do giao dịch';
                        icon = '💵';
                        navPath = '/transactions';
                    } else {
                        shouldNotify = false;
                    }

                    if (shouldNotify) {
                        // Nhóm các biến động số dư cùng loại trong khoảng 2 giây để tránh spam
                        const timeWindow = Math.floor(Date.now() / 2000);
                        const notifId = `balance-${reason}-${timeWindow}`;
                        
                        addNotification({
                            id: notifId,
                            type: 'BALANCE_UPDATE',
                            title,
                            body,
                            icon,
                            timestamp: data.timestamp || Date.now(),
                            read: false,
                            navigateTo: navPath,
                            ttl: Date.now() + 7 * 24 * 3600 * 1000
                        });
                    }
                } catch (e) {
                    console.error('Error parsing balance notification', e);
                }
            })
            // Portfolio channel is not creating notifications for now, UI already handles portfolio changes via refresh
        ];

        return () => {
            subs.forEach(sub => sub && sub.unsubscribe());
        };
    }, [connected, isAuthenticated, subscribe]);

    const markAsRead = (id) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        if (bc.current) bc.current.postMessage({ type: 'MARK_READ', id });
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        if (bc.current) bc.current.postMessage({ type: 'MARK_ALL_READ' });
    };

    const clearAll = () => {
        setNotifications([]);
        if (bc.current) bc.current.postMessage({ type: 'CLEAR_ALL' });
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            markAsRead,
            markAllAsRead,
            clearAll
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    return useContext(NotificationContext);
}
