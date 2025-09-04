import asyncpg
from app.db.database import get_db
from app.db.project import (
    get_projects_by_user_id,
    create_project,
    get_project_by_id,
    update_project_by_id,
    delete_project_by_id,
)
from app.dependencies import get_current_user
from app.schemas import (
    UserResponse,
    ProjectListResponse,
    ProjectDataResponse,
    ProjectCreate,
    ProjectDetailDataResponse,
    SuccessResponse,
    ProjectUpdate,
)
from fastapi import APIRouter, Depends, status, HTTPException
import uuid

router = APIRouter()


@router.get("", response_model=ProjectListResponse, summary="프로젝트 목록 조회")
async def list_projects(
    current_user: UserResponse = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    """
    현재 로그인한 사용자의 모든 **프로젝트 목록**을 조회합니다.
    """
    projects_list = await get_projects_by_user_id(conn, current_user.id)
    return {"projects": projects_list}


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
