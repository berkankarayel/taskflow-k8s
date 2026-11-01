"""Publishes task events to a Redis list; the worker consumes them with BRPOP."""

import json
import logging
from datetime import UTC, datetime

import redis

logger = logging.getLogger(__name__)

TASK_EVENTS_QUEUE = "task_events"


def publish_task_event(r: redis.Redis, action: str, task_id: int, title: str) -> None:
    payload = {
        "action": action,
        "task_id": task_id,
        "title": title,
        "occurred_at": datetime.now(UTC).isoformat(),
    }
    try:
        r.lpush(TASK_EVENTS_QUEUE, json.dumps(payload))
    except redis.RedisError:
        # The task is already committed; losing an activity entry is acceptable.
        logger.warning("could not publish %s event for task %s", action, task_id)
