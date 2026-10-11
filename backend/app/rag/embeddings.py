"""
Embedding Provider Module.

Generates dense vector embeddings for code chunks and search queries using
Google Gemini text-embedding-004 (or configured embedding models).
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Any
import time

from app.config.settings import Settings, get_settings
from app.services.llm_provider import MissingAPIKeyError, LLMProviderError
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Standard vector dimension for Gemini text-embedding-004
GEMINI_EMBEDDING_DIMENSION = 768
DEFAULT_BATCH_SIZE = 32


class BaseEmbeddingProvider(ABC):
    """
    Abstract Base Class for Embedding Providers.
    """

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Vector dimension produced by this model."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Name of the embedding model."""
        pass

    @abstractmethod
    def embed_text(self, text: str) -> List[float]:
        """Generate vector embedding for a single text string."""
        pass

    def embed_query(self, query: str) -> List[float]:
        """Generate vector embedding for a query string."""
        return self.embed_text(query)

    @abstractmethod
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate vector embeddings for a list of text strings."""
        pass


class GeminiEmbeddingProvider(BaseEmbeddingProvider):
    """
    Google Gemini Embedding Provider using the official google-genai SDK.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        dimension: int = GEMINI_EMBEDDING_DIMENSION,
        batch_size: int = DEFAULT_BATCH_SIZE,
    ):
        settings = get_settings()
        self.api_key = api_key if api_key is not None else settings.gemini_api_key
        self._model_name = model_name or settings.gemini_embedding_model
        self._dimension = dimension
        self.batch_size = max(1, batch_size)
        self._client = None

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def model_name(self) -> str:
        return self._model_name

    def _get_client(self):
        """
        Lazily initialize and return the Google GenAI client.
        """
        if not self.api_key or self.api_key == "your_gemini_api_key_here":
            raise MissingAPIKeyError(
                "Gemini API key is not configured for embeddings. "
                "Set GEMINI_API_KEY in your .env file."
            )

        if self._client is None:
            try:
                from google import genai
                self._client = genai.Client(api_key=self.api_key)
            except ImportError as e:
                raise LLMProviderError("The 'google-genai' package is required for Gemini embeddings.") from e
            except Exception as e:
                raise LLMProviderError(f"Failed to initialize Gemini client for embeddings: {e}") from e

        return self._client

    def embed_text(self, text: str) -> List[float]:
        """
        Generate embedding vector for a single string.
        """
        if not text or not text.strip():
            # Return zero-vector for empty content
            return [0.0] * self.dimension

        results = self.embed_batch([text])
        if not results or len(results) == 0:
            raise LLMProviderError("No embedding vector returned by Gemini API.")
        return results[0]

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embedding vectors for a batch of strings in chunks.
        """
        if not texts:
            return []

        client = self._get_client()
        all_embeddings: List[List[float]] = []

        # Sanitize texts: Gemini API requires non-empty strings
        sanitized_texts = [t if t.strip() else " " for t in texts]

        for i in range(0, len(sanitized_texts), self.batch_size):
            batch = sanitized_texts[i: i + self.batch_size]
            logger.debug(f"Generating embeddings for batch of {len(batch)} items using {self._model_name}...")

            from google.genai import types

            config = types.EmbedContentConfig(
                output_dimensionality=self._dimension,
            )

            max_retries = 4
            for attempt in range(1, max_retries + 1):
                try:
                    # Call embed_content via google-genai SDK
                    response = client.models.embed_content(
                        model=self._model_name,
                        contents=batch,
                        config=config,
                    )

                    if hasattr(response, "embeddings") and response.embeddings:
                        for emb in response.embeddings:
                            if hasattr(emb, "values"):
                                all_embeddings.append(list(emb.values))
                            elif isinstance(emb, (list, tuple)):
                                all_embeddings.append(list(emb))
                            else:
                                all_embeddings.append([0.0] * self.dimension)
                    elif hasattr(response, "embedding") and response.embedding:
                        # Single item response
                        values = response.embedding.values if hasattr(response.embedding, "values") else response.embedding
                        all_embeddings.append(list(values))
                    else:
                        raise LLMProviderError("Unexpected response structure from Gemini embed_content API.")
                    break

                except Exception as e:
                    if isinstance(e, LLMProviderError):
                        raise
                    err_str = str(e).lower()
                    is_transient = any(c in err_str for c in ["503", "unavailable", "429", "high demand", "resource_exhausted", "quota", "overloaded"])
                    if is_transient and attempt < max_retries:
                        wait_sec = attempt * 3
                        logger.warning(
                            f"Gemini embedding API transient error on attempt {attempt}/{max_retries}: {e}. "
                            f"Retrying in {wait_sec}s..."
                        )
                        time.sleep(wait_sec)
                        continue
                    logger.error(f"Error calling Gemini embed_content: {e}")
                    raise LLMProviderError(f"Failed to generate embeddings from Gemini API: {str(e)}") from e

        return all_embeddings


class OpenRouterEmbeddingProvider(BaseEmbeddingProvider):
    """
    OpenRouter Embedding Provider supporting models like 'nvidia/nemotron-3-embed-1b:free'.
    Utilizes the standard OpenAI client with OpenRouter base URL.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model_name: Optional[str] = None,
        dimension: int = 2048,
        batch_size: int = DEFAULT_BATCH_SIZE,
    ):
        settings = get_settings()
        self.api_key = api_key if api_key is not None else settings.openrouter_api_key
        self.base_url = base_url or settings.openrouter_base_url
        self._model_name = model_name or settings.openrouter_embedding_model
        self._dimension = dimension
        self.batch_size = max(1, batch_size)
        self._client = None

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def model_name(self) -> str:
        return self._model_name

    def _get_client(self):
        """
        Lazily initialize and return the OpenAI client configured for OpenRouter.
        """
        if not self.api_key or self.api_key == "your_openrouter_api_key_here":
            raise MissingAPIKeyError(
                "OpenRouter API key is not configured for embeddings. "
                "Set OPENROUTER_API_KEY in your .env file."
            )

        if self._client is None:
            try:
                from openai import OpenAI
                self._client = OpenAI(
                    base_url=self.base_url,
                    api_key=self.api_key,
                )
            except ImportError as e:
                raise LLMProviderError("The 'openai' package is required for OpenRouter embeddings.") from e
            except Exception as e:
                raise LLMProviderError(f"Failed to initialize OpenAI client for OpenRouter: {e}") from e

        return self._client

    def embed_text(self, text: str) -> List[float]:
        """
        Generate embedding vector for a single string.
        """
        if not text or not text.strip():
            return [0.0] * self.dimension

        results = self.embed_batch([text])
        if not results or len(results) == 0:
            raise LLMProviderError("No embedding vector returned by OpenRouter API.")
        return results[0]

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embedding vectors for a batch of strings in chunks.
        """
        if not texts:
            return []

        client = self._get_client()
        sanitized_texts = [t if t.strip() else " " for t in texts]
        all_embeddings: List[List[float]] = []

        for i in range(0, len(sanitized_texts), self.batch_size):
            batch = sanitized_texts[i : i + self.batch_size]
            max_retries = 3
            for attempt in range(1, max_retries + 1):
                try:
                    response = client.embeddings.create(
                        extra_headers={
                            "HTTP-Referer": "https://coderag.dev",
                            "X-OpenRouter-Title": "CodeRAG",
                        },
                        model=self._model_name,
                        input=batch,
                        encoding_format="float",
                    )
                    for item in response.data:
                        emb = list(item.embedding)
                        all_embeddings.append(emb)
                        if len(emb) != self._dimension:
                            self._dimension = len(emb)
                    break
                except Exception as e:
                    if attempt < max_retries:
                        time.sleep(attempt * 2)
                        continue
                    logger.error(f"Error calling OpenRouter embeddings: {e}")
                    raise LLMProviderError(f"Failed to generate embeddings from OpenRouter: {str(e)}") from e

        return all_embeddings

import os
import threading

class LocalEmbeddingProvider(BaseEmbeddingProvider):
    """
    Local Sentence Transformers Embedding Provider using 'BAAI/bge-small-en-v1.5'.
    Produces 384-dimensional dense embeddings.
    Runs on CPU by default (or CUDA when available).
    Thread-safe singleton model loaded once and reused across all requests.
    Supports persistent model cache directories via settings or environment variables.
    """
    _cached_model: Optional[Any] = None
    _cached_device: Optional[str] = None
    _cached_model_name: Optional[str] = None
    _cached_cache_dir: Optional[str] = None
    _lock = threading.Lock()

    def __init__(
        self,
        model_name: str = "BAAI/bge-small-en-v1.5",
        batch_size: int = DEFAULT_BATCH_SIZE,
        device: Optional[str] = None,
        cache_dir: Optional[str] = None,
    ):
        settings = get_settings()
        self._model_name = model_name or getattr(settings, "embedding_model", "BAAI/bge-small-en-v1.5")
        self.batch_size = max(1, batch_size or getattr(settings, "embedding_batch_size", DEFAULT_BATCH_SIZE))
        self._cache_dir = (
            cache_dir
            or getattr(settings, "embedding_cache_dir", None)
            or os.environ.get("SENTENCE_TRANSFORMERS_HOME")
            or os.environ.get("HF_HOME")
            or os.environ.get("MODEL_CACHE_DIR")
        )

        # Detect hardware safely - prefer CPU by default unless cuda is explicitly configured and available
        if device:
            self._device = device
        else:
            configured_device = getattr(settings, "embedding_device", "cpu")
            if configured_device == "cuda":
                try:
                    import torch
                    self._device = "cuda" if torch.cuda.is_available() else "cpu"
                except ImportError:
                    self._device = "cpu"
            else:
                self._device = "cpu"

        self._dimension = 384
        self._model = None
        # Eagerly load model only if explicitly requested or device is configured
        if getattr(settings, "app_env", "") == "production":
            self._ensure_model_loaded()

    def _ensure_model_loaded(self):
        """
        Thread-safely initialize and cache the SentenceTransformer model once.
        """
        with LocalEmbeddingProvider._lock:
            if (
                LocalEmbeddingProvider._cached_model is None
                or LocalEmbeddingProvider._cached_device != self._device
                or LocalEmbeddingProvider._cached_model_name != self._model_name
                or LocalEmbeddingProvider._cached_cache_dir != self._cache_dir
            ):
                logger.info(
                    f"Initializing local embedding model '{self._model_name}' on device '{self._device}' "
                    f"(cache_dir={self._cache_dir or 'default'})..."
                )
                try:
                    import torch
                    if hasattr(torch, "set_num_threads"):
                        torch.set_num_threads(min(4, os.cpu_count() or 4))
                    from sentence_transformers import SentenceTransformer
                    try:
                        # Attempt instant local load from cache first to avoid remote network check delay
                        LocalEmbeddingProvider._cached_model = SentenceTransformer(
                            self._model_name,
                            device=self._device,
                            cache_folder=self._cache_dir,
                            local_files_only=True,
                        )
                    except Exception:
                        LocalEmbeddingProvider._cached_model = SentenceTransformer(
                            self._model_name,
                            device=self._device,
                            cache_folder=self._cache_dir,
                        )
                    LocalEmbeddingProvider._cached_device = self._device
                    LocalEmbeddingProvider._cached_model_name = self._model_name
                    LocalEmbeddingProvider._cached_cache_dir = self._cache_dir

                    dim_func = getattr(LocalEmbeddingProvider._cached_model, "get_embedding_dimension", None) or getattr(LocalEmbeddingProvider._cached_model, "get_sentence_embedding_dimension")
                    logger.info(
                        f"Local embedding model '{self._model_name}' loaded successfully "
                        f"({dim_func()} dims on {self._device})."
                    )
                except Exception as e:
                    logger.error(f"Failed to load local embedding model '{self._model_name}': {e}", exc_info=True)
                    raise LLMProviderError(
                        f"Failed to load local embedding model '{self._model_name}'. "
                        f"Ensure 'sentence-transformers' and 'torch' are installed, and that Hugging Face model weights can be downloaded or are present in cache. ({e})"
                    ) from e

            self._model = LocalEmbeddingProvider._cached_model

    @property
    def dimension(self) -> int:
        return self._dimension

    def get_dimension(self) -> int:
        return self._dimension

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def device(self) -> str:
        return self._device

    def embed_text(self, text: str) -> List[float]:
        """Generate vector embedding for a single text string."""
        if not text or not text.strip():
            return [0.0] * self.dimension
        embeddings = self.embed_batch([text])
        if not embeddings:
            return [0.0] * self.dimension
        return embeddings[0]

    def embed_query(self, query: str) -> List[float]:
        """
        Generate vector embedding for a search or chat query.
        Uses identical preprocessing and normalization as document embeddings.
        """
        return self.embed_text(query)

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Alias for embed_batch for compatibility with common embedding interfaces."""
        return self.embed_batch(texts)

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate vector embeddings for a list of strings in batches."""
        if not texts:
            return []

        self._ensure_model_loaded()
        sanitized_texts = [t if t and t.strip() else " " for t in texts]

        try:
            embeddings = self._model.encode(
                sanitized_texts,
                batch_size=self.batch_size,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
            return [emb.tolist() for emb in embeddings]
        except Exception as e:
            logger.error(f"Error generating local embeddings with {self._model_name}: {e}")
            raise LLMProviderError(f"Failed to generate local embeddings: {e}") from e


# Reusable service alias
LocalEmbeddingService = LocalEmbeddingProvider


def get_embedding_provider(
    provider_name: Optional[str] = None,
    settings: Optional[Settings] = None,
) -> BaseEmbeddingProvider:
    """
    Factory function returning the configured embedding provider.
    Supports 'local' (default BGE model), 'bge', 'gemini', and 'openrouter'.
    """
    cfg = settings or get_settings()
    selected = (provider_name or getattr(cfg, "embedding_provider", "local") or "local").lower()

    if selected in ("local", "bge", "sentence-transformers", "sentence_transformers"):
        model = getattr(cfg, "embedding_model", "BAAI/bge-small-en-v1.5")
        device = getattr(cfg, "embedding_device", "cpu")
        batch_size = getattr(cfg, "embedding_batch_size", 32)
        cache_dir = getattr(cfg, "embedding_cache_dir", None)
        return LocalEmbeddingProvider(
            model_name=model,
            device=device,
            batch_size=batch_size,
            cache_dir=cache_dir,
        )

    if selected == "openrouter":
        model = getattr(cfg, "openrouter_embedding_model", None) or getattr(cfg, "embedding_model", None)
        return OpenRouterEmbeddingProvider(
            api_key=cfg.openrouter_api_key,
            base_url=cfg.openrouter_base_url,
            model_name=model,
        )

    return GeminiEmbeddingProvider(
        api_key=cfg.gemini_api_key,
        model_name=cfg.gemini_embedding_model,
    )

