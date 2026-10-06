"""
Pytest configuration and test fixtures for CodeRAG.
"""

import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure backend directory is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app
from app.config.settings import Settings, get_settings


@pytest.fixture
def test_client() -> TestClient:
    """
    Returns a FastAPI TestClient instance for exercising API endpoints.
    """
    with TestClient(app) as client:
        yield client


@pytest.fixture
def mock_settings(monkeypatch) -> Settings:
    """
    Provides a predictable Settings instance for unit tests.
    """
    get_settings.cache_clear()
    settings = Settings(
        app_name="CodeRAG-Test",
        app_env="test",
        gemini_api_key="test_dummy_key",
        gemini_model="gemini-2.5-flash",
    )
    monkeypatch.setattr("app.config.settings.get_settings", lambda: settings)
    monkeypatch.setattr("app.api.routes.health.get_settings", lambda: settings)
    return settings
