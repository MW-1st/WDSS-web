from datetime import timedelta
import uuid
from typing import Optional

import asyncpg
from asyncpg import exceptions as pgexc
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

from app.schemas import Token, User, UserInDB, RegisterRequest, RegisterResponse
from app.utils import security
from app.core import config
from app.db.database import get_conn


router = APIRouter()


# OAuth2 scheme expects a tokenUrl where clients can get the token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def _get_user_by_username(
    conn: asyncpg.Connection, username: str
) -> Optional[UserInDB]:
    row = await conn.fetchrow(
        """
        SELECT u.username, u.status, ac.password_hash
        FROM users u
        LEFT JOIN auth_credentials ac ON ac.user_id = u.id
        WHERE u.username = $1
        """,
        username,
    )
    if not row:
        return None
    disabled = False if (row["status"] or "").upper() == "ACTIVE" else True
    return UserInDB(
        username=row["username"],
        hashed_password=row["password_hash"],
        disabled=disabled,
    )


async def authenticate_user(username: str, password: str) -> Optional[UserInDB]:
    async with get_conn() as conn:
        user = await _get_user_by_username(conn, username)
        if not user or not user.hashed_password:
            return None
        if not security.verify_password(password, user.hashed_password):
            return None
        return user


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        subject=user.username, expires_delta=access_token_expires
    )
    return Token(access_token=access_token)


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
        user_in_db = await _get_user_by_username(conn, username)
    if user_in_db is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    if user_in_db.disabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )
    return User(username=user_in_db.username, disabled=user_in_db.disabled)


@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post(
    "/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED
)
async def register(payload: RegisterRequest):
    user_id = str(uuid.uuid4())
    password_hash = security.get_password_hash(payload.password)  # bcrypt 해시

    async with get_conn() as conn:
        existing = await conn.fetchrow(
            "SELECT 1 FROM users WHERE email = $1 OR username = $2",
            str(payload.email),
            payload.username,
        )
        if existing:
            raise HTTPException(
                status_code=400, detail="Email or username already exists"
            )

        try:
            async with conn.transaction():  # ← 트랜잭션으로 묶기
                await conn.execute(
                    "INSERT INTO users (id, email, username, status) VALUES ($1, $2, $3, 'ACTIVE')",
                    user_id,
                    str(payload.email),
                    payload.username,
                )
                await conn.execute(
                    "INSERT INTO auth_credentials (user_id, password_hash, password_algo) VALUES ($1, $2, $3)",
                    user_id,
                    password_hash,
                    "bcrypt",  # ← 실제 해시와 일치
                )
        except pgexc.UniqueViolationError:
            raise HTTPException(
                status_code=400, detail="Email or username already exists"
            )

    return RegisterResponse(id=user_id, email=payload.email, username=payload.username)
