"""
Authentication and User Identity Data Models.

Defines schemas for user accounts, JWT tokens, sessions, and credentials.
"""

from enum import Enum
from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"
    GUEST = "guest"


class User(BaseModel):
    """
    Authenticated User entity.
    """
    id: str = Field(..., description="Unique user identifier (UUID)")
    email: str = Field(..., description="User email address")
    display_name: Optional[str] = Field(default=None, description="Optional display name")
    role: UserRole = Field(default=UserRole.USER, description="User role")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    is_active: bool = Field(default=True, description="Whether account is active")


class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=8, max_length=128, description="User password (min 8 chars)")
    display_name: Optional[str] = Field(default=None, max_length=64, description="Display name")


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")


class TokenResponse(BaseModel):
    access_token: str = Field(..., description="Bearer JWT access token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in_seconds: int = Field(..., description="Token lifespan in seconds")
    user: User = Field(..., description="Authenticated user profile")


class UserSession(BaseModel):
    user_id: str
    email: str
    role: str
    exp: int
    iat: int
    iss: str = "coderag"
