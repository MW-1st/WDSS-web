# app/routers/projects.py
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from ..db.database import (
    get_conn,
)  # 네 경로에 맞춰 임포트 (app/db/database.py 라면 ..db.database)

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreateReq(BaseModel):
    id: Optional[str] = None  # 프론트에서 uuid 보내줄 수도 있고
    user_id: Optional[str] = None  # 지금은 더미면 None 가능
    project_name: Optional[str] = "My Project"


@router.post("", status_code=201)
async def create_project(body: ProjectCreateReq):
    async with get_conn() as conn:
        # id가 없으면 DB에서 만들기(확장 없으면 파이썬에서 uuid4 생성해서 보내도 됨)
        # 여기서는 DB에서 만들지 않고, id 없으면 SQL에서 gen_random_uuid() 대신 파이썬에서 만든 값을 받는게 안전.
        # 단, 지금은 "추가"만 하기로 했으니, body.id 있으면 그걸 쓰고, 없으면 DB쪽에서 생성하도록 시도.
        if body.id:
            row = await conn.fetchrow(
                """
                INSERT INTO project (id, user_id, project_name, created_at, updated_at)
                VALUES ($1, $2, $3, now(), now())
                RETURNING id, user_id, project_name
                """,
                body.id,
                body.user_id,
                body.project_name,
            )
        else:
            # DB 확장 없이도 돌아가게: Python에서 uuid4 만들어서 넣도록 권장하지만
            # 여기서는 간단히 DB에서 생성하도록 시도하는 버전 (pgcrypto가 없으면 에러날 수 있음)
            row = await conn.fetchrow(
                """
                INSERT INTO project (id, user_id, project_name, created_at, updated_at)
                VALUES (gen_random_uuid(), $1, $2, now(), now())
                RETURNING id, user_id, project_name
                """,
                body.user_id,
                body.project_name,
            )
        return dict(row)
