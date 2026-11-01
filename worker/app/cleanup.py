"""Deletes activity_log rows older than ACTIVITY_RETENTION_DAYS, then exits.

Meant for a CronJob: python -m app.cleanup
A non-zero exit code marks the Job as failed so Kubernetes can retry it.
"""

import logging
import sys
from datetime import UTC, datetime, timedelta

from sqlalchemy import Engine, delete
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.db import activity_log, build_engine
from app.logging_config import setup_logging

logger = logging.getLogger("taskflow.cleanup")


def delete_old_activity(engine: Engine, retention_days: int, now: datetime | None = None) -> int:
    cutoff = (now or datetime.now(UTC)) - timedelta(days=retention_days)
    with engine.begin() as conn:
        result = conn.execute(delete(activity_log).where(activity_log.c.created_at < cutoff))
    return result.rowcount


def main() -> int:
    settings = get_settings()
    setup_logging(settings.log_level)
    engine = build_engine(settings)
    try:
        deleted = delete_old_activity(engine, settings.activity_retention_days)
    except SQLAlchemyError:
        logger.exception("cleanup failed")
        return 1
    finally:
        engine.dispose()

    logger.info(
        "deleted %d activity entries older than %d days",
        deleted,
        settings.activity_retention_days,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
