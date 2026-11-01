"""Exit 0 if the worker loop touched its heartbeat file recently, 1 otherwise.

Used by the exec livenessProbe: python -m app.healthcheck

Reads only its own two variables, so a probe never fails because of unrelated
configuration.
"""

import os
import sys
import time
from pathlib import Path

DEFAULT_HEARTBEAT_FILE = "/tmp/worker-heartbeat"
DEFAULT_MAX_AGE_SECONDS = 30


def heartbeat_age(path: Path, now: float | None = None) -> float | None:
    try:
        mtime = path.stat().st_mtime
    except FileNotFoundError:
        return None
    return (time.time() if now is None else now) - mtime


def main() -> int:
    path = Path(os.environ.get("HEARTBEAT_FILE", DEFAULT_HEARTBEAT_FILE))
    max_age = float(os.environ.get("HEARTBEAT_MAX_AGE_SECONDS", DEFAULT_MAX_AGE_SECONDS))

    age = heartbeat_age(path)
    if age is None:
        print(f"unhealthy: {path} does not exist")
        return 1
    if age > max_age:
        print(f"unhealthy: heartbeat is {age:.0f}s old (max {max_age:.0f}s)")
        return 1
    print(f"healthy: heartbeat is {age:.0f}s old")
    return 0


if __name__ == "__main__":
    sys.exit(main())
