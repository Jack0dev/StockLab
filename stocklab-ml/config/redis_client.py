"""
StockLab ML Service — Redis Client
"""
import redis
from config.settings import settings

redis_client = redis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=0,
    decode_responses=True,  # Return strings instead of bytes
    socket_connect_timeout=5,
    retry_on_timeout=True,
)


def get_redis() -> redis.Redis:
    """Get the Redis client singleton."""
    return redis_client
