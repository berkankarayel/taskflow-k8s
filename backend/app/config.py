from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    """Every setting comes from an environment variable (12-factor).

    Hosts and credentials have no defaults on purpose: a missing ConfigMap or
    Secret should make the process fail fast with a clear error.
    """

    model_config = SettingsConfigDict(case_sensitive=False, extra="ignore")

    app_env: str = "development"
    app_version: str = "dev"
    log_level: str = "INFO"

    db_host: str
    db_port: int = 5432
    db_name: str
    db_user: str
    db_password: str

    redis_host: str
    redis_port: int = 6379
    redis_password: str = ""

    cache_ttl_seconds: int = 30

    @property
    def database_url(self) -> URL:
        # URL.create escapes special characters in the password for us.
        return URL.create(
            "postgresql+psycopg",
            username=self.db_user,
            password=self.db_password,
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
