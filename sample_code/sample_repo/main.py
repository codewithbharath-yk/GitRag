"""
Sample Application Entry Point.

Combines Authentication, UserService, and Database into API-like handler functions.
"""

from typing import Dict, Any
from sample_code.sample_repo.database import get_db
from sample_code.sample_repo.auth import authenticate_user, create_access_token, verify_token
from sample_code.sample_repo.user_service import UserService


class ApplicationServer:
    """
    Simulates a web application handling login, registration, and user profiles.
    """

    def __init__(self):
        self.db = get_db()
        self.user_service = UserService(self.db)

    def handle_login(self, credentials: Dict[str, str]) -> Dict[str, Any]:
        """
        Handle user login by verifying credentials and returning a JWT token.
        """
        username = credentials.get("username", "")
        password = credentials.get("password", "")

        user_record = self.user_service.get_by_username(username)
        if not user_record or not authenticate_user(user_record, password):
            return {"error": "Invalid username or password", "status_code": 401}

        token = create_access_token(
            user_id=user_record["id"],
            username=user_record["username"],
            role=user_record["role"],
        )
        return {
            "token": token,
            "token_type": "bearer",
            "user_id": user_record["id"],
            "status_code": 200,
        }

    def handle_get_profile(self, auth_header: str) -> Dict[str, Any]:
        """
        Retrieve user profile given a Bearer authorization token header.
        """
        if not auth_header.startswith("Bearer "):
            return {"error": "Missing or malformed Authorization header", "status_code": 401}

        token = auth_header.split(" ", 1)[1]
        payload = verify_token(token)
        if not payload:
            return {"error": "Invalid or expired access token", "status_code": 401}

        user_data = self.user_service.get_by_id(payload["user_id"])
        if not user_data:
            return {"error": "User not found", "status_code": 404}

        return {
            "id": user_data["id"],
            "username": user_data["username"],
            "role": user_data["role"],
            "status_code": 200,
        }


# Global application server instance
app_server = ApplicationServer()


def run_app():
    """
    Bootstraps the sample application server.
    """
    print("Sample application server initialized.")
    return app_server
