# 🚀 StockLab — Enterprise Scale-Up & AI Trading Plan

> Bản nâng cấp kiến trúc toàn diện chuyển đổi StockLab từ Monolithic sang Microservices (Event-driven) và tích hợp hệ thống AI Trading Bot chuyên nghiệp.

---

## 🏗️ 1. Kiến trúc Tổng thể (Enterprise-ready)

Kiến trúc sẽ được tách biệt thành các domain riêng biệt để đảm bảo tính mở rộng (scaling), bảo mật (security) và real-time:

**Data Pipeline -> Feature Store -> ML Model -> Signal -> Risk Engine -> Order Service -> Matching Engine -> Feedback Loop**

### 1.1. Core Backend (Java Spring Boot)
- **Order Service**: Xử lý logic đặt lệnh, validation cơ bản. KHÔNG còn khớp lệnh trực tiếp.
- **Risk Engine (BẮT BUỘC PHẢI CÓ)**:
  - Rules: Max position size (10%), Stop loss (-5%), Take profit (+10%), Max drawdown (20%).
  - Input: Signal từ Bot hoặc User Order -> Risk filter -> Final Order.
- **Portfolio & PnL**: Tính toán chuẩn xác Unrealized PnL, Realized PnL và Equity curve.

### 1.2. Matching Engine (Java hoặc Go)
- **Tách riêng biệt**: Service độc lập chuyên xử lý Order Book và Matching.
- Giao tiếp qua **Kafka** hoặc **Redis Stream** thay vì WebSocket thuần để đảm bảo không mất event và xử lý real-time tốc độ cao.

### 1.3. Hệ thống Machine Learning (Python)
- **Data Ingestion Service**: Cron job kéo OHLCV và News (từ MySQL và Redis).
- **Feature Service**: Tính toán technical features (SMA, EMA, RSI, MACD, BB) và sentiment features.
- **ML Service (FastAPI)**: Cung cấp API `/predict` và `/train`.

---

## 📡 2. Data Pipeline & Feature Store

**KHÔNG feed trực tiếp từ DB vào model.**

### 2.1. Data Ingestion Service (Python)
- **Pull**: Kéo dữ liệu OHLCV (từ vnstock/TCBS) và News (scrape CafeF).
- **Push**: Lưu vào MySQL (historical data để offline training) và đẩy vào Redis (real-time cache).

### 2.2. Data Processing (Feature Engineering)
- **Price features**: SMA, EMA, RSI, MACD, Bollinger Bands.
- **Advanced**: 
  - Returns: `r_t = (price_t - price_t-1) / price_t-1`
  - Volatility: `std(returns, window=20)`
- **News features**: Sentiment analysis (positive/negative/neutral) bằng FinBERT (nâng cao) hoặc Rule-based (nhanh).

### 2.3. Feature Store (Redis + MySQL)
- **Redis**: Phục vụ real-time features cho model predict.
- **MySQL**: Lưu trữ offline features cho quá trình training.
- **Structure**:
  ```json
  {
    "symbol": "VNM",
    "timestamp": 1710000000,
    "features": {
      "rsi": 65,
      "macd": 0.12,
      "volatility": 0.03,
      "sentiment": 0.7
    }
  }
  ```

---

## 🤖 3. Model Layer & Signal Generation

### 3.1. Tư duy Model chuẩn xác
- **KHÔNG**: Dự đoán giá cụ thể, dùng accuracy, hay train một lần xài mãi.
- **CÓ**: Dự đoán xác suất xu hướng (Signal: BUY/SELL/HOLD + confidence), tối ưu theo PnL, Sharpe ratio, Drawdown.

### 3.2. ML Models
- **Giai đoạn 1**: Logistic Regression, Random Forest, XGBoost (Best cho tabular).
  - Target: `y = 1` nếu giá tăng > threshold trong 5 ngày, `y = 0` nếu ngược lại.
- **Giai đoạn 2**: LSTM (Time series), Transformer, Reinforcement Learning (Pro level).

### 3.3. Signal Generation Service
- **Input**: Feature vector từ Redis.
- **Output**:
  ```json
  {
    "symbol": "VNM",
    "signal": "BUY",
    "confidence": 0.78
  }
  ```
- **Logic**: 
  - `prob_up > 0.7` → BUY
  - `prob_down > 0.7` → SELL
  - Còn lại → HOLD

---

## 🔁 4. Feedback Loop & Evaluation

### 4.1. Feedback Loop
- Lưu trữ mọi Signal đã đưa ra và kết quả PnL thực tế.
- Tạo dataset `(signal, features) → outcome`.
- Trigger pipeline retrain model định kỳ (mỗi tuần).

### 4.2. Evaluation Metrics (Thay thế Accuracy)
1. **Sharpe Ratio**: Đo lường lợi nhuận trên rủi ro.
2. **Max Drawdown**: Tỷ lệ sụt giảm tài sản lớn nhất.
3. **Win Rate**: Tỷ lệ lệnh thắng.
4. **Profit Factor**: Tổng lãi / Tổng lỗ.

---

## 🗓️ 5. Lộ trình Triển khai (Roadmap Thực Tế)

### Phase 1 (Tuần 1 - 2): ML Foundation
- Xây dựng Data Ingestion Service & Data Processing.
- Thiết lập Feature Store (Redis + MySQL).
- Train model XGBoost cơ bản.
- Dựng API `/predict` bằng FastAPI.

### Phase 2: Integration & Signal UI
- Tích hợp ML Service với hệ thống StockLab hiện tại.
- Xây dựng Signal UI: Hiển thị BUY/SELL/HOLD signal trên giao diện cho người dùng tham khảo.

### Phase 3: Auto Trading (Paper Trading)
- Hoàn thiện Risk Engine.
- Cho phép Bot tự động gọi lệnh dựa trên Signal (Giao dịch giả lập - Paper Trading).
- Tách Matching Engine sang service độc lập.
- Đánh giá theo thời gian thực các metrics: Sharpe Ratio, Drawdown.

### Phase 4: Advanced AI
- Cập nhật model lên LSTM / Transformer.
- Đưa vào Reinforcement Learning.
- Portfolio optimization.
