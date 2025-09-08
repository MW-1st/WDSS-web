from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt  # PyJWT
import bcrypt

from app.core import config


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def create_access_token(subject: str | Any, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta is None:
        expires_delta = config.get_access_token_expiry()

    expire = datetime.now(tz=timezone.utc) + expires_delta
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, config.SECRET_KEY, algorithm=config.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict:
    return jwt.decode(token, key=config.SECRET_KEY, algorithms=[config.ALGORITHM])


def create_email_verification_token(user_id: str) -> str:
    """Create a short-lived token for email verification."""
    expire = datetime.now(tz=timezone.utc) + timedelta(hours=config.EMAIL_VERIFY_EXPIRE_HOURS)
    to_encode = {
        "exp": expire,
        "sub": str(user_id),
        "purpose": "email-verify",
    }
    return jwt.encode(to_encode, config.SECRET_KEY, algorithm=config.ALGORITHM)


def decode_email_verification_token(token: str) -> str:
    """Validate token and return the user_id (sub) if valid and purpose matches."""
    payload = decode_token(token)
    if payload.get("purpose") != "email-verify":
        raise jwt.InvalidTokenError("Invalid token purpose")
    sub = payload.get("sub")
    if not sub:
        raise jwt.InvalidTokenError("Token missing subject")
    return str(sub)
