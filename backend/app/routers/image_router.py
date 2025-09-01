from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.image_service import process_image
import shutil
import os
import uuid
from app.db.database import get_conn

router = APIRouter(prefix="/image", tags=["image"])


@router.post("/process")
async def process_uploaded_image(
    file: UploadFile | None = File(None),
    target_dots: int | None = None,
    project_id: int | None = None,
    scene_id: int | None = None,
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
            db_path = await conn.fetchval("SELECT s3_key FROM scene WHERE scene_num = $1", scene_id)
        if not db_path:
            raise HTTPException(status_code=404, detail="Original image not found for the scene")
        if not os.path.isabs(db_path):
            # 상대 경로로 저장된 경우 백엔드 루트 기준으로 보정
            db_path = os.path.join(backend_root, db_path)
        if not os.path.exists(db_path):
            raise HTTPException(status_code=404, detail="Original image file does not exist on disk")
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
        output_path = process_image(input_path, target_dots=target_dots)
    finally:
        # 임시 파일 정리 (scene 경로가 아닌 경우)
        if input_path and os.path.dirname(input_path).endswith(os.path.sep + "tmp"):
            try:
                os.remove(input_path)
            except OSError:
                pass

    return {"output_url": f"/uploads/{os.path.basename(output_path)}"}
