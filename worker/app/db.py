"""The worker only writes to activity_log. The schema itself is owned by the
backend's Alembic migrations; this table definition just mirrors it."""

from sqlalchemy import (
    Column,
    DateTime,
    Engine,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    func,
)

from app.config import Settings

metadata = MetaData()

activity_log = Table(
    "activity_log",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("task_id", Integer, nullable=False),
    Column("action", String(20), nullable=False),
    Column("message", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)


def build_engine(settings: Settings) -> Engine:
    return create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=2,
        max_overflow=0,
        connect_args={"connect_timeout": 2},
    )
