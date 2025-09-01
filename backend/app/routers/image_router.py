from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.image_service import process_image
from app.services.svg_service import svg_to_coords, coords_to_json
import shutil
import os
import uuid
import json
from app.db.database import get_conn
from app.routers.websocket import manager

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
    """
    Accepts an SVG file, converts coordinates to DSJ JSON, saves to backend/svg_json,
    and returns the downloadable URL under /svg-json/*.
    """
    backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    tmp_dir = os.path.join(backend_root, "tmp")
    out_dir = os.path.join(backend_root, "svg_json")
    os.makedirs(tmp_dir, exist_ok=True)
    os.makedirs(out_dir, exist_ok=True)

    ext = os.path.splitext(file.filename or "")[1].lower() or ".svg"
    temp_path = os.path.join(tmp_dir, f"tmp_{uuid.uuid4().hex}{ext}")

    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        coords = svg_to_coords(temp_path)
        data = coords_to_json(
            coords,
            show_name=show_name,
            max_scene=max_scene,
            max_drone=max_drone,
            scene_number=scene_number,
            scene_holder=scene_holder,
            z_value=z_value,
            scale_x=scale_x,
            scale_y=scale_y,
            scale_z=scale_z,
            offset_x=offset_x,
            offset_y=offset_y,
            offset_z=offset_z,
            led_intensity=led_intensity,
            led_rgb=(led_r, led_g, led_b),
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
        out_path = os.path.join(out_dir, out_name)

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
