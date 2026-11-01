import logging
import sys


def setup_logging(level: str) -> None:
    logging.basicConfig(
        level=level.upper(),
        stream=sys.stdout,
        format="%(asctime)s %(levelname)-7s [%(name)s] %(message)s",
        force=True,
    )
