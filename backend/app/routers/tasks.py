from typing import Annotated

import redis
from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cache import invalidate_stats
from app.deps import DbSession, RedisClient
from app.events import publish_task_event
from app.models import Task, TaskStatus
from app.schemas import TaskIn, TaskOut

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _get_task_or_404(db: Session, task_id: int) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


def _after_write(r: redis.Redis, action: str, task_id: int, title: str) -> None:
    invalidate_stats(r)
    publish_task_event(r, action, task_id, title)


@router.get("", response_model=list[TaskOut])
def list_tasks(
    db: DbSession,
    status_filter: Annotated[TaskStatus | None, Query(alias="status")] = None,
) -> list[Task]:
    stmt = select(Task).order_by(Task.id.desc())
    if status_filter is not None:
        stmt = stmt.where(Task.status == status_filter)
    return list(db.scalars(stmt))


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskIn, db: DbSession, r: RedisClient) -> Task:
    task = Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    _after_write(r, "created", task.id, task.title)
    return task


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: DbSession) -> Task:
    return _get_task_or_404(db, task_id)


@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskIn, db: DbSession, r: RedisClient) -> Task:
    task = _get_task_or_404(db, task_id)
    for field, value in payload.model_dump().items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    _after_write(r, "updated", task.id, task.title)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: DbSession, r: RedisClient) -> Response:
    task = _get_task_or_404(db, task_id)
    title = task.title
    db.delete(task)
    db.commit()
    _after_write(r, "deleted", task_id, title)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
