#!/usr/bin/env python3
"""
StockLab ML -- Data Ingestion: Import OHLCV from vnstock
[P1-02] Pull 2 years of OHLCV data for all stocks in the system.
[P1-03] Validate raw data (null, duplicates, anomalies).
[P1-04] Upsert into stock_price_history table.

Usage:
    cd stocklab-ml
    set PYTHONIOENCODING=utf-8
    .venv\\Scripts\\python.exe data_ingestion/import_ohlcv.py

Notes:
    - Imports into LARAGON MySQL (port 3306) where Spring Boot runs.
    - SLP (platform token) is skipped -- it's not a real stock.
    - vnstock uses VCI source by default.
    - Rate limit: 0.5s delay between stocks to avoid API throttling.
"""
import sys
import os
import time
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from sqlalchemy import create_engine, text

# --- Config ---
# Using Laragon MySQL (port 3306) -- this is where Spring Boot reads data
LARAGON_DB_URL = "mysql+pymysql://root:@localhost:3306/stock_lap?charset=utf8mb4"

# Date range: 2 years back from today
END_DATE = datetime.now().strftime("%Y-%m-%d")
START_DATE = (datetime.now() - timedelta(days=730)).strftime("%Y-%m-%d")

# Delay between stocks (seconds). Free tier: 20 req/min => 1 req every 3s + buffer
RATE_LIMIT_DELAY = 4.0

# Max retries when rate-limited
MAX_RETRIES = 3
RETRY_WAIT = 15  # seconds to wait on rate limit


def get_stock_list(engine):
    """Get list of stocks from DB (exclude SLP platform token)."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT id, ticker FROM stocks WHERE is_active=1 AND ticker != 'SLP' ORDER BY id")
        ).fetchall()
    return [(r[0], r[1]) for r in rows]


def pull_ohlcv(ticker, start_date, end_date):
    """Pull OHLCV data from vnstock for a single ticker. Retries on rate limit."""
    from vnstock import Vnstock
    import warnings
    warnings.filterwarnings("ignore")

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            stock = Vnstock().stock(symbol=ticker, source="VCI")
            df = stock.quote.history(start=start_date, end=end_date)

            if df is None or df.empty:
                return None

            # Standardize column names
            df = df.rename(columns={
                "time": "trading_date",
                "open": "open_price",
                "high": "high_price",
                "low": "low_price",
                "close": "close_price",
                "volume": "volume",
            })

            expected_cols = ["trading_date", "open_price", "high_price", "low_price", "close_price", "volume"]
            df = df[[c for c in expected_cols if c in df.columns]]
            return df

        except Exception as e:
            err_msg = str(e).lower()
            if "rate limit" in err_msg or "429" in err_msg or "exceeded" in err_msg:
                wait = RETRY_WAIT * attempt
                print(f"RATE LIMITED, waiting {wait}s (attempt {attempt}/{MAX_RETRIES})...", end=" ", flush=True)
                time.sleep(wait)
            else:
                raise  # Re-raise non-rate-limit errors

    raise Exception(f"Rate limited after {MAX_RETRIES} retries")


def validate_data(df, ticker):
    """
    [P1-03] Validate raw data. Returns (clean_df, issues_list).
    Checks: nulls, price<=0, spike>50%, duplicate dates, volume=0, date ordering.
    """
    issues = []
    original_len = len(df)

    # 1. Null check
    null_count = df.isnull().sum().sum()
    if null_count > 0:
        issues.append(f"  [WARN] {null_count} null values found, dropping rows")
        df = df.dropna()

    # 2. Price <= 0
    price_cols = ["open_price", "high_price", "low_price", "close_price"]
    for col in price_cols:
        bad = df[df[col] <= 0]
        if len(bad) > 0:
            issues.append(f"  [WARN] {len(bad)} rows with {col} <= 0, removing")
            df = df[df[col] > 0]

    # 3. Duplicate dates
    dup_count = df.duplicated(subset=["trading_date"]).sum()
    if dup_count > 0:
        issues.append(f"  [WARN] {dup_count} duplicate dates, keeping last")
        df = df.drop_duplicates(subset=["trading_date"], keep="last")

    # 4. Volume = 0 (warn only, don't remove -- some days have 0 volume legitimately)
    zero_vol = (df["volume"] == 0).sum()
    if zero_vol > 0:
        issues.append(f"  [INFO] {zero_vol} rows with volume=0 (kept)")

    # 5. Price spike > 50% in 1 day (potential split-adjustment anomaly)
    if len(df) > 1:
        df = df.sort_values("trading_date").reset_index(drop=True)
        pct_change = df["close_price"].pct_change().abs()
        spikes = pct_change[pct_change > 0.5]
        if len(spikes) > 0:
            spike_dates = df.loc[spikes.index, "trading_date"].tolist()
            issues.append(f"  [WARN] {len(spikes)} price spike(s) >50%: {spike_dates[:3]}...")

    # 6. Date ordering
    if not df["trading_date"].is_monotonic_increasing:
        issues.append(f"  [INFO] Dates not sorted, sorting now")
        df = df.sort_values("trading_date").reset_index(drop=True)

    # Summary
    removed = original_len - len(df)
    if removed > 0:
        issues.append(f"  [INFO] Removed {removed} rows ({original_len} -> {len(df)})")

    return df, issues


def upsert_to_db(engine, stock_id, ticker, df):
    """
    [P1-04] Upsert OHLCV data into stock_price_history.
    Uses INSERT ... ON DUPLICATE KEY UPDATE for idempotent imports.
    """
    if df.empty:
        return 0

    upsert_sql = text("""
        INSERT INTO stock_price_history
            (stock_id, trading_date, open_price, high_price, low_price, close_price, volume)
        VALUES
            (:stock_id, :trading_date, :open_price, :high_price, :low_price, :close_price, :volume)
        ON DUPLICATE KEY UPDATE
            open_price = VALUES(open_price),
            high_price = VALUES(high_price),
            low_price = VALUES(low_price),
            close_price = VALUES(close_price),
            volume = VALUES(volume)
    """)

    rows_affected = 0
    with engine.begin() as conn:
        for _, row in df.iterrows():
            conn.execute(upsert_sql, {
                "stock_id": stock_id,
                "trading_date": row["trading_date"],
                "open_price": float(row["open_price"]),
                "high_price": float(row["high_price"]),
                "low_price": float(row["low_price"]),
                "close_price": float(row["close_price"]),
                "volume": int(row["volume"]),
            })
            rows_affected += 1

    return rows_affected


def main():
    print("=" * 60)
    print("StockLab ML -- OHLCV Data Import")
    print(f"Date range: {START_DATE} -> {END_DATE}")
    print("=" * 60)
    print()

    engine = create_engine(LARAGON_DB_URL)

    # Test connection
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    print("[OK] Connected to Laragon MySQL (port 3306)")
    print()

    # Get stocks
    stocks = get_stock_list(engine)
    print(f"Found {len(stocks)} stocks to import")
    print()

    # Track results
    results = []
    total_rows = 0
    failed = []

    for i, (stock_id, ticker) in enumerate(stocks, 1):
        print(f"[{i:2d}/{len(stocks)}] {ticker}...", end=" ", flush=True)

        try:
            # Pull
            df = pull_ohlcv(ticker, START_DATE, END_DATE)
            if df is None or df.empty:
                print("NO DATA")
                failed.append((ticker, "No data returned"))
                continue

            # Validate
            df, issues = validate_data(df, ticker)
            if issues:
                print()
                for issue in issues:
                    print(issue)

            # Upsert
            rows = upsert_to_db(engine, stock_id, ticker, df)
            total_rows += rows
            results.append((ticker, rows, len(issues)))
            print(f"{rows} rows OK")

        except Exception as e:
            print(f"FAILED: {e}")
            failed.append((ticker, str(e)))

        # Rate limit
        if i < len(stocks):
            time.sleep(RATE_LIMIT_DELAY)

    # Summary
    print()
    print("=" * 60)
    print("IMPORT SUMMARY")
    print("=" * 60)
    print(f"  Stocks processed: {len(results)}/{len(stocks)}")
    print(f"  Total rows upserted: {total_rows:,}")
    if failed:
        print(f"  Failed: {len(failed)}")
        for ticker, reason in failed:
            print(f"    - {ticker}: {reason}")

    # Verify
    print()
    print("--- Verification ---")
    with engine.connect() as conn:
        total = conn.execute(text("SELECT COUNT(*) FROM stock_price_history")).scalar()
        stocks_with_data = conn.execute(
            text("""
                SELECT s.ticker, COUNT(*) as cnt,
                       MIN(sph.trading_date) as min_date,
                       MAX(sph.trading_date) as max_date
                FROM stock_price_history sph
                JOIN stocks s ON s.id = sph.stock_id
                GROUP BY s.ticker
                ORDER BY s.ticker
            """)
        ).fetchall()

    print(f"  Total rows in stock_price_history: {total:,}")
    print(f"  Stocks with data: {len(stocks_with_data)}")
    print()
    print(f"  {'Ticker':<8} {'Rows':>6} {'From':>12} {'To':>12}")
    print(f"  {'-'*8} {'-'*6} {'-'*12} {'-'*12}")
    for row in stocks_with_data:
        print(f"  {row[0]:<8} {row[1]:>6} {str(row[2]):>12} {str(row[3]):>12}")

    if failed:
        sys.exit(1)
    print()
    print("[PASS] Import complete!")


if __name__ == "__main__":
    main()
