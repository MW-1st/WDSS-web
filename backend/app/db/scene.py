import asyncpg
import json
from typing import List, Optional
from app.schemas import SceneCreateReq, SceneSaveReq

# ---- 유틸: scene_payload 테이블 보장 ----
# 테이블 생성 SQL은 DB 로직과 함께 있는 것이 자연스러움
CREATE_PAYLOAD_SQL = """
                     CREATE TABLE IF NOT EXISTS scene_payload \
                     ( \
                         scene_id \
                         uuid \
                         PRIMARY \
                         KEY \
                         REFERENCES \
                         scene \
                     ( \
                         id \
                     ) ON DELETE CASCADE,
                         drones jsonb,
                         preview text
                         ); \
                     """


async def _ensure_payload_table(conn: asyncpg.Connection):
    """테이블이 존재하는지 확인하고 없으면 생성합니다."""
    await conn.execute(CREATE_PAYLOAD_SQL)


async def get_scenes_by_project(
    conn: asyncpg.Connection, project_id: str
) -> List[asyncpg.Record]:
    """프로젝트에 속한 모든 씬의 목록을 가져옵니다."""
    await _ensure_payload_table(conn)
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
    return rows


async def create_scene_for_project(
    conn: asyncpg.Connection, project_id: str, scene_data: SceneCreateReq
) -> asyncpg.Record:
    """프로젝트에 새로운 씬을 생성하고 연결합니다."""
    await _ensure_payload_table(conn)
    async with conn.transaction():
        row = await conn.fetchrow(
            "INSERT INTO scene (id, scene_num) VALUES (gen_random_uuid(), $1) RETURNING id, scene_num",
            scene_data.scene_num,
        )
        await conn.execute(
            "INSERT INTO project_scenes (scene_id, project_id) VALUES ($1, $2)",
            row["id"],
            project_id,
        )
    return row


async def get_scene_by_id(
    conn: asyncpg.Connection, project_id: str, scene_id: str
) -> Optional[asyncpg.Record]:
    """특정 씬의 상세 정보를 가져옵니다."""
    await _ensure_payload_table(conn)
    row = await conn.fetchrow(
        """
        SELECT s.id, s.scene_num, sp.drones, sp.preview
        FROM project_scenes ps
                 JOIN scene s ON ps.scene_id = s.id
                 LEFT JOIN scene_payload sp ON sp.scene_id = s.id
        WHERE ps.project_id = $1
          AND s.id = $2
        """,
        project_id,
        scene_id,
    )
    return row


async def update_scene(
    conn: asyncpg.Connection, project_id: str, scene_id: str, scene_data: SceneSaveReq
) -> Optional[asyncpg.Record]:
    """씬의 내용을 저장(덮어쓰기)합니다."""
    await _ensure_payload_table(conn)

    # 씬이 프로젝트에 속해 있는지 먼저 확인
    rel = await conn.fetchval(
        "SELECT 1 FROM project_scenes WHERE project_id=$1 AND scene_id=$2",
        project_id,
        scene_id,
    )
    if not rel:
        return None  # 존재하지 않으면 None 반환

    # drones_as_json_string = json.dumps(scene_data.drones)
    # await conn.execute(
    #     """
    #     INSERT INTO scene_payload (scene_id, drones, preview)
    #     VALUES ($1, $2, $3) ON CONFLICT (scene_id) DO
    #     UPDATE
    #         SET drones = EXCLUDED.drones,
    #         preview = COALESCE (EXCLUDED.preview, scene_payload.preview)
    #     """,
    #     scene_id,
    #     drones_as_json_string,
    #     scene_data.preview,
    # )

    await conn.execute(
        """
        UPDATE scene 
        SET s3_key = $2
        WHERE id = $1
        """,
        scene_id,
        scene_data.imageUrl,  # preview를 s3_key에 저장
    )

    # 업데이트된 전체 데이터를 다시 조회하여 반환
    updated_row = await conn.fetchrow(
        """
        SELECT s.id, s.scene_num
        FROM scene
        WHERE s.id = $1
        """,
        scene_id,
    )
    return updated_row


async def delete_scene_from_project(
    conn: asyncpg.Connection, project_id: str, scene_id: str
) -> bool:
    """프로젝트에서 씬을 삭제하고, 씬 자체도 삭제합니다."""
    async with conn.transaction():
        # CASCADE DELETE가 scene_payload의 데이터도 함께 삭제해 줌
        result = await conn.execute(
            "DELETE FROM scene WHERE id=$1 AND EXISTS (SELECT 1 FROM project_scenes WHERE project_id=$2 AND scene_id=$1)",
            scene_id,
            project_id,
        )

    # 'DELETE 1'이면 성공적으로 삭제된 것
    return result.strip() == "DELETE 1"
