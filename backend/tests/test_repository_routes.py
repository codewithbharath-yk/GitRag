"""
Unit tests for FastAPI Repository and Chat API routes.
"""

from unittest.mock import MagicMock, patch
from fastapi import status
from fastapi.testclient import TestClient

from app.rag.file_scanner import DiscoveredFile
from app.services.repository_service import get_repository_service
from pathlib import Path


def test_validate_repository_route_success(test_client: TestClient):
    """
    Test POST /repositories/validate returns 200 and repository metadata.
    """
    repo_service = get_repository_service()

    with patch.object(repo_service.github_client, "validate_url") as mock_val:
        mock_val.return_value = {
            "id": 12345,
            "owner": "octocat",
            "name": "Hello-World",
            "full_name": "octocat/Hello-World",
            "default_branch": "master",
            "selected_branch": "master",
            "is_private": False,
            "description": "My first repo",
            "size_kb": 100,
            "stars_count": 2500,
            "forks_count": 500,
            "language": "Python",
            "repository_id": "octocat__hello-world",
        }

        response = test_client.post(
            "/repositories/validate",
            json={"url": "https://github.com/octocat/Hello-World"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["valid"] is True
        assert data["owner"] == "octocat"
        assert data["name"] == "Hello-World"
        assert data["repository_id"] == "octocat__hello-world"


def test_validate_repository_route_invalid_url(test_client: TestClient):
    """
    Test POST /repositories/validate with malformed or non-GitHub URL returns 400.
    """
    response = test_client.post(
        "/repositories/validate",
        json={"url": "https://gitlab.com/other/repo"},
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "Invalid repository URL" in response.json()["detail"]


def test_index_repository_route_success(test_client: TestClient):
    """
    Test POST /repositories/index queues a job and returns 202 Accepted.
    """
    repo_service = get_repository_service()

    # Mock fetch_repository_source_files to return sample files
    mock_files = [
        DiscoveredFile(
            path="auth.py",
            absolute_path=Path("auth.py"),
            language="python",
            content="def login(): pass",
            size_bytes=18,
            line_count=1,
        )
    ]

    with patch.object(repo_service.github_client, "get_repository_metadata") as mock_meta, \
         patch.object(repo_service.github_client, "fetch_repository_source_files") as mock_fetch, \
         patch.object(repo_service.rag_pipeline.embedding_provider, "embed_batch") as mock_emb:

        mock_meta.return_value = {
            "owner": "octocat",
            "name": "Hello-World",
            "default_branch": "master",
        }
        mock_fetch.return_value = mock_files
        mock_emb.return_value = [[0.1] * 768]

        response = test_client.post(
            "/repositories/index",
            json={"url": "https://github.com/octocat/Hello-World", "branch": "master"},
        )

        assert response.status_code == status.HTTP_202_ACCEPTED
        data = response.json()
        assert "job_id" in data
        assert data["repository_id"] == "octocat__hello-world"
        assert data["branch"] == "master"


def test_get_repository_status_route(test_client: TestClient):
    """
    Test GET /repositories/{id}/status returns current repository status.
    """
    repo_service = get_repository_service()
    repo_service.rag_pipeline.vector_store.upsert_chunks(
        chunks=[],
        embeddings=[],
    )

    response = test_client.get("/repositories/octocat__hello-world/status")
    assert response.status_code in (status.HTTP_200_OK, status.HTTP_404_NOT_FOUND)


def test_get_repository_files_route(test_client: TestClient):
    """
    Test GET /repositories/{id}/files returns list of indexed files.
    """
    repo_service = get_repository_service()

    # Seed mock files in vector store
    from app.rag.chunker import CodeChunk
    chunk = CodeChunk(
        chunk_id="chunk_test_1",
        repository_id="test_repo_route",
        file_path="src/app.py",
        language="python",
        start_line=1,
        end_line=25,
        content="print('hello')",
    )
    vec_size = repo_service.rag_pipeline.vector_store.vector_size
    repo_service.rag_pipeline.vector_store.upsert_chunks([chunk], [[0.1] * vec_size])

    response = test_client.get("/repositories/test_repo_route/files")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total_files"] >= 1
    assert any(f["path"] == "src/app.py" for f in data["files"])


def test_chat_route_success(test_client: TestClient):
    """
    Test POST /chat returns 200 OK and grounded answer.
    """
    repo_service = get_repository_service()
    vec_size = repo_service.rag_pipeline.vector_store.vector_size

    with patch.object(repo_service.rag_pipeline.llm_provider, "generate_text") as mock_gen, \
         patch.object(repo_service.rag_pipeline.embedding_provider, "embed_text") as mock_emb:

        mock_emb.return_value = [0.1] * vec_size
        mock_gen.return_value = "Authentication is handled in `src/app.py: lines 1-25`."

        response = test_client.post(
            "/chat",
            json={
                "repository_id": "test_repo_route",
                "question": "Where is authentication handled?",
            },
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "answer" in data
        assert "Authentication is handled" in data["answer"]
        assert "sources" in data
        assert "insufficient_context" in data


def test_chat_route_empty_question_fails(test_client: TestClient):
    """
    Test POST /chat with empty question returns 400 Bad Request.
    """
    response = test_client.post(
        "/chat",
        json={"repository_id": "test_repo_route", "question": "   "},
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
