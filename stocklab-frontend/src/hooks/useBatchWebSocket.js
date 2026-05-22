import { useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

/**
 * Hook tùy chỉnh để lắng nghe WebSocket và gom nhóm các bản cập nhật.
 * @param {string} destination - Kênh cần lắng nghe (VD: '/user/queue/balance')
 * @param {function} onBatchUpdate - Callback được gọi mỗi `batchInterval` ms với dữ liệu mới nhất.
 * @param {number} batchInterval - Thời gian gom nhóm (ms). Default: 500ms.
 * @param {string} reduceKey - (Optional) Nếu event là một mảng/đối tượng có ID (VD: Order), dùng key này để gộp các update của cùng 1 ID.
 */
export function useBatchWebSocket(destination, onBatchUpdate, batchInterval = 500, reduceKey = null) {
    const { subscribe, connected } = useWebSocket();
    const queueRef = useRef([]); // Chứa các event thô
    const reducedDataRef = useRef({}); // Dùng nếu có reduceKey

    useEffect(() => {
        if (!connected) return;

        const subscription = subscribe(destination, (message) => {
            try {
                const data = JSON.parse(message.body);

                if (reduceKey) {
                    // Nếu có reduceKey, cập nhật đè data có cùng key
                    const keyVal = data[reduceKey];
                    if (keyVal) {
                        reducedDataRef.current[keyVal] = data;
                    }
                } else {
                    // Nếu không, chỉ đơn giản push vào queue
                    queueRef.current.push(data);
                }
            } catch (error) {
                console.error(`[useBatchWebSocket] Lỗi parse dữ liệu từ ${destination}:`, error);
            }
        });

        // Thiết lập timer để đẩy dữ liệu lên component theo batch
        const timer = setInterval(() => {
            if (reduceKey) {
                const items = Object.values(reducedDataRef.current);
                if (items.length > 0) {
                    onBatchUpdate(items);
                    reducedDataRef.current = {}; // Reset sau khi flush
                }
            } else {
                if (queueRef.current.length > 0) {
                    // Lấy toàn bộ mảng hoặc chỉ lấy phần tử cuối cùng?
                    // Thường đối với Balance/Portfolio, ta chỉ lấy event cuối cùng.
                    // Để tổng quát, ta gửi mảng các events lên để component tự xử lý.
                    const batchedItems = [...queueRef.current];
                    onBatchUpdate(batchedItems);
                    queueRef.current = []; // Reset sau khi flush
                }
            }
        }, batchInterval);

        return () => {
            if (subscription) subscription.unsubscribe();
            clearInterval(timer);
        };
    }, [connected, subscribe, destination, onBatchUpdate, batchInterval, reduceKey]);
}
