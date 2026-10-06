"""
Authentication Service.

Manages user registration, login verification, token generation, and user lookup.
Supports in-memory user registry and integrates with Supabase user records where available.
"""

import uuid
from typing import Dict, Optional
from datetime import datetime

from app.auth.models import User, UserRole, RegisterRequest, LoginRequest, TokenResponse
from app.auth.jwt_handler import hash_password, verify_password, JWTHandler
from app.utils.logger import get_logger

logger = get_logger(__name__)


class UserAlreadyExistsError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


class UserNotFoundError(Exception):
    pass


class AuthService:
    """
    Central Authentication & User Management Service.
    """

    def __init__(self):
        # User storage indexed by user_id and email
        self._users_by_id: Dict[str, User] = {}
        self._users_by_email: Dict[str, User] = {}
        self._password_hashes: Dict[str, str] = {}

        # Initialize a default test/admin user for local testing
        self._init_default_users()

    def _init_default_users(self):
        default_admin = User(
            id="user_admin_default_001",
            email="admin@coderag.ai",
            display_name="CodeRAG Admin",
            role=UserRole.ADMIN,
            created_at=datetime.utcnow(),
            is_active=True,
        )
        self._users_by_id[default_admin.id] = default_admin
        self._users_by_email[default_admin.email.lower()] = default_admin
        self._password_hashes[default_admin.id] = hash_password("AdminPass123!")

        default_dev = User(
            id="user_dev_default_002",
            email="developer@coderag.ai",
            display_name="Default Developer",
            role=UserRole.USER,
            created_at=datetime.utcnow(),
            is_active=True,
        )
        self._users_by_id[default_dev.id] = default_dev
        self._users_by_email[default_dev.email.lower()] = default_dev
        self._password_hashes[default_dev.id] = hash_password("DevPass123!")

    def register_user(self, request: RegisterRequest) -> TokenResponse:
        """
        Register a new user account and return an access token.
        """
        email_clean = str(request.email).strip().lower()
        if email_clean in self._users_by_email:
            raise UserAlreadyExistsError(f"A user with email '{email_clean}' already exists.")

        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = User(
            id=user_id,
            email=email_clean,
            display_name=request.display_name or email_clean.split("@")[0],
            role=UserRole.USER,
            created_at=datetime.utcnow(),
            is_active=True,
        )

        self._users_by_id[user.id] = user
        self._users_by_email[email_clean] = user
        self._password_hashes[user.id] = hash_password(request.password)

        token_str, expires_in = JWTHandler.create_access_token(user)
        logger.info(f"User registered successfully: {user.id} ({email_clean})")

        return TokenResponse(
            access_token=token_str,
            token_type="bearer",
            expires_in_seconds=expires_in,
            user=user,
        )

    def login_user(self, request: LoginRequest) -> TokenResponse:
        """
        Authenticate user with email and password and return access token.
        """
        email_clean = str(request.email).strip().lower()
        user = self._users_by_email.get(email_clean)
        if not user or not user.is_active:
            raise InvalidCredentialsError("Invalid email or password.")

        pwd_hash = self._password_hashes.get(user.id)
        if not pwd_hash or not verify_password(request.password, pwd_hash):
            raise InvalidCredentialsError("Invalid email or password.")

        token_str, expires_in = JWTHandler.create_access_token(user)
        logger.info(f"User logged in successfully: {user.id} ({email_clean})")

        return TokenResponse(
            access_token=token_str,
            token_type="bearer",
            expires_in_seconds=expires_in,
            user=user,
        )

    def get_user_by_id(self, user_id: str) -> Optional[User]:
        return self._users_by_id.get(user_id)

    def get_user_by_email(self, email: str) -> Optional[User]:
        return self._users_by_email.get(email.strip().lower())

    def get_or_create_supabase_user(self, supabase_payload: dict) -> User:
        """
        Map a decoded Supabase JWT token to an internal User profile.
        """
        user_id = supabase_payload.get("sub") or str(uuid.uuid4())
        email = supabase_payload.get("email", f"{user_id}@supabase.user")
        if user_id in self._users_by_id:
            return self._users_by_id[user_id]

        user = User(
            id=user_id,
            email=email,
            display_name=supabase_payload.get("user_metadata", {}).get("full_name", email.split("@")[0]),
            role=UserRole.USER,
            created_at=datetime.utcnow(),
            is_active=True,
        )
        self._users_by_id[user.id] = user
        self._users_by_email[email.lower()] = user
        return user


# Singleton instance
_auth_service_instance: Optional[AuthService] = None


def get_auth_service() -> AuthService:
    global _auth_service_instance
    if _auth_service_instance is None:
        _auth_service_instance = AuthService()
    return _auth_service_instance
