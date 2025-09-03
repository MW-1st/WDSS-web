from fastapi import Depends, HTTPException, status, Cookie
import asyncpg
from typing import Optional

from app.db.database import get_conn
from app.db.user import get_user_by_username
from app.schemas import UserInDB, UserResponse
from app.utils import security


async def get_current_user(
    access_token: Optional[str] = Cookie(None),
) -> UserResponse:
    if access_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token not found in cookies",
        )

    try:
        payload = security.decode_token(access_token)
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

    return UserResponse(
        id=user_in_db.id,
        username=user_in_db.username,
        disabled=user_in_db.disabled,
    )
