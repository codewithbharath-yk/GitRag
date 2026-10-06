"""
Unit tests for FastAPI health check and root endpoints.
"""

from fastapi import status
from fastapi.testclient import TestClient


def test_root_endpoint(test_client: TestClient):
    """
    Test that the root endpoint '/' returns 200 and links to docs and health.
    """
    response = test_client.get("/")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "message" in data
    assert "docs" in data
    assert "health" in data


def test_health_endpoint_success(test_client: TestClient):
    """
    Test GET /health returns 200 and expected schema fields.
    """
    response = test_client.get("/health")
    assert response.status_code == status.HTTP_200_OK

    data = response.json()
    assert data["status"] == "healthy"
    assert "app_name" in data
    assert "version" in data
    assert "environment" in data
    assert "gemini_configured" in data

    # Security check: Ensure no API keys or secret tokens are present anywhere in the payload
    assert "gemini_api_key" not in data
    assert "github_token" not in data
    assert "qdrant_api_key" not in data


def test_api_v1_health_endpoint(test_client: TestClient):
    """
    Test GET /api/v1/health alias returns 200 OK.
    """
    response = test_client.get("/api/v1/health")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "healthy"


def test_health_endpoint_with_configured_gemini(test_client: TestClient, mock_settings):
    """
    Test that gemini_configured reflects the configured status correctly.
    """
    response = test_client.get("/health")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["gemini_configured"] is True
    assert data["app_name"] == "CodeRAG-Test"
