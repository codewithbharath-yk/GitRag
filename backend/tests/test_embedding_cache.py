"""
Unit Tests for EmbeddingCache in Question-Driven / Lazy RAG.
"""

import pytest
from app.rag.embedding_cache import EmbeddingCache


def test_embedding_cache_hit_and_miss():
    """Verify in-memory caching and deterministic chunk key retrieval."""
    cache = EmbeddingCache()

    key1 = EmbeddingCache.generate_chunk_key("repo1", "main", "auth.py", 1, 50, "def login(): pass")
    key2 = EmbeddingCache.generate_chunk_key("repo1", "main", "db.py", 1, 50, "def connect(): pass")

    # Initial lookup should miss
    assert cache.get(key1) is None

    # Store embedding
    dummy_vector1 = [0.1] * 384
    cache.put_batch([key1], [dummy_vector1])

    # Cache hit
    hit = cache.get(key1)
    assert hit is not None
    assert len(hit) == 384
    assert hit[0] == 0.1

    # Batch lookup
    cached_map, missing = cache.get_batch([key1, key2])
    assert 0 in cached_map
    assert 1 in missing
    assert cached_map[0] == dummy_vector1
