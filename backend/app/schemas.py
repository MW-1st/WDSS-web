from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None


class User(BaseModel):
    username: str
    disabled: bool = False


class UserInDB(User):
    hashed_password: str


class RegisterRequest(BaseModel):
    email: EmailStr = Field(max_length=32)
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=8, max_length=128)


class RegisterResponse(BaseModel):
    id: str
    email: EmailStr
    username: str
