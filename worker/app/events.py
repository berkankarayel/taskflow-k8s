"""Parses events published by the backend (app/events.py there).

Example: {"action": "created", "task_id": 5, "title": "...", "occurred_at": "<ISO 8601>"}
"""

import json
from dataclasses import dataclass
from datetime import datetime

QUEUE = "task_events"
ACTIONS = {"created", "updated", "deleted"}


@dataclass(frozen=True)
class TaskEvent:
    action: str
    task_id: int
    title: str
    occurred_at: datetime | None


def parse_event(raw: str) -> TaskEvent | None:
    """Return None for anything malformed, so a bad message is dropped instead
    of crashing the worker."""
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return None
    if not isinstance(data, dict):
        return None

    action = data.get("action")
    task_id = data.get("task_id")
    title = data.get("title")
    if action not in ACTIONS:
        return None
    # bool is a subclass of int; reject it explicitly.
    if not isinstance(task_id, int) or isinstance(task_id, bool):
        return None
    if not isinstance(title, str):
        return None

    return TaskEvent(action, task_id, title, _parse_timestamp(data.get("occurred_at")))


def _parse_timestamp(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def build_message(event: TaskEvent) -> str:
    # No quotes around the title: titles may contain quotes themselves.
    return f"Task {event.action}: {event.title}"
