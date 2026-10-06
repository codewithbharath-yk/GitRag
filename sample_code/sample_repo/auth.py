"""
Authentication and Token Management Module.

Provides password hashing, JWT creation, token validation, and credential checking.
"""

import hashlib
import hmac
import time
from typing import Optional, Dict, Any

# Mock secret key for JWT signing
JWT_SECRET = "sample-synthetic-secret-key-12345"
TOKEN_EXPIRATION_SECONDS = 3600


def hash_password(password: str, salt: str = "coderag_salt") -> str:
    """
    Hash a plaintext password using SHA-256 with a salt.
    """
    salted = f"{salt}:{password}".encode("utf-8")
    return hashlib.sha256(salted).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify if a plaintext password matches the stored hash.
    """
    return hash_password(plain_password) == hashed_password


def create_access_token(user_id: int, username: str, role: str) -> str:
    """
    Generate a mock JWT token string containing user claims and timestamp.
    """
    issued_at = int(time.time())
    expires_at = issued_at + TOKEN_EXPIRATION_SECONDS
    payload = f"{user_id}:{username}:{role}:{expires_at}"
    signature = hmac.new(JWT_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}"


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Validate a mock JWT token and return its decoded payload.
    Returns None if signature is invalid or token has expired.
    """
    parts = token.split(".")
    if len(parts) != 2:
        return None

    payload, signature = parts[0], parts[1]
    expected_sig = hmac.new(JWT_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected_sig):
        return None

    user_id_str, username, role, expires_at_str = payload.split(":")
    if int(time.time()) > int(expires_at_str):
        return None

    return {
        "user_id": int(user_id_str),
        "username": username,
        "role": role,
    }


def authenticate_user(user_record: Optional[Dict[str, Any]], password: str) -> bool:
    """
    Validate a user's credentials against their database record.
    """
    if not user_record:
        return False
    stored_hash = user_record.get("hashed_password", "")
    return verify_password(password, stored_hash)
