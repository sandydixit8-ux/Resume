from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "sqlite:///./dpiic.db"
    secret_key: str = "dpiic-secret-key-change-in-production-2026"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    app_name: str = "ResumeIQ AI"
    app_version: str = "1.0.0"
    cors_origins: str = "*"
    anthropic_api_key: str = ""
    upload_dir: str = "./uploads"
    admin_username: str = "admin"
    admin_password: str = "admin123"
    admin_email: str = ""
    smtp_server: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_pro_monthly: str = "price_pro_monthly"
    stripe_price_recruiter_monthly: str = "price_recruiter_monthly"
    frontend_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
