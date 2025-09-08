import re

import aiofiles
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.services.image_service import process_image
from app.services.svg_service import (
    svg_to_coords,
    coords_to_json,
    get_svg_size,
    svg_to_coords_with_colors,
    coords_with_colors_to_json,
)
import shutil
import os
import uuid
import json
from app.db.database import get_conn
from app.routers.websocket import manager
from starlette.responses import JSONResponse
from app.dependencies import get_current_user
from app.schemas import UserResponse, DeleteImageRequest
from app.config import UPLOAD_DIRECTORY, TMP_DIR, SVG_JSON_DIR

router = APIRouter(prefix="/image", tags=["image"])


@router.get("/my-images")
async def get_my_images(
    current_user: UserResponse = Depends(get_current_user),
):
    """
    현재 로그인한 사용자가 업로드한 모든 이미지의 URL 목록을 반환합니다.
    """
    # 1. 현재 사용자의 ID로 업로드 폴더 경로를 특정합니다.
    user_upload_dir = os.path.join(UPLOAD_DIRECTORY, str(current_user.id))

    # 2. 해당 폴더가 없는 경우, 빈 목록을 반환합니다.
    if not os.path.isdir(user_upload_dir):
        return {"images": []}

    # 3. 폴더 내의 모든 파일 목록을 읽어옵니다.
    try:
        image_files = os.listdir(user_upload_dir)

        # 4. 각 파일명을 웹에서 접근 가능한 URL로 변환합니다.
        image_urls = [
            f"/api/uploads/{current_user.id}/{filename}"
            for filename in image_files
            if filename.lower().endswith(
                (".png", ".jpg", ".jpeg")
            )  # 이미지 파일만 필터링
        ]

        return {"images": image_urls}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"이미지 목록을 불러오는 중 오류 발생: {e}"
        )


@router.post("/upload")
async def upload_image(
    image: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user),
):
    """
    이미지를 서버에 업로드하고, asyncpg를 사용해 DB에 경로를 업데이트합니다.
    """
    # 1. 파일 확장자 검사 및 경로 설정
    allowed_extensions = {"png", "jpg", "jpeg"}
    file_extension = image.filename.split(".")[-1].lower()
    if file_extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail="허용되지 않는 파일 형식입니다.")

    user_upload_dir = os.path.join(UPLOAD_DIRECTORY, str(current_user.id))
    os.makedirs(user_upload_dir, exist_ok=True)

    unique_filename = f"{current_user.id}/{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIRECTORY, unique_filename)
    s3_key = f"/api/uploads/{unique_filename}"

    # 2. 파일을 비동기적으로 저장
    try:
        async with aiofiles.open(file_path, "wb") as out_file:
            while content := await image.read(1024):
                await out_file.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 저장 중 오류 발생: {e}")

    except HTTPException as http_exc:
        # 404 에러가 발생한 경우, 저장했던 파일을 삭제(롤백)하고 에러를 다시 발생시킵니다.
        os.remove(file_path)
        raise http_exc
    except Exception as e:
        # 그 외 DB 관련 에러 발생 시에도 파일을 삭제(롤백)합니다.
        os.remove(file_path)
        raise HTTPException(
            status_code=500, detail=f"데이터베이스 업데이트 중 오류 발생: {e}"
        )

    # 6. 성공 응답 반환
    return JSONResponse(
        status_code=200,
        content={
            "success": True,
            "message": "이미지가 업로드되었습니다.",
            "image_url": file_path,
        },
    )


@router.delete("/delete")
async def delete_image(
    request: DeleteImageRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    S3 또는 서버에 저장된 특정 이미지를 삭제합니다.
    사용자 본인의 이미지만 삭제할 수 있습니다.
    """
    image_url = request.imageUrl

    # 1. URL에서 파일 경로를 추출합니다. (예: /uploads/user-id/filename.png)
    #    정규식을 사용하여 안전하게 경로 부분만 추출합니다.
    match = re.search(r"/uploads/(.+)", image_url)
    if not match:
        raise HTTPException(
            status_code=400,
            detail=f"유효하지 않은 이미지 URL 형식입니다.",
        )

    relative_path = match.group(1)  # 예: user-id/filename.png

    # 2. 보안 검사: 경로에 포함된 사용자 ID가 현재 로그인한 사용자의 ID와 일치하는지 확인
    try:
        path_user_id = relative_path.split("/")[0]
        if path_user_id != str(current_user.id):
            raise HTTPException(
                status_code=403, detail="자신의 이미지만 삭제할 수 있습니다."
            )
    except IndexError:
        raise HTTPException(status_code=400, detail="잘못된 파일 경로입니다.")

    # 3. 실제 파일 시스템 경로를 구성하고 파일 삭제
    file_to_delete = os.path.join(UPLOAD_DIRECTORY, relative_path)

    # 4. 보안 검사: 최종 경로가 UPLOAD_DIRECTORY 내에 있는지 다시 한번 확인 (경로 조작 공격 방지)
    if not os.path.abspath(file_to_delete).startswith(
        os.path.abspath(UPLOAD_DIRECTORY)
    ):
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")

    if os.path.exists(file_to_delete):
        try:
            os.remove(file_to_delete)
            return {"success": True, "message": "이미지가 성공적으로 삭제되었습니다."}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"파일 삭제 중 오류 발생: {e}")
    else:
        # 파일이 서버에 없더라도 클라이언트 입장에서는 성공한 것이므로 404 대신 성공으로 처리할 수 있습니다.
        return {"success": True, "message": "이미지가 이미 존재하지 않습니다."}


@router.post("/process")
async def process_uploaded_image(
    file: UploadFile | None = File(None),
    target_dots: int | None = None,
    project_id: int | None = None,
    scene_id: int | None = None,
    color_r: int | None = None,
    color_g: int | None = None,
    color_b: int | None = None,
):
    """
    변환은 항상 DB에 저장된 원본 이미지 경로를 기준으로 수행합니다.
    - scene_id가 주어지면 scene.s3_key에서 경로를 조회합니다.
    - scene_id가 없고 파일이 주어진 경우에만 임시 파일로 처리합니다(백워드 호환).
    """
    backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

    input_path: str | None = None

    # 1) scene_id가 있으면 DB에서 원본 경로 조회
    if scene_id is not None:
        async with get_conn() as conn:
            db_path = await conn.fetchval(
                "SELECT s3_key FROM scene WHERE scene_num = $1", scene_id
            )
        if not db_path:
            raise HTTPException(
                status_code=404, detail="Original image not found for the scene"
            )
        if not os.path.isabs(db_path):
            # 상대 경로로 저장된 경우 백엔드 루트 기준으로 보정
            db_path = os.path.join(backend_root, db_path)
        if not os.path.exists(db_path):
            raise HTTPException(
                status_code=404, detail="Original image file does not exist on disk"
            )
        input_path = db_path

    # 2) scene_id가 없고 업로드 파일이 오면 임시 파일로 처리
    elif file is not None:
        tmp_dir = os.path.join(backend_root, "tmp")
        os.makedirs(tmp_dir, exist_ok=True)
        ext = os.path.splitext(file.filename or "")[1].lower() or ".png"
        temp_path = os.path.join(tmp_dir, f"tmp_{uuid.uuid4().hex}{ext}")
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        input_path = temp_path
    else:
        raise HTTPException(status_code=400, detail="scene_id or file is required")

    try:
        # RGB 색상 정보를 process_image 함수에 전달
        color_rgb = None
        if color_r is not None and color_g is not None and color_b is not None:
            color_rgb = (color_r, color_g, color_b)

        output_path = process_image(
            input_path, target_dots=target_dots, color_rgb=color_rgb
        )
    finally:
        # 임시 파일 정리 (scene 경로가 아닌 경우)
        if input_path and os.path.dirname(input_path).endswith(os.path.sep + "tmp"):
            try:
                os.remove(input_path)
            except OSError:
                pass

    return {"output_url": f"uploads/{os.path.basename(output_path)}"}


@router.post("/svg-to-json")
async def svg_to_json_endpoint(
    file: UploadFile = File(...),
    show_name: str = "svg-import",
    scene_number: int = 1,
    scene_holder: int = 0,
    max_scene: int = 1,
    max_drone: int | None = None,
    # mapping
    z_value: float = 0.0,
    scale_x: float = 1.0,
    scale_y: float = 1.0,
    scale_z: float = 1.0,
    offset_x: float = 0.0,
    offset_y: float = 0.0,
    offset_z: float = 0.0,
    # visuals
    led_intensity: float = 1.0,
    led_r: int = 255,
    led_g: int = 255,
    led_b: int = 255,
    # constraints
    max_speed: float = 6.0,
    max_accel: float = 3.0,
    min_separation: float = 2.0,
):

    ext = os.path.splitext(file.filename or "")[1].lower() or ".svg"
    temp_path = os.path.join(TMP_DIR, f"tmp_{uuid.uuid4().hex}{ext}")

    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        coords_with_colors = svg_to_coords_with_colors(temp_path)
        scene_w, scene_h, scene_z = get_svg_size(temp_path)
        data = coords_with_colors_to_json(
            coords_with_colors,
            show_name=show_name,
            max_scene=max_scene,
            max_drone=max_drone,
            scene_number=scene_number,
            scene_holder=scene_holder,
            scene_size=(scene_w, scene_h, scene_z),
            z_value=z_value,
            scale_x=scale_x,
            scale_y=scale_y,
            scale_z=scale_z,
            offset_x=offset_x,
            offset_y=offset_y,
            offset_z=offset_z,
            led_intensity=led_intensity,
            max_speed=max_speed,
            max_accel=max_accel,
            min_separation=min_separation,
        )

        # Save JSON with timestamped filename
        from datetime import datetime

        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        base = os.path.splitext(os.path.basename(file.filename or "import.svg"))[0]
        safe_base = base or "svg"
        out_name = f"{safe_base}_{ts}_{uuid.uuid4().hex[:6]}.json"
        out_path = os.path.join(SVG_JSON_DIR, out_name)

        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # Unity로 JSON 데이터 전송
        await manager.broadcast(json.dumps(data))

        return {"json_url": f"/svg-json/{out_name}", "unity_sent": True}
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass
