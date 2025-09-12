import os
import shutil
import uuid
import json
from typing import Optional

import aiofiles
from fastapi import HTTPException, Depends, APIRouter, UploadFile, File, Body

from app.db.database import get_conn
from app.dependencies import get_current_user
from app.schemas import (
    SceneCreate,
    SceneUpdate,
    SceneResponse,
    Scene,
    ScenesResponse,
    UserResponse,
    ScenePatch,
)

from app.config import ORIGINALS_DIR, PROCESSED_DIR, TMP_DIR, THUMBNAILS_DIR
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
                    # display_url=get_display_url(scene["s3_key"]),
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
                    # display_url=get_display_url(scene["s3_key"]),
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
                # display_url=get_display_url(scene["s3_key"]),
            ),
        )


# @router.put("/{scene_id}", response_model=SceneResponse)
# async def update_scene(
#     project_id: str,
#     scene_id: str,
#     scene_data: SceneUpdate,
#     user: UserResponse = Depends(get_current_user),
# ):
#     """씬 업데이트"""
#     try:
#         uuid.UUID(project_id)
#         uuid.UUID(scene_id)
#     except ValueError:
#         raise HTTPException(status_code=400, detail="Invalid ID format")
#
#     async with get_conn() as conn:
#         # 씬 존재 여부 확인 + 기존 s3_key도 함께 조회
#         existing_scene = await conn.fetchrow(
#             """
#             SELECT s.id, s.s3_key, s.scene_num
#             FROM project_scenes ps
#             JOIN scene s ON ps.scene_id = s.id
#             WHERE s.id = $1 AND ps.project_id = $2
#             """,
#             scene_id,
#             project_id,
#         )
#
#         if not existing_scene:
#             raise HTTPException(status_code=404, detail="Scene not found")
#
#         # s3_key 결정: 새 값이 있으면 사용, 없으면 기존 값 유지
#         new_s3_key = (
#             scene_data.s3_key if scene_data.s3_key else existing_scene["s3_key"]
#         )
#
#         # 씬 업데이트
#         scene = await conn.fetchrow(
#             """
#             UPDATE scene
#             SET s3_key = $1
#             WHERE id = $2
#             RETURNING id, s3_key, scene_num
#             """,
#             new_s3_key,
#             scene_id,
#         )
#
#         return SceneResponse(
#             success=True,
#             scene=Scene(
#                 id=str(scene["id"]),
#                 project_id=project_id,
#                 scene_num=scene["scene_num"],
#                 s3_key=scene["s3_key"],
#                 display_url=get_display_url(scene["s3_key"]),
#             ),
#         )


# 초기화
@router.patch("/{scene_id}", response_model=SceneResponse)
async def patch_scene(
    project_id: str,
    scene_id: str,
    patch_data: ScenePatch,
    user: UserResponse = Depends(get_current_user),
):
    """씬 상태 변경 (초기화 등)"""
    try:
        uuid.UUID(project_id)
        uuid.UUID(scene_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")

    if patch_data.status == "reset":
        # 초기화 로직
        async with get_conn() as conn:
            async with conn.transaction():
                # 씬 존재 여부 확인 및 현재 scene_num 조회
                existing_scene = await conn.fetchrow(
                    """
                    SELECT s.id, s.scene_num, s.s3_key
                    FROM project_scenes ps
                             JOIN scene s ON ps.scene_id = s.id
                    WHERE s.id = $1
                      AND ps.project_id = $2
                    """,
                    scene_id,
                    project_id,
                )

                if not existing_scene:
                    raise HTTPException(status_code=404, detail="Scene not found")

                # DB에서 s3_key를 NULL로 초기화
                await conn.execute(
                    """
                    UPDATE scene
                    SET s3_key = NULL
                    WHERE id = $1
                    """,
                    scene_id,
                )

                # 연관된 파일들 삭제
                original_file = os.path.join(ORIGINALS_DIR, f"{scene_id}.json")
                original_png_file = os.path.join(ORIGINALS_DIR, f"{scene_id}.json")
                processed_file = os.path.join(PROCESSED_DIR, f"{scene_id}.json")

                # originals 폴더의 파일 삭제
                if os.path.exists(original_file):
                    try:
                        os.remove(original_file)
                    except OSError as e:
                        # 파일 삭제 실패시 로그는 남기되 작업은 계속 진행
                        print(f"Failed to remove original file {original_file}: {e}")

                if os.path.exists(original_png_file):
                    try:
                        os.remove(original_png_file)
                    except OSError as e:
                        # 파일 삭제 실패시 로그는 남기되 작업은 계속 진행
                        print(
                            f"Failed to remove original file {original_png_file}: {e}"
                        )

                # processed 폴더의 파일 삭제
                if os.path.exists(processed_file):
                    try:
                        os.remove(processed_file)
                    except OSError as e:
                        # 파일 삭제 실패시 로그는 남기되 작업은 계속 진행
                        print(f"Failed to remove processed file {processed_file}: {e}")

        return SceneResponse(
            success=True,
            scene=Scene(
                id=scene_id,
                project_id=project_id,
                scene_num=existing_scene["scene_num"],  # 기존 값 유지
                s3_key=None,
                # display_url=None,
            ),
        )

    raise HTTPException(status_code=400, detail="Invalid status")


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


@router.put("/{scene_id}/originals")
async def save_original_canvas(
    project_id: uuid.UUID,
    scene_id: uuid.UUID,
    canvas_data: dict = Body(...),
    user: UserResponse = Depends(get_current_user),
):
    """원본 캔버스 데이터 저장"""
    async with get_conn() as conn:
        scene_exists = await conn.fetchrow(
            """
            SELECT s.id
            FROM project_scenes ps
                     JOIN scene s ON ps.scene_id = s.id
            WHERE s.id = $1
              AND ps.project_id = $2
            """,
            scene_id,
            project_id,
        )

        if not scene_exists:
            raise HTTPException(status_code=404, detail="Scene not found")

    try:
        # 원본 캔버스를 originals 폴더에 JSON으로 저장
        canvas_file = os.path.join(ORIGINALS_DIR, f"{scene_id}.json")

        async with aiofiles.open(canvas_file, "w", encoding="utf-8") as f:
            await f.write(json.dumps(canvas_data, ensure_ascii=False, indent=2))

        # 씬 db 업데이트
        async with get_conn() as conn:
            scene = await conn.fetchrow(
                """
                UPDATE scene
                SET s3_key = $1
                WHERE id = $2 RETURNING id, s3_key, scene_num
                """,
                f"originals/{scene_id}.json",
                scene_id,
            )

        return {
            "success": True,
            "output_url": scene["s3_key"],
            "message": "Original canvas saved successfully",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save canvas data: {e}")


@router.post("/{scene_id}/processed")
async def convert_canvas_to_dots(
    project_id: uuid.UUID,
    scene_id: uuid.UUID,
    # conversion_options: dict = Body(default={}),
    image: Optional[UploadFile] = File(None),
    target_dots: int = 2000,
    user: UserResponse = Depends(get_current_user),
):
    """원본 캔버스를 도트 캔버스로 변환"""

    async with get_conn() as conn:
        # 씬 존재 여부 확인
        scene_exists = await conn.fetchrow(
            """
            SELECT s.id
            FROM project_scenes ps
            JOIN scene s ON ps.scene_id = s.id
            WHERE s.id = $1 AND ps.project_id = $2
            """,
            scene_id,
            project_id,
        )

        if not scene_exists:
            raise HTTPException(status_code=404, detail="Scene not found")

    # 파일 위치 정의
    original_path = os.path.join(ORIGINALS_DIR, f"{scene_id}.png")
    temp_processed_path = None

    try:
        # 1. 원본 이미지를 받았으면 해당 이미지로 원본 이미지 대체
        if image:
            async with aiofiles.open(original_path, "wb") as out_file:
                content = await image.read()
                await out_file.write(content)

        # 2. 임시 원본 파일로 변환 작업을 시도
        temp_processed_path = process_image(original_path, target_dots=target_dots)

        # 3-1. 변환 성공 시, 임시 변환 파일을 영구 저장소로 이동
        permanent_processed_path = os.path.join(PROCESSED_DIR, f"{scene_id}.json")
        shutil.move(temp_processed_path, permanent_processed_path)

        # 4. DB의 s3_key에 변환된 캔버스 json 파일을 저장.
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
                f"processed/{scene_id}.json",
                scene_id,
                project_id,
            )

        return {
            "success": True,
            "message": "Canvas converted to dots successfully",
            "output_url": f"processed/{scene_id}.json",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Canvas conversion failed: {e}")


@router.put("/{scene_id}/processed")
async def save_dot_canvas(
    project_id: uuid.UUID,
    scene_id: uuid.UUID,
    canvas_data: dict = Body(...),
    user: UserResponse = Depends(get_current_user),
):
    """도트 캔버스 데이터 저장"""
    async with get_conn() as conn:
        scene_exists = await conn.fetchrow(
            """
            SELECT s.id
            FROM project_scenes ps
                     JOIN scene s ON ps.scene_id = s.id
            WHERE s.id = $1
              AND ps.project_id = $2
            """,
            scene_id,
            project_id,
        )

        if not scene_exists:
            raise HTTPException(status_code=404, detail="Scene not found")

    try:
        # 도트 캔버스를 processed 폴더에 저장
        dot_canvas_file = os.path.join(PROCESSED_DIR, f"{scene_id}.json")

        async with aiofiles.open(dot_canvas_file, "w", encoding="utf-8") as f:
            await f.write(json.dumps(canvas_data, ensure_ascii=False, indent=2))

        # 씬 db 업데이트
        async with get_conn() as conn:
            scene = await conn.fetchrow(
                """
                UPDATE scene
                SET s3_key = $1
                WHERE id = $2
                RETURNING id, s3_key, scene_num
                """,
                f"processed/{scene_id}.json",
                scene_id,
            )

        return {
            "success": True,
            "output_url": scene["s3_key"],
            "message": "Dot canvas saved successfully",
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to save dot canvas data: {e}"
        )


@router.post("/{scene_id}/thumbnail")
async def upload_scene_thumbnail(
    project_id: uuid.UUID,
    scene_id: uuid.UUID,
    thumbnail: UploadFile = File(...),
    user: UserResponse = Depends(get_current_user),
):
    """씬 썸네일 이미지 업로드"""

    # 1. 씬 존재 여부 확인
    async with get_conn() as conn:
        scene_exists = await conn.fetchrow(
            """
            SELECT s.id
            FROM project_scenes ps
                     JOIN scene s ON ps.scene_id = s.id
            WHERE s.id = $1
              AND ps.project_id = $2
            """,
            scene_id,
            project_id,
        )
        if not scene_exists:
            raise HTTPException(status_code=404, detail="Scene not found")

    # 썸네일 저장 경로 정의
    thumbnail_filename = f"{scene_id}.png"
    thumbnail_save_path = os.path.join(THUMBNAILS_DIR, thumbnail_filename)

    try:
        # 2. 썸네일 파일 저장
        async with aiofiles.open(thumbnail_save_path, "wb") as f:
            content = await thumbnail.read()
            await f.write(content)

        return {
            "success": True,
            "message": "Thumbnail uploaded successfully",
            "thumbnail_url": f"thumbnails/{thumbnail_filename}",
        }

    except Exception as e:
        # 파일 저장 또는 DB 업데이트 중 오류 발생 시
        raise HTTPException(status_code=500, detail=f"Failed to upload thumbnail: {e}")


def get_display_url(original_s3_key: str) -> str:
    """원본 경로를 표시용 경로로 변환"""
    if not original_s3_key:
        return None

    if original_s3_key.startswith("originals/"):
        return original_s3_key.replace("originals/", "processed/").replace(
            ".png", ".json"
        )

    return original_s3_key
