# app/routers/scenes.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Any, List, Optional
from app.db.database import get_conn

router = APIRouter(tags=["scenes"])  # ✅ prefix 제거 (main.py에서만 붙임)


# ---- (임시) 인증 대체 ----
async def get_current_user_id() -> str:
    return "00000000-0000-0000-0000-000000000001"


# ---- 모델 ----
class SceneBrief(BaseModel):
    id: str
    scene_num: Optional[int] = None
    name: Optional[str] = None
    preview: Optional[str] = None  # base64 썸네일(선택)


class SceneDetail(BaseModel):
    id: str
    scene_num: Optional[int] = None
    drones: List[Any] = Field(default_factory=list)  # ✅ 가변 기본값 방지
    preview: Optional[str] = None


class SceneCreateReq(BaseModel):
    scene_num: int  # ✅ project_id는 경로 파라미터로 받음


class SceneSaveReq(BaseModel):
    drones: List[Any] = Field(default_factory=list)  # ✅
    preview: Optional[str] = None


# ---- 유틸: scene_payload 테이블 보장 ----
CREATE_PAYLOAD_SQL = """
CREATE TABLE IF NOT EXISTS scene_payload (
  scene_id uuid PRIMARY KEY REFERENCES scene(id) ON DELETE CASCADE,
  drones   jsonb,
  preview  text
);
"""


# ---- 목록 ----
@router.get("/{project_id}/scenes", response_model=List[SceneBrief])
async def list_scenes(project_id: str, user_id: str = Depends(get_current_user_id)):
    async with get_conn() as conn:
        await conn.execute(CREATE_PAYLOAD_SQL)
        rows = await conn.fetch(
            """
            SELECT s.id, s.scene_num, sp.preview
            FROM project_scenes ps
            JOIN scene s ON ps.scene_id = s.id
            LEFT JOIN scene_payload sp ON sp.scene_id = s.id
            WHERE ps.project_id = $1
            ORDER BY s.scene_num ASC NULLS LAST, s.id ASC
            """,
            project_id,
        )
        return [
            {
                "id": str(r["id"]),
                "scene_num": r["scene_num"],
                "name": f"Scene {r['scene_num'] or i + 1}",
                "preview": r["preview"],
            }
            for i, r in enumerate(rows)
        ]


# ---- 생성 ----
@router.post("/{project_id}/scenes", response_model=SceneBrief)
async def create_scene(
    project_id: str,
    body: SceneCreateReq,
    user_id: str = Depends(get_current_user_id),
):
    async with get_conn() as conn:
        await conn.execute(CREATE_PAYLOAD_SQL)
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                INSERT INTO scene (id, scene_num)
                VALUES (gen_random_uuid(), $1)
                RETURNING id, scene_num
                """,
                body.scene_num,
            )
            scene_id = row["id"]
            scene_num = row["scene_num"]

            await conn.execute(
                "INSERT INTO project_scenes (scene_id, project_id) VALUES ($1, $2)",
                scene_id,
                project_id,
            )
        return {
            "id": str(scene_id),
            "scene_num": scene_num,
            "name": f"Scene {scene_num}",
            "preview": None,
        }


# ---- 상세 ----
@router.get("/{project_id}/scenes/{scene_id}", response_model=SceneDetail)
async def get_scene(
    project_id: str, scene_id: str, user_id: str = Depends(get_current_user_id)
):
    async with get_conn() as conn:
        await conn.execute(CREATE_PAYLOAD_SQL)
        row = await conn.fetchrow(
            """
            SELECT s.id, s.scene_num, sp.drones, sp.preview
            FROM project_scenes ps
            JOIN scene s ON ps.scene_id = s.id
            LEFT JOIN scene_payload sp ON sp.scene_id = s.id
            WHERE ps.project_id = $1 AND s.id = $2
            """,
            project_id,
            scene_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Scene not found")
        return {
            "id": str(row["id"]),
            "scene_num": row["scene_num"],
            "drones": row["drones"] or [],
            "preview": row["preview"],
        }


# ---- 저장(덮어쓰기) ----
@router.put("/{project_id}/scenes/{scene_id}", response_model=SceneDetail)
async def save_scene(
    project_id: str,
    scene_id: str,
    body: SceneSaveReq,
    user_id: str = Depends(get_current_user_id),
):
    async with get_conn() as conn:
        await conn.execute(CREATE_PAYLOAD_SQL)

        rel = await conn.fetchval(
            "SELECT 1 FROM project_scenes WHERE project_id=$1 AND scene_id=$2",
            project_id,
            scene_id,
        )
        if not rel:
            raise HTTPException(status_code=404, detail="Scene not found in project")

        await conn.execute(
            """
            INSERT INTO scene_payload (scene_id, drones, preview)
            VALUES ($1, $2, $3)
            ON CONFLICT (scene_id) DO UPDATE
                SET drones = EXCLUDED.drones,
                    preview = COALESCE(EXCLUDED.preview, scene_payload.preview)
            """,
            scene_id,
            body.drones,
            body.preview,
        )

        row = await conn.fetchrow(
            """
            SELECT s.id, s.scene_num, sp.drones, sp.preview
            FROM scene s
            LEFT JOIN scene_payload sp ON sp.scene_id = s.id
            WHERE s.id = $1
            """,
            scene_id,
        )
        return {
            "id": str(row["id"]),
            "scene_num": row["scene_num"],
            "drones": row["drones"] or [],
            "preview": row["preview"],
        }


# ---- 삭제 ----
@router.delete("/{project_id}/scenes/{scene_id}")
async def delete_scene(
    project_id: str, scene_id: str, user_id: str = Depends(get_current_user_id)
):
    async with get_conn() as conn:
        async with conn.transaction():
            await conn.execute(
                "DELETE FROM project_scenes WHERE project_id=$1 AND scene_id=$2",
                project_id,
                scene_id,
            )
            await conn.execute("DELETE FROM scene WHERE id=$1", scene_id)
    return {"ok": True}
