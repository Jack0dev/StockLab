import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { useBatchWebSocket } from '../hooks/useBatchWebSocket';

export default function GlobalWebSocketListener() {
    const { fetchUserProfile } = useAuth();
    const { lastResyncTime } = useWebSocket();

    // Lắng nghe thay đổi Balance -> update Global User Profile
    useBatchWebSocket('/user/queue/balance', (batches) => {
        if (batches.length > 0) {
            // Thay vì tự set các trường, gọi fetchUserProfile để lấy dữ liệu đồng nhất
            // Hoặc có thể tạo method updateUser trong AuthContext để update trực tiếp bộ nhớ
            fetchUserProfile();
        }
    });

    return null; // Không render UI gì cả
}
