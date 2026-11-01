from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.deps import DbSession
from app.models import ActivityLog
from app.schemas import ActivityOut

router = APIRouter(prefix="/api", tags=["activity"])


@router.get("/activity", response_model=list[ActivityOut])
def list_activity(
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[ActivityLog]:
    stmt = (
        select(ActivityLog)
        .order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))
