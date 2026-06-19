from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "SinFro MVP"
    environment: str = "local"
    app_secret_key: str = "change-me"
    jwt_secret_key: str = "change-me"
    database_url: str = "postgresql+psycopg://sinfro:sinfro@localhost:5432/sinfro"
    redis_url: str = "redis://localhost:6379/0"
    public_web_url: str = "http://localhost:5173"
    public_api_url: str = "http://localhost:8000"
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/auth/google/callback"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "developer@maxpanra.xyz"
    smtp_from_name: str = "SinFro"
    smtp_use_tls: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
