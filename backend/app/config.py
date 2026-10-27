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

    # Document storage: a private S3-compatible bucket (Backblaze B2 in use).
    s3_endpoint: str = ""
    s3_region: str = "ap-south-1"
    s3_bucket: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    # Each uploaded document must be between these sizes (50 KB to 200 KB).
    min_upload_bytes: int = 50 * 1024
    max_upload_bytes: int = 200 * 1024

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

    # Demo accounts (emails at DEMO_EMAIL_DOMAIN) get their sign-in code and authenticator secret on screen,
    # even in production, so the demo can be tried. Everyone else gets codes by email only.
    demo_logins: bool = False
    demo_email_domain: str = "ahatin.example"

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

    def show_demo_codes(self, email: str) -> bool:
        """Development: everyone. Elsewhere, with DEMO_LOGINS on, only the demo accounts."""
        return self.expose_dev_codes or (self.demo_logins and email.lower().endswith("@" + self.demo_email_domain))

    def check_production(self) -> None:
        """Refuses to start a production server with development secrets or settings."""
        if self.app_env != "production":
            return
        problems = [
            name
            for name, bad in (
                ("SESSION_SECRET", self.session_secret.startswith("dev-") or len(self.session_secret) < 32),
                ("OTP_PEPPER", self.otp_pepper.startswith("dev-") or len(self.otp_pepper) < 32),
                ("FIELD_ENCRYPTION_KEY", not self.field_encryption_key),
                ("COOKIE_SECURE", not self.cookie_secure),
                ("S3_BUCKET", not self.s3_bucket),
            )
            if bad
        ]
        if problems:
            raise RuntimeError(f"Production settings missing or unsafe: {', '.join(problems)}")

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.api_allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
