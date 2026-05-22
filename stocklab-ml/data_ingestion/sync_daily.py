#!/usr/bin/env python3
"""
StockLab ML -- Daily Sync: Pull latest OHLCV data
[P1-06] Cron job to update stock_price_history with the latest trading day.

Usage:
    cd stocklab-ml
    set PYTHONIOENCODING=utf-8
    .venv\\Scripts\\python.exe data_ingestion/sync_daily.py

Schedule (Windows Task Scheduler or crontab):
    Cron: 0 17 * * 1-5  (17:00 weekdays, after market close)

Notes:
    - Only pulls data for the last 7 days (overlap to catch missed days).
    - Uses ON DUPLICATE KEY UPDATE so re-runs are safe.
    - Skips SLP (platform token).
"""
import sys
import os
import time
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import warnings
warnings.filterwarnings("ignore")

from sqlalchemy import create_engine, text

# --- Config ---
LARAGON_DB_URL = "mysql+pymysql://root:@localhost:3306/stock_lap?charset=utf8mb4"
LOOKBACK_DAYS = 7  # Pull last 7 days to catch any gaps
RATE_LIMIT_DELAY = 4.0


def get_stock_list(engine):
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT id, ticker FROM stocks WHERE is_active=1 AND ticker != 'SLP' ORDER BY id")
        ).fetchall()
    return [(r[0], r[1]) for r in rows]


def pull_recent(ticker, days=7):
    from vnstock import Vnstock
    end = datetime.now().strftime("%Y-%m-%d")
    start = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

    stock = Vnstock().stock(symbol=ticker, source="VCI")
    df = stock.quote.history(start=start, end=end)
    if df is None or df.empty:
        return None

    df = df.rename(columns={
        "time": "trading_date", "open": "open_price",
        "high": "high_price", "low": "low_price",
        "close": "close_price", "volume": "volume",
    })
    expected = ["trading_date", "open_price", "high_price", "low_price", "close_price", "volume"]
    return df[[c for c in expected if c in df.columns]]


def upsert(engine, stock_id, df):
    if df is None or df.empty:
        return 0
    sql = text("""
        INSERT INTO stock_price_history
            (stock_id, trading_date, open_price, high_price, low_price, close_price, volume)
        VALUES (:stock_id, :trading_date, :open_price, :high_price, :low_price, :close_price, :volume)
        ON DUPLICATE KEY UPDATE
            open_price=VALUES(open_price), high_price=VALUES(high_price),
            low_price=VALUES(low_price), close_price=VALUES(close_price), volume=VALUES(volume)
    """)
    count = 0
    with engine.begin() as conn:
        for _, row in df.iterrows():
            conn.execute(sql, {
                "stock_id": stock_id,
                "trading_date": row["trading_date"],
                "open_price": float(row["open_price"]),
                "high_price": float(row["high_price"]),
                "low_price": float(row["low_price"]),
                "close_price": float(row["close_price"]),
                "volume": int(row["volume"]),
            })
            count += 1
    return count


def main():
    print(f"[{datetime.now():%Y-%m-%d %H:%M}] Daily Sync -- Start")
    engine = create_engine(LARAGON_DB_URL)
    stocks = get_stock_list(engine)
    total = 0

    for i, (stock_id, ticker) in enumerate(stocks, 1):
        try:
            df = pull_recent(ticker, LOOKBACK_DAYS)
            rows = upsert(engine, stock_id, df)
            total += rows
            print(f"  [{i:2d}/{len(stocks)}] {ticker}: {rows} rows synced")
        except Exception as e:
            print(f"  [{i:2d}/{len(stocks)}] {ticker}: FAILED - {e}")

        if i < len(stocks):
            time.sleep(RATE_LIMIT_DELAY)

    print(f"[{datetime.now():%Y-%m-%d %H:%M}] Daily Sync -- Done. Total: {total} rows")


if __name__ == "__main__":
    main()
