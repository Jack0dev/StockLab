"""
StockLab ML Service — Database Connection (SQLAlchemy)
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from config.settings import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_recycle=3600,
    echo=False,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Session:
    """Get a database session. Use with context manager or try/finally."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
