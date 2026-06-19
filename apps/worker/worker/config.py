from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://sinfro:sinfro@localhost:5432/sinfro"
    redis_url: str = "redis://localhost:6379/0"
    sync_poll_timeout: int = 5
    app_secret_key: str = "change-me"
    google_client_id: str = ""
    google_client_secret: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
