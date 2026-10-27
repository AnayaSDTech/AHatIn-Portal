from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration comes from environment variables (or a .env file in development)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["development", "staging", "production", "test"] = "development"
    app_base_url: str = "http://localhost:5173"
    # Every online session uses this Google Meet room (hosted by info@ahat.in) for now.
    meeting_link: str = "https://meet.google.com/juz-bodt-wbd"
    api_allowed_origins: str = ""  # comma-separated, development only

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "ahat"

    session_cookie_name: str = "ahat_session"
    csrf_cookie_name: str = "ahat_csrf"
    cookie_secure: bool = False  # True in production (HTTPS)
    session_secret: str = "dev-session-secret-change-me"
    otp_pepper: str = "dev-otp-pepper-change-me"
    field_encryption_key: str = ""  # Fernet key; generated per process in development if empty
    totp_issuer: str = "AHat Portal"

    staff_idle_minutes: int = 30
    staff_max_hours: int = 12
    student_idle_days: int = 7
    student_max_days: int = 30
    otp_ttl_seconds: int = 600
    otp_resend_seconds: int = 30
    otp_max_attempts: int = 5

    # File storage: "local" (development) or "s3" (production).
    storage_backend: Literal["local", "s3"] = "local"
    local_storage_dir: str = "var/uploads"
    s3_endpoint: str = ""
    s3_region: str = "ap-south-1"
    s3_bucket: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    max_upload_bytes: int = 10 * 1024 * 1024

    clamav_host: str = ""  # empty = scanning disabled (development only)
    clamav_port: int = 3310

    resend_api_key: str = ""  # Resend (https://resend.com); used instead of SMTP when set
    smtp_host: str = ""  # empty (and no Resend key) = emails are written to the log (development)
    smtp_port: int = 465
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    mail_from: str = "AHat <no-reply@ahat.example>"
    admin_alert_emails: str = ""

    business_timezone: str = "Asia/Kolkata"
    run_background_jobs: bool = True  # run the worker loops inside the API process
    log_level: str = "INFO"

    @property
    def is_dev(self) -> bool:
        return self.app_env in ("development", "test")

    @property
    def expose_dev_codes(self) -> bool:
        """Development only: return one-time codes and authenticator secrets so the UI can show them."""
        return self.is_dev

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.api_allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
