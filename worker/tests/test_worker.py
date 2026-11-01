import json
import threading
import time
from datetime import UTC, datetime

import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.events import QUEUE
from app.main import Worker
from tests.conftest import BrokenRedis, stored_rows


def publish(fake_redis, **fields) -> str:
    """Publish the way the backend does: LPUSH to the head of the list."""
    event = json.dumps({"action": "created", "task_id": 1, "title": "Task", **fields})
    fake_redis.lpush(QUEUE, event)
    return event


def wait_until(condition, timeout: float = 5.0) -> None:
    deadline = time.monotonic() + timeout
    while not condition():
        if time.monotonic() > deadline:
            raise AssertionError("condition not met in time")
        time.sleep(0.05)


def test_event_is_stored_in_activity_log(worker, fake_redis, engine):
    publish(
        fake_redis,
        action="updated",
        task_id=7,
        title="Write tests",
        occurred_at="2026-11-01T10:00:00+00:00",
    )

    assert worker.process_next() is True

    [row] = stored_rows(engine)
    assert row["task_id"] == 7
    assert row["action"] == "updated"
    assert row["message"] == "Task updated: Write tests"
    # The time the change happened, not the time the worker got to it.
    assert row["created_at"].replace(tzinfo=UTC) == datetime(2026, 11, 1, 10, 0, tzinfo=UTC)
    assert fake_redis.llen(QUEUE) == 0


def test_event_without_timestamp_uses_database_time(worker, fake_redis, engine):
    publish(fake_redis)
    worker.process_next()
    assert stored_rows(engine)[0]["created_at"] is not None


def test_empty_queue_returns_false(worker, engine):
    assert worker.process_next() is False
    assert stored_rows(engine) == []


def test_events_are_processed_in_publish_order(worker, fake_redis, engine):
    for task_id in (1, 2, 3):
        publish(fake_redis, task_id=task_id)

    while worker.process_next():
        pass

    assert [row["task_id"] for row in stored_rows(engine)] == [1, 2, 3]


def test_malformed_event_is_dropped(worker, fake_redis, engine):
    fake_redis.lpush(QUEUE, "not json")
    publish(fake_redis, task_id=2)

    assert worker.process_next() is True  # dropped
    assert worker.process_next() is True  # the valid one

    assert [row["task_id"] for row in stored_rows(engine)] == [2]
    assert fake_redis.llen(QUEUE) == 0


def test_event_is_requeued_when_database_fails(fake_redis, engine_without_schema, tmp_path):
    worker = Worker(fake_redis, engine_without_schema, tmp_path / "hb", block_seconds=1)
    publish(fake_redis, task_id=1)
    publish(fake_redis, task_id=2)

    with pytest.raises(SQLAlchemyError):
        worker.process_next()

    # Nothing lost, and task 1 is still the next one out.
    assert fake_redis.llen(QUEUE) == 2
    assert json.loads(fake_redis.rpop(QUEUE))["task_id"] == 1


def test_beat_writes_heartbeat_file(worker):
    assert not worker.heartbeat_file.exists()
    worker.beat()
    assert worker.heartbeat_file.exists()


def test_run_processes_events_and_stops_cleanly(worker, fake_redis, engine):
    thread = threading.Thread(target=worker.run)
    thread.start()

    publish(fake_redis, task_id=42)
    wait_until(lambda: len(stored_rows(engine)) == 1)

    worker.stop()
    thread.join(timeout=5)

    assert not thread.is_alive()
    assert worker.heartbeat_file.exists()
    assert stored_rows(engine)[0]["task_id"] == 42


def test_run_survives_redis_outage(engine, tmp_path):
    worker = Worker(BrokenRedis(), engine, tmp_path / "hb", block_seconds=1)
    thread = threading.Thread(target=worker.run)
    thread.start()

    wait_until(worker.heartbeat_file.exists)
    assert thread.is_alive()  # still looping, waiting for Redis to come back

    worker.stop()  # also interrupts the retry wait
    thread.join(timeout=5)
    assert not thread.is_alive()
