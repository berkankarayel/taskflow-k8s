# ---------- Stage 1: install dependencies into a virtualenv ----------
FROM python:3.12-slim AS build

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

# Package index. Later this points to the Nexus pypi-proxy:
#   docker build \
#     --build-arg PIP_INDEX_URL=http://<nexus>:8081/repository/pypi-proxy/simple \
#     --build-arg PIP_TRUSTED_HOST=<nexus> ...
# PIP_TRUSTED_HOST is only needed when the index uses plain HTTP.
ARG PIP_INDEX_URL=https://pypi.org/simple
ARG PIP_TRUSTED_HOST=

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --index-url "$PIP_INDEX_URL" \
        ${PIP_TRUSTED_HOST:+--trusted-host "$PIP_TRUSTED_HOST"} \
        -r requirements.txt


# ---------- Stage 2: runtime ----------
FROM python:3.12-slim

# No .pyc files (works with a read-only filesystem), logs straight to stdout.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# Fixed numeric UID so Kubernetes `runAsNonRoot` can verify it.
RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid app --no-create-home app

WORKDIR /app

COPY --from=build /opt/venv /opt/venv
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

USER 10001

EXPOSE 8000

# Exec form: uvicorn is PID 1 and receives SIGTERM directly. It stops accepting
# connections and gives in-flight requests up to 20s to finish.
# Migrations are NOT run here; run the same image with: alembic upgrade head
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--timeout-graceful-shutdown", "20"]
