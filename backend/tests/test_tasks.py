import json

import pytest

from app.cache import STATS_CACHE_KEY
from app.events import TASK_EVENTS_QUEUE


def create(client, **fields):
    body = {"title": "Write backend", **fields}
    response = client.post("/api/tasks", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def queued_events(fake_redis):
    # LPUSH adds to the head, the worker BRPOPs from the tail: oldest is last.
    return [json.loads(raw) for raw in reversed(fake_redis.lrange(TASK_EVENTS_QUEUE, 0, -1))]


def test_create_task_uses_defaults(client):
    task = create(client)
    assert task["id"] > 0
    assert task["title"] == "Write backend"
    assert task["status"] == "todo"
    assert task["priority"] == "medium"
    assert task["description"] is None
    assert task["due_date"] is None
    assert task["created_at"] and task["updated_at"]


def test_create_task_with_all_fields(client):
    task = create(
        client,
        title="  Deploy to minikube  ",
        description="Use a Deployment",
        status="in_progress",
        priority="high",
        due_date="2026-12-31",
    )
    assert task["title"] == "Deploy to minikube"
    assert task["status"] == "in_progress"
    assert task["priority"] == "high"
    assert task["due_date"] == "2026-12-31"


def test_empty_description_is_stored_as_null(client):
    assert create(client, description="   ")["description"] is None


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"title": ""},
        {"title": "   "},
        {"title": "x" * 201},
        {"title": "ok", "status": "blocked"},
        {"title": "ok", "priority": "urgent"},
        {"title": "ok", "due_date": "not-a-date"},
    ],
)
def test_create_task_rejects_invalid_input(client, body):
    assert client.post("/api/tasks", json=body).status_code == 422


def test_get_task(client):
    task = create(client)
    response = client.get(f"/api/tasks/{task['id']}")
    assert response.status_code == 200
    assert response.json() == task


def test_get_missing_task_returns_404(client):
    response = client.get("/api/tasks/999")
    assert response.status_code == 404
    assert response.json() == {"detail": "Task not found"}


def test_list_tasks_newest_first_and_filter_by_status(client):
    first = create(client, title="first")
    second = create(client, title="second", status="done")
    third = create(client, title="third")

    all_ids = [t["id"] for t in client.get("/api/tasks").json()]
    assert all_ids == [third["id"], second["id"], first["id"]]

    todo_ids = [t["id"] for t in client.get("/api/tasks", params={"status": "todo"}).json()]
    assert todo_ids == [third["id"], first["id"]]

    assert client.get("/api/tasks", params={"status": "blocked"}).status_code == 422


def test_update_task_replaces_fields(client):
    task = create(client, description="old")
    body = {"title": "Renamed", "status": "done", "priority": "low"}

    response = client.put(f"/api/tasks/{task['id']}", json=body)

    assert response.status_code == 200
    updated = response.json()
    assert updated["title"] == "Renamed"
    assert updated["status"] == "done"
    assert updated["priority"] == "low"
    assert updated["description"] is None  # PUT is a full replacement


def test_update_missing_task_returns_404(client):
    assert client.put("/api/tasks/999", json={"title": "x"}).status_code == 404


def test_delete_task(client):
    task = create(client)
    assert client.delete(f"/api/tasks/{task['id']}").status_code == 204
    assert client.get(f"/api/tasks/{task['id']}").status_code == 404
    assert client.delete(f"/api/tasks/{task['id']}").status_code == 404


def test_writes_publish_events_in_order(client, fake_redis):
    task = create(client, title="Queue me")
    client.put(f"/api/tasks/{task['id']}", json={"title": "Queue me v2"})
    client.delete(f"/api/tasks/{task['id']}")

    events = queued_events(fake_redis)
    assert [(e["action"], e["task_id"], e["title"]) for e in events] == [
        ("created", task["id"], "Queue me"),
        ("updated", task["id"], "Queue me v2"),
        ("deleted", task["id"], "Queue me v2"),
    ]
    assert all(e["occurred_at"] for e in events)


def test_reads_do_not_publish_events(client, fake_redis):
    task = create(client)
    fake_redis.delete(TASK_EVENTS_QUEUE)
    client.get("/api/tasks")
    client.get(f"/api/tasks/{task['id']}")
    assert fake_redis.llen(TASK_EVENTS_QUEUE) == 0


@pytest.mark.parametrize("action", ["create", "update", "delete"])
def test_writes_invalidate_stats_cache(client, fake_redis, action):
    task = create(client)
    fake_redis.set(STATS_CACHE_KEY, "{}")

    if action == "create":
        create(client)
    elif action == "update":
        client.put(f"/api/tasks/{task['id']}", json={"title": "changed"})
    else:
        client.delete(f"/api/tasks/{task['id']}")

    assert fake_redis.get(STATS_CACHE_KEY) is None


def test_writes_still_succeed_when_redis_is_down(broken_redis_client):
    client = broken_redis_client
    task = create(client)
    assert client.put(f"/api/tasks/{task['id']}", json={"title": "x"}).status_code == 200
    assert client.delete(f"/api/tasks/{task['id']}").status_code == 204
