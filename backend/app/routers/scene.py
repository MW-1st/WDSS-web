import os
import shutil
import uuid

import aiofiles
from fastapi import HTTPException, Depends, APIRouter, UploadFile, File

from app.db.database import get_conn
from app.dependencies import get_current_user
from app.schemas import (
    SceneCreate,
    SceneUpdate,
    SceneResponse,
    Scene,
    ScenesResponse,
    UserResponse,
)

from app.config import ORIGINALS_DIR, PROCESSED_DIR, TMP_DIR
from app.schemas import TransformOptions
from app.services.image_service import process_image

router = APIRouter()


@router.get("", response_model=ScenesResponse)
async def get_scenes(project_id: str, user: UserResponse = Depends(get_current_user)):
    """씬 목록 조회"""
    try:
        uuid.UUID(project_id)  # UUID 유효성 검사
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project ID format")

    async with get_conn() as conn:
        # 프로젝트 존재 여부 확인
        project_check = await conn.fetchrow(
            "SELECT id FROM project WHERE id = $1", project_id
        )
        if not project_check:
            raise HTTPException(status_code=404, detail="Project not found")

        # 씬 목록 조회 - project_scenes와 scene 테이블 조인
        scenes = await conn.fetch(
            """
            SELECT s.id, ps.project_id, ps.scene_id, s.s3_key, s.scene_num
            FROM project_scenes ps
            JOIN scene s ON ps.scene_id = s.id
            WHERE ps.project_id = $1
            ORDER BY s.scene_num ASC
            """,
            project_id,
        )

        return ScenesResponse(
            success=True,
            scenes=[
                Scene(
                    id=str(scene["id"]),
                    project_id=str(scene["project_id"]),
                    scene_num=scene["scene_num"],
                    s3_key=scene["s3_key"],
                    display_url=get_display_url(scene["s3_key"]),
                    # created_at=None,  # DB에 created_at, updated_at이 없으므로 None
                    # updated_at=None,
                )
                for scene in scenes
            ],
        )


@router.post("", response_model=SceneResponse)
async def create_scene(
    project_id: str,
    scene_data: SceneCreate,
    user: UserResponse = Depends(get_current_user),
):
    """빈 씬 생성"""
    try:
        uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project ID format")

    async with get_conn() as conn:
        async with conn.transaction():
            # 프로젝트 존재 여부 확인
            project_check = await conn.fetchrow(
                "SELECT id FROM project WHERE id = $1", project_id
            )
            if not project_check:
                raise HTTPException(status_code=404, detail="Project not found")

            # 중복 scene_num 확인 (같은 프로젝트 내에서)
            existing_scene = await conn.fetchrow(
                """
                SELECT s.id
                FROM project_scenes ps
                JOIN scene s ON ps.scene_id = s.id
                WHERE ps.project_id = $1 AND s.scene_num = $2
                """,
                project_id,
                scene_data.scene_num,
            )

            if existing_scene:
                raise HTTPException(
                    status_code=400,
                    detail=f"Scene number {scene_data.scene_num} already exists",
                )

            # 씬 생성
            scene = await conn.fetchrow(
                """
                INSERT INTO scene (scene_num)
                VALUES ($1) 
                RETURNING id, s3_key, scene_num
                """,
                scene_data.scene_num,
            )

            # project_scenes 관계 생성
            await conn.execute(
                """
                INSERT INTO project_scenes (project_id, scene_id)
                VALUES ($1, $2)
                """,
                project_id,
                scene["id"],
            )

            return SceneResponse(
                success=True,
                scene=Scene(
                    id=str(scene["id"]),
                    project_id=project_id,
                    scene_num=scene["scene_num"],
                    s3_key=scene["s3_key"],
                    display_url=get_display_url(scene["s3_key"]),
                ),
            )


@router.get("/{scene_id}", response_model=SceneResponse)
async def get_scene(
    project_id: str, scene_id: str, user: UserResponse = Depends(get_current_user)
):
    """씬 정보 조회"""
    try:
        uuid.UUID(project_id)
        uuid.UUID(scene_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")

    async with get_conn() as conn:
        scene = await conn.fetchrow(
            """
            SELECT s.id, ps.project_id, s.s3_key, s.scene_num
            FROM project_scenes ps
            JOIN scene s ON ps.scene_id = s.id
            WHERE s.id = $1 AND ps.project_id = $2
            """,
            scene_id,
            project_id,
        )

        if not scene:
            raise HTTPException(status_code=404, detail="Scene not found")

        return SceneResponse(
            success=True,
            scene=Scene(
                id=str(scene["id"]),
                project_id=str(scene["project_id"]),
                scene_num=scene["scene_num"],
                s3_key=scene["s3_key"],
                display_url=get_display_url(scene["s3_key"]),
            ),
        )


@router.post("/{scene_id}", response_model=SceneResponse)
async def update_scene(
    project_id: str,
    scene_id: str,
    scene_data: SceneUpdate,
    user: UserResponse = Depends(get_current_user),
):
    """씬 업데이트"""
    try:
        uuid.UUID(project_id)
        uuid.UUID(scene_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")

    async with get_conn() as conn:
        # 씬 존재 여부 확인 + 기존 s3_key도 함께 조회
        existing_scene = await conn.fetchrow(
            """
            SELECT s.id, s.s3_key, s.scene_num
            FROM project_scenes ps
            JOIN scene s ON ps.scene_id = s.id
            WHERE s.id = $1 AND ps.project_id = $2
            """,
            scene_id,
            project_id,
        )

        if not existing_scene:
            raise HTTPException(status_code=404, detail="Scene not found")

        # s3_key 결정: 새 값이 있으면 사용, 없으면 기존 값 유지
        new_s3_key = (
            scene_data.s3_key if scene_data.s3_key else existing_scene["s3_key"]
        )

        # 씬 업데이트
        scene = await conn.fetchrow(
            """
            UPDATE scene
            SET s3_key = $1
            WHERE id = $2
            RETURNING id, s3_key, scene_num
            """,
            new_s3_key,
            scene_id,
        )

        return SceneResponse(
            success=True,
            scene=Scene(
                id=str(scene["id"]),
                project_id=project_id,
                scene_num=scene["scene_num"],
                s3_key=scene["s3_key"],
                display_url=get_display_url(scene["s3_key"]),
            ),
        )


@router.delete("/{scene_id}")
async def delete_scene(
    project_id: str, scene_id: str, user: UserResponse = Depends(get_current_user)
):
    """씬 삭제"""
    try:
        uuid.UUID(project_id)
        uuid.UUID(scene_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")

    async with get_conn() as conn:
        async with conn.transaction():
            # 씬 존재 여부 확인
            existing_scene = await conn.fetchrow(
                """
                SELECT s.id
                FROM project_scenes ps
                JOIN scene s ON ps.scene_id = s.id
                WHERE s.id = $1 AND ps.project_id = $2
                """,
                scene_id,
                project_id,
            )

            if not existing_scene:
                raise HTTPException(status_code=404, detail="Scene not found")

            # project_scenes 관계 삭제
            await conn.execute(
                """
                DELETE FROM project_scenes
                WHERE scene_id = $1 AND project_id = $2
                """,
                scene_id,
                project_id,
            )

            # scene 삭제 (다른 프로젝트에서 사용하지 않는 경우에만)
            other_projects = await conn.fetchrow(
                """
                SELECT COUNT(*) as count
                FROM project_scenes
                WHERE scene_id = $1
                """,
                scene_id,
            )

            if other_projects["count"] == 0:
                await conn.execute(
                    """
                    DELETE FROM scene
                    WHERE id = $1
                    """,
                    scene_id,
                )

        return {"success": True, "message": "Scene deleted successfully"}


@router.get("/{scene_id}/originals")
async def check_original_image_exists(
    project_id: uuid.UUID,
    scene_id: uuid.UUID,
):
    async with get_conn() as conn:
        # s3_key가 NULL이 아니면 True, NULL이면 False를 반환합니다.
        s3_key_exists = await conn.fetchval(
            """
            SELECT s.s3_key IS NOT NULL
            FROM scene s
            JOIN project_scenes ps ON s.id = ps.scene_id
            WHERE s.id = $1 AND ps.project_id = $2
            """,
            scene_id,
            project_id,
        )

    if s3_key_exists is None:
        # 씬 자체가 존재하지 않는 경우
        raise HTTPException(status_code=404, detail="Scene not found")

    return {"exists": s3_key_exists}


@router.post("/{scene_id}/originals")
async def create_original_and_transform(
    project_id: uuid.UUID,
    scene_id: uuid.UUID,
    image: UploadFile = File(...),
    # target_dots, color 등 첫 변환 옵션도 쿼리 파라미터로 받을 수 있습니다.
    target_dots: int = 2000,
):
    """최초 변환: 이미지를 받아 원본과 변환본을 모두 생성합니다."""
    # 임시 파일 경로를 고유하게 생성
    temp_original_path = os.path.join(TMP_DIR, f"{uuid.uuid4()}.png")
    temp_processed_path = None

    try:
        # 1. 업로드된 파일을 서버의 임시 폴더에 저장
        async with aiofiles.open(temp_original_path, "wb") as out_file:
            content = await image.read()
            await out_file.write(content)

        # 2. 임시 원본 파일로 변환 작업을 시도
        #    process_image 함수는 변환된 파일의 경로를 반환해야 합니다.
        temp_processed_path = process_image(temp_original_path, target_dots=target_dots)

        # 3. 변환 성공 시, 임시 파일들을 영구 저장소로 이동
        permanent_original_path = os.path.join(ORIGINALS_DIR, f"{scene_id}.png")
        permanent_processed_path = os.path.join(PROCESSED_DIR, f"{scene_id}.svg")

        shutil.move(temp_original_path, permanent_original_path)
        shutil.move(temp_processed_path, permanent_processed_path)

        # 4. DB의 s3_key에 '원본' 이미지의 상대 경로를 저장
        original_s3_key = os.path.join("originals", f"{scene_id}.png").replace(
            "\\", "/"
        )
        async with get_conn() as conn:
            await conn.execute(
                """
                    UPDATE scene
                    SET s3_key = $1
                    WHERE id = $2
                    AND EXISTS (
                        SELECT 1 FROM project_scenes 
                        WHERE scene_id = $2 AND project_id = $3
                    )
                    """,
                original_s3_key,
                scene_id,
                project_id,
            )

        # 5. 프론트엔드에 '변환된' 이미지의 URL을 반환
        output_url = os.path.join("processed", f"{scene_id}.svg").replace("\\", "/")
        return {"output_url": f"{output_url}"}

    except Exception as e:
        # 과정 중 오류 발생 시 500 에러 반환
        raise HTTPException(status_code=500, detail=f"Image processing failed: {e}")
    finally:
        # 6. 성공/실패 여부와 관계없이 임시 파일들을 항상 삭제
        if os.path.exists(temp_original_path):
            os.remove(temp_original_path)
        if temp_processed_path and os.path.exists(temp_processed_path):
            os.remove(temp_processed_path)


@router.post("/{scene_id}/transformations")
async def re_transform_from_original(
    project_id: uuid.UUID,
    scene_id: uuid.UUID,
    options: TransformOptions,
):
    """재변환: DB에 저장된 원본을 기준으로 다시 변환합니다."""
    async with get_conn() as conn:
        # 1. DB에서 s3_key (원본 이미지 경로)를 조회
        original_s3_key = await conn.fetchval(
            """
            SELECT s.s3_key
            FROM scene s
            JOIN project_scenes ps ON s.id = ps.scene_id
            WHERE s.id = $1 AND ps.project_id = $2
            """,
            scene_id,
            project_id,
        )

    if not original_s3_key:
        raise HTTPException(
            status_code=404, detail="This scene has no original image to transform."
        )

    # 2. 원본 파일의 실제 서버 경로를 확인
    original_file_path = os.path.abspath(original_s3_key)
    if not os.path.exists(original_file_path):
        raise HTTPException(
            status_code=404,
            detail="Original image file not found on server, but DB record exists.",
        )

    try:
        # 3. 원본 파일과 새로운 옵션으로 변환을 다시 수행
        color_rgb = (options.color_r, options.color_g, options.color_b)

        # process_image 함수 호출 (반환값으로 처리된 파일 경로를 받음)
        temp_processed_path = process_image(
            input_path=original_file_path,
            target_dots=options.target_dots,
            color_rgb=color_rgb,
        )

        # 4. 임시 처리된 파일을 최종 위치로 이동
        final_processed_path = os.path.join(PROCESSED_DIR, f"{scene_id}.svg")
        shutil.move(temp_processed_path, final_processed_path)

        # 5. 업데이트된 변환 이미지의 URL을 반환
        output_url = os.path.join("processed", f"{scene_id}.svg").replace("\\", "/")
        return {"output_url": f"{output_url}"}

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Image re-transformation failed: {e}"
        )


def get_display_url(original_s3_key: str) -> str:
    """원본 경로를 표시용 경로로 변환"""
    if not original_s3_key:
        return None

    if original_s3_key.startswith("originals/"):
        return original_s3_key.replace("originals/", "processed/").replace(
            ".png", ".svg"
        )

    return original_s3_key
