from datetime import UTC, date, datetime
from typing import Any

from fastapi import APIRouter
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.cache import get_cached_stats, set_cached_stats
from app.deps import AppSettings, DbSession, RedisClient
from app.models import Task, TaskPriority, TaskStatus
from app.schemas import StatsOut

router = APIRouter(prefix="/api", tags=["stats"])


def compute_stats(db: Session) -> dict[str, Any]:
    by_status = {s.value: 0 for s in TaskStatus}
    for task_status, count in db.execute(select(Task.status, func.count()).group_by(Task.status)):
        by_status[task_status.value] = count

    by_priority = {p.value: 0 for p in TaskPriority}
    for priority, count in db.execute(select(Task.priority, func.count()).group_by(Task.priority)):
        by_priority[priority.value] = count

    overdue = db.scalar(
        select(func.count())
        .select_from(Task)
        .where(Task.due_date < date.today(), Task.status != TaskStatus.DONE)
    )

    return {
        "total": sum(by_status.values()),
        "by_status": by_status,
        "by_priority": by_priority,
        "overdue": overdue or 0,
        "generated_at": datetime.now(UTC).isoformat(),
    }


@router.get("/stats", response_model=StatsOut)
def get_stats(db: DbSession, r: RedisClient, settings: AppSettings) -> dict[str, Any]:
    cached = get_cached_stats(r)
    if cached is not None:
        return {**cached, "cached": True}

    stats = compute_stats(db)
    set_cached_stats(r, stats, settings.cache_ttl_seconds)
    return {**stats, "cached": False}
