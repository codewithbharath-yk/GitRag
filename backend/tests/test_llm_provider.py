"""
Unit tests for the LLM Provider adapter and error handling.
"""

from unittest.mock import MagicMock, patch
import pytest

from app.services.llm_provider import (
    GeminiProvider,
    MissingAPIKeyError,
    LLMProviderError,
    get_llm_provider,
)
from app.config.settings import Settings


def test_missing_api_key_raises_error():
    """
    Verify that calling generate_text with an empty or placeholder key raises MissingAPIKeyError.
    """
    provider = GeminiProvider(api_key="")
    with pytest.raises(MissingAPIKeyError) as exc_info:
        provider.generate_text("Hello")

    assert "Gemini API key is not configured" in str(exc_info.value)


def test_placeholder_api_key_raises_error():
    """
    Verify that calling generate_text with placeholder key also raises MissingAPIKeyError.
    """
    provider = GeminiProvider(api_key="your_gemini_api_key_here")
    with pytest.raises(MissingAPIKeyError) as exc_info:
        provider.generate_text("Hello")

    assert "Gemini API key is not configured" in str(exc_info.value)


def test_smoke_test_with_missing_key():
    """
    Verify that smoke_test returns a clean failed dictionary rather than an unhandled crash.
    """
    provider = GeminiProvider(api_key="")
    result = provider.smoke_test()

    assert result["status"] == "failed"
    assert "error" in result
    assert "Gemini API key is not configured" in result["error"]
    assert result["latency_ms"] >= 0


def test_mocked_gemini_generate_text():
    """
    Test generate_text using a mocked Google GenAI client to verify response handling.
    """
    provider = GeminiProvider(api_key="AIzaSyMockedKeyForTesting", model_name="gemini-2.5-flash")

    # Create mock response object
    mock_response = MagicMock()
    mock_response.text = "This is a mocked Gemini response about Python."

    # Create mock client
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response
    provider._client = mock_client

    result = provider.generate_text(prompt="What is Python?")
    assert result == "This is a mocked Gemini response about Python."
    mock_client.models.generate_content.assert_called_once()


def test_mocked_gemini_smoke_test_success():
    """
    Test smoke_test returning success dictionary when Gemini responds.
    """
    provider = GeminiProvider(api_key="AIzaSyMockedKeyForTesting", model_name="gemini-2.5-flash")

    mock_response = MagicMock()
    mock_response.text = "CodeRAG Gemini Smoke Test Successful."

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response
    provider._client = mock_client

    result = provider.smoke_test()
    assert result["status"] == "success"
    assert "CodeRAG Gemini Smoke Test Successful" in result["response"]
    assert result["model"] == "gemini-2.5-flash"
    assert result["latency_ms"] >= 0


def test_get_llm_provider_factory():
    """
    Verify get_llm_provider returns a properly configured GeminiProvider instance.
    """
    settings = Settings(gemini_api_key="AIzaSyFactoryKey", gemini_model="gemini-2.5-flash")
    provider = get_llm_provider(settings)

    assert isinstance(provider, GeminiProvider)
    assert provider.api_key == "AIzaSyFactoryKey"
    assert provider.model_name == "gemini-2.5-flash"
