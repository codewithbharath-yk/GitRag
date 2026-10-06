"""
JWT Token & Password Security Handler.

Handles JWT encoding/decoding, signature verification, and secure password hashing using standard PBKDF2-HMAC-SHA256.
"""

import hashlib
import secrets
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
import jwt

from app.config.settings import get_settings
from app.auth.models import User, UserSession
from app.utils.logger import get_logger

logger = get_logger(__name__)


def hash_password(password: str) -> str:
    """
    Hash password using PBKDF2-HMAC-SHA256 with a unique cryptographic salt.
    Format: pbkdf2_sha256$iterations$salt_hex$hash_hex
    """
    salt = secrets.token_hex(16)
    iterations = 100_000
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    )
    return f"pbkdf2_sha256${iterations}${salt}${derived.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify password against stored hash using constant-time comparison.
    """
    try:
        parts = hashed_password.split("$")
        if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
            return False
        iterations = int(parts[1])
        salt = parts[2]
        expected_hash = parts[3]
        derived = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations,
        )
        return secrets.compare_digest(derived.hex(), expected_hash)
    except Exception as e:
        logger.error(f"Error during password verification: {e}")
        return False


class JWTHandler:
    """
    JWT Token Encoder and Decoder.
    """

    hash_password = staticmethod(hash_password)
    verify_password = staticmethod(verify_password)

    @classmethod
    def create_access_token(
        cls,
        user: User,
        expires_delta: Optional[timedelta] = None,
    ) -> Tuple[str, int]:
        """
        Generate a signed JWT for the given user.
        Returns (token_string, expires_in_seconds).
        """
        settings = get_settings()
        if expires_delta:
            exp_duration = int(expires_delta.total_seconds())
        else:
            exp_duration = settings.jwt_expiration_minutes * 60

        now_ts = int(time.time())
        exp_ts = now_ts + exp_duration

        payload = {
            "sub": user.id,
            "email": user.email,
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            "display_name": user.display_name or "",
            "iat": now_ts,
            "exp": exp_ts,
            "iss": "coderag",
        }

        token = jwt.encode(
            payload,
            settings.jwt_secret,
            algorithm=settings.jwt_algorithm,
        )
        return token, exp_duration

    @classmethod
    def decode_token(cls, token: str) -> Optional[Dict[str, Any]]:
        """
        Decode and verify JWT signature.
        Supports both local CodeRAG secret and Supabase JWT secret.
        """
        settings = get_settings()
        secrets_to_try = [settings.jwt_secret]
        if settings.supabase_jwt_secret:
            secrets_to_try.append(settings.supabase_jwt_secret)

        for secret in secrets_to_try:
            if not secret:
                continue
            try:
                payload = jwt.decode(
                    token,
                    secret,
                    algorithms=[settings.jwt_algorithm, "HS256"],
                    options={"verify_exp": True},
                )
                return payload
            except jwt.ExpiredSignatureError:
                logger.debug("JWT token has expired.")
                return None
            except jwt.InvalidTokenError:
                continue
            except Exception as e:
                logger.error(f"Error decoding JWT token: {e}")
                return None

        return None

    @classmethod
    def decode_access_token(cls, token: str) -> Optional[Dict[str, Any]]:
        """Alias for decode_token."""
        return cls.decode_token(token)
