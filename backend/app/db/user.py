import asyncpg
from app.schemas import UserInDB  # 스키마 경로에 맞게 수정


async def get_user_by_username(
    conn: asyncpg.Connection, username: str
) -> UserInDB | None:
    """
    사용자 이름으로 DB에서 사용자 정보와 비밀번호 해시를 함께 조회합니다.
    """
    # 👇 users와 auth_credentials 테이블을 JOIN하는 쿼리로 수정
    query = """
            SELECT u.id, \
                   u.username, \
                   u.email, \
                   ac.password_hash AS hashed_password -- auth_credentials 테이블의 password_hash를 가져옴
            FROM users AS u \
                     JOIN \
                 auth_credentials AS ac ON u.id = ac.user_id
            WHERE u.username = $1 \
            """

    record = await conn.fetchrow(query, username)

    if record:
        user_data = dict(record)

        # 2. 변환된 딕셔너리의 'id' 값을 str으로 바꿉니다.
        user_data["id"] = str(user_data["id"])

        # 4. 최종적으로 수정된 딕셔너리를 사용해 Pydantic 모델을 생성합니다.
        return UserInDB(**user_data)

    return None
