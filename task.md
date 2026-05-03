# Checklist: Nâng Cấp Real-time Doanh Nghiệp (WebSocket V3)

## 1. Backend: Security & Config
- [x] Cập nhật `WebSocketConfig.java`: 
  - Thêm `config.setUserDestinationPrefix("/user")`.
  - Thêm `ChannelInterceptor` xử lý JWT Authentication & Authorization.
- [x] Tạo DTOs chuẩn hóa (`BaseWsDTO`, `BalanceWsDTO`, `PortfolioWsDTO`, `OrderWsDTO`).
- [x] Xây dựng Event-driven (Tạo các event `BalanceChangedEvent`, `PortfolioChangedEvent`...).
- [x] Cập nhật `WebSocketService.java` để broadcast sử dụng `simpMessagingTemplate.convertAndSendToUser()`.
- [x] Gắn Event Publisher vào `OrderService`, `PostTradeProcessor`, `WalletService`.
- [x] Cấu hình `@TransactionalEventListener` để lắng nghe event và gọi `WebSocketService`.

## 2. Frontend: Global WebSocket Context
- [ ] Tạo file/context quản lý Global WebSocket Connection (với Reconnect + JWT + Auto-resync).
- [ ] Tạo cơ chế Batch Update (queue + setInterval).

## 3. Frontend: Cập nhật các Pages
- [ ] `TradingPage.jsx`: Áp dụng hook WS, xóa bỏ cơ chế fetch thủ công sau mỗi lệnh.
- [ ] `WalletPage.jsx`: Cập nhật bảng và số dư theo WS.
- [ ] `OrderHistoryPage.jsx`: Update order array item theo ID thay vì load lại toàn bộ mảng.
- [ ] `PortfolioPage.jsx` & `DashboardPage.jsx`: Cập nhật số lượng và tính PnL real-time.

## 4. Verification & Testing
- [ ] Test đặt lệnh & khớp lệnh với 2 users (Multi-user security).
- [ ] Test rớt mạng (Disconnect/Reconnect Resync).
- [ ] Test load (Batch Update).
