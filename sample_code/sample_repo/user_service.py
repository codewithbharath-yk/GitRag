"""
User Service Business Logic Module.

Orchestrates user creation, retrieval, and profile updates.
"""

from typing import Optional, Dict, Any, List
from sample_code.sample_repo.database import DatabaseConnection, get_db
from sample_code.sample_repo.auth import hash_password


class UserService:
    """
    Handles user management business operations against the database.
    """

    def __init__(self, db: Optional[DatabaseConnection] = None):
        self.db = db or get_db()

    def get_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Fetch a single user by primary ID.
        """
        results = self.db.query("users", {"id": user_id})
        return results[0] if results else None

    def get_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """
        Look up a user record by their unique username.
        """
        results = self.db.query("users", {"username": username})
        return results[0] if results else None

    def register_user(self, username: str, raw_password: str, role: str = "developer") -> Dict[str, Any]:
        """
        Register a new user account with hashed password credentials.
        """
        existing = self.get_by_username(username)
        if existing:
            raise ValueError(f"Username '{username}' is already taken.")

        hashed_pass = hash_password(raw_password)
        new_record = self.db.insert(
            "users",
            {
                "username": username,
                "hashed_password": hashed_pass,
                "role": role,
            },
        )
        return {
            "id": new_record["id"],
            "username": new_record["username"],
            "role": new_record["role"],
        }

    def list_all_users(self) -> List[Dict[str, Any]]:
        """
        Return sanitized list of all active users.
        """
        all_users = self.db.query("users")
        return [
            {"id": u["id"], "username": u["username"], "role": u["role"]}
            for u in all_users
        ]
