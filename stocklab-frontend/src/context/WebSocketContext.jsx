import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
    const { token, isAuthenticated } = useAuth();
    const [connected, setConnected] = useState(false);
    const clientRef = useRef(null);
    const [lastResyncTime, setLastResyncTime] = useState(Date.now());

    // Connect / Disconnect logic
    useEffect(() => {
        if (!isAuthenticated || !token) {
            // Ngắt kết nối nếu không đăng nhập
            if (clientRef.current) {
                clientRef.current.deactivate();
                clientRef.current = null;
                setConnected(false);
            }
            return;
        }

        const client = new Client({
            // Sử dụng SockJS thay vì raw WebSocket url vì backend config .withSockJS()
            webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
            connectHeaders: {
                Authorization: `Bearer ${token}` // Truyền JWT vào header
            },
            reconnectDelay: 5000, // Auto reconnect sau 5s nếu mất kết nối
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
        });

        client.onConnect = () => {
            console.log('[WebSocket] Connected securely!');
            setConnected(true);
            // Khi (re)connect thành công, kích hoạt một trigger resync
            setLastResyncTime(Date.now());
        };

        client.onStompError = (frame) => {
            console.error('[WebSocket] Broker reported error:', frame.headers['message']);
            console.error('[WebSocket] Additional details:', frame.body);
        };

        client.onWebSocketClose = () => {
            console.warn('[WebSocket] Connection closed');
            setConnected(false);
        };

        client.activate();
        clientRef.current = client;

        return () => {
            client.deactivate();
            setConnected(false);
        };
    }, [isAuthenticated, token]);

    // Hàm tiện ích đăng ký lắng nghe sự kiện
    const subscribe = useCallback((destination, callback) => {
        if (!clientRef.current || !connected) return null;
        return clientRef.current.subscribe(destination, callback);
    }, [connected]);

    // Hàm tiện ích gửi thông điệp
    const publish = useCallback((destination, body) => {
        if (!clientRef.current || !connected) return;
        clientRef.current.publish({ destination, body: JSON.stringify(body) });
    }, [connected]);

    return (
        <WebSocketContext.Provider value={{
            connected,
            subscribe,
            publish,
            lastResyncTime // Component có thể useEffect theo biến này để gọi API resync dữ liệu
        }}>
            {children}
        </WebSocketContext.Provider>
    );
}

export function useWebSocket() {
    return useContext(WebSocketContext);
}
