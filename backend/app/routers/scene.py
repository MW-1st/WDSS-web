import json  # ✅ json 라이브러리 임포트
from app.db.database import get_db
from app.dependencies import get_current_user
from app.schemas import SceneBrief, SceneCreateReq, SceneDetail, SceneSaveReq
from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.db import scene as crud
import asyncpg

router = APIRouter(tags=["scenes"])


# ---- 목록 ----
@router.get("/", response_model=List[SceneBrief])
async def list_scenes(
    project_id: str,
    user_id: str = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    rows = await crud.get_scenes_by_project(conn, project_id)
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
@router.post("/", response_model=SceneBrief)
async def create_scene(
    project_id: str,
    body: SceneCreateReq,
    user_id: str = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    new_scene = await crud.create_scene_for_project(conn, project_id, body)
    return {
        "id": str(new_scene["id"]),
        "scene_num": new_scene["scene_num"],
        "name": f"Scene {new_scene['scene_num']}",
        "preview": None,
    }


# ---- 상세 ----
@router.get("/{scene_id}", response_model=SceneDetail)
async def get_scene(
    project_id: str,
    scene_id: str,
    user_id: str = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    scene = await crud.get_scene_by_id(conn, project_id, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    # ✅ 수정된 부분: DB에서 받은 문자열을 Python 리스트로 변환
    drones_list = json.loads(scene["drones"]) if scene["drones"] else []

    return {
        "id": str(scene["id"]),
        "scene_num": scene["scene_num"],
        "drones": drones_list,  # ✅ 변환된 리스트 사용
        "preview": scene["preview"],
    }


# ---- 저장(덮어쓰기) ----
@router.put("/{scene_id}", response_model=SceneDetail)
async def save_scene(
    project_id: str,
    scene_id: str,
    body: SceneSaveReq,
    user_id: str = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    updated_scene = await crud.update_scene(conn, project_id, scene_id, body)
    if not updated_scene:
        raise HTTPException(status_code=404, detail="Scene not found in project")

    # ✅ 수정된 부분: DB에서 받은 문자열을 Python 리스트로 변환
    drones_list = json.loads(updated_scene["drones"]) if updated_scene["drones"] else []

    return {
        "id": str(updated_scene["id"]),
        "scene_num": updated_scene["scene_num"],
        "drones": drones_list,  # ✅ 변환된 리스트 사용
        "preview": updated_scene["preview"],
    }


# ---- 삭제 ----
@router.delete("/{scene_id}")
async def delete_scene(
    project_id: str,
    scene_id: str,
    user_id: str = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    success = await crud.delete_scene_from_project(conn, project_id, scene_id)
    if not success:
        raise HTTPException(
            status_code=404, detail="Scene not found or could not be deleted"
        )
    return {"ok": True}
