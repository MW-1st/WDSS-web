from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt  # PyJWT
from passlib.context import CryptContext

from app.core import config


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: str | Any, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta is None:
        expires_delta = config.get_access_token_expiry()

    expire = datetime.now(tz=timezone.utc) + expires_delta
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, config.SECRET_KEY, algorithm=config.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict:
    return jwt.decode(token, key=config.SECRET_KEY, algorithms=[config.ALGORITHM])

