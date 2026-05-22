#!/usr/bin/env python3
"""
StockLab ML -- Feature Engineering
[P1-07] Compute all technical indicators from OHLCV data.
[P1-08] Batch compute and store into ml_features table.

Indicators computed:
    - SMA (10, 20, 50)
    - EMA (12, 26)
    - RSI (14)
    - MACD (12-26) + Signal (9)
    - Bollinger Bands (20, 2std)
    - ATR (14)
    - Returns 1d, 5d
    - Volatility 20d
    - Volume Change 1d
    - Momentum 10

Usage:
    cd stocklab-ml
    set PYTHONIOENCODING=utf-8
    .venv\\Scripts\\python.exe features/feature_engineering.py
"""
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text

# --- Config ---
LARAGON_DB_URL = "mysql+pymysql://root:@localhost:3306/stock_lap?charset=utf8mb4"

# Minimum rows needed to compute all indicators (SMA50 needs 50 rows)
MIN_ROWS_REQUIRED = 55


def load_ohlcv(engine, stock_id):
    """Load OHLCV data for a single stock, sorted by date."""
    query = text("""
        SELECT trading_date, open_price, high_price, low_price, close_price, volume
        FROM stock_price_history
        WHERE stock_id = :stock_id
        ORDER BY trading_date ASC
    """)
    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params={"stock_id": stock_id})
    return df


def compute_features(df):
    """
    Compute all technical indicators from OHLCV DataFrame.
    Returns DataFrame with feature columns added.
    """
    close = df["close_price"].astype(float)
    high = df["high_price"].astype(float)
    low = df["low_price"].astype(float)
    volume = df["volume"].astype(float)

    features = pd.DataFrame(index=df.index)
    features["trading_date"] = df["trading_date"]

    # ===== SMA (Simple Moving Average) =====
    features["sma_10"] = close.rolling(window=10).mean()
    features["sma_20"] = close.rolling(window=20).mean()
    features["sma_50"] = close.rolling(window=50).mean()

    # ===== EMA (Exponential Moving Average) =====
    features["ema_12"] = close.ewm(span=12, adjust=False).mean()
    features["ema_26"] = close.ewm(span=26, adjust=False).mean()

    # ===== RSI (Relative Strength Index, 14 days) =====
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.rolling(window=14).mean()
    avg_loss = loss.rolling(window=14).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    features["rsi_14"] = 100.0 - (100.0 / (1.0 + rs))

    # ===== MACD (12-26) + Signal (9) =====
    ema_12 = close.ewm(span=12, adjust=False).mean()
    ema_26 = close.ewm(span=26, adjust=False).mean()
    features["macd"] = ema_12 - ema_26
    features["macd_signal"] = features["macd"].ewm(span=9, adjust=False).mean()

    # ===== Bollinger Bands (20 days, 2 std) =====
    sma_20 = close.rolling(window=20).mean()
    std_20 = close.rolling(window=20).std()
    features["bb_upper"] = sma_20 + (2 * std_20)
    features["bb_lower"] = sma_20 - (2 * std_20)

    # ===== ATR (Average True Range, 14 days) =====
    tr1 = high - low
    tr2 = (high - close.shift(1)).abs()
    tr3 = (low - close.shift(1)).abs()
    true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    features["atr_14"] = true_range.rolling(window=14).mean()

    # ===== Returns =====
    features["returns_1d"] = close.pct_change(periods=1)
    features["returns_5d"] = close.pct_change(periods=5)

    # ===== Volatility (20-day rolling std of daily returns) =====
    daily_returns = close.pct_change()
    features["volatility_20d"] = daily_returns.rolling(window=20).std()

    # ===== Volume Change =====
    features["volume_change_1d"] = volume.pct_change(periods=1)
    # Cap extreme volume changes (e.g., volume going from 0 -> X)
    features["volume_change_1d"] = features["volume_change_1d"].clip(-10, 10)

    # ===== Momentum =====
    features["momentum_10"] = close - close.shift(10)

    return features


def save_features(engine, stock_id, features_df):
    """
    Save computed features to ml_features table.
    Uses INSERT ... ON DUPLICATE KEY UPDATE for idempotent writes.
    """
    sql = text("""
        INSERT INTO ml_features (
            stock_id, trading_date,
            sma_10, sma_20, sma_50, ema_12, ema_26,
            rsi_14, macd, macd_signal, bb_upper, bb_lower,
            atr_14, returns_1d, returns_5d, volatility_20d,
            volume_change_1d, momentum_10
        ) VALUES (
            :stock_id, :trading_date,
            :sma_10, :sma_20, :sma_50, :ema_12, :ema_26,
            :rsi_14, :macd, :macd_signal, :bb_upper, :bb_lower,
            :atr_14, :returns_1d, :returns_5d, :volatility_20d,
            :volume_change_1d, :momentum_10
        ) ON DUPLICATE KEY UPDATE
            sma_10=VALUES(sma_10), sma_20=VALUES(sma_20), sma_50=VALUES(sma_50),
            ema_12=VALUES(ema_12), ema_26=VALUES(ema_26),
            rsi_14=VALUES(rsi_14), macd=VALUES(macd), macd_signal=VALUES(macd_signal),
            bb_upper=VALUES(bb_upper), bb_lower=VALUES(bb_lower),
            atr_14=VALUES(atr_14), returns_1d=VALUES(returns_1d), returns_5d=VALUES(returns_5d),
            volatility_20d=VALUES(volatility_20d), volume_change_1d=VALUES(volume_change_1d),
            momentum_10=VALUES(momentum_10)
    """)

    # Drop rows where any core feature is NaN (first ~50 rows due to SMA50 window)
    feature_cols = [
        "sma_10", "sma_20", "sma_50", "ema_12", "ema_26",
        "rsi_14", "macd", "macd_signal", "bb_upper", "bb_lower",
        "atr_14", "returns_1d", "returns_5d", "volatility_20d",
        "volume_change_1d", "momentum_10"
    ]
    clean_df = features_df.dropna(subset=feature_cols)

    count = 0
    with engine.begin() as conn:
        for _, row in clean_df.iterrows():
            params = {"stock_id": stock_id, "trading_date": row["trading_date"]}
            for col in feature_cols:
                val = row[col]
                # Convert numpy types to Python native
                if pd.isna(val):
                    params[col] = None
                elif isinstance(val, (np.floating, np.integer)):
                    params[col] = float(val)
                else:
                    params[col] = float(val)
            conn.execute(sql, params)
            count += 1

    return count


def get_stock_list(engine):
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT id, ticker FROM stocks WHERE is_active=1 AND ticker != 'SLP' ORDER BY id")
        ).fetchall()
    return [(r[0], r[1]) for r in rows]


def main():
    print("=" * 60)
    print("StockLab ML -- Feature Engineering (Batch)")
    print("=" * 60)
    print()

    engine = create_engine(LARAGON_DB_URL)
    stocks = get_stock_list(engine)
    print(f"Processing {len(stocks)} stocks...")
    print()

    total_saved = 0
    skipped = []

    for i, (stock_id, ticker) in enumerate(stocks, 1):
        print(f"[{i:2d}/{len(stocks)}] {ticker}...", end=" ", flush=True)

        # Load OHLCV
        df = load_ohlcv(engine, stock_id)
        if len(df) < MIN_ROWS_REQUIRED:
            print(f"SKIPPED (only {len(df)} rows, need {MIN_ROWS_REQUIRED})")
            skipped.append(ticker)
            continue

        # Compute features
        features = compute_features(df)

        # Save
        saved = save_features(engine, stock_id, features)
        total_saved += saved
        print(f"{saved} feature rows saved (from {len(df)} OHLCV rows)")

    # Summary
    print()
    print("=" * 60)
    print("FEATURE ENGINEERING SUMMARY")
    print("=" * 60)
    print(f"  Stocks processed: {len(stocks) - len(skipped)}/{len(stocks)}")
    print(f"  Total feature rows saved: {total_saved:,}")
    if skipped:
        print(f"  Skipped (insufficient data): {skipped}")

    # Verification
    print()
    print("--- Verification ---")
    with engine.connect() as conn:
        total = conn.execute(text("SELECT COUNT(*) FROM ml_features")).scalar()
        null_check = conn.execute(text("""
            SELECT COUNT(*) FROM ml_features
            WHERE sma_50 IS NULL OR rsi_14 IS NULL OR macd IS NULL
        """)).scalar()
        sample = conn.execute(text("""
            SELECT mf.trading_date, s.ticker, mf.rsi_14, mf.macd, mf.sma_20, mf.atr_14
            FROM ml_features mf
            JOIN stocks s ON s.id = mf.stock_id
            ORDER BY mf.trading_date DESC
            LIMIT 5
        """)).fetchall()

    print(f"  Total rows in ml_features: {total:,}")
    print(f"  Rows with NULL in core features: {null_check}")
    print()
    print("  Latest features sample:")
    print(f"  {'Date':<12} {'Ticker':<6} {'RSI':>8} {'MACD':>10} {'SMA20':>10} {'ATR14':>10}")
    for r in sample:
        print(f"  {str(r[0]):<12} {r[1]:<6} {r[2]:>8.2f} {r[3]:>10.4f} {r[4]:>10.2f} {r[5]:>10.4f}")

    print()
    if null_check == 0:
        print("[PASS] All features computed successfully!")
    else:
        print(f"[WARN] {null_check} rows have NULL values (may be at start of time series)")


if __name__ == "__main__":
    main()
