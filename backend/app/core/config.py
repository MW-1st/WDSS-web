import os
from datetime import timedelta


# Basic JWT configuration; consider overriding via environment variables
SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY",
    # NOTE: Replace this default in production via environment/config
    "change_me_please_for_prod_use_only_env_or_secret_manager",
)

ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))


def get_access_token_expiry() -> timedelta:
    return timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

# Email verification token expiry (hours)
EMAIL_VERIFY_EXPIRE_HOURS = int(os.getenv("EMAIL_VERIFY_EXPIRE_HOURS", "24"))

# Service URLs
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")

# SMTP settings
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_STARTTLS = os.getenv("SMTP_STARTTLS", "true").lower() in ("1", "true", "yes")
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "no-reply@localhost")
