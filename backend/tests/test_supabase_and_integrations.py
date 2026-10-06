"""
Unit tests for Supabase client diagnostics and integrations health endpoint.
"""

from fastapi import status
from fastapi.testclient import TestClient
from app.db.supabase_client import SupabaseClient


def test_supabase_client_unconfigured():
    """Verify SupabaseClient behavior when credentials are not configured."""
    client = SupabaseClient(url="", key="")
    assert client.is_configured is False
    res = client.test_connection()
    assert res["configured"] is False
    assert res["connected"] is False
    assert "in-memory" in res["message"]


def test_supabase_client_custom_mock():
    """Verify SupabaseClient custom parameters."""
    client = SupabaseClient(
        url="https://testproject.supabase.co",
        key="test-anon-key",
        service_role_key="test-service-key",
    )
    assert client.is_configured is True
    assert client.active_key == "test-service-key"


def test_health_integrations_endpoint(test_client: TestClient):
    """Verify GET /api/v1/health/integrations endpoint returns diagnostics for all services."""
    response = test_client.get("/api/v1/health/integrations")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "healthy"
    assert "services" in data
    services = data["services"]
    assert "gemini" in services
    assert "qdrant" in services
    assert "github" in services
    assert "supabase" in services
    assert "configured" in services["supabase"]
