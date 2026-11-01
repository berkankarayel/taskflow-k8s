from datetime import UTC, datetime, timedelta

import pytest

from app.models import ActivityLog


@pytest.fixture
def seeded(db_session):
    now = datetime.now(UTC)
    rows = [
        ActivityLog(
            task_id=i,
            action="created",
            message=f"task {i} created",
            created_at=now - timedelta(minutes=10 - i),
        )
        for i in range(1, 6)
    ]
    db_session.add_all(rows)
    db_session.commit()


def test_activity_is_empty_by_default(client):
    response = client.get("/api/activity")
    assert response.status_code == 200
    assert response.json() == []


def test_activity_newest_first(client, seeded):
    items = client.get("/api/activity").json()
    assert [item["task_id"] for item in items] == [5, 4, 3, 2, 1]
    assert set(items[0]) == {"id", "task_id", "action", "message", "created_at"}


def test_activity_limit(client, seeded):
    items = client.get("/api/activity", params={"limit": 2}).json()
    assert [item["task_id"] for item in items] == [5, 4]


@pytest.mark.parametrize("limit", [0, 201, "abc"])
def test_activity_rejects_invalid_limit(client, limit):
    assert client.get("/api/activity", params={"limit": limit}).status_code == 422
