from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

from app.schemas import Token, User, UserInDB
from app.utils import security
from app.core import config


router = APIRouter()


# OAuth2 scheme expects a tokenUrl where clients can get the token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# Temporary in-memory user store for demo. Replace with DB lookup.
_fake_user_db: dict[str, UserInDB] = {}


def _ensure_demo_user():
    # Create a demo user only once in memory
    if "demo" not in _fake_user_db:
        _fake_user_db["demo"] = UserInDB(
            username="demo",
            hashed_password=security.get_password_hash("demo1234"),
            disabled=False,
        )


def authenticate_user(username: str, password: str) -> UserInDB | None:
    _ensure_demo_user()
    user = _fake_user_db.get(username)
    if not user:
        return None
    if not security.verify_password(password, user.hashed_password):
        return None
    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(subject=user.username, expires_delta=access_token_expires)
    return Token(access_token=access_token)


def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    try:
        payload = security.decode_token(token)
        username: str | None = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")

    user_in_db = _fake_user_db.get(username)
    if user_in_db is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if user_in_db.disabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return User(username=user_in_db.username, disabled=user_in_db.disabled)


@router.get("/me", response_model=User)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

