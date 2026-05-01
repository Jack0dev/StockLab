# 📋 StockLab — Task Tracker

> Cập nhật: 2026-03-23

---

## ✅ Đã hoàn thành (23 task)

- [x] Setup Spring Boot + React + MySQL
- [x] Database Schema & JPA Hibernate
- [x] User Registration + Login (JWT)
- [x] JWT Authentication (Filter, Interceptor, SecurityConfig)
- [x] User Profile (xem, sửa, đổi mật khẩu)
- [x] Stock Entity + List API + Detail API
- [x] Price History + biểu đồ
- [x] Stock Search (autocomplete, debounce)
- [x] Buy/Sell Stock (trực tiếp — sẽ refactor sang OMS)
- [x] Check Balance + Update Portfolio sau GD
- [x] Transaction History (filter, pagination)
- [x] Portfolio View + Lãi/Lỗ + Pie Chart
- [x] Watchlist (thêm/xóa CP theo dõi)
- [x] Dashboard tổng quan
- [x] CORS Config + Data Seeder

---

## ❌ Module 1 — Bảo mật & OTP (0/7)

- [ ] **SEC-1** Gửi OTP qua Email (JavaMailSender + Redis)
- [ ] **SEC-2** Xác thực OTP khi đăng ký
- [ ] **SEC-3** OTP khi đặt lệnh giao dịch lớn
- [ ] **SEC-4** OTP khi đổi mật khẩu
- [ ] **SEC-5** Quên mật khẩu (OTP → Reset)
- [ ] **SEC-6** Xác thực 2 bước đăng nhập (2FA)
- [ ] **SEC-7** Token Blacklist (Logout Redis)

---

## ✅ Module 2 — Nạp/Rút tiền (5/5)

- [x] **WAL-1** Nạp tiền (Deposit)
- [x] **WAL-2** Rút tiền (Withdraw + OTP)
- [x] **WAL-3** Lịch sử nạp/rút
- [x] **WAL-4** Số dư khả dụng vs Tổng số dư
- [x] **WAL-5** Giới hạn nạp/rút

---

## ❌ Module 3 — OMS (6/8)

- [x] **OMS-1** Order Model & Enums
- [x] **OMS-2** Đặt lệnh (Place Order)
- [x] **OMS-3** Hủy lệnh (Cancel Order)
- [x] **OMS-4** Sửa lệnh (Modify Order)
- [x] **OMS-5** Sổ lệnh (Order Book)
- [x] **OMS-6** Lịch sử lệnh (My Orders)
- [x] **OMS-7** Chi tiết lệnh
- [ ] **OMS-8** Xác nhận lệnh bằng OTP

---

## ❌ Module 4 — Matching Engine (0/6)

- [ ] **ME-1** Thuật toán Price-Time Priority
- [ ] **ME-2** Xử lý MARKET Order
- [ ] **ME-3** Xử lý LIMIT Order
- [ ] **ME-4** Xử lý sau khớp (Transaction, Portfolio, Balance, Price)
- [ ] **ME-5** Matching Scheduler (@Scheduled 3s)
- [ ] **ME-6** Lock tài sản khi đặt lệnh

---

## ❌ Module 5 — WebSocket (0/5)

- [ ] **WS-1** WebSocket Config (STOMP)
- [ ] **WS-2** Broadcast giá cổ phiếu
- [ ] **WS-3** Broadcast trạng thái lệnh
- [ ] **WS-4** Broadcast order book
- [ ] **WS-5** Thông báo giao dịch (notification)

---

## ❌ Module 6 — Trading Bot (0/3)

- [ ] **BOT-1** Bot User (seed)
- [ ] **BOT-2** Auto Place Orders
- [ ] **BOT-3** Cấu hình Bot (admin toggle)

---

## ❌ Module 7 — Admin (4/6)

- [x] **ADM-1** Phân quyền Admin
- [x] **ADM-2** Quản lý Users
- [x] **ADM-3** Quản lý Stocks
- [x] **ADM-4** Dashboard thống kê
- [x] **ADM-5** Quản lý lệnh
- [x] **ADM-6** Admin Navigation & Routing

---

## ❌ Module 8 — DevOps (0/6)

- [ ] **DEV-1** Redis Cache
- [ ] **DEV-2** Postman Collection
- [ ] **DEV-3** Dockerize
- [ ] **DEV-4** CI/CD
- [ ] **DEV-5** Portfolio Performance Chart
- [ ] **DEV-6** TradingView Widget

---

## 🐛 Bug / Fix

- [x] **403 trên /api/auth/register** — Fix `shouldNotFilter()` trong `JwtAuthFilter`
- [x] **VNPay** — Không ép mặc định ngân hàng NCB, cho phép chọn ngân hàng

---

> **Tổng: 33 đã xong / 35 cần làm = 68 task**
