import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBatchWebSocket } from '../hooks/useBatchWebSocket';

/**
 * GlobalWebSocketListener - Luôn active khi user đã đăng nhập.
 * Quản lý các side effects toàn cục không thuộc về UI thông báo.
 */
export default function GlobalWebSocketListener() {
    const { fetchUserProfile } = useAuth();

    // ✅ Balance: cập nhật profile người dùng khi số dư thay đổi
    // Lưu ý: NotificationContext đã xử lý việc tạo thông báo, ở đây chỉ update global state (user context)
    useBatchWebSocket('/user/queue/balance', (batches) => {
        if (batches.length > 0) {
            fetchUserProfile();
        }
    });

    return null;
}
