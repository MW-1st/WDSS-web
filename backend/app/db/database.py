# app/database.py
import os
import asyncpg
from contextlib import asynccontextmanager
from typing import AsyncIterator
from asyncpg import exceptions as pgexc

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:1234@localhost:5432/wdss"
)

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
        _schema_ready = True
    except Exception:
        # Do not block request if introspection fails; let route raise on actual use
        pass
