import redis
from redis.backoff import NoBackoff
from redis.retry import Retry

from app.config import Settings, get_settings


def _build_client(settings: Settings) -> redis.Redis:
    return redis.Redis(
        host=settings.redis_host,
        port=settings.redis_port,
        password=settings.redis_password or None,
        decode_responses=True,
        socket_connect_timeout=1,
        socket_timeout=2,
        health_check_interval=30,
        # The default retries with exponential backoff, which made a request
        # hang for ~25s when Redis was down. Fail fast so probes stay quick.
        retry=Retry(NoBackoff(), retries=1),
    )


redis_client = _build_client(get_settings())


def get_redis() -> redis.Redis:
    return redis_client
