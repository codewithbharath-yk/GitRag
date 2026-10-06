"""
Authentication API Routes.

Exposes endpoints for user registration, login, profile retrieval, session token refresh, and logout.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from app.auth.models import RegisterRequest, LoginRequest, TokenResponse, User
from app.auth.service import (
    get_auth_service,
    UserAlreadyExistsError,
    InvalidCredentialsError,
)
from app.auth.jwt_handler import JWTHandler
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication & Identity"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register New User",
    description="Creates a new user account with hashed credentials and returns an authentication JWT.",
)
async def register(request: RegisterRequest) -> TokenResponse:
    auth_service = get_auth_service()
    try:
        return auth_service.register_user(request)
    except UserAlreadyExistsError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration failed: {str(e)}",
        )


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="User Login",
    description="Authenticates credentials and returns a signed access token.",
)
async def login(request: LoginRequest) -> TokenResponse:
    auth_service = get_auth_service()
    try:
        return auth_service.login_user(request)
    except InvalidCredentialsError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication processing error: {str(e)}",
        )


@router.get(
    "/me",
    response_model=User,
    status_code=status.HTTP_200_OK,
    summary="Current User Profile",
    description="Returns profile details for the currently authenticated user.",
)
async def get_my_profile(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Refresh Session Token",
    description="Generates a refreshed access token for the authenticated user.",
)
async def refresh_token(current_user: User = Depends(get_current_user)) -> TokenResponse:
    token_str, expires_in = JWTHandler.create_access_token(current_user)
    return TokenResponse(
        access_token=token_str,
        token_type="bearer",
        expires_in_seconds=expires_in,
        user=current_user,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="User Logout",
    description="Logs out the current session.",
)
async def logout(current_user: User = Depends(get_current_user)):
    return {
        "status": "success",
        "message": f"Successfully logged out session for user '{current_user.email}'.",
    }
