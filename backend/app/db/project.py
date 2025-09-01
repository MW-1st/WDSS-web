import asyncpg


async def get_projects_by_user_id(conn: asyncpg.Connection, user_id: str) -> list[dict]:
    """
    특정 사용자의 모든 프로젝트 목록을 DB에서 조회합니다.
    """
    query = """
            SELECT id, \
                   project_name, \
                   format, \
                   max_scene, \
                   max_speed, \
                   max_accel, \
                   min_separation, \
                   created_at, \
                   updated_at
            FROM projects
            WHERE user_id = $1
            ORDER BY updated_at DESC \
            """

    # conn.fetch는 asyncpg.Record 객체의 리스트를 반환합니다.
    records = await conn.fetch(query, user_id)

    # Pydantic 모델이 인식할 수 있도록 각 Record를 dict로 변환합니다.
    return [dict(record) for record in records]
