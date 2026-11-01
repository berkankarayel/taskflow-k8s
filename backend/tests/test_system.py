import socket
from collections.abc import Iterator

from sqlalchemy.exc import OperationalError

from app.db import get_db
from app.main import app


class BrokenSession:
    def execute(self, *args, **kwargs):
        raise OperationalError("SELECT 1", {}, Exception("database is down"))


def test_live_is_always_ok(client):
    response = client.get("/api/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "alive"}


def test_ready_when_dependencies_are_up(client):
    response = client.get("/api/health/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready", "checks": {"database": "ok", "redis": "ok"}}


def test_ready_returns_503_when_redis_is_down(broken_redis_client):
    response = broken_redis_client.get("/api/health/ready")
    assert response.status_code == 503
    assert response.json()["checks"] == {"database": "ok", "redis": "error"}


def test_ready_returns_503_when_database_is_down(client):
    def broken_db() -> Iterator[BrokenSession]:
        yield BrokenSession()

    app.dependency_overrides[get_db] = broken_db
    response = client.get("/api/health/ready")
    assert response.status_code == 503
    assert response.json()["checks"] == {"database": "error", "redis": "ok"}


def test_api_returns_503_when_database_is_down(client):
    def broken_db() -> Iterator[BrokenSession]:
        yield BrokenSession()

    app.dependency_overrides[get_db] = broken_db
    response = client.get("/api/stats")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}


def test_live_stays_ok_when_dependencies_are_down(broken_redis_client):
    assert broken_redis_client.get("/api/health/live").status_code == 200


def test_version_reports_version_and_hostname(client):
    response = client.get("/api/version")
    assert response.status_code == 200
    assert response.json() == {
        "version": "1.0.0-test",
        "hostname": socket.gethostname(),
        "env": "test",
    }
