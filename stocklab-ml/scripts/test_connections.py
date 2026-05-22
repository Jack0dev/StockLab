#!/usr/bin/env python3
"""
StockLab ML — Test Connections
[P0-03] Verify MySQL and Redis are accessible from Python.

Usage:
    cd stocklab-ml
    python scripts/test_connections.py
"""
import sys
import os

# Add parent dir to path so we can import config
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import settings


def test_mysql():
    """Test MySQL connection via SQLAlchemy."""
    try:
        from sqlalchemy import create_engine, text

        engine = create_engine(settings.DATABASE_URL)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1 AS ok"))
            row = result.fetchone()
            assert row[0] == 1

            # Check ML tables exist
            result = conn.execute(text("SHOW TABLES LIKE 'ml_%'"))
            tables = [r[0] for r in result.fetchall()]

        print(f"[OK] MySQL connected -> {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}")
        print(f"     ML tables found: {tables}")
        return True
    except Exception as e:
        print(f"[FAIL] MySQL -> {e}")
        return False


def test_redis():
    """Test Redis connection."""
    try:
        import redis

        r = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            decode_responses=True,
            socket_connect_timeout=5,
        )
        pong = r.ping()
        assert pong is True

        # Quick write/read test
        r.set("stocklab:test", "ok", ex=10)
        val = r.get("stocklab:test")
        assert val == "ok"
        r.delete("stocklab:test")

        print(f"[OK] Redis connected -> {settings.REDIS_HOST}:{settings.REDIS_PORT}")
        return True
    except Exception as e:
        print(f"[FAIL] Redis -> {e}")
        return False


def main():
    print("=" * 50)
    print("StockLab ML -- Connection Test")
    print("=" * 50)
    print()

    results = []
    results.append(("MySQL", test_mysql()))
    print()
    results.append(("Redis", test_redis()))

    print()
    print("-" * 50)
    all_ok = all(r[1] for r in results)
    if all_ok:
        print("[PASS] All connections OK! Ready for Phase 1.")
    else:
        failed = [r[0] for r in results if not r[1]]
        print(f"[FAIL] Failed: {', '.join(failed)}")
        print("   Check docker compose status: docker ps")
        sys.exit(1)


if __name__ == "__main__":
    main()
