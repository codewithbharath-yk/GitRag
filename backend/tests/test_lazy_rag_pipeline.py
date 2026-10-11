"""
Integration and Unit Tests for Question-Driven / Lazy RAG Pipeline.
"""

import pytest
from pathlib import Path
from app.rag.pipeline import RAGPipeline, DiscoveredFile
from app.rag.embeddings import BaseEmbeddingProvider
from app.rag.vector_store import QdrantVectorStore
from app.services.llm_provider import BaseLLMProvider


class MockEmbeddingProvider(BaseEmbeddingProvider):
    @property
    def dimension(self) -> int:
        return 384

    @property
    def model_name(self) -> str:
        return "mock-bge-model"

    def embed_text(self, text: str) -> list[float]:
        # Generate stable deterministic pseudo-vector based on character values
        val = sum(ord(c) for c in text[:20]) % 100 / 100.0
        vec = [val] * 384
        vec[0] = 1.0  # normalize non-zero
        return vec

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [self.embed_text(t) for t in texts]


class MockLLMProvider(BaseLLMProvider):
    @property
    def provider_name(self) -> str:
        return "mock-llm"

    @property
    def model_name(self) -> str:
        return "mock-model"

    def generate_text(self, prompt: str, system_instruction: str = None, temperature: float = 0.2) -> str:
        if "login" in prompt.lower() or "auth" in prompt.lower():
            return "Authentication is handled in `src/auth/login.ts` via the `authenticateUser` function."
        return "Based on the repository code, the requested information was not found."

    def smoke_test(self) -> bool:
        return True


def test_lazy_rag_pipeline_end_to_end():
    """Verify that Question-Driven Lazy RAG selectively retrieves, parses, embeds, and answers."""
    emb_provider = MockEmbeddingProvider()
    vec_store = QdrantVectorStore(collection_name="test_lazy_collection", location=":memory:", vector_size=384)
    llm = MockLLMProvider()

    pipeline = RAGPipeline(
        embedding_provider=emb_provider,
        vector_store=vec_store,
        llm_provider=llm,
    )

    manifest_files = [
        {"path": "src/auth/login.ts", "language": "typescript", "size_bytes": 500},
        {"path": "src/database/client.ts", "language": "typescript", "size_bytes": 400},
        {"path": "README.md", "language": "markdown", "size_bytes": 1000},
    ]

    fetched_files_log = []

    def mock_fetch_callback(paths: list[str]) -> list[DiscoveredFile]:
        result = []
        for p in paths:
            fetched_files_log.append(p)
            if p == "src/auth/login.ts":
                content = (
                    "export function authenticateUser(token: string) {\n"
                    "    // JWT verification logic\n"
                    "    return verifyToken(token);\n"
                    "}\n"
                )
            elif p == "src/database/client.ts":
                content = "export const db = createConnection();\n"
            else:
                content = "# Project Overview\n"

            result.append(
                DiscoveredFile(
                    path=p,
                    absolute_path=Path(p),
                    language="typescript",
                    content=content,
                    size_bytes=len(content),
                    line_count=len(content.splitlines()),
                )
            )
        return result

    # Ask an auth-specific question
    resp = pipeline.answer_question(
        question="Where is user login and authentication handled?",
        repository_id="test_repo",
        user_id="user_123",
        branch="main",
        manifest_files=manifest_files,
        fetch_file_content_fn=mock_fetch_callback,
    )

    assert resp.question == "Where is user login and authentication handled?"
    assert "src/auth/login.ts" in fetched_files_log
    assert "src/auth/login.ts" in resp.files_analyzed
    assert len(resp.sources) > 0
    assert resp.sources[0].path == "src/auth/login.ts"
    assert "authenticateUser" in resp.answer or "Authentication is handled" in resp.answer


def test_lazy_rag_pipeline_fault_tolerance():
    """Verify that if one candidate file fails to download, the pipeline continues gracefully."""
    emb_provider = MockEmbeddingProvider()
    vec_store = QdrantVectorStore(collection_name="test_fault_collection", location=":memory:", vector_size=384)
    llm = MockLLMProvider()

    pipeline = RAGPipeline(
        embedding_provider=emb_provider,
        vector_store=vec_store,
        llm_provider=llm,
    )

    manifest_files = [
        {"path": "src/auth/broken.ts", "language": "typescript", "size_bytes": 500},
        {"path": "src/auth/login.ts", "language": "typescript", "size_bytes": 500},
    ]

    def mock_fetch_with_failure(paths: list[str]) -> list[DiscoveredFile]:
        result = []
        for p in paths:
            if p == "src/auth/broken.ts":
                # Simulated 404/failure by skipping or throwing handled exception
                continue
            content = "export function login() { return true; }\n"
            result.append(
                DiscoveredFile(
                    path=p,
                    absolute_path=Path(p),
                    language="typescript",
                    content=content,
                    size_bytes=len(content),
                    line_count=1,
                )
            )
        return result

    resp = pipeline.answer_question(
        question="Where is login?",
        repository_id="test_repo",
        user_id="user_123",
        branch="main",
        manifest_files=manifest_files,
        fetch_file_content_fn=mock_fetch_with_failure,
    )

    assert resp is not None
    assert "src/auth/login.ts" in resp.files_analyzed
