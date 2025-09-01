from fastapi import APIRouter, UploadFile, File
from app.services.image_service import process_image
import shutil
import os
import uuid

router = APIRouter(prefix="/image", tags=["image"])


@router.post("/process")
async def process_uploaded_image(file: UploadFile = File(...)):
    # 임시 저장 경로
    backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    tmp_dir = os.path.join(backend_root, "tmp")
    os.makedirs(tmp_dir, exist_ok=True)

    ext = os.path.splitext(file.filename)[1].lower() or ".png"
    temp_path = os.path.join(tmp_dir, f"tmp_{uuid.uuid4().hex}{ext}")

    # 파일 저장
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        output_path = process_image(temp_path)
    finally:
        # 임시 파일 정리
        try:
            os.remove(temp_path)
        except OSError:
            pass

    return {"output_path": output_path}
