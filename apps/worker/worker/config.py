from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://sinfro:sinfro@localhost:5432/sinfro"
    redis_url: str = "redis://localhost:6379/0"
    sync_poll_timeout: int = 5
    app_secret_key: str = "change-me"
    google_client_id: str = ""
    google_client_secret: str = ""

    # Scheduler de resúmenes (corre dentro del contenedor worker).
    # El envío usa el Gmail conectado de cada usuario (OAuth gmail.send),
    # por eso no se necesita SMTP aquí.
    digest_enabled: bool = False
    digest_interval_minutes: int = 60
    global_sync_enabled: bool = True
    global_sync_interval_minutes: int = 60
    global_jobs_ttl_days: int = 30
    global_sync_max_matches_per_profile: int = 80

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
