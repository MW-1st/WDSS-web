# app/database.py
import os
import asyncpg
from contextlib import asynccontextmanager
from typing import AsyncIterator
from asyncpg import exceptions as pgexc
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "wdss")
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "1234")
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

_pool: asyncpg.Pool | None = None
_schema_ready: bool = False


async def init_db():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=1,
            max_size=5,
            timeout=10,
        )


async def close_db():
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def reset_pool():
    await close_db()
    await init_db()


@asynccontextmanager
async def get_conn() -> AsyncIterator[asyncpg.Connection]:
    # Lazy init and one retry if the pool/connection is invalidated
    if _pool is None:
        await init_db()
    assert _pool is not None
    try:
        conn = await _pool.acquire()
    except (pgexc.ConnectionDoesNotExistError, pgexc.InterfaceError):
        await reset_pool()
        assert _pool is not None
        conn = await _pool.acquire()
    try:
        # Ensure schema exists (one-time)
        await _ensure_schema(conn)
        yield conn
    finally:
        await _pool.release(conn)


async def get_db() -> AsyncIterator[asyncpg.Connection]:
    """Depends가 사용할 수 있도록 get_conn을 감싸는 래퍼 함수"""
    async with get_conn() as conn:
        yield conn


async def _ensure_schema(conn: asyncpg.Connection) -> None:
    global _schema_ready
    if _schema_ready:
        return
    try:
        users_exists = await conn.fetchval("SELECT to_regclass('public.users')")
        creds_exists = await conn.fetchval(
            "SELECT to_regclass('public.auth_credentials')"
        )
        if users_exists is None or creds_exists is None:
            sql_path = os.path.join(os.path.dirname(__file__), "WDSS.sql")
            with open(sql_path, "r", encoding="utf-8") as f:
                sql_text = f.read()
            # Execute statements individually to satisfy asyncpg
            statements = [s.strip() for s in sql_text.split(";") if s.strip()]
            for stmt in statements:
                await conn.execute(stmt)
        else:
            # Ensure new columns exist for evolving schema without full migrations
            has_verified_col = await conn.fetchval(
                """
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'is_email_verified'
                )
                """
            )
            if not has_verified_col:
                await conn.execute(
                    "ALTER TABLE users ADD COLUMN is_email_verified boolean NOT NULL DEFAULT false"
                )
        _schema_ready = True
    except Exception:
        # Do not block request if introspection fails; let route raise on actual use
        pass
