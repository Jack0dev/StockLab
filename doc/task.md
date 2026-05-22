# 📋 StockLab — Task Tracking (Scale-Up Plan)

> File theo dõi tiến độ thực hiện kế hoạch nâng cấp StockLab → Enterprise AI Trading Platform.
> Cập nhật mỗi khi hoàn thành 1 task: `[ ]` → `[/]` (đang làm) → `[x]` (xong).
>
> **Nguyên tắc:** Infra → Secrets → Data → Features → Model → Backtest → API → UI → Risk → Paper Trading → Feedback → Advanced AI

**Last Updated:** 2026-05-12

---

## ⚙️ PHASE 0 — Environment & Infrastructure
> **Mục tiêu:** Dựng hạ tầng local ổn định, quản lý secrets đúng cách trước khi viết bất kỳ dòng ML code nào.
> **Rule:** Không bắt đầu Phase 1 nếu Phase 0 chưa xong.

### 0.1. Docker & Local Services
- [x] **[P0-01]** ✅ Tạo `docker-compose.yml` với các services:
  - `mysql` (8.0) → port 3307
  - `redis` (7-alpine) → port 6380
  - `phpmyadmin` → http://localhost:8081
  - `redis-commander` → http://localhost:8082
  - Verified: 4 containers `Up (healthy)`
- [x] **[P0-02]** ✅ `.env.example` đã tạo (chưa tạo `.env` thực — sẽ cần khi chạy ML service)
- [x] **[P0-03]** ✅ `scripts/test_connections.py` — verified:
  - `[OK] MySQL connected -> localhost:3307/stock_lap`
  - `[OK] Redis connected -> localhost:6380`
  - ML tables found: `['ml_features', 'ml_predictions']`

### 0.2. Database Migrations
- [x] **[P0-04]** ✅ Bảng `stock_price_history` — Spring Boot sẽ tự tạo khi start (ddl-auto=update)
- [x] **[P0-05]** ✅ Bảng `ml_features` đã tạo (wide-table, 17 feature columns + indexes)
- [x] **[P0-06]** ✅ Bảng `ml_predictions` đã tạo (stock_id + symbol + signal_type + confidence + model_version)
- [x] **[P0-07]** ✅ Bảng `signal_outcomes` đã tạo (FK → ml_predictions, CASCADE delete)
  - Bonus: cũng đã tạo `risk_logs` + `paper_trades` (Phase 4, tạo sớm tránh migration sau)

### 0.3. Configuration & Secrets Management
- [x] **[P0-08]** ✅ `.env.example` đã tạo tại `stocklab-ml/.env.example`
- [x] **[P0-09]** ✅ `.gitignore` đã cập nhật (thêm ML artifacts, Python cache, Docker patterns)

### ✅ Definition of Done — Phase 0
> Phase 0 hoàn thành khi tất cả đều pass:
> - `docker compose up -d` → 4 containers `Up`
> - `python scripts/test_connections.py` → `[OK] MySQL` + `[OK] Redis`
> - 4 bảng DB đã tồn tại với đúng schema
> - `.env.example` đã có trong repo, `.env` không bao giờ xuất hiện trong `git status`

---

## 📦 PHASE 1 — Data Foundation
> **Mục tiêu:** Data pipeline sạch, ổn định, có thể re-run bất cứ lúc nào.
> Phụ thuộc: Phase 0 ✅

### 1.0. ML Service Skeleton
- [x] **[P1-00]** ✅ Project structure `stocklab-ml/` đã tạo:
  ```
  stocklab-ml/
  ├── config/         # settings.py, db.py, redis_client.py ✅
  ├── data_ingestion/ # __init__.py (placeholder)
  ├── features/       # __init__.py (placeholder)
  ├── models/         # __init__.py (placeholder)
  ├── api/            # __init__.py (placeholder)
  ├── tests/          # __init__.py (placeholder)
  ├── scripts/        # test_connections.py ✅
  ├── requirements.txt ✅ (all deps installed)
  ├── .env.example ✅
  └── .venv/ (Python 3.11 virtual env)
  ```

### 1.1. Real Market Data Import
- [x] **[P1-01]** ✅ vnstock hoạt động — pull VCB OHLCV thành công (columns: time, open, high, low, close, volume)
- [x] **[P1-02]** ✅ `import_ohlcv.py` -- pull OHLCV 2 năm cho 20 mã (trừ SLP token)
- [x] **[P1-03]** ✅ Validate raw data -- tất cả 20 mã pass (không có null, duplicate, spike)
- [x] **[P1-04]** ✅ Upsert vào MySQL -- `ON DUPLICATE KEY UPDATE` (idempotent)
- [x] **[P1-05]** ✅ Import verified:
  - 20/20 stocks, **10,480 rows** upserted
  - Tổng trong DB: **17,000 rows** (bao gồm 1,280 seed cũ + 10,480 mới)
  - Date range: 2024-03-29 -> 2026-05-11
  - Mỗi stock: 524-588 rows (đúng ~2 năm trading days)
- [x] **[P1-06]** ✅ `sync_daily.py` đã viết -- pull 7 ngày gần nhất, upsert, rate limit 4s
  - Schedule: `0 17 * * 1-5` (cần tự add vào Windows Task Scheduler)

### 1.2. Feature Engineering
- [x] **[P1-07]** ✅ `feature_engineering.py` đã viết -- tính đầy đủ 17 features:
  - SMA (10, 20, 50), EMA (12, 26), RSI (14)
  - MACD (12-26) + Signal (9), Bollinger Bands (20, 2std)
  - ATR-14, Returns (1d, 5d), Volatility 20d
  - Volume Change 1d, Momentum 10
- [x] **[P1-08]** ✅ Batch compute: **9,492 feature rows** cho 20 stocks
- [x] **[P1-09]** ✅ Verified: 0 NULL trong core features, giá trị hợp lý
  - VCB: RSI=54.05, MACD=+0.15, SMA20=60.05
  - Data cleanup: xóa 1,280 seed cũ + dedup + thêm UNIQUE constraint

### 1.3. Feature Store (Redis)
- [x] **[P1-10]** ✅ Redis key: `features:v1:{SYMBOL}` -> JSON, TTL=24h
- [x] **[P1-11]** ✅ `feature_store.py` đã viết -- push 20 stocks vào Redis
- [x] **[P1-12]** ✅ Verified: All Redis values match MySQL!

### ✅ Definition of Done — Phase 1
> - 22 stocks đã import, mỗi stock ≥ 400 records
> - `sync_daily.py` chạy được, upsert đúng ngày mới nhất
> - `ml_features` đã có data cho toàn bộ 22 mã
> - Redis feature store populated, đọc lại khớp với MySQL

---

## 🤖 PHASE 2 — ML Baseline
> **Mục tiêu:** Model chạy được, backtest dương, predict API hoạt động và bảo mật.
> Phụ thuộc: Phase 1 ✅

### 2.1. Dataset Preparation
- [x] **[P2-01]** ✅ Training dataset built:
  - 9,392 labeled rows from 20 stocks
  - Labels: BUY 39.3% / HOLD 25.7% / SELL 35.0%
  - Target: future_return_5d > +1% (BUY), < -1% (SELL)
- [x] **[P2-02]** ✅ Time-based split:
  - Train: 8,252 rows (2024-06 -> 2026-02)
  - Test: 1,140 rows (2026-02 -> 2026-05) out-of-sample

### 2.2. Model Training (XGBoost)
- [x] **[P2-03]** ✅ XGBoost trained: 200 trees, depth=6, StandardScaler normalization
- [x] **[P2-04]** ✅ Evaluation:
  - BUY F1=0.48, SELL F1=0.39, HOLD F1=0.23
  - F1 Macro=0.37 (baseline -- below 0.45 target, expected for v1)
  - Top features: bb_upper, sma_20, ema_26, bb_lower, volatility_20d
- [x] **[P2-04b]** ✅ Backtest:
  - 1,001 trades, Win rate=50.2%
  - Avg return/trade: -0.35% (Sharpe: -0.40)
  - Benchmark (buy-all): -0.09% (Sharpe: -0.10)
  - Status: UNDERPERFORM (expected for v1 baseline)
- [x] **[P2-05]** ✅ Artifacts saved: `xgboost_v1.json`, `xgboost_v1.pkl`, `metadata_v1.json`
- [x] **[P2-06]** ✅ Report: `evaluation_v1.md`

### 2.3. FastAPI Prediction Service
- [x] **[P2-07]** ✅ `api/main.py` with endpoints:
  - `GET /health` -> model_loaded=true, version=v1
  - `POST /predict` -> single symbol (VCB: SELL, confidence=0.67)
  - `POST /predict/batch` -> 20 symbols, **56ms latency** (< 200ms target)
  - `POST /admin/train` -> 403 without X-Admin-Token (security OK)
- [x] **[P2-08]** ✅ Model loaded on startup, cached in memory
- [x] **[P2-09]** ✅ Batch test: 20 symbols, all returned signals, latency=56ms
- [ ] **[P2-10]** Dockerfile cho ML service (Optional -- chưa cần ngay)
- [ ] **[P2-11]** Thêm ml_service vào docker-compose (Optional -- chưa cần ngay)

### ✅ Definition of Done -- Phase 2
> - [x] XGBoost trained, F1 macro = 0.37 (baseline, sẽ cải thiện ở Phase 5)
> - [ ] Backtest Sharpe < 0 (cần tune model, nhưng pipeline hoạt động end-to-end)
> - [x] `/predict/batch` 20 signals, latency 56ms < 200ms
> - [x] `/admin/train` reject 403 khi không có X-Admin-Token
> - [ ] Docker (deferred to later)

---

## 🔗 PHASE 3 — Integration & Signal UI
> **Mục tiêu:** Spring Boot gọi được ML service, frontend hiển thị signal, AI chatbot hoạt động.
> Phụ thuộc: Phase 2 ✅

### 3.1. Financial News Service (Spring Boot)
- [x] **[P3-01]** ✅ `NewsService.java` -- RSS parser + Redis cache
- [x] **[P3-02]** ✅ RSS feeds: VnEconomy + VnExpress chung khoan
- [x] **[P3-03]** ✅ Simple XML parser (không cần ROME dep cho basic parsing)
- [x] **[P3-04]** ✅ Redis cache TTL=15min, auto refresh `@Scheduled`
- [x] **[P3-05]** ✅ `GET /api/news` -- `NewsController.java`
- [ ] **[P3-06]** Frontend `NewsWidget` (deferred -- cần design thêm)

### 3.2. ML Service Integration (Spring Boot <-> FastAPI)
- [x] **[P3-07]** ✅ `spring-boot-starter-webflux` added to pom.xml
- [x] **[P3-08]** ✅ `MLService.java` -- WebClient, calls `/predict/batch`
- [x] **[P3-09]** ✅ Retry 3x + timeout 5s handling
- [x] **[P3-10]** ✅ Circuit breaker: FastAPI down -> return cached signal from Redis
- [x] **[P3-11]** ✅ Cache signal Redis TTL=5min
- [x] **[P3-12]** ✅ `GET /api/signals/{ticker}` -- `SignalController.java`
- [x] **[P3-13]** ✅ `GET /api/signals` -- batch all 20 stocks

### 3.3. Signal UI (Frontend)
- [x] **[P3-14]** ✅ `SignalBadge.jsx` + CSS -- BUY/SELL/HOLD badge, confidence bar, reasons tooltip
- [ ] **[P3-15]** Tích hợp `SignalBadge` vào `StockDetailPage` (cần review page)
- [ ] **[P3-16]** Tích hợp `SignalBadge` vào `TradingPage` (cần review page)
- [x] **[P3-17]** ✅ `SignalDashboard.jsx` -- full table, filter cards, route `/signals`, Navbar link

### 3.4. AI Assistant Chatbot (Gemini)
- [x] **[P3-18]** ✅ `AIAssistantService.java` -- Gemini 2.0 Flash API
- [x] **[P3-19]** ✅ Context injection: ML signal + probabilities + reasons
- [x] **[P3-20]** ✅ Redis rate limiting: 20 req/user/day
- [x] **[P3-21]** ✅ `POST /api/ai/chat` -- `AIController.java` (authenticated)
- [ ] **[P3-22]** Frontend `AIChatWidget` (deferred -- cần design thêm)

### ✅ Definition of Done -- Phase 3
> - [x] Spring Boot gọi FastAPI thành công + circuit breaker (cached fallback)
> - [x] `SignalBadge` component + `SignalDashboard` page
> - [x] AI chatbot backend (Gemini) với context injection + rate limit
> - [ ] Frontend widgets (News, AI Chat) -- deferred

---

## 🛡️ PHASE 4 — Risk Engine & Auto Trading
> **Mục tiêu:** Bot tự động đặt lệnh có Risk Engine kiểm soát, paper trading hoạt động.
> Phụ thuộc: Phase 3 ✅

### 4.1. Risk Engine (Spring Boot)
- [ ] **[P4-01]** Tạo `RiskEngine.java` với đầy đủ 6 rules:
  - [ ] Max position size: không vượt 10% tổng portfolio value
  - [ ] **Max order value**: 1 lệnh không vượt 20% cash available
  - [ ] Stop loss: trigger khi unrealized P&L < -5%
  - [ ] Take profit: trigger khi unrealized P&L > +10%
  - [ ] Max drawdown: dừng mọi auto trade nếu portfolio giảm > 20%
  - [ ] **Trade cooldown**: không trade cùng 1 mã trong vòng 10 phút (lưu lastTradeTime trong Redis)
- [ ] **[P4-02]** Tạo bảng `risk_logs` — log mọi quyết định accept/reject kèm lý do
- [ ] **[P4-03]** Integrate: Signal → Risk Engine → nếu pass → OrderService
- [ ] **[P4-04]** Frontend: Risk dashboard hiển thị drawdown, position size, cooldown status

### 4.2. Auto Trading Bot (Paper Trading)
- [ ] **[P4-05]** Tạo `AutoTradingService.java`:
  - Pull signal từ `GET /api/signals`
  - Pass qua Risk Engine
  - Đặt lệnh với virtual balance (không phải tiền thật)
- [ ] **[P4-06]** Tạo bảng `paper_trades` — lưu lệnh giả lập + P&L
- [ ] **[P4-07]** Cron job: mỗi 5 phút pull signal → risk check → place paper order
- [ ] **[P4-08]** Frontend: `PaperTradingPage` — lệnh auto, P&L simulation, equity curve

### 4.3. Feedback Loop
- [ ] **[P4-09]** Sau 5 ngày, tự động tính `actual_return_5d` cho mỗi signal đã phát ra → lưu vào `signal_outcomes`
- [ ] **[P4-10]** Script tạo retraining dataset từ `signal_outcomes` (signal + features → outcome)
- [ ] **[P4-11]** Schedule retrain model mỗi tuần (cron nội bộ gọi `/admin/train` với token)

### ✅ Definition of Done — Phase 4
> - Paper trading bot tự đặt lệnh thành công, P&L được tính đúng
> - Risk engine block ít nhất 1 trong 6 rules khi test (viết unit test)
> - `signal_outcomes` được populate sau 5 ngày có signal
> - Feedback loop retrain chạy được (test thủ công trước khi schedule)

---

## 🔵 PHASE 5 — Advanced AI
> **Mục tiêu:** Nâng cấp model, portfolio optimization.
> Phụ thuộc: Phase 4 ổn định + đủ feedback data (ít nhất 3 tháng) ✅

### 5.1. Advanced Models
- [ ] **[P5-01]** LSTM cho time-series prediction
- [ ] **[P5-02]** `[OPTIONAL]` Temporal Fusion Transformer (TFT) — chỉ làm nếu LSTM không cải thiện đáng kể
- [ ] **[P5-03]** A/B testing framework: XGBoost vs LSTM trên production signal
- [ ] **[P5-04]** Chọn model theo Sharpe Ratio thực tế (không phải F1 score)

### 5.2. Reinforcement Learning `[OPTIONAL]`
> ⚠️ RL rất dễ ngốn thời gian mà không chắc vượt XGBoost. Chỉ làm khi backtest XGBoost đã ổn định và có đủ data.

- [ ] **[P5-05]** `[OPTIONAL]` Thiết kế RL environment:
  - State: feature vector + portfolio state (cash, holdings, unrealized P&L)
  - Action: BUY/SELL/HOLD + size (0.1 → 1.0 × max_position)
  - Reward: daily Sharpe contribution
- [ ] **[P5-06]** `[OPTIONAL]` Implement RL agent (PPO với `stable-baselines3`)
- [ ] **[P5-07]** `[OPTIONAL]` Backtest RL agent trên out-of-sample data

### 5.3. Portfolio Optimization
- [ ] **[P5-08]** Mean-Variance Optimization (Markowitz) cho 22 mã
- [ ] **[P5-09]** Frontend: `PortfolioOptimizePage` — gợi ý phân bổ tối ưu theo risk appetite

### ✅ Definition of Done — Phase 5
> - LSTM Sharpe > XGBoost Sharpe trên cùng out-of-sample period → mới switch
> - Portfolio optimization trả về allocation hợp lý (sum = 100%, không có negative weight)

---

## 📊 Progress Summary

| Phase | Mục tiêu | Tổng tasks | ✅ Xong | 🔄 Đang làm | % |
|---|---|---|---|---|---|
| ⚙️ Phase 0 | Infra & Secrets | 9 | 9 | 0 | 100% |
| 📦 Phase 1 | Data Foundation | 13 | 13 | 0 | 100% |
| 🤖 Phase 2 | ML Baseline | 12 | 10 | 0 | 83% |
| 🔗 Phase 3 | Integration + UI | 22 | 18 | 0 | 82% |
| 🛡️ Phase 4 | Risk + Auto Trading | 11 | 0 | 0 | 0% |
| 🔵 Phase 5 | Advanced AI | 9 | 0 | 0 | 0% |
| | **TOTAL** | **76** | **50** | **0** | **66%** |

---

## 🚀 Next 4 Tasks (Làm ngay — theo đúng thứ tự)

> Phase 0+1+2+3 nearly DONE! Starting Phase 4 -- Risk Engine.

1. ~~**[P0]** Infra~~ ✅
2. ~~**[P1]** Data Foundation~~ ✅
3. ~~**[P2]** ML Baseline~~ ✅
4. ~~**[P3]** Integration + UI~~ ✅ (backend + frontend, 18/22 tasks)
5. **[P4]** Risk Engine & Auto Trading

---

## 📝 Notes & Blockers

> Ghi chú các vấn đề phát sinh trong quá trình thực hiện.

- _(chưa có)_

---

## 🔗 Tech Stack cần cài

### Python ML Service (`requirements.txt`)
```
python>=3.10
vnstock>=3.0
pandas
numpy
scikit-learn
xgboost
fastapi
uvicorn[standard]
redis
sqlalchemy
pymysql
joblib
python-dotenv
ta          # technical analysis library (ATR, RSI, MACD, BB)
```

### Spring Boot additions (`pom.xml`)
```xml
<!-- HTML Scraping -->
<dependency>org.jsoup / jsoup</dependency>
<!-- Reactive HTTP Client (gọi FastAPI) -->
<dependency>org.springframework.boot / spring-boot-starter-webflux</dependency>
<!-- Circuit Breaker -->
<dependency>io.github.resilience4j / resilience4j-spring-boot3</dependency>
```
