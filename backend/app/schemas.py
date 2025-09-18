import datetime
import uuid
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List, Any


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None


# class User(BaseModel):
#     username: str
#     disabled: bool = False
class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    disabled: bool = False


class UserInDB(UserResponse):
    hashed_password: str
    is_email_verified: bool = False


class SendVerificationRequest(BaseModel):
    email: EmailStr = Field(max_length=32)



class RegisterRequest(BaseModel):
    email: EmailStr = Field(max_length=32)
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=8, max_length=128)


class RegisterResponse(BaseModel):
    id: str
    email: EmailStr
    username: str


# logout?
class MessageResponse(BaseModel):
    success: bool = True
    message: str


class Project(BaseModel):
    id: str
    project_name: str
    format: str
    max_scene: int
    max_drone: int
    max_speed: float
    max_accel: float
    min_separation: float
    created_at: datetime.datetime
    updated_at: datetime.datetime


class ProjectListResponse(BaseModel):
    success: bool = True
    projects: list[Project]


class ProjectBase(BaseModel):
    """프로젝트의 기본 필드를 정의하는 모델"""

    project_name: str = Field(
        ..., description="프로젝트 이름", example="새 드론쇼 프로젝트"
    )
    format: str = Field("dsj", description="프로젝트 포맷", example="dsj")
    max_drone: int = Field(..., description="최대 드론 개수", example=10)
    max_speed: float = Field(..., description="최대 속도", example=6.0)
    max_accel: float = Field(..., description="최대 가속도", example=3.0)
    min_separation: float = Field(..., description="드론간 최소 이격 거리", example=2.0)


class ProjectCreate(ProjectBase):
    """프로젝트 생성 시 요청 본문에 사용되는 모델"""

    pass


class ProjectUpdate(BaseModel):
    """프로젝트 수정 시 요청 본문에 사용되는 모델 (모든 필드는 선택적)"""

    project_name: Optional[str] = Field(
        None, description="수정할 프로젝트 이름", example="수정된 프로젝트 이름"
    )
    max_drone: Optional[int] = Field(
        None, description="수정할 최대 드론 개수", example=15
    )
    max_speed: Optional[float] = Field(
        None, description="수정할 최대 속도", example=8.0
    )
    max_accel: Optional[float] = Field(
        None, description="수정할 최대 가속도", example=4.0
    )
    min_separation: Optional[float] = Field(
        None, description="수정할 드론간 최소 이격 거리", example=1.5
    )


class ProjectResponse(ProjectBase):
    """프로젝트 생성 또는 수정 후 응답에 포함될 프로젝트 정보 모델"""

    id: uuid.UUID = Field(..., description="프로젝트 고유 ID")
    user_id: uuid.UUID = Field(..., description="사용자 고유 ID")
    created_at: datetime.datetime = Field(..., description="생성 일시")
    updated_at: datetime.datetime = Field(..., description="수정 일시")

    class Config:
        orm_mode = True  # orm_mode 대신 from_attributes=True (Pydantic v2)


class SceneResponse(BaseModel):
    """프로젝트 상세 조회 시 포함될 씬 정보 모델"""

    id: uuid.UUID = Field(..., description="씬 고유 ID")
    scene_num: int = Field(..., description="씬 번호")
    s3_key: str | None = Field(None, description="S3에 저장된 씬 파일의 키")

    class Config:
        orm_mode = True


class ProjectDetailResponse(ProjectResponse):
    """프로젝트 상세 조회 응답에 사용될 모델"""

    scenes: List[SceneResponse] = []


class ProjectListResponse(BaseModel):
    """프로젝트 목록 조회 응답 모델"""

    projects: List[ProjectResponse]


class SuccessResponse(BaseModel):
    """성공 여부만 반환하는 응답 모델"""

    success: bool = True


class ProjectDataResponse(SuccessResponse):
    """프로젝트 데이터를 포함하는 성공 응답 모델"""

    project: ProjectResponse


class ProjectDetailDataResponse(SuccessResponse):
    """상세 프로젝트 데이터를 포함하는 성공 응답 모델"""

    project: ProjectDetailResponse


class ProjectListDataResponse(BaseModel):
    """프로젝트 목록 + 전체 개수 반환 모델"""

    success: bool = True
    projects: List[ProjectResponse]
    total: int = 0


# schemas.py에서 Scene 관련 스키마 수정
class SceneCreate(BaseModel):
    scene_num: Optional[int] = None


class SceneUpdate(BaseModel):
    s3_key: Optional[str] = None


class Scene(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    scene_num: int
    s3_key: Optional[str] = None
    display_url: Optional[str] = None


class SceneResponse(BaseModel):
    success: bool
    scene: Scene


class ScenesResponse(BaseModel):
    success: bool
    scenes: List[Scene]


class ScenePatch(BaseModel):
    status: str


class DeleteImageRequest(BaseModel):
    imageUrl: str


class TransformOptions(BaseModel):
    target_dots: int | None = 2000
    color_r: int | None = 0
    color_g: int | None = 0
    color_b: int | None = 0
