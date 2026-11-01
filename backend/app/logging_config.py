import logging
import sys


class _HealthCheckFilter(logging.Filter):
    """Drop access-log lines for probe endpoints so container logs stay readable."""

    def filter(self, record: logging.LogRecord) -> bool:
        return "/api/health/" not in record.getMessage()


def setup_logging(level: str) -> None:
    logging.basicConfig(
        level=level.upper(),
        stream=sys.stdout,
        format="%(asctime)s %(levelname)-7s [%(name)s] %(message)s",
        force=True,
    )
    logging.getLogger("uvicorn.access").addFilter(_HealthCheckFilter())
