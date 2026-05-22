# 📦 StockLab — Project Documentation (Codebase Actual State)

> Tài liệu này được tổng hợp từ việc đọc **toàn bộ source code thực tế** của dự án.

---

## 1. Tổng quan kiến trúc

```
React 19 (Vite)  ←──HTTP/REST──→  Spring Boot 3.2.5 (Java 21)
     ↕ WebSocket (STOMP/SockJS)           ↕               ↕
NotificationContext              MySQL 8.0 (Laragon)   Redis 6
WebSocketContext                 stock_lap DB           OTP cache
```

**Stack thực tế:**
| Layer | Công nghệ | Ghi chú |
|---|---|---|
| Frontend | React 19 + Vite 8 + React Router 7 | SPA, Vanilla CSS |
| Backend | Spring Boot 3.2.5, Java 21, Maven | Monolith |
| ORM | Spring Data JPA / Hibernate | `ddl-auto=update` |
| Auth | JWT (jjwt 0.12.5) + Spring Security | Stateless |
| 2FA | Google Authenticator TOTP (warrenstrange lib) + ZXing QR | |
| WebSocket | STOMP over SockJS | In-process broker |
| Cache/OTP | Redis 6 (với fallback in-memory Map nếu Redis down) | |
| Email | Gmail SMTP SSL (port 465) | |
| Payment | VNPay Sandbox | |
| Charts | lightweight-charts v5, Chart.js 4 + react-chartjs-2 | |
| Export | Apache POI (Excel .xlsx) | |
| Deploy | Railway (backend + frontend riêng biệt) | `railway.json` có ở cả 2 |

---

## 2. Database — 10 Tables

### `users`
- id, username (unique), email (unique), password (BCrypt)
- fullName, phone, avatarUrl (LONGTEXT — Base64)
- role: `USER | ADMIN | MANAGER`
- balance (decimal 15,2) — mặc định 10,000,000 VND
- lockedBalance (decimal 15,2) — tiền bị lock cho BUY order
- is2faEnabled (bit), twoFaSecret
- isActive (bit), createdAt, updatedAt
- `getAvailableBalance()` = balance - lockedBalance

### `stocks`
- id, ticker (unique, max 10), companyName, exchange (HOSE/HNX/UPCOM)
- currentPrice, openPrice, highPrice, lowPrice, referencePrice
- volume (bigint), change (price_change), changePercent (double)
- isActive (bit), createdAt, updatedAt
- **22 mã cổ phiếu** đã seed (VCB, VIC, VHM, HPG, BID, CTG, MBB, TCB, MSN, GVR, ACB, FPT, MWG, VJC, HVN, SAB, VNM, POW, GAS, REE, SSI, VND)

### `orders`
- 9 loại order: `MARKET | LIMIT | STOP_MARKET | STOP_LIMIT | TAKE_PROFIT | TAKE_PROFIT_LIMIT | TRAILING_STOP | TRAILING_STOP_LIMIT | OCO`
- 6 trạng thái: `PENDING_TRIGGER | ACTIVE | PARTIALLY_FILLED | FILLED | CANCELLED | EXPIRED`
- side: `BUY | SELL`
- timeInForce: `GTC | IOC | FOK | GTD`
- Fields đặc biệt: stopPrice, trailingDelta, activationPrice, highestTrackedPrice, lowestTrackedPrice, ocoGroupId (UUID), triggered (bit), triggeredAt, expiryDate
- Auto-increment ID đã tới **7,106** (7K+ orders đã đặt)
- Indexes: idx_order_user, idx_order_stock_status, idx_order_stock_side_status, idx_order_oco_group, idx_order_status_type

### `conditional_orders`
- Bảng lệnh điều kiện riêng biệt (tách ra khỏi orders)
- conditionType: `GTD | STOP | STOP_LIMIT | TRAILING_STOP | TRAILING_STOP_LIMIT | OCO | SL_TP`
- status: `ACTIVE | TRIGGERED | CANCELLED | EXPIRED`
- Fields: limitPrice, ocoPrice1, ocoPrice2, stopLossPrice, takeProfitPrice, trailingAmount, trailingType (PERCENT/AMOUNT)
- effectiveDate, expiryDate, triggeredOrderId (FK → orders)

### `transactions`
- Giao dịch thực sự (kết quả khớp lệnh)
- type: `BUY | SELL`
- price, quantity, totalAmount
- Auto-increment đã tới **9,047** (~9K giao dịch)

### `portfolios`
- Danh mục đầu tư per user per stock
- quantity, lockedQuantity (CP bị lock cho SELL pending)
- avgBuyPrice — weighted average
- `getAvailableQuantity()` = quantity - lockedQuantity
- UNIQUE constraint: (user_id, stock_id)
- 490 records hiện tại

### `wallet_transactions`
- type: `DEPOSIT | WITHDRAW`
- status: `PENDING | COMPLETED | FAILED | CANCELLED`
- bankAccount, bankName, transactionCode (unique), note
- amount (decimal 18,2)

### `stock_price_history`
- OHLCV daily candles: openPrice, closePrice, highPrice, lowPrice, volume, tradingDate
- Index: idx_stock_date (stock_id, trading_date)
- 1,281 records (khoảng 60 ngày × 21 stocks)

### `watchlists`
- user_id + stock_id (UNIQUE pair)
- 130 entries hiện tại

### `platform_stats`
- Singleton table (1 row)
- tokenBasePrice = 10,000 VND, tokenCurrentPrice = 10,045.55 VND
- tokenTotalSupply = 1,000,000 (SLP token)
- totalFeesCollected = 45,553,224.86 VND
- totalTradingVolume = 15,184,404,325.30 VND (~15.2 tỷ)
- totalTradesCount = 4,522
- dailyFees, lastResetDate (reset mỗi ngày)

---

## 3. Backend — Package Structure

```
com.stocklab/
├── config/          CorsConfig, DataSeeder, MailConfig, RedisConfig,
│                    SchedulerConfig, SecurityConfig, VnPayConfig,
│                    WebSocketConfig, OrderStatusMigration,
│                    TrustAllSSLSocketFactory
├── controller/      AdminController, AdminStockController, AuthController,
│                    BankController, BotController, HealthController,
│                    OrderController, OtpController, PlatformTokenController,
│                    ReportController, StockController, UserController,
│                    VnPayController, WalletController, WatchlistController
├── dto/             Request/Response DTOs + ws/ (WsDTO)
├── engine/          MatchingEngine, TriggerEngine, PostTradeProcessor, MatchResult
├── event/           BalanceChangedEvent, OrderBookUpdatedEvent,
│                    OrderUpdatedEvent, PortfolioChangedEvent, TransactionCreatedEvent
├── listener/        WebSocketEventListener
├── model/           Entities + Enums
├── repository/      JPA interfaces
├── scheduler/       MatchingScheduler, TriggerScheduler
├── security/        CustomUserDetailsService, JwtAuthFilter, JwtUtils
└── service/         Business logic services
```

---

## 4. Core Engine — Matching & Trigger

### MatchingEngine.java
- **Price-Time Priority**: BUY sort giá DESC+createdAt ASC, SELL sort giá ASC+createdAt ASC
- **Anti-Wash Trading**: Nếu buyOrder.userId == sellOrder.userId → bỏ qua cặp, tăng index của lệnh mới hơn
- **Match price logic**: MARKET vs MARKET → dùng referencePrice; MARKET vs LIMIT → dùng LIMIT price; LIMIT vs LIMIT → nếu buyPrice >= sellPrice → dùng sellPrice (maker gets better price)
- **IOC/FOK**: IOC cancel phần remaining sau khi match; FOK cancel toàn bộ nếu không fill được 100%
- **OCO**: Khi 1 lệnh fill → cancel lệnh còn lại trong group (theo ocoGroupId UUID)
- Lưu orders sau match, publish Spring events

### TriggerEngine.java
- Xử lý PENDING_TRIGGER orders mỗi 1 giây
- **STOP**: SELL kích hoạt khi price <= stopPrice; BUY khi price >= stopPrice
- **TAKE_PROFIT**: Ngược lại với STOP
- **TRAILING_STOP**: Track highest/lowest price, kích hoạt khi giá quay đầu >= trailingDelta%
- Kiểm tra `activationPrice` trước khi bắt đầu track trailing
- GTD expiry check trên từng order

### PostTradeProcessor.java
- Xử lý sau mỗi MatchResult:
  1. Tạo Transaction record cho cả buyer & seller
  2. Cập nhật balance: buyer trừ (price×qty + fee), seller nhận (price×qty - fee)
  3. Unlock lockedBalance phần đã fill của buyer
  4. Cập nhật portfolio: buyer tăng qty + weighted avg price; seller giảm qty + lockedQty
  5. Cập nhật stock: currentPrice, highPrice, lowPrice, volume, change%, changePercent
  6. Gọi `PlatformTokenService.recordTradeFee()`: phí 0.15% mỗi bên
  7. Publish các Spring Events (OrderUpdated, BalanceChanged, PortfolioChanged, etc.)

### Schedulers
- `MatchingScheduler`: `@Scheduled(fixedRate=1000)` — 1 giây/lần, tìm stocks có ACTIVE/PARTIALLY_FILLED orders → chạy matching
- `TriggerScheduler`: `@Scheduled(fixedRate=1000)` — 1 giây/lần, chạy TriggerEngine

### PlatformTokenService
- SLP Token: basePrice = 10,000 VND
- Công thức: `tokenPrice = basePrice × (1 + totalFees / initialMarketCap)` (initialMarketCap = 10 tỷ)
- Fee rate: 0.15% mỗi bên
- `@Scheduled` reset dailyFees mỗi ngày

---

## 5. API Endpoints

### Auth (`/api/auth/`)
- POST `/register` → gửi OTP email xác thực
- POST `/verify-registration` → xác thực OTP → tạo account
- POST `/resend-otp` → gửi lại OTP
- POST `/login` → trả JWT (nếu 2FA on → trả `requires2fa: true`)
- POST `/login/verify-2fa` → nhập TOTP code → trả JWT
- POST `/forgot-password/request` → gửi OTP reset
- POST `/forgot-password/reset` → đặt lại mật khẩu

### User (`/api/users/`)
- GET/PUT `/profile` — xem/cập nhật profile
- POST `/change-password/request` + `/verify`
- POST `/avatar` — upload Base64 avatar (lưu LONGTEXT vào DB)
- GET `/users/2fa/setup` — tạo QR code TOTP
- POST `/users/2fa/verify` — xác thực và bật 2FA
- POST `/users/2fa/disable` — tắt 2FA (cần xác nhận mật khẩu)

### Stock (`/api/stocks/`)
- GET `/` (paginated, filter by exchange)
- GET `/{ticker}` — chi tiết 1 cổ phiếu
- GET `/search?keyword=` — tìm kiếm theo ticker/tên
- GET `/{ticker}/history?range=` — OHLCV history (1W/1M/3M/6M/1Y/ALL)

### Order (`/api/orders/`)
- POST `/` — đặt lệnh (kiểm tra balance/portfolio trước, lock tài sản)
- GET `/` (paginated, filter status) — lệnh của tôi
- GET `/{id}` — chi tiết lệnh
- PUT `/{id}/cancel` — hủy lệnh (unlock tài sản)
- PUT `/{id}/modify` — sửa giá/khối lượng lệnh ACTIVE
- GET `/book/{ticker}` — order book BUY/SELL depth
- GET `/transactions` — lịch sử giao dịch (paginated, filter type)
- GET `/portfolio` — danh mục đầu tư
- GET `/portfolio/summary` — tổng hợp + phân bổ + P&L

### Conditional Order (`/api/conditional-orders/`)
- POST `/` — đặt lệnh điều kiện (yêu cầu OTP xác thực)
- GET `/` (paginated, filter status)
- PUT `/{id}/cancel`

### Wallet (`/api/wallet/`)
- POST `/deposit` — tạo link thanh toán VNPay
- POST `/withdraw` — rút tiền (cần OTP)
- POST `/withdraw/request-otp` — gửi OTP rút tiền
- GET `/history` — lịch sử nạp/rút

### VNPay (`/api/vnpay/`)
- POST `/create-payment` — tạo payment URL
- GET `/return` — xử lý callback sau thanh toán
- GET `/ipn` — IPN webhook từ VNPay
- POST `/cancel/{txnRef}` — hủy giao dịch pending

### Admin (`/api/admin/`)
- GET/PUT `/users` + `/{id}/toggle-lock` + `/{id}/role`
- GET `/dashboard` — stats: totalUsers, totalTransactions, totalVolume, topStocks
- GET `/orders` (paginated) + PUT `/{id}/cancel` — cưỡng chế hủy lệnh

### Admin Stock (`/api/admin/stocks/`)
- Full CRUD + `/{id}/toggle-status`

### Bot (`/api/bot/`)
- GET `/status`, `/activity`
- PUT `/toggle` — bật/tắt bot

### Misc
- GET `/api/platform-token` — SLP token info
- GET `/api/bank/lookup?bankCode=&accountNo=` — mock NAPAS lookup (delay 1.2s)
- POST `/api/otp/send` — gửi OTP (wallet withdraw)
- GET `/api/reports/transactions/export` — export Excel (.xlsx)
- GET `/api/health` — health check

### WebSocket Topics
- `/topic/prices` — broadcast tất cả stock prices (mảng)
- `/topic/trades` — broadcast từng trade event khi khớp lệnh
- `/topic/orderbook` — signal orderbook cần refresh (ticker + type)
- `/topic/bot` — bot order activity stream
- `/topic/bot-status` — bot status changes
- `/user/queue/orders` — order updates (per-user, authenticated)
- `/user/queue/balance` — balance changes (per-user)
- `/user/queue/portfolio` — portfolio changes (per-user)

---

## 6. Security

- **JWT**: Secret từ env `JWT_SECRET`, expiry 24h, stateless
- **BCrypt** password hashing
- **TOTP 2FA**: Google Authenticator compatible, QR code tạo bằng ZXing
- **OTP Email**: 6 chữ số, TTL 5 phút trong Redis (fallback in-memory Map)
- **WebSocket Auth**: JWT truyền qua STOMP CONNECT header `Authorization: Bearer {token}`
- **Roles**: USER, ADMIN, MANAGER (MANAGER hiện chưa có routes riêng)
- **Public endpoints**: `/api/auth/**`, `/api/stocks/**`, `/api/orders/book/**`, `/ws/**`, `/api/bot/**`, `/api/platform-token/**`, `/api/vnpay/ipn`, `/api/vnpay/return`
- **Không có rate limiting** nào ở backend

### Lỗ hổng đã biết
1. `Thread.sleep(1200)` trong `BankController` gây blocking servlet thread
2. OTP được trả về trong response body (`ApiResponse.success("...", otp)`) — có thể thấy qua network tab
3. Avatar lưu base64 trong LONGTEXT — không scale
4. `app.jwt.secret` có default value hardcoded trong properties file
5. `spring.jpa.show-sql=true` vẫn bật

---

## 7. TradingBotService

- 20 bots: `bot_01` → `bot_20` (user accounts đã seed vào DB)
- `@Scheduled` với interval từ config `app.bot.interval-ms` (default 10,000ms)
- Bot bị **tắt mặc định** (`app.bot.enabled=false`)
- Random: chọn ngẫu nhiên bot_xx, chọn stock ngẫu nhiên, BUY hoặc SELL, MARKET hoặc LIMIT order
- Lưu 100 lệnh gần nhất trong `ConcurrentLinkedDeque`
- Broadcast qua WebSocket `/topic/bot` và `/topic/bot-status`
- Toggle qua `PUT /api/bot/toggle` (không cần auth - **security issue**)

---

## 8. DataSeeder (tự chạy khi start)

Chạy `CommandLineRunner` mỗi lần start, check trước khi seed:
1. **Admin user**: username=`admin`, email=`admin@stocklab.vn`, password=`admin123`, role=ADMIN
2. **Manager**: username=`manager`, role=MANAGER
3. **20 regular users**: `user1`→`user20`, mỗi user 10 triệu VND
4. **20 bot users**: `bot_01`→`bot_20`
5. **22 stocks** với giá seed từ dữ liệu thực tế (VCB=78k, VIC=39k, VHM=32k...)
6. **60 ngày OHLCV history** cho mỗi stock (giá random walk)
7. **Portfolio seed**: một số user có sẵn portfolio
8. **Watchlist seed**: một số user có sẵn watchlist
9. `resetCorruptedPrices()`: fix giá bị crash do bot (nếu currentPrice <= 1000)

---

## 9. Frontend — Pages & Features

### Public Routes
- `/login` — LoginPage: form login, 2FA step nếu cần, forgot password flow
- `/register` — RegisterPage: form đăng ký → OTP verification step

### Protected Routes (User)
- `/dashboard` — DashboardPage: grid cards link đến các tính năng
- `/stocks` — StockListPage: bảng giá real-time (WS `/topic/prices`), filter theo sàn, paginated
- `/stocks/:ticker` — StockDetailPage: biểu đồ candlestick (lightweight-charts), OHLCV range selector, watchlist toggle
- `/trading` — TradingPage: đặt lệnh (MARKET/LIMIT/STOP_MARKET/STOP_LIMIT/...), OTP wizard step
- `/conditional-order` — ConditionalOrderPage: 7 loại conditional order, dynamic fields per type, OTP xác nhận
- `/portfolio` — PortfolioPage: danh sách holdings + P&L, pie chart phân bổ (Chart.js)
- `/order-book` — OrderBookPage: BUY/SELL depth, real-time qua WS `/topic/orderbook` + debounce 300ms
- `/orders` — OrderHistoryPage: lịch sử lệnh paginated, filter status, cancel/modify
- `/transactions` — TransactionHistoryPage: lịch sử giao dịch paginated, filter type
- `/watchlist` — WatchlistPage: danh sách watchlist, xem giá real-time
- `/wallet` — WalletPage: 3 tabs (Nạp tiền VNPay / Rút tiền / Lịch sử)
  - Tab nạp: chọn số tiền → redirect sang VNPay
  - Tab rút: step 1 nhập thông tin ngân hàng + mock lookup NAPAS → step 2 OTP wizard
- `/payment-result` — VnPayResultPage: xử lý callback từ VNPay
- `/profile` — ProfilePage: xem/sửa profile, đổi mật khẩu, setup 2FA, upload avatar
- `/reports` — ReportPage: export Excel lịch sử giao dịch

### Admin Routes
- `/admin/dashboard` — thống kê tổng quan + bar chart top stocks (Chart.js)
- `/admin/users` — quản lý users: lock/unlock, đổi role
- `/admin/stocks` — CRUD cổ phiếu
- `/admin/orders` — xem tất cả lệnh hệ thống, cưỡng chế hủy
- `/admin/bot-activity` — xem bot log, toggle bot
- `/admin/platform-token` — xem SLP token stats

---

## 10. Frontend Architecture

### Context Providers (wrap toàn bộ app)
- **AuthContext**: token + user state, localStorage sync, auto-fetch profile khi mount
- **WebSocketContext**: STOMP client singleton, connect khi authenticated, `subscribe()` + `publish()` utils, `lastResyncTime` trigger
- **NotificationContext**: in-app notifications, persist vào localStorage với TTL, `BroadcastChannel` sync multi-tab, unread count, shake animation
- **TourContext**: first-time user tour system per page

### Custom Hooks
- `useWebSocket(topic, onMessage)` — hook đơn giản, tạo STOMP client riêng per subscription
- `useBatchWebSocket(destination, onBatchUpdate, batchInterval, reduceKey)` — gom nhóm events, flush theo interval (500ms default), dedup theo `reduceKey`
- `usePageTour(pageId)` — auto-start tour khi user lần đầu vào trang
- `useNotificationSound()` — Web Audio API, beep khi có thông báo mới (không cần file .mp3)

### Notification System
- Notifications lưu vào `localStorage` key `stocklab_notifs` với TTL
- `BroadcastChannel('stocklab_notifications')` — sync giữa các tab
- Nhận events từ WS: order filled/partially filled/cancelled, balance thay đổi
- Deduplicate partially filled orders (tránh spam)
- Bell icon với shake animation khi có mới

### Tour System
- `pageTourSteps.js`: định nghĩa steps per page (selector CSS + title + description + position)
- `TourOverlay.jsx`: render spotlight + tooltip, arrow để điều hướng
- Auto-start lần đầu vào mỗi trang, có nút "?" để restart

### Components
- `Navbar`: mega menu cho trading section, dropdown user menu, NotificationBell
- `SearchBar`: tìm kiếm cổ phiếu với autocomplete
- `OtpInput`: 6 ô nhập OTP riêng biệt, auto-focus, paste support
- `ProtectedRoute`: redirect về login nếu chưa auth
- `AdminRoute`: redirect về login hoặc dashboard nếu không phải ADMIN
- `GlobalWebSocketListener`: lắng nghe `/user/queue/balance` → gọi `fetchUserProfile()`

---

## 11. Config & Infrastructure

### application.properties key configs
- `spring.jpa.hibernate.ddl-auto=update` — tự migrate schema
- `app.bot.enabled=false` — bot tắt mặc định
- Redis fallback: nếu Redis không chạy → OTP lưu RAM
- CORS: cho phép localhost:5173, 5174, 80 và Railway URL
- Twilio config có sẵn nhưng chưa dùng (SMS)
- Webhook secret có nhưng không thấy endpoint nào dùng

### Frontend ENV
- `VITE_API_URL` (default: `http://localhost:8080/api`)
- `VITE_WS_URL` (default: `http://localhost:8080/ws`)
- `.env.development` và `.env.production` riêng biệt

### WebSocket Config
- STOMP endpoint: `/ws` with SockJS fallback
- JWT auth check khi CONNECT (preSend interceptor)
- Destinations: `/topic/*` (broadcast), `/user/queue/*` (per-user)

### Axios interceptor
- Auto-attach JWT Bearer token
- Auto-logout (localStorage clear + redirect `/login`) khi nhận 401

---

## 12. Known Technical Debt

1. **WebSocketContext hardcode URL**: `new SockJS('http://localhost:8080/ws')` — không dùng env variable
2. **Hai useWebSocket khác nhau**: `hooks/useWebSocket.js` tạo client riêng per-hook; `context/WebSocketContext.jsx` là singleton shared — dùng lẫn lộn trong codebase
3. **OtpService**: trả OTP trong response body
4. **Thread.sleep** trong BankController (blocking)
5. **No pagination cho Admin Users**: `userRepository.findAll()` trả toàn bộ
6. **AdminDashboardService**: không dùng readOnly transactions
7. **No global error boundary** trong frontend
8. **Avatar lưu LONGTEXT**: performance issue với nhiều user

---

## 13. Dữ liệu thực tế hiện tại

| Metric | Giá trị |
|---|---|
| Stocks | 22 mã (HOSE, HNX, UPCOM) |
| Users (real) | ~26 (bao gồm admin, manager, users) |
| Bot users | 20 (bot_01 → bot_20) |
| Orders placed | ~7,100 |
| Trades executed | ~9,000 transactions |
| Total trading volume | ~15.2 tỷ VND |
| Total fees collected | ~45.5 triệu VND |
| SLP token price | 10,045.55 VND (tăng 0.46% từ 10,000) |
| Price history records | 1,281 (60 ngày × 21 stocks) |
| Portfolio records | ~490 |
| Watchlist records | ~130 |
