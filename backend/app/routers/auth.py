from datetime import timedelta
import uuid
from typing import Optional
from asyncpg import exceptions as pgexc
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
import asyncio
import json

from app.schemas import (
    Token,
    UserInDB,
    UserResponse,
    RegisterRequest,
    RegisterResponse,
    MessageResponse,
    SendVerificationRequest,
)
from app.utils import security
from app.core import config
from app.db.database import get_conn
from app.db.user import get_user_by_username
from app.dependencies import get_current_user
from app.utils.mailer import send_email

router = APIRouter()

# SSE를 위한 인메모리 스토어 (이메일별 인증 상태 관리)
verification_store = {}
verification_events = {}

# 이메일 재발송 제한을 위한 스토어 (이메일별 마지막 발송 시간)
email_send_timestamps = {}


async def authenticate_user(username: str, password: str) -> Optional[UserInDB]:
    async with get_conn() as conn:
        user = await get_user_by_username(conn, username)
        if not user or not user.hashed_password:
            return None
        if not security.verify_password(password, user.hashed_password):
            return None
        # 이메일 인증 여부 확인
        if not user.is_email_verified:
            return None
        return user


@router.post("/login")
async def login(
    response: Response,  # 2. Response 객체를 주입받도록 추가
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    # 사용자 존재 여부와 비밀번호 확인
    async with get_conn() as conn:
        user = await get_user_by_username(conn, form_data.username)
        if not user or not user.hashed_password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not security.verify_password(form_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        # 이메일 인증 여부 확인
        if not user.is_email_verified:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Please verify your email before logging in. Check your inbox for the verification link.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    access_token_expires = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        subject=user.username, expires_delta=access_token_expires
    )

    # 3. 생성된 토큰을 JSON 본문 대신 HttpOnly 쿠키에 설정
    response.set_cookie(
        key="access_token",
        value=access_token,
        path="/",
        httponly=True,  # JavaScript에서 접근 불가
        secure=False,  # 프로덕션(HTTPS) 환경에서는 True로 설정 권장
        samesite="lax",  # CSRF 방어
    )
    user_response_data = UserResponse.model_validate(user)

    # 4. Token 모델 대신, 성공 여부와 사용자 정보를 담은 JSON을 반환
    return {"success": True, "user": user_response_data}


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: UserResponse = Depends(get_current_user)):
    return current_user


@router.get("/verification-stream/{email}")
async def verification_stream(email: str):
    """SSE 엔드포인트: 이메일 인증 상태를 실시간으로 스트리밍"""

    async def event_publisher():
        # 연결 초기화
        verification_events[email] = asyncio.Event()

        try:
            yield f"data: {json.dumps({'status': 'connected', 'email': email})}\n\n"

            while True:
                # 인증 이벤트 대기
                await verification_events[email].wait()

                # 인증 상태 확인
                if email in verification_store and verification_store[email].get('verified'):
                    token = verification_store[email].get('token')
                    yield f"data: {json.dumps({'status': 'verified', 'email': email, 'token': token})}\n\n"
                    break

                # 이벤트 리셋
                verification_events[email].clear()

        except asyncio.CancelledError:
            pass
        finally:
            # 정리
            if email in verification_events:
                del verification_events[email]
            if email in verification_store:
                del verification_store[email]

    return StreamingResponse(
        event_publisher(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control"
        }
    )


async def _send_verification_email_internal(email: str, is_resend: bool = False):
    """내부 이메일 발송 함수 (재발송 제한 로직 포함)"""
    import time

    current_time = time.time()
    email_str = str(email)

    # 재발송 제한 확인 (재발송인 경우에만)
    if is_resend and email_str in email_send_timestamps:
        time_since_last_send = current_time - email_send_timestamps[email_str]
        if time_since_last_send < 60:  # 60초 제한
            remaining_time = int(60 - time_since_last_send)
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {remaining_time} seconds before resending"
            )

    # 이미 존재하는 이메일인지 확인 (신규 발송 시에만)
    if not is_resend:
        async with get_conn() as conn:
            existing = await conn.fetchrow(
                "SELECT 1 FROM users WHERE email = $1", email_str
            )
            if existing:
                raise HTTPException(
                    status_code=400, detail="Email already exists"
                )

    # 토큰 생성 및 이메일 발송
    verify_token = security.create_email_verification_token(email_str)
    verify_link = f"{config.BACKEND_BASE_URL}/auth/verify?token={verify_token}"

    subject = "Verify your email for WDSS"
    if is_resend:
        subject = "WDSS - Verification Email (Resent)"

    body = (
        f"Welcome to WDSS!\n\n"
        f"Your verification link is:\n{verify_link}\n\n"
        f"This link expires in {config.EMAIL_VERIFY_EXPIRE_HOURS} hours.\n"
        f"If you did not sign up, you can safely ignore this email."
        f"\n\n{'This is a resent verification email.' if is_resend else ''}"
    )

    try:
        send_email(email_str, subject, body)

        # 발송 시간 기록 (재발송인 경우에만)
        if is_resend:
            email_send_timestamps[email_str] = current_time

        action = "resent" if is_resend else "sent"
        return MessageResponse(
            success=True,
            message=f"Verification email {action} to {email_str}. Please check your inbox."
        )
    except Exception as e:
        # 발송 시간 기록 (개발환경에서도, 재발송인 경우에만)
        if is_resend:
            email_send_timestamps[email_str] = current_time

        action = "resent" if is_resend else "sent"
        return MessageResponse(
            success=True,
            message=f"Verification email {action} to {email_str}. Check console for development."
        )


@router.post("/send-verification", response_model=MessageResponse)
async def send_verification_email(payload: SendVerificationRequest):
    """이메일 인증 코드를 발송합니다."""
    return await _send_verification_email_internal(payload.email, is_resend=False)


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification_email(payload: SendVerificationRequest):
    """이메일 인증 코드를 재발송합니다."""
    return await _send_verification_email_internal(payload.email, is_resend=True)



@router.post(
    "/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED
)
async def register(payload: RegisterRequest):
    # 이메일 인증 여부 확인 (SSE 방식)
    if payload.email not in verification_store or not verification_store[payload.email].get('verified'):
        raise HTTPException(
            status_code=400, detail="Email verification required. Please verify your email first."
        )

    user_id = str(uuid.uuid4())
    password_hash = security.get_password_hash(payload.password)  # bcrypt 해시

    async with get_conn() as conn:
        existing = await conn.fetchrow(
            "SELECT 1 FROM users WHERE email = $1 OR username = $2",
            str(payload.email),
            payload.username,
        )
        if existing:
            raise HTTPException(
                status_code=400, detail="Email or username already exists"
            )

        try:
            async with conn.transaction():  # ← 트랜잭션으로 묶기
                await conn.execute(
                    "INSERT INTO users (id, email, username, status, is_email_verified) VALUES ($1, $2, $3, 'ACTIVE', TRUE)",
                    user_id,
                    str(payload.email),
                    payload.username,
                )
                await conn.execute(
                    "INSERT INTO auth_credentials (user_id, password_hash, password_algo) VALUES ($1, $2, $3)",
                    user_id,
                    password_hash,
                    "bcrypt",  # ← 실제 해시와 일치
                )
        except pgexc.UniqueViolationError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email or username already exists",
            )


    return RegisterResponse(id=user_id, email=payload.email, username=payload.username)


@router.post("/logout", response_model=MessageResponse)
async def logout(response: Response):
    """
    사용자를 로그아웃 처리하고 인증 쿠키를 삭제합니다.
    """
    # 1. 'access_token'이라는 이름의 쿠키를 삭제하도록 응답을 설정합니다.
    response.delete_cookie(
        key="access_token",
        path="/",
        httponly=True,
        secure=False,
        samesite="lax",
    )

    # 2. 성공 메시지를 반환합니다.
    return {"message": "Successfully logged out"}


@router.get("/verify", response_class=HTMLResponse)
async def verify_email(token: str):
    """이메일 인증 완료 후 SSE로 알림 전송"""
    try:
        email = security.decode_email_verification_token(token)

        # 인증 상태 저장
        verification_store[email] = {
            'verified': True,
            'token': token,
            'timestamp': timedelta()
        }

        # SSE 이벤트 트리거
        if email in verification_events:
            verification_events[email].set()

        return f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verified - WDSS</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
            <style>
                .font-yuniverse {{ font-family: 'Inter', sans-serif; }}
                body {{ font-family: 'Inter', sans-serif; }}
            </style>
        </head>
        <body class="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
            <!-- 카드 -->
            <div class="w-full max-w-md rounded-2xl bg-white/70 shadow-xl ring-1 ring-black/5 overflow-hidden backdrop-blur-md">
                <!-- 헤더 -->
                <div class="px-5 pt-4 pb-2">
                    <div class="flex items-center justify-center">
                        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                            </svg>
                        </div>
                    </div>
                </div>

                <!-- 본문 -->
                <div class="px-5 pb-5 text-center font-yuniverse">
                    <h1 class="text-3xl font-black text-gray-900 mb-3">
                        Email Verified!
                    </h1>
                    <p class="text-gray-600 mb-2 text-lg">
                        Your email has been successfully verified.
                    </p>
                    <p class="text-sm text-gray-500 mb-6">
                        You can now close this tab and complete your registration.
                    </p>

                    <button
                        onclick="window.close()"
                        class="w-full rounded bg-[#646cff] hover:bg-[#5c64ed] text-white py-2 font-yuniverse transition font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                    >
                        Close Tab
                    </button>

                    <div class="mt-4 text-xs text-gray-400">
                        Return to your registration form to continue
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
    except Exception:
        return f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verification Failed - WDSS</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
            <style>
                .font-yuniverse {{ font-family: 'Inter', sans-serif; }}
                body {{ font-family: 'Inter', sans-serif; }}
            </style>
        </head>
        <body class="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
            <!-- 카드 -->
            <div class="w-full max-w-md rounded-2xl bg-white/70 shadow-xl ring-1 ring-black/5 overflow-hidden backdrop-blur-md">
                <!-- 헤더 -->
                <div class="px-5 pt-4 pb-2">
                    <div class="flex items-center justify-center">
                        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                            <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </div>
                    </div>
                </div>

                <!-- 본문 -->
                <div class="px-5 pb-5 text-center font-yuniverse">
                    <h1 class="text-3xl font-black text-gray-900 mb-3">
                        Verification Failed
                    </h1>
                    <p class="text-gray-600 mb-2 text-lg">
                        The verification link is invalid or has expired.
                    </p>
                    <p class="text-sm text-gray-500 mb-6">
                        Please request a new verification email.
                    </p>

                    <a
                        href="http://localhost:5173/login"
                        class="w-full inline-block rounded bg-[#646cff] hover:bg-[#5c64ed] text-white py-2 font-yuniverse transition font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-center"
                    >
                        Try Again
                    </a>
                </div>
            </div>
        </body>
        </html>
        """
