# 📈 StockLab — Hệ thống mô phỏng sàn giao dịch chứng khoán

> Ứng dụng fullstack mô phỏng sàn giao dịch chứng khoán với Matching Engine, WebSocket realtime, xác thực 2FA và thanh toán VNPay Sandbox.

---

## 📋 Mục lục

- [Công nghệ sử dụng](#-công-nghệ-sử-dụng)
- [Yêu cầu hệ thống](#-yêu-cầu-hệ-thống)
- [Cách 1 — Chạy bằng Docker (Khuyến nghị)](#-cách-1--chạy-bằng-docker-khuyến-nghị)
- [Cách 2 — Chạy thủ công (Local)](#-cách-2--chạy-thủ-công-local)
- [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
- [Các module chính](#-các-module-chính)

---

## 🛠 Công nghệ sử dụng

| Layer     | Công nghệ                                   |
|-----------|----------------------------------------------|
| Frontend  | React 19, Vite 8, Chart.js, WebSocket (STOMP) |
| Backend   | Spring Boot 3.2.5, Java 21, Spring Security, JPA |
| Database  | MySQL 8.0                                    |
| Cache     | Redis 6                                      |
| Thanh toán| VNPay Sandbox                                |
| Container | Docker, Docker Compose                       |

---

## 📦 Yêu cầu hệ thống

### Chạy bằng Docker (Cách 1)

- **Docker Desktop** ≥ 4.x ([tải tại đây](https://www.docker.com/products/docker-desktop/))
- **Docker Compose** (đi kèm Docker Desktop)

### Chạy thủ công (Cách 2)

- **Java JDK** 21+
- **Maven** 3.9+
- **Node.js** 20.19+
- **MySQL** 8.0
- **Redis** 6+

---

## 🐳 Cách 1 — Chạy bằng Docker (Khuyến nghị)

> Chỉ cần 1 lệnh để khởi động toàn bộ hệ thống (MySQL, Redis, Backend, Frontend).

### Bước 1: Kiểm tra Docker

```bash
docker --version          # Docker Engine ≥ 24.x
docker compose version    # Docker Compose ≥ 2.x
```

### Bước 2: Tắt MySQL / Redis local (nếu đang chạy)

Docker sẽ dùng port `3306` (MySQL), `6379` (Redis), `8080` (Backend), `80` (Frontend). Nếu các port này đang bị chiếm, cần tắt trước:

**Windows:**
```powershell
# Tắt MySQL service
net stop MySQL80

# Tắt Redis service
net stop Redis

# Hoặc kill theo PID (tìm PID bằng netstat)
netstat -ano | findstr "3306 6379"
taskkill /PID <PID> /F
```

**macOS / Linux:**
```bash
# Tắt MySQL
sudo systemctl stop mysql    # hoặc: brew services stop mysql

# Tắt Redis
sudo systemctl stop redis    # hoặc: brew services stop redis
```

### Bước 3: Build & Khởi động

```bash
# Di chuyển đến thư mục gốc dự án (nơi có file docker-compose.yml)
cd StockLap

# Build image và chạy tất cả containers
docker compose up --build -d
```

> ⏱ Lần đầu build sẽ mất **2–5 phút** (tải Maven dependencies + npm packages).

### Bước 4: Kiểm tra trạng thái

```bash
# Xem trạng thái containers
docker compose ps

# Xem logs realtime
docker compose logs -f

# Xem log riêng từng service
docker compose logs -f backend
docker compose logs -f frontend
```

### Bước 5: Truy cập ứng dụng

| Service       | URL                          |
|---------------|------------------------------|
| 🌐 Frontend  | http://localhost              |
| ⚙️ Backend API| http://localhost:8080         |
| 🗄 MySQL      | `localhost:3306` (user: `root`, pass: `root`) |
| 📦 Redis      | `localhost:6379`             |

### Các lệnh Docker hữu ích

```bash
# Dừng tất cả containers
docker compose down

# Dừng và xóa cả volumes (reset database)
docker compose down -v

# Rebuild lại 1 service cụ thể
docker compose up --build -d backend

# Restart 1 service
docker compose restart backend
```

---

## 💻 Cách 2 — Chạy thủ công (Local)

### Bước 1: Cài đặt MySQL & Redis

1. Cài **MySQL 8.0** (hoặc dùng [Laragon](https://laragon.org/))
2. Tạo database:
   ```sql
   CREATE DATABASE stock_lap;
   ```
3. Cài **Redis** ([tải cho Windows](https://github.com/tporadowski/redis/releases))

### Bước 2: Chạy Backend

```bash
cd stocklab-backend

# Build & chạy bằng Maven
mvn clean install -DskipTests
mvn spring-boot:run
```

> Backend sẽ chạy tại **http://localhost:8080**

**Cấu hình kết nối** (file `src/main/resources/application.properties`):

```properties
# MySQL
spring.datasource.url=jdbc:mysql://localhost:3306/stock_lap?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
spring.datasource.username=root
spring.datasource.password=           # để trống nếu dùng Laragon

# Redis
spring.data.redis.host=localhost
spring.data.redis.port=6379
```

### Bước 3: Chạy Frontend

```bash
cd stocklab-frontend

# Cài dependencies
npm install

# Chạy dev server
npm run dev
```

> Frontend sẽ chạy tại **http://localhost:5173**

---

## 🧠 Kiến trúc hệ thống

### Tổng quan

Hệ thống **StockLab** được xây dựng theo kiến trúc **Client – Server**, kết hợp xử lý **Realtime (WebSocket)** và mô phỏng **Order Matching Engine** giống sàn giao dịch thực tế.

```
┌──────────────┐     HTTP/WS      ┌──────────────────────┐     SQL      ┌─────────┐
│   Frontend   │ ◄──────────────► │   Spring Boot API    │ ◄──────────► │  MySQL  │
│  (React 19)  │                  │  Controller→Service  │              │   8.0   │
│  Port: 5173  │                  │  →Repository→JPA     │   Cache      ├─────────┤
│  (hoặc :80)  │                  │      Port: 8080      │ ◄──────────► │  Redis  │
└──────────────┘                  └──────────────────────┘              └─────────┘
```

### Luồng giao dịch (Trading Flow)

```text
User đặt lệnh → Frontend → Backend API
→ Service → OMS → Matching Engine
→ Cập nhật Database + Redis
→ Gửi realtime qua WebSocket → Frontend cập nhật UI
```

---

## 🧩 Các module chính

### 1. Request/Response (HTTP API)

```text
User → Frontend → Spring Boot API → Controller → Service → Repository → MySQL
```

- **Controller**: nhận request, mapping endpoints
- **Service**: xử lý business logic
- **Repository**: truy vấn database (JPA/Hibernate)

### 2. Realtime (WebSocket)

```text
Backend → WebSocket Server (STOMP) → Frontend
```

- Gửi dữ liệu realtime: giá cổ phiếu, trạng thái lệnh
- Frontend cập nhật UI tức thời (không cần reload)

### 3. OMS — Order Management System

- Quản lý lệnh: Mua (Buy) / Bán (Sell)
- Kiểm tra: Số dư, Khối lượng
- Lưu trạng thái lệnh

### 4. Matching Engine

- Khớp lệnh theo giá & thời gian (Price-Time Priority)
- So sánh: Giá mua ↔ Giá bán
- Tạo giao dịch khi match, cập nhật giá & khối lượng

### 5. Redis Cache

- Cache dữ liệu realtime
- Tăng hiệu năng, giảm tải database

### 6. Bảo mật

- JWT Authentication
- Xác thực 2FA (Google Authenticator)
- CORS configuration

### 7. Thanh toán

- Tích hợp VNPay Sandbox
- Nạp tiền vào tài khoản giao dịch

---

## 🎯 Tổng kết

Hệ thống gồm 3 phần cốt lõi:

1. **API Layer (Spring Boot)** → xử lý request
2. **Core Engine (OMS + Matching Engine)** → mô phỏng giao dịch
3. **Realtime Layer (WebSocket)** → cập nhật dữ liệu tức thời

👉 Kiến trúc này cho phép hệ thống:

- Mô phỏng giao dịch giống sàn thật
- Xử lý realtime
- Dễ mở rộng (scale)
- Triển khai nhanh bằng Docker

---

## 📂 Cấu trúc dự án

```
StockLap/
├── docker-compose.yml              # Docker Compose config
├── README.md
│
├── stocklab-backend/
│   ├── Dockerfile                   # Docker build cho backend
│   ├── pom.xml                      # Maven dependencies
│   └── src/main/
│       ├── java/com/stocklab/       # Source code Java
│       │   ├── config/              # Cấu hình (CORS, Redis, VNPay...)
│       │   ├── controller/          # REST API endpoints
│       │   ├── dto/                 # Data Transfer Objects
│       │   ├── model/               # Entity classes
│       │   ├── repository/          # JPA Repositories
│       │   ├── security/            # JWT, Authentication
│       │   └── service/             # Business logic
│       └── resources/
│           └── application.properties
│
└── stocklab-frontend/
    ├── Dockerfile                   # Docker build cho frontend
    ├── nginx.conf                   # Nginx config (production)
    ├── package.json
    └── src/
        ├── components/              # React components
        ├── pages/                   # Page components
        └── main.jsx                 # Entry point
```
