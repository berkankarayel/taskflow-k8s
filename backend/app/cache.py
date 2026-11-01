"""Stats cache. Redis problems are logged and ignored: the API falls back to
Postgres instead of failing the request."""

import json
import logging
from typing import Any

import redis

logger = logging.getLogger(__name__)

STATS_CACHE_KEY = "stats"


def get_cached_stats(r: redis.Redis) -> dict[str, Any] | None:
    try:
        raw = r.get(STATS_CACHE_KEY)
    except redis.RedisError:
        logger.warning("stats cache read failed, falling back to database")
        return None
    return json.loads(raw) if raw else None


def set_cached_stats(r: redis.Redis, stats: dict[str, Any], ttl_seconds: int) -> None:
    try:
        r.set(STATS_CACHE_KEY, json.dumps(stats, default=str), ex=ttl_seconds)
    except redis.RedisError:
        logger.warning("stats cache write failed")


def invalidate_stats(r: redis.Redis) -> None:
    try:
        r.delete(STATS_CACHE_KEY)
    except redis.RedisError:
        logger.warning("stats cache invalidation failed")
