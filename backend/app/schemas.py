import datetime

from pydantic import BaseModel, EmailStr, Field
from typing import Optional


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
    username: str
    disabled: bool = False


class UserInDB(UserResponse):
    hashed_password: str


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
    max_speed: float
    max_accel: float
    min_separation: float
    created_at: datetime.datetime
    updated_at: datetime.datetime


class ProjectListResponse(BaseModel):
    success: bool = True
    projects: list[Project]
