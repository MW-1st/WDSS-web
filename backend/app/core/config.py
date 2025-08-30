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
