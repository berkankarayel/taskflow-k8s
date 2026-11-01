from typing import Annotated

import redis
from fastapi import Depends
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.redis_client import get_redis

DbSession = Annotated[Session, Depends(get_db)]
RedisClient = Annotated[redis.Redis, Depends(get_redis)]
AppSettings = Annotated[Settings, Depends(get_settings)]
