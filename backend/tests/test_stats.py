from datetime import date, timedelta

from app.cache import STATS_CACHE_KEY


def create(client, **fields):
    response = client.post("/api/tasks", json={"title": "task", **fields})
    assert response.status_code == 201
    return response.json()


def test_stats_on_empty_database(client):
    stats = client.get("/api/stats").json()
    assert stats["total"] == 0
    assert stats["by_status"] == {"todo": 0, "in_progress": 0, "done": 0}
    assert stats["by_priority"] == {"low": 0, "medium": 0, "high": 0}
    assert stats["overdue"] == 0
    assert stats["cached"] is False


def test_stats_counts(client):
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()

    create(client, status="todo", priority="high", due_date=yesterday)  # overdue
    create(client, status="in_progress", priority="high")
    create(client, status="done", priority="low", due_date=yesterday)  # done: not overdue
    create(client, status="todo", due_date=tomorrow)

    stats = client.get("/api/stats").json()
    assert stats["total"] == 4
    assert stats["by_status"] == {"todo": 2, "in_progress": 1, "done": 1}
    assert stats["by_priority"] == {"low": 1, "medium": 1, "high": 2}
    assert stats["overdue"] == 1


def test_second_request_is_served_from_cache_with_ttl(client, fake_redis):
    create(client)

    first = client.get("/api/stats").json()
    second = client.get("/api/stats").json()

    assert first["cached"] is False
    assert second["cached"] is True
    assert second["total"] == first["total"] == 1
    assert 0 < fake_redis.ttl(STATS_CACHE_KEY) <= 30


def test_cache_is_refreshed_after_a_write(client):
    create(client)
    client.get("/api/stats")  # fills the cache

    create(client)
    stats = client.get("/api/stats").json()

    assert stats["cached"] is False
    assert stats["total"] == 2


def test_stats_fall_back_to_database_when_redis_is_down(broken_redis_client):
    create(broken_redis_client)
    response = broken_redis_client.get("/api/stats")
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["cached"] is False
