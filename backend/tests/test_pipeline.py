"""
Unit & Integration tests for RAGPipeline orchestration.
"""

from pathlib import Path
from unittest.mock import MagicMock
import pytest

from app.rag.pipeline import RAGPipeline, IndexingResult, RAGResponse
from app.rag.vector_store import QdrantVectorStore
from app.rag.embeddings import BaseEmbeddingProvider
from app.services.llm_provider import BaseLLMProvider


class MockEmbedding(BaseEmbeddingProvider):
    @property
    def dimension(self) -> int:
        return 4

    @property
    def model_name(self) -> str:
        return "mock-embed"

    def embed_text(self, text: str):
        return [1.0, 0.0, 0.0, 0.0]

    def embed_batch(self, texts):
        return [[1.0, 0.0, 0.0, 0.0] for _ in texts]


class MockLLM(BaseLLMProvider):
    def generate_text(self, prompt: str, system_instruction=None, temperature=0.2):
        return "Token creation is handled in `auth.py: lines 20-35` via `create_access_token`."

    def smoke_test(self):
        return {"status": "success", "response": "OK"}


def test_pipeline_index_sample_repo_and_answer():
    """
    Test indexing the real sample_repo directory and generating an answer.
    """
    sample_repo_path = Path(__file__).resolve().parent.parent.parent / "sample_code" / "sample_repo"

    # Use in-memory Qdrant store
    store = QdrantVectorStore(
        collection_name="test_pipeline_chunks",
        vector_size=4,
        location=":memory:",
    )

    pipeline = RAGPipeline(
        embedding_provider=MockEmbedding(),
        vector_store=store,
        llm_provider=MockLLM(),
    )

    # 1. Index sample repo
    idx_result = pipeline.index_directory(
        directory_path=sample_repo_path,
        repository_id="test_sample_repo",
    )

    assert idx_result.files_discovered >= 4
    assert idx_result.files_indexed >= 4
    assert idx_result.chunks_created >= 4
    assert idx_result.chunks_indexed >= 4
    assert idx_result.error is None
    assert idx_result.duration_ms >= 0

    # 2. Answer question
    response = pipeline.answer_question(
        question="How does JWT creation work?",
        repository_id="test_sample_repo",
        top_k=2,
    )

    assert isinstance(response, RAGResponse)
    assert "create_access_token" in response.answer
    assert len(response.sources) > 0
    assert response.sources[0].path in ["auth.py", "database.py", "user_service.py", "main.py"]
    assert response.sources[0].start_line >= 1
    assert response.sources[0].end_line >= response.sources[0].start_line
    assert response.insufficient_context is False


def test_pipeline_empty_retrieval_returns_clean_response():
    """
    Test that searching an unindexed repository returns insufficient_context response gracefully.
    """
    store = QdrantVectorStore(
        collection_name="test_empty_chunks",
        vector_size=4,
        location=":memory:",
    )

    pipeline = RAGPipeline(
        embedding_provider=MockEmbedding(),
        vector_store=store,
        llm_provider=MockLLM(),
    )

    response = pipeline.answer_question(
        question="Where is payment processing handled?",
        repository_id="non_existent_repo",
    )

    assert response.insufficient_context is True
    assert response.retrieved_chunks_count == 0
    assert len(response.sources) == 0
    assert "no relevant source code files" in response.answer.lower()
