"""
Redis 클라이언트 유틸리티

Redis는 키-값 저장소입니다:
- 키: "verification:user@email.com"
- 값: {"verified": True, "token": "abc123"}

모든 서버가 같은 Redis를 보기 때문에 데이터를 공유할 수 있습니다.
"""

import redis
import json
import time
from typing import Optional, Dict, Any
from app.core import config
import logging

logger = logging.getLogger(__name__)

# Redis 클라이언트 초기화
try:
    redis_client = redis.Redis(
        host=config.REDIS_HOST,
        port=config.REDIS_PORT,
        password=config.REDIS_PASSWORD if config.REDIS_PASSWORD else None,
        db=config.REDIS_DB,
        decode_responses=True,  # 문자열로 자동 변환
        socket_timeout=5,
        socket_connect_timeout=5,
        retry_on_timeout=True
    )

    # 연결 테스트
    redis_client.ping()
    logger.info(f"✅ Redis 연결 성공: {config.REDIS_HOST}:{config.REDIS_PORT}")

except redis.ConnectionError as e:
    logger.error(f"❌ Redis 연결 실패: {e}")
    raise Exception(f"Redis 서버에 연결할 수 없습니다: {e}")


class VerificationStore:
    """
    이메일 인증 상태를 Redis에 저장/조회하는 클래스

    기존 코드:
        verification_store['user@email.com'] = {'verified': True, 'token': 'abc'}

    Redis 코드:
        VerificationStore.set_verified('user@email.com', 'abc')
    """

    @staticmethod
    def set_verified(email: str, token: str, expire_hours: int = 24):
        """
        이메일 인증 완료 상태를 Redis에 저장

        Args:
            email: 사용자 이메일
            token: 인증 토큰
            expire_hours: 만료 시간 (기본 24시간)
        """
        try:
            key = f"verification:{email}"
            data = {
                "verified": True,
                "token": token,
                "timestamp": time.time()
            }

            # Redis에 JSON으로 저장하고 24시간 후 자동 삭제
            redis_client.setex(
                key,
                expire_hours * 3600,  # 초 단위로 변환
                json.dumps(data)
            )

            logger.info(f"✅ 인증 상태 저장: {email}")
            return True

        except Exception as e:
            logger.error(f"❌ 인증 상태 저장 실패: {email}, 오류: {e}")
            return False

    @staticmethod
    def is_verified(email: str) -> bool:
        """
        이메일 인증 상태 확인

        Returns:
            True: 인증 완료
            False: 인증 미완료 또는 만료
        """
        try:
            key = f"verification:{email}"
            data = redis_client.get(key)

            if data:
                parsed = json.loads(data)
                is_verified = parsed.get("verified", False)
                logger.info(f"📧 인증 상태 조회: {email} = {is_verified}")
                return is_verified

            logger.info(f"📧 인증 상태 조회: {email} = False (데이터 없음)")
            return False

        except Exception as e:
            logger.error(f"❌ 인증 상태 조회 실패: {email}, 오류: {e}")
            return False

    @staticmethod
    def get_token(email: str) -> Optional[str]:
        """저장된 인증 토큰 조회"""
        try:
            key = f"verification:{email}"
            data = redis_client.get(key)

            if data:
                parsed = json.loads(data)
                return parsed.get("token")

            return None

        except Exception as e:
            logger.error(f"❌ 토큰 조회 실패: {email}, 오류: {e}")
            return None

    @staticmethod
    def delete_verification(email: str):
        """인증 데이터 삭제 (회원가입 완료 후)"""
        try:
            key = f"verification:{email}"
            redis_client.delete(key)
            logger.info(f"🗑️ 인증 데이터 삭제: {email}")

        except Exception as e:
            logger.error(f"❌ 인증 데이터 삭제 실패: {email}, 오류: {e}")


class RateLimitStore:
    """
    이메일 재발송 제한을 Redis로 관리하는 클래스

    기존 코드:
        email_send_timestamps['user@email.com'] = time.time()

    Redis 코드:
        RateLimitStore.set_send_timestamp('user@email.com')
    """

    @staticmethod
    def set_send_timestamp(email: str, expire_seconds: int = 60):
        """
        이메일 발송 시간 기록 (60초 제한용)

        Args:
            email: 사용자 이메일
            expire_seconds: 만료 시간 (기본 60초)
        """
        try:
            key = f"email_send:{email}"
            current_time = time.time()

            # 60초 후 자동 삭제
            redis_client.setex(key, expire_seconds, str(current_time))
            logger.info(f"📤 이메일 발송 시간 기록: {email}")

        except Exception as e:
            logger.error(f"❌ 발송 시간 기록 실패: {email}, 오류: {e}")

    @staticmethod
    def get_send_timestamp(email: str) -> Optional[float]:
        """마지막 이메일 발송 시간 조회"""
        try:
            key = f"email_send:{email}"
            timestamp = redis_client.get(key)

            if timestamp:
                return float(timestamp)

            return None

        except Exception as e:
            logger.error(f"❌ 발송 시간 조회 실패: {email}, 오류: {e}")
            return None

    @staticmethod
    def get_remaining_cooldown(email: str) -> int:
        """재발송까지 남은 시간 (초)"""
        last_send = RateLimitStore.get_send_timestamp(email)

        if last_send:
            elapsed = time.time() - last_send
            remaining = max(0, 60 - elapsed)
            return int(remaining)

        return 0


def check_redis_health() -> bool:
    """Redis 연결 상태 확인"""
    try:
        redis_client.ping()
        return True
    except:
        return False


def get_redis_info() -> Dict[str, Any]:
    """Redis 상태 정보 조회 (디버깅용)"""
    try:
        info = redis_client.info()
        return {
            "connected": True,
            "total_commands_processed": info.get("total_commands_processed", 0),
            "used_memory_human": info.get("used_memory_human", "unknown"),
            "connected_clients": info.get("connected_clients", 0)
        }
    except Exception as e:
        return {"connected": False, "error": str(e)}


if __name__ == "__main__":
    """테스트 코드 - 이 파일을 직접 실행하면 테스트됩니다"""
    print("🔧 Redis 클라이언트 테스트 시작...")

    # 연결 테스트
    print(f"📡 Redis 연결: {check_redis_health()}")

    # 인증 상태 테스트
    test_email = "test@example.com"
    test_token = "test_token_123"

    print(f"1️⃣ 인증 전 상태: {VerificationStore.is_verified(test_email)}")

    VerificationStore.set_verified(test_email, test_token)
    print(f"2️⃣ 인증 후 상태: {VerificationStore.is_verified(test_email)}")
    print(f"3️⃣ 저장된 토큰: {VerificationStore.get_token(test_email)}")

    # 재발송 제한 테스트
    print(f"4️⃣ 재발송 제한 전: {RateLimitStore.get_remaining_cooldown(test_email)}초")

    RateLimitStore.set_send_timestamp(test_email)
    print(f"5️⃣ 재발송 제한 후: {RateLimitStore.get_remaining_cooldown(test_email)}초")

    # 정리
    VerificationStore.delete_verification(test_email)
    print(f"6️⃣ 삭제 후 상태: {VerificationStore.is_verified(test_email)}")

    print("✅ 테스트 완료!")