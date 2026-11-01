import json
from datetime import UTC, datetime

import pytest

from app.events import TaskEvent, build_message, parse_event


def raw(**fields) -> str:
    event = {"action": "created", "task_id": 5, "title": "Write worker", **fields}
    return json.dumps(event)


def test_parse_valid_event():
    event = parse_event(raw(occurred_at="2026-11-01T10:00:00+00:00"))
    assert event == TaskEvent(
        action="created",
        task_id=5,
        title="Write worker",
        occurred_at=datetime(2026, 11, 1, 10, 0, tzinfo=UTC),
    )


@pytest.mark.parametrize("occurred_at", [None, "yesterday", 123])
def test_missing_or_invalid_timestamp_becomes_none(occurred_at):
    event = parse_event(raw(occurred_at=occurred_at))
    assert event is not None
    assert event.occurred_at is None


@pytest.mark.parametrize(
    "payload",
    [
        "not json",
        "[]",
        "null",
        raw(action="archived"),
        raw(action=None),
        raw(task_id="5"),
        raw(task_id=True),
        raw(task_id=None),
        raw(title=None),
        json.dumps({"action": "created", "title": "missing id"}),
    ],
)
def test_malformed_events_are_rejected(payload):
    assert parse_event(payload) is None


@pytest.mark.parametrize("action", ["created", "updated", "deleted"])
def test_build_message(action):
    event = TaskEvent(action=action, task_id=1, title="Deploy", occurred_at=None)
    assert build_message(event) == f"Task {action}: Deploy"


def test_build_message_with_quotes_in_title():
    event = TaskEvent(action="created", task_id=1, title='Deploy "v1"', occurred_at=None)
    assert build_message(event) == 'Task created: Deploy "v1"'
