import asyncpg
from app.config import PROCESSED_DIR, SVG_JSON_DIR
from app.db.database import get_db
from app.dependencies import get_current_user
from app.schemas import (
    UserResponse,
    ProjectListDataResponse,
    ProjectDataResponse,
    ProjectCreate,
    ProjectDetailDataResponse,
    SuccessResponse,
    ProjectUpdate,
)
from app.db.project import (
    get_projects_by_user_id,
    get_projects_by_user_id_paginated,
    create_project,
    get_project_by_id,
    update_project_by_id,
    delete_project_by_id,
)
from app.routers.websocket import manager
from app.services.fabric_json_service import (
    fabric_json_to_coords_with_colors,
    get_fabric_json_size,
)
from fastapi import APIRouter, Depends, status, HTTPException
import json
import os
import uuid
import websockets

router = APIRouter()


@router.get("", response_model=ProjectListDataResponse, summary="프로젝트 목록 조회")
async def list_projects(
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
    limit: int = 12,
    offset: int = 0,
):
    """
    현재 로그인한 사용자의 모든 **프로젝트 목록**을 조회합니다.
    """
    # 안전장치: limit 상한
    if limit <= 0:
        limit = 10
    if limit > 100:
        limit = 100

    projects_list, total = await get_projects_by_user_id_paginated(
        conn, current_user.id, limit=limit, offset=offset
    )
    return {"success": True, "projects": projects_list, "total": total}


@router.post(
    "",
    response_model=ProjectDataResponse,
    status_code=status.HTTP_201_CREATED,
    summary="프로젝트 생성",
)
async def create_new_project(
    project: ProjectCreate,
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    """
    새로운 **드론쇼 프로젝트**를 생성합니다.

    - **project_name**: 프로젝트의 이름
    - **format**: 포맷 (기본값: "dsj")
    - **max_scene**: 최대 씬 개수
    - **max_drone**: 최대 드론 개수
    - **max_speed**: 드론의 최대 속도 (m/s)
    - **max_accel**: 드론의 최대 가속도 (m/s²)
    - **min_separation**: 드론 간 최소 안전 이격 거리 (m)
    """
    new_project_record = await create_project(conn, project, current_user.id)
    return {"success": True, "project": new_project_record}


@router.get(
    "/{project_id}",
    response_model=ProjectDetailDataResponse,
    summary="프로젝트 상세 조회",
)
async def get_project_details(
    project_id: uuid.UUID,
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    """
    특정 **프로젝트의 상세 정보**를 조회합니다. 프로젝트에 포함된 씬 목록도 함께 반환됩니다.
    """
    project_record = await get_project_by_id(conn, project_id, current_user.id)
    if not project_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    return {"success": True, "project": project_record}


@router.put(
    "/{project_id}", response_model=ProjectDataResponse, summary="프로젝트 수정"
)
async def update_existing_project(
    project_id: uuid.UUID,
    project_update: ProjectUpdate,
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    """
    특정 **프로젝트의 정보**를 수정합니다. 수정하려는 필드만 요청 본문에 포함하여 전송합니다.
    """
    updated_project_record = await update_project_by_id(
        conn, project_id, project_update, current_user.id
    )
    if not updated_project_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    return {"success": True, "project": updated_project_record}


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_200_OK,
    response_model=SuccessResponse,
    summary="프로젝트 삭제",
)
async def delete_existing_project(
    project_id: uuid.UUID,
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    """
    특정 **프로젝트를 삭제**합니다.
    """
    success = await delete_project_by_id(conn, project_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    return {"success": True}

## GCS서버로 json보내버리기
async def send_json_to_external_server(json_data: str):
    """외부 WebSocket 서버로 JSON 데이터를 전송합니다."""
    # uri = "ws://gsc.wdss.store:8000/"
    uri = "ws://3.36.114.187:5089/json"
    try:
        print(f"Attempting to send JSON data to {uri}")
        async with websockets.connect(uri) as websocket:
            await websocket.send(json_data)
            print(f"Successfully sent JSON data to {uri}")
    except Exception as e:
        # 주 프로세스를 중단시키지 않고 오류를 로깅합니다.
        print(f"Error sending JSON to external server {uri}: {e}")


@router.post("/{project_id}/json")
async def export_project_to_json(
    project_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
    # 개별 씬 변환 파라미터들 (DB에 없는 값들)
    z_value: float = 0.0,
    scale_x: float = 1.0,
    scale_y: float = 1.0,
    scale_z: float = 1.0,
    offset_x: float = 0.0,
    offset_y: float = 0.0,
    offset_z: float = 0.0,
    led_intensity: float = 1.0,
):
    """프로젝트의 모든 씬을 JSON으로 변환"""

    # 프로젝트 정보 가져오기 (JSON 메타데이터용)
    project = await conn.fetchrow(
        """
              SELECT project_name, format, max_scene, max_drone, max_speed, max_accel, min_separation
              FROM project
              WHERE id = $1
              """,
        project_id,
    )

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # 씬들 가져오기
    scenes = await conn.fetch(
        """
              SELECT s.id, s.scene_num
              FROM project_scenes ps
                       JOIN scene s ON ps.scene_id = s.id
              WHERE ps.project_id = $1
              ORDER BY s.scene_num
              """,
        project_id,
    )

    if not scenes:
        raise HTTPException(status_code=404, detail="No scenes found")

    all_scenes_data = []
    max_drone = int(project["max_drone"]);

    for i, scene in enumerate(scenes):
        scene_id = scene["id"]
        scene_num = scene["scene_num"]

        # scene_holder 계산: 다음 씬까지의 간격
        if i < len(scenes) - 1:  # 마지막 씬이 아닌 경우
            next_scene_num = scenes[i + 1]["scene_num"]
            scene_holder = next_scene_num - scene_num - 1
        else:  # 마지막 씬인 경우
            scene_holder = 0  # 기본값 또는 DB에서 설정된 기본 지속시간

        # processed 파일 경로
        processed_path = os.path.join(PROCESSED_DIR, f"{scene_id}.json")

        if os.path.exists(processed_path):
            try:
                # SVG 파일을 좌표+색상으로 변환
                coords_with_colors = fabric_json_to_coords_with_colors(processed_path)
                scene_w, scene_h, scene_z = get_fabric_json_size(processed_path)

                # 드론 수 갱신
                max_drone = min(len(coords_with_colors), max_drone)
                print(len(coords_with_colors))

                # 개별 씬 액션 데이터 생성
                actions = []
                for x, y, (r, g, b), opacity in coords_with_colors:
                    tx = x * scale_x + offset_x
                    ty = y * scale_y + offset_y
                    tz = z_value * scale_z + offset_z
                    actions.append(
                        {
                            "led_intensity": float(opacity),
                            "led_rgb": [int(r), int(g), int(b)],
                            "transform_pos": [float(tx), float(ty), float(tz)],
                        }
                    )

                # 씬 데이터 구성
                scene_data = {
                    "scene_number": int(scene_num),
                    "scene_holder": scene_holder,
                    "scene_size": [float(scene_w), float(scene_h), float(scene_z)],
                    "action_data": actions,
                }

                all_scenes_data.append(scene_data)

            except Exception as e:
                print(f"Error processing scene {scene_id}: {e}")
                continue

    if not all_scenes_data:
        raise HTTPException(status_code=400, detail="No valid processed scenes found")

    # 프로젝트 레벨 JSON 구성 (무조건 DB 값 사용)
    project_json = {
        "format": (project["format"] or "dsj").strip(),
        "show": {
            "show_name": project["project_name"] or "Untitled Show",
            "max_drone": max_drone,
            "max_scene": len(scenes),
        },
        "constraints": {
            "max_speed": float(project["max_speed"] or 6.0),
            "max_accel": float(project["max_accel"] or 3.0),
            "min_separation": float(project["min_separation"] or 2.0),
        },
        "scenes": all_scenes_data,
    }

    # JSON 파일 저장
    from datetime import datetime

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_name = f"{project_id}_{ts}.json"
    out_path = os.path.join(SVG_JSON_DIR, out_name)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(project_json, f, ensure_ascii=False, indent=2)

    # Unity로 전송
    await send_json_to_external_server(json.dumps(project_json))

    return {
        "json_url": f"/svg-json/{out_name}",
        "unity_sent": True,
        "scenes_processed": len(all_scenes_data),
        "total_scenes": len(scenes),
    }
