from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import insert

from app import cleanup
from app.config import get_settings
from app.db import activity_log
from tests.conftest import stored_rows

NOW = datetime(2026, 11, 1, 12, 0, tzinfo=UTC)


@pytest.fixture
def seeded(engine):
    with engine.begin() as conn:
        for task_id, days_ago in [(1, 10), (2, 8), (3, 6), (4, 0)]:
            conn.execute(
                insert(activity_log).values(
                    task_id=task_id,
                    action="created",
                    message=f"task {task_id}",
                    created_at=NOW - timedelta(days=days_ago),
                )
            )


def test_deletes_only_rows_older_than_retention(engine, seeded):
    deleted = cleanup.delete_old_activity(engine, retention_days=7, now=NOW)

    assert deleted == 2
    assert [row["task_id"] for row in stored_rows(engine)] == [3, 4]


def test_nothing_to_delete(engine, seeded):
    assert cleanup.delete_old_activity(engine, retention_days=30, now=NOW) == 0
    assert len(stored_rows(engine)) == 4


@pytest.fixture
def worker_env(monkeypatch):
    for name, value in {
        "DB_HOST": "unused",
        "DB_NAME": "unused",
        "DB_USER": "unused",
        "DB_PASSWORD": "unused",
        "REDIS_HOST": "unused",
        "ACTIVITY_RETENTION_DAYS": "7",
    }.items():
        monkeypatch.setenv(name, value)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_main_exits_zero_on_success(worker_env, engine, monkeypatch):
    monkeypatch.setattr(cleanup, "build_engine", lambda settings: engine)
    assert cleanup.main() == 0


def test_main_exits_non_zero_when_database_fails(worker_env, engine_without_schema, monkeypatch):
    monkeypatch.setattr(cleanup, "build_engine", lambda settings: engine_without_schema)
    assert cleanup.main() == 1
