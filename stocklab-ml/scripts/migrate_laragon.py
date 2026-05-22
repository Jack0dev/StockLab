"""Quick script to create ML tables in Laragon MySQL."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sqlalchemy import create_engine, text

engine = create_engine("mysql+pymysql://root:@localhost:3306/stock_lap?charset=utf8mb4")

sql_path = os.path.join(os.path.dirname(__file__), "..", "..", "doc", "migrations", "001_ml_tables.sql")
with open(sql_path, "r") as f:
    sql = f.read()

with engine.begin() as conn:
    for stmt in sql.split(";"):
        stmt = stmt.strip()
        if stmt and not stmt.startswith("--"):
            try:
                conn.execute(text(stmt))
            except Exception as e:
                print(f"  (skip: {str(e)[:60]})")

with engine.connect() as conn:
    tables = conn.execute(text("SHOW TABLES")).fetchall()
    print("Tables in Laragon stock_lap:")
    for t in tables:
        print(f"  - {t[0]}")

print("\nDone!")
