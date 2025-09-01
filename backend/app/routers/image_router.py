from fastapi import APIRouter, UploadFile, File
from app.services.image_service import process_image
import shutil

router = APIRouter(prefix="/image", tags=["image"])


@router.post("/process")
async def process_uploaded_image(file: UploadFile = File(...)):
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    output_path = process_image(temp_path)
    return {"output_path": output_path}
