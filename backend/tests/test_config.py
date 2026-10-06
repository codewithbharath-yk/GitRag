"""
Unit tests for configuration loading and validation.
"""

from app.config.settings import Settings, get_settings


def test_default_settings():
    """
    Test that default settings load with expected standard values.
    """
    settings = Settings()
    assert settings.app_name == "CodeRAG"
    assert settings.gemini_model == "gemini-2.5-flash"
    assert settings.gemini_embedding_model == "gemini-embedding-001"
    assert settings.app_port == 8000


def test_gemini_configured_property():
    """
    Test the is_gemini_configured property correctly identifies missing or placeholder keys.
    """
    empty_settings = Settings(gemini_api_key="")
    assert not empty_settings.is_gemini_configured

    placeholder_settings = Settings(gemini_api_key="your_gemini_api_key_here")
    assert not placeholder_settings.is_gemini_configured

    valid_settings = Settings(gemini_api_key="AIzaSyValidSampleKey123")
    assert valid_settings.is_gemini_configured


def test_safe_summary_does_not_leak_secrets():
    """
    Verify that safe_summary includes public metadata without exposing the raw API key.
    """
    settings = Settings(gemini_api_key="secret_test_key_xyz", qdrant_api_key="secret_qdrant_key")
    summary = settings.safe_summary()

    assert "app_name" in summary
    assert "gemini_configured" in summary
    assert summary["gemini_configured"] is True
    # Ensure raw keys are not in summary dict keys or values
    assert "gemini_api_key" not in summary
    assert "secret_test_key_xyz" not in str(summary)
    assert "secret_qdrant_key" not in str(summary)
