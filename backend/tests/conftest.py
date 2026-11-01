"""Test setup: SQLite in memory instead of Postgres, fakeredis instead of Redis.

Settings require these variables, so they must be set before importing the app.
Nothing connects to them: the real engine and Redis client are replaced below.
"""

import os

os.environ.update(
    {
        "APP_ENV": "test",
        "APP_VERSION": "1.0.0-test",
        "DB_HOST": "unused",
        "DB_NAME": "unused",
        "DB_USER": "unused",
        "DB_PASSWORD": "unused",
        "REDIS_HOST": "unused",
    }
)

from collections.abc import Iterator

import fakeredis
import pytest
import redis
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import get_db
from app.main import app
from app.models import Base
from app.redis_client import get_redis


class BrokenRedis:
    """Behaves like a Redis server that is down: every command raises."""

    def __getattr__(self, name: str):
        def _fail(*args, **kwargs):
            raise redis.ConnectionError("redis is down")

        return _fail


@pytest.fixture
def engine() -> Iterator[Engine]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture
def db_session(session_factory: sessionmaker[Session]) -> Iterator[Session]:
    with session_factory() as session:
        yield session


@pytest.fixture
def fake_redis() -> fakeredis.FakeRedis:
    return fakeredis.FakeRedis(decode_responses=True)


@pytest.fixture
def client(session_factory: sessionmaker[Session], fake_redis) -> Iterator[TestClient]:
    def override_get_db() -> Iterator[Session]:
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = lambda: fake_redis
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def broken_redis_client(client: TestClient) -> TestClient:
    app.dependency_overrides[get_redis] = lambda: BrokenRedis()
    return client
