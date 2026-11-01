import logging
import socket

import redis
from fastapi import APIRouter, Response, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.deps import AppSettings, DbSession, RedisClient
from app.schemas import ReadyOut, VersionOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/health/live")
def live() -> dict[str, str]:
    """Liveness: the process is up. Never touches dependencies, so a database
    outage does not make Kubernetes restart the pod."""
    return {"status": "alive"}


@router.get("/health/ready", response_model=ReadyOut)
def ready(response: Response, db: DbSession, r: RedisClient) -> ReadyOut:
    """Readiness: can we serve traffic? Returns 503 when Postgres or Redis is down."""
    checks: dict[str, str] = {}

    try:
        db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except SQLAlchemyError:
        logger.warning("readiness: database check failed")
        checks["database"] = "error"

    try:
        r.ping()
        checks["redis"] = "ok"
    except redis.RedisError:
        logger.warning("readiness: redis check failed")
        checks["redis"] = "error"

    is_ready = all(value == "ok" for value in checks.values())
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return ReadyOut(status="ready" if is_ready else "not_ready", checks=checks)


@router.get("/version", response_model=VersionOut)
def version(settings: AppSettings) -> VersionOut:
    # In Kubernetes the hostname is the pod name.
    return VersionOut(
        version=settings.app_version, hostname=socket.gethostname(), env=settings.app_env
    )
