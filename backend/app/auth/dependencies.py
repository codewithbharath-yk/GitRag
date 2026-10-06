"""
FastAPI Authentication Dependencies.

Provides dependency functions for extracting and verifying user tokens in route handlers.
"""

from typing import Optional
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.auth.models import User, UserRole
from app.auth.jwt_handler import JWTHandler
from app.auth.service import get_auth_service
from app.config.settings import get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

# HTTP Bearer scheme (auto_error=False allows optional auth fallback when enabled)
bearer_scheme = HTTPBearer(auto_error=False)

# Default fallback guest user when authentication is optional or disabled in local testing
GUEST_USER = User(
    id="default_user",
    email="guest@coderag.local",
    display_name="Guest User",
    role=UserRole.GUEST,
    is_active=True,
)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(bearer_scheme),
) -> User:
    """
    Extract and authenticate the user from the Authorization: Bearer <token> header.
    Raises HTTP 401 Unauthorized if token is missing or invalid when auth is enabled.
    """
    settings = get_settings()
    auth_service = get_auth_service()

    if not credentials:
        if not settings.enable_auth:
            return GUEST_USER
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = JWTHandler.decode_token(token)

    if not payload:
        if not settings.enable_auth:
            return GUEST_USER
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or malformed authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing subject identifier.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = auth_service.get_user_by_id(user_id)
    if not user:
        # Check if it's a Supabase token payload
        user = auth_service.get_or_create_supabase_user(payload)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(bearer_scheme),
) -> User:
    """
    Returns authenticated user if a valid Bearer token is provided, otherwise returns GUEST_USER.
    Never raises 401.
    """
    if not credentials:
        return GUEST_USER

    try:
        token = credentials.credentials
        payload = JWTHandler.decode_token(token)
        if not payload:
            return GUEST_USER

        user_id = payload.get("sub")
        if not user_id:
            return GUEST_USER

        auth_service = get_auth_service()
        user = auth_service.get_user_by_id(user_id) or auth_service.get_or_create_supabase_user(payload)
        return user if user and user.is_active else GUEST_USER
    except Exception:
        return GUEST_USER


async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Requires the authenticated user to possess the ADMIN role.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required.",
        )
    return current_user
