import logging
import socket
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError

from app.config import get_settings
from app.db import engine
from app.logging_config import setup_logging
from app.redis_client import redis_client
from app.routers import activity, stats, system, tasks

settings = get_settings()
setup_logging(settings.log_level)
logger = logging.getLogger("taskflow")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    logger.info(
        "TaskFlow backend %s starting (env=%s, host=%s)",
        settings.app_version,
        settings.app_env,
        socket.gethostname(),
    )
    yield
    # Uvicorn stops accepting connections and drains in-flight requests on
    # SIGTERM before we get here; now release the pools.
    logger.info("shutting down, closing connections")
    engine.dispose()
    redis_client.close()


app = FastAPI(
    title="TaskFlow API",
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)


@app.exception_handler(OperationalError)
async def database_unavailable(_: Request, exc: OperationalError) -> JSONResponse:
    # A lost database connection is a temporary condition, not a bug: 503, not 500.
    logger.error("database unavailable: %s", exc.orig or exc)
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "Database unavailable"},
    )


app.include_router(system.router)
app.include_router(tasks.router)
app.include_router(stats.router)
app.include_router(activity.router)
