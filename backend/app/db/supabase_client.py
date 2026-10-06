"""
Supabase Integration & Client Module for CodeRAG.

Provides connection diagnostics, table schema verification, and REST client access
using standard httpx without requiring external heavy SDK dependencies.
"""

from typing import Dict, Any, Optional
import httpx

from app.config.settings import get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)


class SupabaseClient:
    """
    Lightweight, production-safe Supabase REST client and connectivity checker.
    """

    def __init__(
        self,
        url: Optional[str] = None,
        key: Optional[str] = None,
        service_role_key: Optional[str] = None,
    ):
        settings = get_settings()
        self.url = (url or settings.supabase_url or "").rstrip("/")
        self.anon_key = key or settings.supabase_anon_key or ""
        self.service_key = service_role_key or settings.supabase_service_role_key or ""
        self.active_key = self.service_key or self.anon_key

    @property
    def is_configured(self) -> bool:
        """Check if Supabase URL and at least one API key are configured."""
        return bool(self.url and self.active_key and not self.url.startswith("your_"))

    def test_connection(self) -> Dict[str, Any]:
        """
        Perform a safe connectivity and table readiness check against Supabase.
        Guarantees no secret keys are logged or returned.
        """
        if not self.is_configured:
            return {
                "configured": False,
                "connected": False,
                "message": "Supabase is not configured. Application is using high-performance in-memory repository store and native JWT auth.",
            }

        headers = {
            "apikey": self.active_key,
            "Authorization": f"Bearer {self.active_key}",
            "Accept": "application/json",
        }

        try:
            with httpx.Client(timeout=5.0) as client:
                # 1. Ping the PostgREST root schema endpoint
                resp = client.get(f"{self.url}/rest/v1/", headers=headers)
                if resp.status_code in (200, 204):
                    # 2. Check if the 'repositories' table defined in schema.sql is present
                    table_resp = client.get(
                        f"{self.url}/rest/v1/repositories?select=count",
                        headers={**headers, "Range-Unit": "items", "Range": "0-0"},
                    )
                    tables_ready = table_resp.status_code in (200, 206)
                    return {
                        "configured": True,
                        "connected": True,
                        "status_code": resp.status_code,
                        "tables_ready": tables_ready,
                        "message": (
                            "Successfully connected to Supabase PostgREST endpoint. Schema tables ready."
                            if tables_ready
                            else "Connected to Supabase endpoint, but 'repositories' table was not found. Please apply 'backend/app/db/schema.sql' in the Supabase SQL Editor."
                        ),
                    }
                elif resp.status_code in (401, 403):
                    return {
                        "configured": True,
                        "connected": False,
                        "status_code": resp.status_code,
                        "message": "Authentication failed against Supabase. Verify SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY.",
                    }
                else:
                    return {
                        "configured": True,
                        "connected": False,
                        "status_code": resp.status_code,
                        "message": f"Unexpected HTTP status {resp.status_code} received from Supabase.",
                    }
        except httpx.ConnectError:
            return {
                "configured": True,
                "connected": False,
                "message": f"Could not establish network connection to Supabase at '{self.url}'. Check DNS or network connectivity.",
            }
        except Exception as e:
            return {
                "configured": True,
                "connected": False,
                "message": f"Error connecting to Supabase: {str(e)}",
            }


_supabase_instance: Optional[SupabaseClient] = None


def get_supabase_client() -> SupabaseClient:
    """Returns singleton SupabaseClient instance."""
    global _supabase_instance
    if _supabase_instance is None:
        _supabase_instance = SupabaseClient()
    return _supabase_instance
