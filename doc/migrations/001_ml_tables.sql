-- ============================================
-- StockLab ML — Database Migrations
-- Phase 0: Create tables for ML pipeline
-- ============================================

-- ===== 1. Verify stock_price_history =====
-- Bảng này đã tồn tại từ Spring Boot (ddl-auto=update).
-- Chỉ cần đảm bảo có đúng indexes.
-- Nếu chạy trên Docker MySQL mới (chưa có bảng), Spring Boot sẽ tự tạo khi start.

-- ===== 2. ml_features (wide-table) =====
CREATE TABLE IF NOT EXISTS ml_features (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    stock_id BIGINT NOT NULL,
    trading_date DATE NOT NULL,

    -- Simple Moving Averages
    sma_10 DOUBLE,
    sma_20 DOUBLE,
    sma_50 DOUBLE,

    -- Exponential Moving Averages
    ema_12 DOUBLE,
    ema_26 DOUBLE,

    -- RSI
    rsi_14 DOUBLE,

    -- MACD
    macd DOUBLE,
    macd_signal DOUBLE,

    -- Bollinger Bands
    bb_upper DOUBLE,
    bb_lower DOUBLE,

    -- Average True Range
    atr_14 DOUBLE,

    -- Returns
    returns_1d DOUBLE,
    returns_5d DOUBLE,

    -- Volatility
    volatility_20d DOUBLE,

    -- Volume
    volume_change_1d DOUBLE,

    -- Momentum
    momentum_10 DOUBLE,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_stock_date (stock_id, trading_date),
    INDEX idx_ml_features_stock (stock_id),
    INDEX idx_ml_features_date (trading_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 3. ml_predictions =====
CREATE TABLE IF NOT EXISTS ml_predictions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    stock_id BIGINT NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    signal_type ENUM('BUY', 'SELL', 'HOLD') NOT NULL,
    confidence DOUBLE NOT NULL,
    predicted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    model_version VARCHAR(20) NOT NULL DEFAULT 'v1',

    INDEX idx_predictions_stock (stock_id),
    INDEX idx_predictions_symbol (symbol),
    INDEX idx_predictions_date (predicted_at),
    INDEX idx_predictions_model (model_version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 4. signal_outcomes (feedback loop) =====
CREATE TABLE IF NOT EXISTS signal_outcomes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    prediction_id BIGINT NOT NULL,
    outcome_price DECIMAL(15, 2),
    outcome_date DATE,
    actual_return_5d DOUBLE,
    actual_label ENUM('BUY', 'SELL', 'HOLD'),
    evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_signal_prediction
        FOREIGN KEY (prediction_id) REFERENCES ml_predictions(id)
        ON DELETE CASCADE,

    UNIQUE KEY uk_prediction (prediction_id),
    INDEX idx_outcomes_date (outcome_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 5. risk_logs (Phase 4, create now to avoid migration later) =====
CREATE TABLE IF NOT EXISTS risk_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    stock_id BIGINT,
    symbol VARCHAR(10),
    signal_type ENUM('BUY', 'SELL', 'HOLD'),
    rule_name VARCHAR(50) NOT NULL,
    decision ENUM('ACCEPT', 'REJECT') NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_risk_logs_stock (stock_id),
    INDEX idx_risk_logs_decision (decision),
    INDEX idx_risk_logs_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 6. paper_trades (Phase 4, create now) =====
CREATE TABLE IF NOT EXISTS paper_trades (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    stock_id BIGINT NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    side ENUM('BUY', 'SELL') NOT NULL,
    quantity INT NOT NULL,
    entry_price DECIMAL(15, 2) NOT NULL,
    exit_price DECIMAL(15, 2),
    pnl DECIMAL(15, 2),
    pnl_percent DOUBLE,
    signal_confidence DOUBLE,
    model_version VARCHAR(20),
    status ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,

    INDEX idx_paper_stock (stock_id),
    INDEX idx_paper_status (status),
    INDEX idx_paper_date (opened_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
