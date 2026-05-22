#!/usr/bin/env python3
"""
StockLab ML -- Feature Store (Redis)
[P1-10] Redis key schema with versioning.
[P1-11] Push latest features from MySQL to Redis.
[P1-12] Verify: read back from Redis and compare with MySQL.

Redis key schema:
    features:v1:{SYMBOL}  ->  JSON { rsi_14, macd, sma_20, ... }

Usage:
    cd stocklab-ml
    set PYTHONIOENCODING=utf-8
    .venv\\Scripts\\python.exe features/feature_store.py
"""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import redis
from sqlalchemy import create_engine, text

# --- Config ---
LARAGON_DB_URL = "mysql+pymysql://root:@localhost:3306/stock_lap?charset=utf8mb4"
REDIS_HOST = "localhost"
REDIS_PORT = 6380  # Docker Redis
FEATURE_VERSION = "v1"
FEATURE_TTL = 86400  # 24 hours


FEATURE_COLUMNS = [
    "sma_10", "sma_20", "sma_50", "ema_12", "ema_26",
    "rsi_14", "macd", "macd_signal", "bb_upper", "bb_lower",
    "atr_14", "returns_1d", "returns_5d", "volatility_20d",
    "volume_change_1d", "momentum_10"
]


def get_latest_features(engine):
    """Get the latest feature row for each stock from MySQL."""
    query = text("""
        SELECT s.ticker, s.id as stock_id, mf.*
        FROM ml_features mf
        JOIN stocks s ON s.id = mf.stock_id
        INNER JOIN (
            SELECT stock_id, MAX(trading_date) as max_date
            FROM ml_features
            GROUP BY stock_id
        ) latest ON mf.stock_id = latest.stock_id AND mf.trading_date = latest.max_date
        ORDER BY s.ticker
    """)
    with engine.connect() as conn:
        rows = conn.execute(query).mappings().all()
    return rows


def push_to_redis(r, features_rows):
    """Push latest features to Redis with versioning."""
    pushed = 0
    for row in features_rows:
        ticker = row["ticker"]
        key = f"features:{FEATURE_VERSION}:{ticker}"

        data = {
            "symbol": ticker,
            "stock_id": int(row["stock_id"]),
            "trading_date": str(row["trading_date"]),
            "version": FEATURE_VERSION,
        }
        for col in FEATURE_COLUMNS:
            val = row[col]
            data[col] = round(float(val), 6) if val is not None else None

        r.set(key, json.dumps(data), ex=FEATURE_TTL)
        pushed += 1

    return pushed


def verify_redis(r, engine):
    """Read back from Redis and compare with MySQL values."""
    issues = []
    engine_features = get_latest_features(engine)

    for row in engine_features:
        ticker = row["ticker"]
        key = f"features:{FEATURE_VERSION}:{ticker}"
        cached = r.get(key)

        if cached is None:
            issues.append(f"  [MISS] {ticker}: not found in Redis")
            continue

        data = json.loads(cached)

        # Compare a few key features
        for col in ["rsi_14", "macd", "sma_20"]:
            mysql_val = round(float(row[col]), 4) if row[col] is not None else None
            redis_val = round(data.get(col, 0), 4) if data.get(col) is not None else None
            if mysql_val != redis_val:
                issues.append(f"  [DIFF] {ticker}.{col}: MySQL={mysql_val} Redis={redis_val}")

    return issues


def main():
    print("=" * 60)
    print("StockLab ML -- Feature Store (Redis)")
    print("=" * 60)
    print()

    engine = create_engine(LARAGON_DB_URL)
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True, socket_connect_timeout=5)

    # Test Redis
    r.ping()
    print(f"[OK] Redis connected -> {REDIS_HOST}:{REDIS_PORT}")
    print()

    # Get latest features from MySQL
    features = get_latest_features(engine)
    print(f"Found latest features for {len(features)} stocks")

    # Push to Redis
    pushed = push_to_redis(r, features)
    print(f"Pushed {pushed} feature sets to Redis")
    print(f"Key schema: features:{FEATURE_VERSION}:{{SYMBOL}}")
    print(f"TTL: {FEATURE_TTL}s ({FEATURE_TTL//3600}h)")
    print()

    # Verify
    print("--- Verification ---")
    issues = verify_redis(r, engine)
    if not issues:
        print("[PASS] All Redis values match MySQL!")
    else:
        for issue in issues:
            print(issue)

    # Show sample
    print()
    print("Sample (features:v1:VCB):")
    vcb = r.get(f"features:{FEATURE_VERSION}:VCB")
    if vcb:
        data = json.loads(vcb)
        for k, v in data.items():
            print(f"  {k}: {v}")

    # List all keys
    print()
    keys = sorted(r.keys(f"features:{FEATURE_VERSION}:*"))
    print(f"Total Redis keys: {len(keys)}")
    print(f"Keys: {[k.split(':')[-1] for k in keys]}")


if __name__ == "__main__":
    main()
