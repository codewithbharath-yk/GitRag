"""
Unit tests for CodeRetriever module.
"""

from unittest.mock import MagicMock
from app.rag.retriever import CodeRetriever, RetrievedChunk
from app.rag.embeddings import BaseEmbeddingProvider


class MockEmbeddingProvider(BaseEmbeddingProvider):
    @property
    def dimension(self) -> int:
        return 4

    @property
    def model_name(self) -> str:
        return "mock-embedding"

    def embed_text(self, text: str):
        return [0.5, 0.5, 0.0, 0.0]

    def embed_batch(self, texts):
        return [[0.5, 0.5, 0.0, 0.0] for _ in texts]


def test_retriever_empty_query():
    """
    Verify empty query returns empty result without calling vector search.
    """
    mock_store = MagicMock()
    retriever = CodeRetriever(vector_store=mock_store, embedding_provider=MockEmbeddingProvider())

    result = retriever.retrieve(query="")
    assert result.total_found == 0
    assert result.chunks == []
    mock_store.search.assert_not_called()


def test_retriever_formats_hits():
    """
    Verify search hits are mapped correctly into RetrievedChunk objects.
    """
    mock_store = MagicMock()
    mock_store.search.return_value = [
        {
            "chunk_id": "c1",
            "repository_id": "repo1",
            "file_path": "auth.py",
            "language": "python",
            "start_line": 5,
            "end_line": 25,
            "content": "def hash_password():",
            "score": 0.88,
            "metadata": {"custom": "value"},
        }
    ]

    retriever = CodeRetriever(vector_store=mock_store, embedding_provider=MockEmbeddingProvider())
    result = retriever.retrieve(query="password hashing", repository_id="repo1", top_k=3)

    assert result.total_found == 1
    assert len(result.chunks) == 1
    chunk = result.chunks[0]
    assert chunk.file_path == "auth.py"
    assert chunk.start_line == 5
    assert chunk.end_line == 25
    assert chunk.score == 0.88
    assert chunk.content == "def hash_password():"
