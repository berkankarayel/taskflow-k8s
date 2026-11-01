"""Queue consumer: BRPOP task_events -> INSERT activity_log.

Run with: python -m app.main
"""

import logging
import signal
import threading
from pathlib import Path

import redis
from redis.backoff import NoBackoff
from redis.retry import Retry
from sqlalchemy import Engine, insert
from sqlalchemy.exc import SQLAlchemyError

from app.config import Settings, get_settings
from app.db import activity_log, build_engine
from app.events import QUEUE, TaskEvent, build_message, parse_event
from app.logging_config import setup_logging

logger = logging.getLogger("taskflow.worker")

RETRY_DELAY_SECONDS = 2


class Worker:
    def __init__(
        self, r: redis.Redis, engine: Engine, heartbeat_file: Path, block_seconds: int
    ) -> None:
        self.redis = r
        self.engine = engine
        self.heartbeat_file = heartbeat_file
        self.block_seconds = block_seconds
        self._stop = threading.Event()

    def stop(self, signum: int | None = None, _frame: object = None) -> None:
        name = signal.Signals(signum).name if signum else "stop()"
        logger.info("received %s, finishing current event and shutting down", name)
        self._stop.set()

    def beat(self) -> None:
        # The exec livenessProbe checks how old this file is.
        self.heartbeat_file.touch()

    def run(self) -> None:
        logger.info("listening on redis list %r", QUEUE)
        while not self._stop.is_set():
            self.beat()
            try:
                self.process_next()
            except redis.RedisError as exc:
                logger.warning("redis unavailable (%s), retrying in %ss", exc, RETRY_DELAY_SECONDS)
                self._stop.wait(RETRY_DELAY_SECONDS)
            except SQLAlchemyError as exc:
                logger.warning(
                    "database unavailable (%s), retrying in %ss", exc, RETRY_DELAY_SECONDS
                )
                self._stop.wait(RETRY_DELAY_SECONDS)
        logger.info("worker stopped")

    def process_next(self) -> bool:
        """Handle one event. Returns False when the queue stayed empty."""
        item = self.redis.brpop([QUEUE], timeout=self.block_seconds)
        if item is None:
            return False

        _, raw = item
        event = parse_event(raw)
        if event is None:
            logger.warning("dropping malformed event: %.200r", raw)
            return True

        try:
            self.store(event)
        except SQLAlchemyError:
            # Put it back at the tail so it is the next one BRPOP returns.
            self.redis.rpush(QUEUE, raw)
            raise
        return True

    def store(self, event: TaskEvent) -> None:
        values = {
            "task_id": event.task_id,
            "action": event.action,
            "message": build_message(event),
        }
        if event.occurred_at is not None:
            values["created_at"] = event.occurred_at
        with self.engine.begin() as conn:
            conn.execute(insert(activity_log).values(**values))
        logger.info("stored %s event for task %s", event.action, event.task_id)


def build_redis(settings: Settings) -> redis.Redis:
    return redis.Redis(
        host=settings.redis_host,
        port=settings.redis_port,
        password=settings.redis_password or None,
        decode_responses=True,
        socket_connect_timeout=2,
        # Must be longer than the BRPOP block time, or every idle wait times out.
        socket_timeout=settings.queue_block_seconds + 5,
        retry=Retry(NoBackoff(), retries=1),
    )


def main() -> None:
    settings = get_settings()
    setup_logging(settings.log_level)
    logger.info("TaskFlow worker %s starting", settings.app_version)

    r = build_redis(settings)
    engine = build_engine(settings)
    worker = Worker(r, engine, Path(settings.heartbeat_file), settings.queue_block_seconds)
    signal.signal(signal.SIGTERM, worker.stop)
    signal.signal(signal.SIGINT, worker.stop)

    try:
        worker.run()
    finally:
        engine.dispose()
        r.close()


if __name__ == "__main__":
    main()
