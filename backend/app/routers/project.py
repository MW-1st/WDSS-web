import asyncpg
from app.db.database import get_conn
from app.db.project import get_projects_by_user_id
from app.dependencies import get_current_user
from app.schemas import UserResponse, ProjectListResponse
from fastapi import APIRouter, Depends, status
from fastapi.responses import RedirectResponse

router = APIRouter()


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    # 현재 로그인한 사용자 정보를 가져옵니다.
    current_user: UserResponse = Depends(get_current_user),
    # 데이터베이스 커넥션을 주입받습니다.
    conn: asyncpg.Connection = Depends(get_conn),
):
    """
    현재 로그인한 사용자의 모든 프로젝트 목록을 조회합니다.
    """
    # 1. DB 로직 함수를 호출하여 프로젝트 목록 데이터를 가져옵니다.
    projects_list = await get_projects_by_user_id(conn, current_user.id)

    # 2. Pydantic 모델 형식에 맞춰 데이터를 반환합니다.
    #    FastAPI가 response_model을 보고 자동으로 {"success": true, "projects": [...]} 형식으로 만들어줍니다.
    return {"projects": projects_list}


@router.post("/")
async def create_projects():
    pass


@router.get("/{project_id}")
async def get_project():
    pass


@router.put("/{project_id}")
async def update_project():
    pass


@router.delete("/{project_id}")
async def delete_project():
    pass
