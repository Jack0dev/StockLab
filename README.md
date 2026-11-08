# 📈 StockLab — Hệ Thống Mô Phỏng Sàn Giao Dịch Chứng Khoán Chuyên Nghiệp

[![Build Status](https://img.shields.io/badge/Backend%20Tests-95%2F95%20PASS-brightgreen?style=flat-square&logo=java)](https://github.com/Jack0dev/StockLab)
[![Java Version](https://img.shields.io/badge/Java-21%20LTS-orange?style=flat-square&logo=openjdk)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.5-brightgreen?style=flat-square&logo=springboot)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%208-blue?style=flat-square&logo=react)](https://react.dev/)
[![Architecture](https://img.shields.io/badge/Architecture-Modular%20Clean%20Architecture-purple?style=flat-square)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
[![AI/ML](https://img.shields.io/badge/AI%20%26%20ML-Gemini%202.5%20%7C%20Ollama%20%7C%20XGBoost-blueviolet?style=flat-square)](https://ai.google.dev/)

> **StockLab** là nền tảng mô phỏng giao dịch chứng khoán thời gian thực toàn diện, xây dựng trên nền tảng **Clean Architecture**, tích hợp **Matching Engine** (Khớp lệnh liên tục Price-Time Priority), **WebSocket STOMP**, **ML Pipeline** dự đoán xu hướng giá (FastAPI + XGBoost), **AI Assistant** đa tác tử (Google Gemini 2.5 Flash + Local Ollama Qwen 2.5 với RAG), bảo mật xác thực 2FA TOTP và cổng nạp rút tiền VNPay Sandbox.

---

## 📋 Mục lục

1. [Điểm Nổi Bật & Tính Năng Mới](#-điểm-nổi-bật--tính-năng-mới)
2. [Công Nghệ Sử Dụng](#-công-nghệ-sử-dụng)
3. [Kiến Trúc Hệ Thống (Clean Architecture)](#-kiến-trúc-hệ-thống-clean-architecture)
4. [Các Module Cốt Lõi](#-các-module-cốt-lõi)
5. [Cấu Trúc Thư Mục](#-cấu-trúc-thư-mục)
6. [Yêu Cầu Hệ Thống & Cài Đặt](#-yêu-cầu-hệ-thống--cài-đặt)
7. [Kiểm Thử & Đảm Bảo Chất Lượng](#-kiểm-thử--đảm-bảo-chất-lượng)
8. [Triển Khai Hạ Tầng (Docker & Cloud Deploy)](#-triển-khai-hạ-tầng-docker--cloud-deploy)
9. [Tác Giả & Bản Quyền](#-tác-giả--bản-quyền)

---

## 🌟 Điểm Nổi Bật & Tính Năng Mới

### 1. Kiến Trúc Phân Lớp Doanh Nghiệp (Clean & Layered Architecture)
- **Tách biệt ranh giới nghiệp vụ (Separation of Concerns)**: Tách rõ các tầng `domain` (chứa cốt lõi nghiệp vụ và ngoại lệ miền), `application/service` (xử lý use-cases), `infrastructure` (cơ sở dữ liệu, Redis, Security) và `presentation` (REST Controllers, DTOs).
- **Facade Pattern cho khối User**: Phân rã dịch vụ người dùng nguyên khối thành các dịch vụ chuyên trách: `UserAuthService` (đăng nhập, đăng ký, JWT), `UserSecurityService` (2FA TOTP, OTP email, khôi phục mật khẩu), `UserProfileService` (thông tin cá nhân, đổi mật khẩu, phân quyền quản trị) và kết nối qua `UserService` Facade.
- **Xử lý lỗi tập trung chuẩn RFC 7807**: Cây ngoại lệ miền `StocklabException`, `BusinessRuleException`, `ResourceNotFoundException`, `SecurityAuthException` đi kèm bảng mã lỗi định danh `ErrorCode` và `@RestControllerAdvice` (`GlobalExceptionHandler`), loại bỏ hoàn toàn các lỗi unhandled trên API.

### 2. Bảng Giá Chứng Khoán Thích Ứng (Responsive Price Board)
- **Căn chỉnh tự động vừa khít khung màn hình**: Loại bỏ hoàn toàn các thanh cuộn dọc/ngang thừa thãi trong khung bảng, dàn đều 13 cột dữ liệu chuẩn xác theo tỷ lệ phần trăm tối ưu.
- **Tính toán biên độ trần/sàn chuẩn các sàn Việt Nam**: Tích hợp cơ chế tính toán giá trần (`ceilingPrice`) và sàn (`floorPrice`) tự động theo quy định sở giao dịch chứng khoán (HOSE ±7%, HNX ±10%, UPCOM ±15%) với bước giá chuẩn 100 VNĐ.

### 3. Trợ Lý AI Chat Đa Nền Tảng (Light Minimalist AI Assistant)
- **Bong bóng chat kéo thả tự do (Draggable Floating Bubble)**: Sử dụng Pointer Events API mượt mà, cho phép người dùng kéo thả bong bóng chat đến mọi vị trí trên màn hình; tự động lưu tọa độ vào `localStorage` và double-click để khôi phục góc mặc định.
- **Tự động định vị bảng chat (`getPanelStyle`)**: Khung trò chuyện tự động tính toán để mở lên phía trên hoặc phía dưới và neo mép theo vị trí của bong bóng, không bao giờ bị che khuất hoặc tràn màn hình.
- **Giao diện sáng tinh giản (Light Modernist Editorial UI)**: Thiết kế nền sáng chuẩn typographic, tương phản cao, loại bỏ hoàn toàn các biểu tượng cảm xúc (emoji/icon) trang trí, thay thế bằng huy hiệu vai trò tối giản (`Bạn`, `AI`) và nút thao tác văn bản trực quan.
- **Nhập liệu kép**: Hỗ trợ đồng thời gõ văn bản và nhận diện giọng nói tiếng Việt thời gian thực (Web Speech API).

---

## 🛠 Công Nghệ Sử Dụng

| Khối Chức Năng | Công Nghệ & Thư Viện Chính |
|---|---|
| **Frontend** | React 19, Vite 8, React Router v6, Chart.js, STOMP / SockJS WebSocket Client, Axios |
| **Backend** | Spring Boot 3.2.5, Java 21 LTS, Spring Security, Spring Data JPA, Spring AI |
| **Core Engine** | Custom In-Memory & Redis-Backed Order Matching Engine (Price-Time Priority) |
| **Trí Tuệ Nhân Tạo (AI)** | Google Gemini 2.5 Flash API, Ollama (Qwen 2.5:3b), In-Memory Vector RAG Pipeline |
| **Học Máy (ML Pipeline)** | Python 3.11, FastAPI, XGBoost, Scikit-learn, Pandas, NumPy, Technical Analysis |
| **Cơ Sở Dữ Liệu & Cache** | MySQL 8.0, Redis 7 (Lưu trữ sổ lệnh và Cache dữ liệu thời gian thực) |
| **Cổng Thanh Toán** | VNPay Payment Gateway Sandbox (Tích hợp chữ ký HMAC-SHA512) |
| **DevOps & Cloud** | Docker, Docker Compose, Render PaaS (`render.yaml`), Railway Dockerfile |

---

## 🧠 Kiến Trúc Hệ Thống (Clean Architecture)

### 1. Sơ đồ luồng tổng quan

```
┌────────────────────────────────────────────────────────┐
│                   CLIENT (BROWSER)                     │
│  React 19 + Vite 8 (Port 5173)                         │
│  • Bảng giá realtime fit 100%                          │
│  • Sổ lệnh trực quan & Quick Trading Dock              │
│  • AI Chat Widget (Draggable, Light Theme, No Emojis)  │
└───────────────▲────────────────────────▲───────────────┘
                │ HTTP REST              │ WebSocket STOMP
                ▼                        ▼
┌────────────────────────────────────────────────────────┐
│             BACKEND LAYER (SPRING BOOT 3.2)            │
│                                                        │
│  [Presentation Layer]                                  │
│  Controllers, DTOs, GlobalExceptionHandler             │
│                       │                                │
│  [Application & Service Layer]                         │
│  OrderService, MatchingEngine, UserService Facade      │
│  UserAuthService, UserSecurityService, AIAssistant     │
│                       │                                │
│  [Domain Layer]                                        │
│  Entities, Value Objects, Domain Exceptions, Enums     │
│                       │                                │
│  [Infrastructure Layer]                                │
│  Spring Data Repositories, Redis Config, Security      │
└──────────┬─────────────────┬──────────────────┬────────┘
           │ SQL             │ Cache / OrderBook│ Streaming / RAG
           ▼                 ▼                  ▼
    ┌─────────────┐   ┌─────────────┐    ┌─────────────────────┐
    │  MySQL 8.0  │   │   Redis 7   │    │     AI SERVICES     │
    │  (Port 3306)│   │ (Port 6379) │    │ • Gemini 2.5 Flash  │
    └─────────────┘   └─────────────┘    │ • Local Ollama RAG  │
                                         └─────────────────────┘
                                                    ▲
                                                    │ Predict API
                                         ┌─────────────────────┐
                                         │  FASTAPI ML SERVICE │
                                         │  Python 3.11        │
                                         │  XGBoost (Port 8000)│
                                         └─────────────────────┘
```

### 2. Luồng Khớp Lệnh Thời Gian Thực (Trading & Matching Flow)
1. Nhà đầu tư gửi lệnh (`Limit`, `Market`, `ATO`, `ATC`, `MP`, `MOK`, `MAK`, `PLO`, `Conditional`) từ giao diện Web.
2. `OrderEstimationService` thẩm định sức mua (tiền mặt khả dụng, phí giao dịch 0.15%, biên độ trần/sàn, quy cách lô chẵn 100 cổ phiếu).
3. `OrderController` đẩy lệnh vào hàng đợi `MatchingEngine`.
4. Engine thực hiện khớp lệnh theo nguyên tắc **Ưu tiên về giá, sau đó ưu tiên về thời gian (Price-Time Priority)**.
5. Cập nhật số dư tài khoản, danh mục cổ phiếu vào MySQL và đồng bộ sổ lệnh thời gian thực vào Redis.
6. Phát dữ liệu khớp lệnh và biến động giá tức thời đến toàn bộ người dùng thông qua STOMP WebSocket.

### 3. Luồng Xử Lý AI Chat & RAG Pipeline
1. Người dùng gửi câu hỏi qua khung chat nổi hoặc trang toàn màn hình.
2. `SmartAIRouterService` tự động đánh giá và định tuyến:
   - Ưu tiên mô hình **Local AI (Ollama Qwen 2.5)** để bảo mật và tối ưu chi phí.
   - Tự động chuyển vùng thông minh sang **Google Gemini 2.5 Flash** khi câu hỏi phức tạp hoặc hệ thống local bận.
3. Cơ chế **Tool Calling** tự động kích hoạt khi câu hỏi liên quan đến:
   - Tra cứu giá thị trường (`get_stock_price`).
   - Phân tích tin tức báo cáo tài chính (`get_financial_news`).
   - Kiểm tra hiệu quả danh mục đầu tư (`get_portfolio`).
4. Truy xuất tri thức tài chính từ tài liệu chứng khoán (RAG), sinh phản hồi streaming trực tiếp bằng SSE (*Server-Sent Events*).

---

## 🧩 Các Module Cốt Lõi

### 1. Hệ Thống Khớp Lệnh (Matching Engine & OMS)
- Hỗ trợ đầy đủ các lệnh giao dịch chuẩn thị trường chứng khoán Việt Nam.
- Quản lý lệnh điều kiện tự động: Cắt lỗ (*Stop Loss*), Chốt lời (*Take Profit*), *Trailing Stop*, Lệnh hủy lệnh (*OCO*).
- Tính toán chỉ số tài chính: Lãi/lỗ thực tế (*Realized PnL*), Lãi/lỗ tạm tính (*Unrealized PnL*), Tỷ trọng phân bổ danh mục.

### 2. Bảng Giá & Chi Tiết Cổ Phiếu
- Hiển thị đầy đủ thông tin: Mã, Tên công ty, Sàn, Trần, Sàn, Tham chiếu, Giá khớp, Khối lượng, Cao/Thấp trong phiên.
- Biểu đồ nến kỹ thuật tích hợp các chỉ báo phân tích: RSI, MACD, Bollinger Bands, SMA 20/50/200, Volume MA.
- Tính năng **Quick Trading Dock** gắn liền góc dưới màn hình giúp đặt lệnh nhanh trong 1 click.

### 3. Học Máy & Dự Đoán Tín Hiệu (ML Pipeline)
- Dịch vụ Python FastAPI thu thập dữ liệu giá lịch sử OHLCV.
- Trích xuất 50+ đặc trưng phân tích kỹ thuật và tâm lý thị trường.
- Huấn luyện mô hình phân loại **XGBoost Classifier** để đưa ra tín hiệu khuyến nghị Mua/Bán/Nắm giữ kèm độ tin cậy.

### 4. Bảo Mật & Quản Trị Hệ Thống
- Phân quyền theo vai trò kép: `ROLE_USER` và `ROLE_ADMIN`.
- Xác thực 2 bước 2FA TOTP thông qua Google Authenticator / Authy.
- Khôi phục mật khẩu bảo mật qua mã OTP gửi về Email.
- Bảng điều khiển quản trị viên (*Admin Dashboard*): Quản lý người dùng, duyệt nạp rút tiền ví, cấu hình tham số mã chứng khoán.

---

## 📂 Cấu Trúc Thư Mục

Mã nguồn được tổ chức chặt chẽ theo mô hình Clean Architecture:

```
StockLab/
├── docker-compose.yml                      # Cấu hình khởi chạy MySQL, Redis, phpMyAdmin, Redis Commander
├── render.yaml                             # Cấu hình triển khai tự động trên Render PaaS (JVM Optimized)
├── README.md                               # Tài liệu hướng dẫn dự án
│
├── stocklab-backend/                       # DỊCH VỤ BACKEND (SPRING BOOT 3.2 & JAVA 21)
│   ├── pom.xml                             # Quản lý thư viện Maven
│   ├── Dockerfile                          # Dockerfile đa tầng (Multi-stage Build)
│   └── src/
│       ├── main/java/com/stocklab/
│       │   ├── domain/                     # TẦNG NGHIỆP VỤ CỐT LÕI (DOMAIN LAYER)
│       │   │   ├── model/                  # Domain Entities & Value Objects (Order, Stock, User...)
│       │   │   ├── enums/                  # Enums miền (OrderStatus, OrderType, MarketType...)
│       │   │   └── exception/              # Domain Exceptions & ErrorCode chuẩn RFC 7807
│       │   ├── service/                    # TẦNG ỨNG DỤNG (APPLICATION / SERVICE LAYER)
│       │   │   ├── user/                   # Phân rã Facade: UserAuth, UserSecurity, UserProfile
│       │   │   ├── order/                  # Thẩm định sức mua, tính toán phân bổ danh mục
│       │   │   ├── ai/                     # Điều phối Smart Router, Gemini, Ollama RAG, AI Tools
│       │   │   └── matching/               # Thuật toán khớp lệnh liên tục
│       │   ├── presentation/               # TẦNG GIAO DIỆN (PRESENTATION LAYER)
│       │   │   ├── controller/             # REST Endpoints (Auth, Order, Stock, AI, Wallet...)
│       │   │   ├── dto/                    # Request/Response DTOs & ApiResponse wrapper
│       │   │   └── GlobalExceptionHandler  # Bắt và xử lý ngoại lệ tập trung (@RestControllerAdvice)
│       │   └── infrastructure/             # TẦNG HẠ TẦNG (INFRASTRUCTURE LAYER)
│       │       ├── repository/             # Spring Data JPA Repositories
│       │       ├── security/               # Bộ lọc JWT, SecurityFilterChain, CORS Filter
│       │       └── config/                 # Cấu hình Redis, WebSocket, Async, ThreadPool
│       └── test/                           # BỘ KIỂM THỬ TỰ ĐỘNG (95 Test Cases)
│
├── stocklab-frontend/                      # GIAO DIỆN NGƯỜI DÙNG (REACT 19 & VITE 8)
│   ├── package.json
│   ├── Dockerfile
│   └── src/
│       ├── presentation/                   # TẦNG TRÌNH DIỄN (UI / UX)
│       │   ├── components/                 # Các thành phần tái sử dụng (AIChatWidget, Navbar, Dock...)
│       │   └── pages/                      # Các trang ứng dụng (StockListPage, Trading, AIChatPage...)
│       ├── application/                    # TẦNG LOGIC ỨNG DỤNG
│       │   ├── context/                    # AuthContext, WebSocketContext
│       │   └── hooks/                      # Custom hooks
│       └── infrastructure/                 # TẦNG KẾT NỐI HẠ TẦNG
│           └── repositories/api.js         # Cấu hình Axios Interceptor & Gọi API Backend
│
└── stocklab-ml/                            # HỌC MÁY & DỰ ĐOÁN GIÁ (PYTHON 3.11 & FASTAPI)
    ├── api/main.py                         # REST API dự đoán tín hiệu mua/bán
    ├── features/                           # Xử lý đặc trưng kỹ thuật (RSI, MACD, MA)
    ├── models/                             # Huấn luyện & lưu trữ mô hình XGBoost
    └── requirements.txt                    # Danh sách thư viện Python
```

---

## 📦 Yêu Cầu Hệ Thống & Cài Đặt

### 1. Yêu cầu môi trường
- **Docker & Docker Compose** (khuyến nghị cho hạ tầng DB/Cache).
- **Java JDK 21+** (OpenJDK hoặc Eclipse Temurin).
- **Apache Maven 3.9+**.
- **Node.js 20.19+** & **npm**.
- **Python 3.11+** (tùy chọn cho module ML).

---

### 2. Khởi chạy toàn bộ hệ sinh thái

#### Bước 1: Khởi động Cơ sở dữ liệu và Cache (Docker)
```bash
# Khởi chạy MySQL 8 và Redis 7 dưới nền
docker compose up -d

# Kiểm tra các container đang hoạt động
docker compose ps
```
- **MySQL**: `localhost:3306` (hoặc `3307` theo cấu hình docker-compose)
- **Redis**: `localhost:6379` (hoặc `6380`)
- **phpMyAdmin**: `http://localhost:8081`

#### Bước 2: Chạy Backend Spring Boot
```bash
cd stocklab-backend

# Chạy kiểm thử tự động toàn diện
mvn clean test

# Khởi chạy dịch vụ backend
mvn spring-boot:run
```
> Backend hoạt động tại địa chỉ: **http://localhost:8080**

#### Bước 3: Chạy Frontend React (Vite)
```bash
cd stocklab-frontend

# Cài đặt các gói thư viện
npm install

# Khởi chạy máy chủ phát triển
npm run dev
```
> Frontend hoạt động tại địa chỉ: **http://localhost:5173**

#### Bước 4: Khởi chạy ML Service (Tùy chọn)
```bash
cd stocklab-ml

# Tạo môi trường ảo và cài đặt thư viện
python -m venv .venv
# Trên Windows:
.venv\Scripts\activate
# Trên Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
```
> ML API hoạt động tại địa chỉ: **http://localhost:8000**

---

## 🧪 Kiểm Thử & Đảm Bảo Chất Lượng

Dự án được bảo vệ nghiêm ngặt bằng quy trình kiểm thử tự động liên tục:

```bash
cd stocklab-backend
mvn test
```

### Kết Quả Kiểm Thử (100% Passed)
- **Tổng số test cases**: **95/95 test cases PASS GREEN**.
- **TradingConstantsTest**: Xác thực chính xác biên độ giá trần/sàn cho từng sàn (HOSE, HNX, UPCOM) và bước giá làm tròn 100 VNĐ.
- **OrderEstimationServiceTest**: Kiểm tra 7 tình huống ước tính lệnh, kiểm tra số dư tiền, tỷ lệ phí 0.15% và điều kiện lô chẵn.
- **PortfolioMetricsCalculatorTest**: Kiểm định tính toàn vẹn của thuật toán tính toán PnL danh mục và tỷ trọng tài sản 100%.
- **MatchingEngineTest & OrderServiceTest**: Kiểm tra tính chính xác của khớp lệnh liên tục, khớp từng phần, hủy lệnh và xử lý xung đột số dư.

---

## 🚀 Triển Khai Hạ Tầng (Docker & Cloud Deploy)

### 1. Triển khai bằng Docker Compose
Hệ thống sẵn sàng đóng gói và triển khai một lệnh bằng Docker Compose cho môi trường Production:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 2. Triển khai trên Cloud Render (`render.yaml`)
Dự án được cấu hình sẵn tệp `render.yaml` tối ưu hóa tài nguyên cho môi trường Free Tier:
- Bật cờ JVM siêu tiết kiệm bộ nhớ: `-XX:+UseSerialGC -Xss512k -XX:MaxRAMPercentage=75.0`.
- Khởi động đồng thời Web Service Backend (Spring Boot), Web Service Frontend (React Static) và Web Service ML (FastAPI).

---

## 📄 Bản Quyền & Tác Giả

- **Dự án**: StockLab — Simulation Trading Platform
- **Tác giả**: [Jack0dev](https://github.com/Jack0dev)
- **Giấy phép**: Phục vụ mục đích học tập, nghiên cứu khoa học và phát triển mã nguồn mở.
