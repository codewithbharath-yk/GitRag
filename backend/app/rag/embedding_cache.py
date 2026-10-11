"""
Embedding Cache Module for Question-Driven / Lazy RAG.

Stores and retrieves chunk embeddings by deterministic content and location hash,
preventing duplicate embedding operations across repeated questions and sessions.
"""

import hashlib
import json
import os
import threading
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

from app.utils.logger import get_logger

logger = get_logger(__name__)


class EmbeddingCache:
    """
    Thread-safe in-memory and persistent chunk embedding cache.
    """

    def __init__(self, cache_file_path: Optional[str] = None):
        self._lock = threading.Lock()
        self._cache: Dict[str, List[float]] = {}
        self._cache_file_path = cache_file_path
        self._load_disk_cache()

    def _load_disk_cache(self) -> None:
        """
        Load existing cache from disk if file exists.
        """
        if not self._cache_file_path:
            return

        try:
            path = Path(self._cache_file_path)
            if path.exists() and path.is_file():
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        self._cache = data
                        logger.info(f"Loaded {len(self._cache)} cached embeddings from '{path}'.")
        except Exception as e:
            logger.warning(f"Could not load embedding cache from '{self._cache_file_path}': {e}")

    def _persist_disk_cache(self) -> None:
        """
        Persist cache to disk.
        """
        if not self._cache_file_path:
            return

        try:
            path = Path(self._cache_file_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(self._cache, f)
        except Exception as e:
            logger.debug(f"Could not save embedding cache to disk: {e}")

    @staticmethod
    def generate_chunk_key(
        repository_id: str,
        branch: str,
        file_path: str,
        start_line: int,
        end_line: int,
        content: str,
    ) -> str:
        """
        Compute a stable SHA256 digest identity for a chunk.
        """
        content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]
        seed = f"{repository_id}:{branch}:{file_path}:{start_line}:{end_line}:{content_hash}"
        return hashlib.sha256(seed.encode("utf-8")).hexdigest()

    def get(self, key: str) -> Optional[List[float]]:
        """
        Retrieve cached embedding vector for key.
        """
        with self._lock:
            return self._cache.get(key)

    def get_batch(
        self,
        keys: List[str],
    ) -> Tuple[Dict[int, List[float]], List[int]]:
        """
        Lookup a batch of keys.
        Returns:
            cached_map: {index: vector} for hits
            missing_indices: [index] for misses
        """
        cached_map: Dict[int, List[float]] = {}
        missing_indices: List[int] = []

        with self._lock:
            for idx, key in enumerate(keys):
                if key in self._cache:
                    cached_map[idx] = self._cache[key]
                else:
                    missing_indices.append(idx)

        return cached_map, missing_indices

    def put_batch(
        self,
        keys: List[str],
        vectors: List[List[float]],
    ) -> None:
        """
        Store a batch of keys and their embedding vectors.
        """
        if len(keys) != len(vectors):
            return

        with self._lock:
            for key, vec in zip(keys, vectors):
                self._cache[key] = vec

            if self._cache_file_path and len(keys) > 0:
                self._persist_disk_cache()

    def clear(self) -> None:
        """
        Clear in-memory and disk cache.
        """
        with self._lock:
            self._cache.clear()
            if self._cache_file_path:
                try:
                    p = Path(self._cache_file_path)
                    if p.exists():
                        p.unlink()
                except Exception:
                    pass

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._cache)


# Global singleton instance
_embedding_cache_instance: Optional[EmbeddingCache] = None


def get_embedding_cache() -> EmbeddingCache:
    global _embedding_cache_instance
    if _embedding_cache_instance is None:
        from app.config.settings import get_settings
        settings = get_settings()
        cache_dir = getattr(settings, "embedding_cache_dir", None) or "storage"
        cache_path = os.path.join(cache_dir, "chunk_embeddings_cache.json")
        _embedding_cache_instance = EmbeddingCache(cache_file_path=cache_path)
    return _embedding_cache_instance
