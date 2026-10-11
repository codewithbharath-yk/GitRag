"""
Unit tests for GeminiEmbeddingProvider and BaseEmbeddingProvider.
"""

from unittest.mock import MagicMock
import pytest

from app.rag.embeddings import (
    GeminiEmbeddingProvider,
    OpenRouterEmbeddingProvider,
    get_embedding_provider,
    GEMINI_EMBEDDING_DIMENSION,
)
from app.services.llm_provider import MissingAPIKeyError
from app.config.settings import Settings


def test_missing_api_key_raises_for_embeddings():
    """
    Verify initializing embedding client without an API key raises MissingAPIKeyError.
    """
    provider = GeminiEmbeddingProvider(api_key="")
    with pytest.raises(MissingAPIKeyError):
        provider.embed_text("test query")


def test_placeholder_api_key_raises_for_embeddings():
    """
    Verify placeholder key raises MissingAPIKeyError.
    """
    provider = GeminiEmbeddingProvider(api_key="your_gemini_api_key_here")
    with pytest.raises(MissingAPIKeyError):
        provider.embed_text("test query")


def test_empty_string_returns_zero_vector():
    """
    Verify empty or whitespace strings return a zero vector of correct dimension without network calls.
    """
    provider = GeminiEmbeddingProvider(api_key="dummy_key", dimension=768)
    vec = provider.embed_text("")
    assert len(vec) == 768
    assert all(v == 0.0 for v in vec)


def test_mocked_gemini_embed_batch():
    """
    Verify embed_batch accurately processes batches and formats vectors.
    """
    provider = GeminiEmbeddingProvider(
        api_key="AIzaSyMockKey",
        model_name="text-embedding-004",
        dimension=4,
        batch_size=2,
    )

    # Mock response object from google-genai
    mock_emb_1 = MagicMock()
    mock_emb_1.values = [0.1, 0.2, 0.3, 0.4]

    mock_emb_2 = MagicMock()
    mock_emb_2.values = [0.5, 0.6, 0.7, 0.8]

    mock_response = MagicMock()
    mock_response.embeddings = [mock_emb_1, mock_emb_2]

    mock_client = MagicMock()
    mock_client.models.embed_content.return_value = mock_response
    provider._client = mock_client

    texts = ["def auth():", "def database():"]
    embeddings = provider.embed_batch(texts)

    assert len(embeddings) == 2
    assert embeddings[0] == [0.1, 0.2, 0.3, 0.4]
    assert embeddings[1] == [0.5, 0.6, 0.7, 0.8]
    mock_client.models.embed_content.assert_called_once()


def test_openrouter_missing_api_key_raises():
    """
    Verify OpenRouter raises MissingAPIKeyError when no key is supplied.
    """
    provider = OpenRouterEmbeddingProvider(api_key="")
    with pytest.raises(MissingAPIKeyError):
        provider.embed_text("test")


def test_openrouter_empty_string_zero_vector():
    """
    Verify OpenRouter returns zero vector for empty input without network calls.
    """
    provider = OpenRouterEmbeddingProvider(api_key="dummy", dimension=2048)
    vec = provider.embed_text("   ")
    assert len(vec) == 2048
    assert all(v == 0.0 for v in vec)


def test_mocked_openrouter_embed_batch():
    """
    Verify OpenRouter batch embeddings using mocked OpenAI client.
    """
    provider = OpenRouterEmbeddingProvider(
        api_key="sk-or-mock",
        model_name="nvidia/nemotron-3-embed-1b:free",
        dimension=4,
    )
    mock_item_1 = MagicMock()
    mock_item_1.embedding = [0.11, 0.22, 0.33, 0.44]
    mock_item_2 = MagicMock()
    mock_item_2.embedding = [0.55, 0.66, 0.77, 0.88]

    mock_resp = MagicMock()
    mock_resp.data = [mock_item_1, mock_item_2]

    mock_client = MagicMock()
    mock_client.embeddings.create.return_value = mock_resp
    provider._client = mock_client

    embs = provider.embed_batch(["code 1", "code 2"])
    assert len(embs) == 2
    assert embs[0] == [0.11, 0.22, 0.33, 0.44]
    assert embs[1] == [0.55, 0.66, 0.77, 0.88]


def test_get_embedding_provider_factory():
    """
    Verify factory function uses settings properly for Local, Gemini and OpenRouter.
    """
    # Local provider selection (default)
    local_settings = Settings(
        embedding_provider="local",
        embedding_model="BAAI/bge-small-en-v1.5",
        embedding_device="cpu",
    )
    from app.rag.embeddings import LocalEmbeddingProvider
    local_provider = get_embedding_provider(settings=local_settings)
    assert isinstance(local_provider, LocalEmbeddingProvider)
    assert local_provider.dimension == 384
    assert local_provider.model_name == "BAAI/bge-small-en-v1.5"

    settings = Settings(
        gemini_api_key="AIzaSyFactoryKey",
        gemini_embedding_model="text-embedding-004",
        embedding_provider="gemini",
    )
    provider = get_embedding_provider(settings=settings)
    assert isinstance(provider, GeminiEmbeddingProvider)
    assert provider.api_key == "AIzaSyFactoryKey"
    assert provider.model_name == "text-embedding-004"

    # OpenRouter provider selection
    or_settings = Settings(
        openrouter_api_key="sk-or-mock-key",
        embedding_provider="openrouter",
    )
    or_provider = get_embedding_provider(settings=or_settings)
    assert isinstance(or_provider, OpenRouterEmbeddingProvider)
    assert or_provider.api_key == "sk-or-mock-key"
    assert or_provider.model_name == "nvidia/nemotron-3-embed-1b:free"


def test_local_embedding_provider_live_execution():
    """
    Verify LocalEmbeddingProvider generates 384-dim normalized embeddings on CPU.
    """
    import math
    from app.rag.embeddings import LocalEmbeddingProvider, LocalEmbeddingService
    provider = LocalEmbeddingProvider(model_name="BAAI/bge-small-en-v1.5", device="cpu")
    assert provider.dimension == 384
    assert provider.get_dimension() == 384
    assert provider.device == "cpu"

    # Test empty string returns zero vector
    zero_vec = provider.embed_text("   ")
    assert len(zero_vec) == 384
    assert all(v == 0.0 for v in zero_vec)

    # Test embed_query
    query_vec = provider.embed_query("Where is authentication handled?")
    assert len(query_vec) == 384
    assert any(v != 0.0 for v in query_vec)

    # Verify L2 normalization (norm should be ~1.0)
    norm = math.sqrt(sum(x * x for x in query_vec))
    assert abs(norm - 1.0) < 1e-4, f"Expected unit norm, got {norm}"

    # Test embed_batch
    batch_vecs = provider.embed_batch(["def login(): pass", "def logout(): pass"])
    assert len(batch_vecs) == 2
    assert len(batch_vecs[0]) == 384
    assert len(batch_vecs[1]) == 384

    # Test alias LocalEmbeddingService
    assert LocalEmbeddingService is LocalEmbeddingProvider


def test_local_embedding_singleton_and_consistency():
    """
    Verify that subsequent initializations of LocalEmbeddingProvider reuse the cached model instance.
    """
    from app.rag.embeddings import LocalEmbeddingProvider
    provider1 = LocalEmbeddingProvider(model_name="BAAI/bge-small-en-v1.5", device="cpu")
    provider2 = LocalEmbeddingProvider(model_name="BAAI/bge-small-en-v1.5", device="cpu")

    assert provider1._model is provider2._model

    # Verify embedding consistency across calls
    v1 = provider1.embed_text("def process_payment(amount): return True")
    v2 = provider2.embed_text("def process_payment(amount): return True")
    assert v1 == v2
    assert len(v1) == 384

