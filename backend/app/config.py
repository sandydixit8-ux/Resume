from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET_KEY = "dpiic-secret-key-change-in-production-2026"
DEFAULT_ADMIN_PASSWORD = "admin123"
MIN_SECRET_KEY_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    environment: str = "development"
    database_url: str = "sqlite:///./dpiic.db"
    secret_key: str = DEFAULT_SECRET_KEY
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    app_name: str = "ResumeIQ AI"
    app_version: str = "1.0.0"
    cors_origins: str = "*"
    anthropic_api_key: str = ""
    groq_api_key: str = ""
    upload_dir: str = "./uploads"
    max_upload_mb: int = 10
    max_paste_chars: int = 500_000
    max_pdf_pages: int = 100
    max_docx_uncompressed_mb: int = 64
    admin_username: str = "admin"
    admin_password: str = DEFAULT_ADMIN_PASSWORD
    admin_email: str = ""
    smtp_server: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_pro_monthly: str = "price_pro_monthly"
    stripe_price_recruiter_monthly: str = "price_recruiter_monthly"
    stripe_price_pro_monthly_usd: str = "price_pro_monthly_usd"
    stripe_price_recruiter_monthly_usd: str = "price_recruiter_monthly_usd"
    frontend_url: str = "http://localhost:3000"

    def validate_production(self) -> None:
        """Fail fast at startup when required production secrets are insecure.

        Runs only when ENVIRONMENT=production so local development keeps the
        convenience defaults (admin/admin123, dummy secret).
        """
        if self.environment != "production":
            return
        problems: list[str] = []
        if self.secret_key == DEFAULT_SECRET_KEY or len(self.secret_key) < MIN_SECRET_KEY_LENGTH:
            problems.append(
                f"SECRET_KEY must be a random value of at least {MIN_SECRET_KEY_LENGTH} characters"
            )
        if self.admin_password == DEFAULT_ADMIN_PASSWORD or len(self.admin_password) < 12:
            problems.append("ADMIN_PASSWORD must be overridden with a strong password (min 12 chars)")
        if not self.cors_origins or self.cors_origins.strip() in ("", "*"):
            problems.append("CORS_ORIGINS must list explicit allowed origins, not '*'")
        if not self.groq_api_key and not self.anthropic_api_key:
            problems.append("at least one AI key is required (GROQ_API_KEY or ANTHROPIC_API_KEY)")
        if problems:
            raise RuntimeError("Refusing to start in production with insecure configuration:\n - " + "\n - ".join(problems))


@lru_cache()
def get_settings() -> Settings:
    return Settings()
