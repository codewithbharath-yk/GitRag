"""
Authentication Package Initialization.
"""

from app.auth.models import User, UserRole, RegisterRequest, LoginRequest, TokenResponse, UserSession
from app.auth.jwt_handler import JWTHandler, hash_password, verify_password
from app.auth.service import get_auth_service, AuthService
from app.auth.dependencies import get_current_user, get_optional_user, require_admin, GUEST_USER

__all__ = [
    "User",
    "UserRole",
    "RegisterRequest",
    "LoginRequest",
    "TokenResponse",
    "UserSession",
    "JWTHandler",
    "hash_password",
    "verify_password",
    "get_auth_service",
    "AuthService",
    "get_current_user",
    "get_optional_user",
    "require_admin",
    "GUEST_USER",
]
