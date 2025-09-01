import os
import uuid
from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import aiofiles

# database.py 파일에서 get_conn 함수를 가져옵니다.
from app.db.database import get_conn

# 라우터 설정
router = APIRouter()

# 이미지를 저장할 기본 디렉토리 설정
UPLOAD_DIRECTORY = "./uploaded_images"
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)


@router.post("/upload-image")
async def upload_image(
    project_id: int,
    scene_id: int,  # DB의 scene_num 컬럼과 매칭
    image: UploadFile = File(...),
):
    """
    이미지를 서버에 업로드하고, asyncpg를 사용해 DB에 경로를 업데이트합니다.
    """
    # 1. 파일 확장자 검사 및 경로 설정
    allowed_extensions = {"png", "jpg", "jpeg"}
    file_extension = image.filename.split(".")[-1].lower()
    if file_extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail="허용되지 않는 파일 형식입니다.")

    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIRECTORY, unique_filename)

    # 2. 파일을 비동기적으로 저장
    try:
        async with aiofiles.open(file_path, "wb") as out_file:
            while content := await image.read(1024):
                await out_file.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 저장 중 오류 발생: {e}")

    # 3. DB 업데이트
    try:
        # 3-1. get_conn 컨텍스트 관리자를 사용해 DB 커넥션을 얻습니다.
        async with get_conn() as conn:
            # 3-2. 실행할 SQL 쿼리 (SQL 인젝션 방지를 위해 $1, $2 사용)
            query = "UPDATE scene SET s3_key = $1 WHERE scene_num = $2"

            # 3-3. 쿼리를 실행하고 결과를 받습니다.
            # conn.execute는 "UPDATE 1"과 같은 상태 메시지를 문자열로 반환합니다.
            status = await conn.execute(query, file_path, scene_id)

            # 3-4. 영향 받은 행(row)이 있는지 확인합니다.
            updated_rows = int(status.split()[-1])
            if updated_rows == 0:
                # 업데이트된 행이 없으면 해당 scene_id가 존재하지 않는 것이므로 404 에러 발생
                raise HTTPException(
                    status_code=404,
                    detail=f"Scene ID(num) {scene_id}를 찾을 수 없습니다.",
                )

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
