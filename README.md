# 📈 StockLab — Hệ thống mô phỏng sàn giao dịch chứng khoán

> Ứng dụng fullstack mô phỏng sàn giao dịch chứng khoán với Matching Engine, WebSocket realtime, AI Assistant (Gemini + Ollama), ML Pipeline dự đoán giá, xác thực 2FA và thanh toán VNPay Sandbox.

---

## 📋 Mục lục

- [Công nghệ sử dụng](#-công-nghệ-sử-dụng)
- [Yêu cầu hệ thống](#-yêu-cầu-hệ-thống)
- [Cài đặt & Chạy dự án](#-cài-đặt--chạy-dự-án)
- [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
- [Các module chính](#-các-module-chính)
- [Cấu trúc dự án](#-cấu-trúc-dự-án)
- [Tổng kết](#-tổng-kết)

---

## 🛠 Công nghệ sử dụng

| Layer        | Công nghệ                                                  |
|--------------|-------------------------------------------------------------|
| Frontend     | React 19, Vite 8, Chart.js, WebSocket (STOMP)              |
| Backend      | Spring Boot 3.2.5, Java 21, Spring Security, Spring AI, JPA|
| AI / LLM     | Google Gemini 2.5 Flash, Ollama (Qwen 2.5), RAG Pipeline   |
| ML Pipeline  | Python 3.11, FastAPI, scikit-learn, pandas, XGBoost         |
| Database     | MySQL 8.0                                                   |
| Cache        | Redis 7                                                     |
| Thanh toán   | VNPay Sandbox                                               |
| DevOps       | Docker, Docker Compose                                      |

---

## 📦 Yêu cầu hệ thống

- **Docker Desktop** ≥ 4.x ([tải tại đây](https://www.docker.com/products/docker-desktop/))
- **Java JDK** 21+
- **Maven** 3.9+
- **Node.js** 20.19+
- **Python** 3.11+ (cho ML module)

---

## 🚀 Cài đặt & Chạy dự án

### Bước 1: Clone repository

```bash
git clone https://github.com/Jack0dev/StockLab.git
cd StockLab
```

### Bước 2: Khởi động Infrastructure bằng Docker

Docker Compose sẽ khởi động **MySQL, Redis, phpMyAdmin, Redis Commander** — các service hạ tầng cho toàn bộ dự án.

```bash
# Tắt MySQL / Redis local nếu đang chạy (tránh conflict port)
# Windows:
net stop MySQL80
net stop Redis

# Khởi động infrastructure
docker compose up -d
```

> ⏱ Lần đầu sẽ mất **1–2 phút** để pull image.

**Kiểm tra trạng thái:**

```bash
docker compose ps
docker compose logs -f
```

**Truy cập các service:**

| Service           | URL / Connection                                       |
|-------------------|--------------------------------------------------------|
| 🗄 MySQL          | `localhost:3307` (user: `stocklab`, pass: `stocklab2026`) |
| 📦 Redis          | `localhost:6380`                                       |
| 🔧 phpMyAdmin     | http://localhost:8081 (root / stocklab2026)             |
| 🔧 Redis Commander| http://localhost:8082                                  |

> **Lưu ý:** MySQL dùng port `3307`, Redis dùng port `6380` để tránh conflict với Laragon local (3306/6379).

**Các lệnh Docker hữu ích:**

```bash
# Dừng tất cả containers
docker compose down

# Dừng và xóa cả volumes (reset database)
docker compose down -v

# Restart 1 service
docker compose restart mysql
```

### Bước 3: Chạy Backend (Spring Boot)

```bash
cd stocklab-backend

# Build & chạy
mvn clean install -DskipTests
mvn spring-boot:run
```

> Backend sẽ chạy tại **http://localhost:8080**

**Cấu hình kết nối** (file `src/main/resources/application.properties`):

```properties
# MySQL (qua Docker)
spring.datasource.url=jdbc:mysql://localhost:3306/stock_lap?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
spring.datasource.username=root
spring.datasource.password=           # để trống nếu dùng Laragon

# Redis (qua Docker)
spring.data.redis.url=redis://localhost:6379
```

### Bước 4: Chạy Frontend (React + Vite)

```bash
cd stocklab-frontend

# Cài dependencies
npm install

# Chạy dev server
npm run dev
```

> Frontend sẽ chạy tại **http://localhost:5173**

### Bước 5: Chạy ML Service (Tùy chọn)

```bash
cd stocklab-ml

# Tạo virtual environment
python -m venv .venv

# Kích hoạt (Windows)
.venv\Scripts\activate

# Cài dependencies
pip install -r requirements.txt

# Chạy FastAPI server
uvicorn api.main:app --reload --port 8000
```

> ML API sẽ chạy tại **http://localhost:8000**

### Bước 6: Cài đặt AI Local (Tùy chọn)

Để sử dụng AI Assistant chạy local (không tốn API key):

```bash
# Cài Ollama: https://ollama.com/download

# Pull model
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
```

> AI cũng hỗ trợ **Google Gemini 2.5 Flash** (cấu hình API key trong `application.properties`).

---

## 🧠 Kiến trúc hệ thống

### Tổng quan

```
┌──────────────┐    HTTP/WS     ┌──────────────────────┐    SQL     ┌──────────┐
│   Frontend   │ ◄────────────► │   Spring Boot API    │ ◄────────► │  MySQL   │
│  (React 19)  │                │  Controller→Service  │            │   8.0    │
│  Port: 5173  │                │  →Repository→JPA     │   Cache    ├──────────┤
└──────────────┘                │      Port: 8080      │ ◄────────► │  Redis 7 │
                                └──────────┬───────────┘            └──────────┘
                                           │
                            ┌──────────────┼──────────────┐
                            ▼              ▼              ▼
                     ┌────────────┐ ┌────────────┐ ┌────────────┐
                     │  Matching  │ │ AI Service │ │ ML Service │
                     │  Engine    │ │ Gemini /   │ │  (FastAPI)  │
                     │            │ │ Ollama RAG │ │  Port: 8000 │
                     └────────────┘ └────────────┘ └────────────┘
```

### Luồng giao dịch (Trading Flow)

```
User đặt lệnh → Frontend → Backend API
→ Service → OMS → Matching Engine
→ Cập nhật Database + Redis
→ Gửi realtime qua WebSocket → Frontend cập nhật UI
```

### Luồng AI Chat

```
User hỏi → Frontend → AI Controller
→ Smart Router (chọn Gemini hoặc Ollama)
→ RAG Pipeline (tìm context từ knowledge base)
→ Tool Calling (giá cổ phiếu, tin tức, portfolio)
→ Stream response → Frontend hiển thị
```

---

## 🧩 Các module chính

### 1. Trading Engine

- **OMS (Order Management System):** Quản lý lệnh Mua/Bán, kiểm tra số dư & khối lượng
- **Matching Engine:** Khớp lệnh theo Price-Time Priority
- **9 loại lệnh:** Market, Limit, ATO, ATC, MP, MOK, MAK, PLO, Conditional
- **Conditional Orders:** Stop Loss, Take Profit, Trailing Stop, OCO

### 2. Realtime (WebSocket)

- STOMP WebSocket protocol
- Cập nhật giá cổ phiếu, trạng thái lệnh, thông báo realtime
- Batch updates cho hiệu năng cao

### 3. AI Assistant

- **Dual LLM:** Google Gemini 2.5 Flash (cloud) + Ollama Qwen 2.5 (local)
- **RAG Pipeline:** 15 tài liệu kiến thức chứng khoán Việt Nam
- **Tool Calling:** Tra giá cổ phiếu, lấy tin tức tài chính, xem portfolio
- **Smart Router:** Tự động chọn LLM phù hợp, fallback khi lỗi
- **Chat Widget:** Floating widget + trang chat toàn màn hình

### 4. ML Pipeline (Python)

- **Data Ingestion:** Import dữ liệu OHLCV, đồng bộ hàng ngày
- **Feature Engineering:** Tính toán 50+ technical indicators (RSI, MACD, Bollinger...)
- **Model Training:** XGBoost, Random Forest — dự đoán xu hướng giá
- **FastAPI:** REST API phục vụ prediction cho backend

### 5. Technical Indicators

- RSI, MACD, Bollinger Bands, SMA, EMA
- Hiển thị trực tiếp trên biểu đồ chi tiết cổ phiếu

### 6. Tin tức tài chính (News)

- Crawl tin tức từ các nguồn tài chính
- Hiển thị trên trang chi tiết cổ phiếu
- Tích hợp với AI để phân tích sentiment

### 7. Bảo mật

- JWT Authentication
- Xác thực 2FA (TOTP — Google Authenticator)
- OTP qua Email & SMS (Twilio)
- CORS configuration
- Role-based access (User / Admin)

### 8. Thanh toán & Ví

- Tích hợp VNPay Sandbox
- Nạp/rút tiền vào tài khoản giao dịch
- Lịch sử giao dịch chi tiết

### 9. Admin Dashboard

- Quản lý Users, Stocks, Orders
- Export báo cáo
- Monitoring Trading Bot

---

## 📂 Cấu trúc dự án

```
StockLab/
├── docker-compose.yml                # Docker Compose — MySQL, Redis, phpMyAdmin, Redis Commander
├── README.md
├── doc/                              # Tài liệu dự án
│   ├── database_schema.sql           # Schema database
│   ├── project_documentation.md      # Tài liệu chi tiết
│   ├── scaleup_plan.md               # Kế hoạch mở rộng
│   └── migrations/                   # SQL migrations
│
├── stocklab-backend/                 # Spring Boot Backend
│   ├── pom.xml                       # Maven dependencies
│   └── src/main/
│       ├── java/com/stocklab/
│       │   ├── config/               # Cấu hình (CORS, Redis, Security, AI...)
│       │   ├── controller/           # REST API endpoints
│       │   │   ├── AuthController        # Đăng nhập, đăng ký, 2FA
│       │   │   ├── StockController       # CRUD cổ phiếu, giá realtime
│       │   │   ├── OrderController       # Đặt lệnh, quản lý lệnh
│       │   │   ├── AIController          # AI Chat, streaming
│       │   │   ├── NewsController        # Tin tức tài chính
│       │   │   ├── WalletController      # Nạp/rút tiền
│       │   │   ├── VnPayController       # Thanh toán VNPay
│       │   │   └── Admin*Controller      # Quản trị hệ thống
│       │   ├── dto/                  # Data Transfer Objects
│       │   ├── engine/               # Matching Engine
│       │   ├── model/                # Entity classes (JPA)
│       │   ├── repository/           # JPA Repositories
│       │   ├── scheduler/            # Scheduled tasks
│       │   ├── security/             # JWT, Authentication filters
│       │   └── service/              # Business logic
│       │       ├── OrderService          # Xử lý lệnh, matching
│       │       ├── AIAssistantService    # AI orchestration
│       │       ├── NewsService           # Crawl & serve tin tức
│       │       ├── TechnicalIndicatorService  # RSI, MACD, Bollinger...
│       │       ├── WebSocketService      # Realtime messaging
│       │       └── ai/                   # AI sub-module
│       │           ├── SmartAIRouterService   # Chọn Gemini/Ollama
│       │           ├── GeminiClient           # Google Gemini API
│       │           ├── RagTrainingService     # RAG pipeline
│       │           ├── ToolExecutor           # Function calling
│       │           └── tools/                 # AI Tools (giá, tin, portfolio)
│       └── resources/
│           ├── application.properties    # Cấu hình ứng dụng
│           └── docs/                     # Knowledge base cho RAG (15 tài liệu)
│
├── stocklab-frontend/                # React Frontend
│   ├── package.json
│   └── src/
│       ├── api/                      # API client (Axios)
│       ├── components/               # Shared components
│       │   ├── Navbar                    # Navigation bar
│       │   ├── AIChatWidget              # Floating AI chat widget
│       │   ├── SearchBar                 # Tìm kiếm cổ phiếu
│       │   ├── NotificationBell          # Thông báo realtime
│       │   └── TourOverlay               # Hướng dẫn người mới
│       ├── context/                  # React Context (Auth, WebSocket)
│       ├── hooks/                    # Custom hooks
│       ├── pages/                    # Page components
│       │   ├── TradingPage               # Giao diện giao dịch chính
│       │   ├── StockDetailPage           # Chi tiết cổ phiếu + biểu đồ
│       │   ├── StockListPage             # Danh sách cổ phiếu
│       │   ├── AIChatPage                # Trang AI Chat toàn màn hình
│       │   ├── PortfolioPage             # Danh mục đầu tư
│       │   ├── WalletPage                # Quản lý ví
│       │   ├── OrderHistoryPage          # Lịch sử lệnh
│       │   ├── ConditionalOrderPage      # Lệnh điều kiện
│       │   └── Admin*Page                # Trang quản trị
│       ├── routes/                   # React Router + Protected Routes
│       └── styles/                   # Global styles
│
└── stocklab-ml/                      # Python ML Pipeline
    ├── requirements.txt              # Python dependencies
    ├── .env.example                  # Cấu hình mẫu
    ├── api/                          # FastAPI endpoints
    │   └── main.py                       # ML API server
    ├── config/                       # DB, Redis, Settings
    ├── data_ingestion/               # Import & sync dữ liệu OHLCV
    ├── features/                     # Feature engineering & store
    ├── models/                       # Train & predict
    ├── scripts/                      # Migration & test scripts
    └── tests/                        # Unit tests
```

---

## 🎯 Tổng kết

Hệ thống **StockLab** gồm 4 phần cốt lõi:

1. **API Layer (Spring Boot)** → Xử lý request, authentication, authorization
2. **Core Engine (OMS + Matching Engine)** → Mô phỏng giao dịch chứng khoán thực tế
3. **AI Layer (Gemini + Ollama + RAG)** → Trợ lý AI thông minh với kiến thức chứng khoán VN
4. **ML Pipeline (FastAPI + XGBoost)** → Dự đoán xu hướng giá bằng Machine Learning
5. **Realtime Layer (WebSocket)** → Cập nhật dữ liệu tức thời

👉 **Kiến trúc này cho phép hệ thống:**

- ✅ Mô phỏng giao dịch giống sàn thật (9 loại lệnh)
- ✅ Xử lý realtime qua WebSocket
- ✅ AI tư vấn đầu tư thông minh (RAG + Tool Calling)
- ✅ ML dự đoán xu hướng giá
- ✅ Dễ mở rộng (microservice-ready)
- ✅ Triển khai nhanh bằng Docker

---

## 📄 License

This project is for educational purposes.

## 👨‍💻 Author

**Jack0dev** — [GitHub](https://github.com/Jack0dev)
