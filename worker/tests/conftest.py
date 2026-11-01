"""Test setup: SQLite in memory instead of Postgres, fakeredis instead of Redis."""

from collections.abc import Iterator

import fakeredis
import pytest
import redis
from sqlalchemy import Engine, create_engine, select
from sqlalchemy.pool import StaticPool

from app.db import activity_log, metadata
from app.main import Worker


class BrokenRedis:
    """Behaves like a Redis server that is down: every command raises."""

    def __getattr__(self, name: str):
        def _fail(*args, **kwargs):
            raise redis.ConnectionError("redis is down")

        return _fail


def _sqlite_engine() -> Engine:
    return create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )


@pytest.fixture
def engine() -> Iterator[Engine]:
    engine = _sqlite_engine()
    metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def engine_without_schema() -> Iterator[Engine]:
    """Every insert fails, like a database that is unreachable."""
    engine = _sqlite_engine()
    yield engine
    engine.dispose()


@pytest.fixture
def fake_redis() -> fakeredis.FakeRedis:
    return fakeredis.FakeRedis(decode_responses=True)


@pytest.fixture
def worker(fake_redis, engine, tmp_path) -> Worker:
    return Worker(fake_redis, engine, tmp_path / "heartbeat", block_seconds=1)


def stored_rows(engine: Engine) -> list[dict]:
    with engine.connect() as conn:
        rows = conn.execute(select(activity_log).order_by(activity_log.c.id))
        return [dict(row._mapping) for row in rows]
