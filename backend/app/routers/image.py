import os
import uuid
from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import aiofiles  # 비동기 파일 처리를 위한 라이브러리

# 라우터 설정
router = APIRouter()

# 이미지를 저장할 기본 디렉토리 설정
UPLOAD_DIRECTORY = "./uploaded_images"

# 서버 시작 시 UPLOAD_DIRECTORY가 없으면 생성
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)


@router.post("/upload-image")
async def upload_image(project_id: int, scene_id: int, image: UploadFile = File(...)):
    """
    이미지를 서버에 업로드하고 저장된 URL을 반환합니다.
    """
    # 1. 파일 확장자 검사 (옵션이지만 보안상 권장)
    allowed_extensions = {"png", "jpg", "jpeg", "gif"}
    file_extension = image.filename.split(".")[-1].lower()
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="허용되지 않는 파일 형식입니다. (png, jpg, jpeg, gif만 가능)",
        )

    # 2. 고유한 파일 이름 생성 (UUID 사용)
    # 원래 파일의 확장자를 유지하면서, UUID로 새로운 파일 이름을 만듭니다.
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIRECTORY, unique_filename)

    # 3. 파일을 비동기적으로 저장
    try:
        async with aiofiles.open(file_path, "wb") as out_file:
            while content := await image.read(1024):  # 1024 바이트(1KB)씩 스트리밍
                await out_file.write(content)
    except Exception as e:
        # 파일 저장 중 오류 발생 시 500 에러 반환
        raise HTTPException(status_code=500, detail=f"파일 저장 중 오류 발생: {e}")

    # 4. 성공 응답 반환
    # 클라이언트가 이미지에 접근할 수 있는 URL을 만들어 반환합니다.
    # 이 URL은 실제 서비스에서는 설정에 따라 달라질 수 있습니다.
    image_url = f"/static/images/{unique_filename}"  # 예시 URL

    return JSONResponse(
        status_code=200,
        content={
            "message": "이미지 업로드 성공",
            "image_url": image_url,
            "filename": unique_filename,
        },
    )