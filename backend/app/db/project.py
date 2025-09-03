import uuid
from typing import List, Optional
import asyncpg
from app.schemas import ProjectCreate, ProjectUpdate


async def get_projects_by_user_id(
    conn: asyncpg.Connection, user_id: uuid.UUID
) -> List[dict]:
    """사용자 ID로 프로젝트 목록을 조회합니다."""
    rows = await conn.fetch(
        "SELECT * FROM project WHERE user_id = $1 ORDER BY created_at DESC", user_id
    )
    return [dict(row) for row in rows]


async def create_project(
    conn: asyncpg.Connection, project_data: ProjectCreate, user_id: uuid.UUID
) -> dict:
    """DB에 새 프로젝트를 생성합니다."""
    query = """
        INSERT INTO project (project_name, format, max_scene, max_speed, max_accel, min_separation, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    """
    new_project = await conn.fetchrow(
        query,
        project_data.project_name,
        project_data.format,
        project_data.max_scene,
        project_data.max_speed,
        project_data.max_accel,
        project_data.min_separation,
        user_id,
    )
    return dict(new_project)


async def get_project_by_id(
    conn: asyncpg.Connection, project_id: uuid.UUID, user_id: uuid.UUID
) -> Optional[dict]:
    """프로젝트 ID로 특정 프로젝트와 관련 씬 정보를 조회합니다."""
    # 프로젝트 정보 조회
    project_row = await conn.fetchrow(
        "SELECT * FROM project WHERE id = $1 AND user_id = $2", project_id, user_id
    )
    if not project_row:
        return None

    project = dict(project_row)

    # ⭐️ [수정됨] project_scenes 테이블을 JOIN하여 관련 씬 정보를 조회합니다.
    scene_rows = await conn.fetch(
        """
            SELECT s.id, s.s3_key, s.scene_num
            FROM scene s
            INNER JOIN project_scenes ps ON s.id = ps.scene_id
            WHERE ps.project_id = $1
            ORDER BY s.scene_num ASC
        """,
        project_id,
    )
    project["scenes"] = [dict(row) for row in scene_rows]
    return project


async def update_project_by_id(
    conn: asyncpg.Connection,
    project_id: uuid.UUID,
    project_data: ProjectUpdate,
    user_id: uuid.UUID,
) -> Optional[dict]:
    """프로젝트 ID로 특정 프로젝트 정보를 수정합니다."""
    update_data = project_data.model_dump(exclude_unset=True)
    if not update_data:
        # 수정할 내용이 없으면 기존 프로젝트 정보 반환
        return await get_project_by_id(conn, project_id, user_id)

    set_clauses = [f"{key} = ${i+2}" for i, key in enumerate(update_data.keys())]
    query = f"""
        UPDATE project
        SET {', '.join(set_clauses)}, updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING *
    """
    params = [project_id, user_id] + list(update_data.values())

    updated_project = await conn.fetchrow(query, *params)
    return dict(updated_project) if updated_project else None


async def delete_project_by_id(
    conn: asyncpg.Connection, project_id: uuid.UUID, user_id: uuid.UUID
) -> bool:
    """프로젝트 ID로 특정 프로젝트를 삭제합니다."""
    # 참고: ON DELETE CASCADE 제약조건이 설정되어 있다면 project 삭제 시 project_scenes의 관련 데이터도 자동 삭제됩니다.
    # 그렇지 않다면, project_scenes 테이블의 데이터를 먼저 삭제하는 로직이 필요합니다.
    result = await conn.execute(
        "DELETE FROM project WHERE id = $1 AND user_id = $2", project_id, user_id
    )
    return result == "DELETE 1"
