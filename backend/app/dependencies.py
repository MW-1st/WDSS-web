# OAuth2 scheme expects a tokenUrl where clients can get the token
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import asyncpg
from typing import Optional

from app.db.database import get_conn
from app.schemas import User, UserInDB
from app.utils import security

from app.db.user import get_user_by_username

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    try:
        payload = security.decode_token(token)
        username: str | None = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload"
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    async with get_conn() as conn:
        user_in_db = await get_user_by_username(conn, username)
    if user_in_db is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    if user_in_db.disabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )
    return User(username=user_in_db.username, disabled=user_in_db.disabled)
