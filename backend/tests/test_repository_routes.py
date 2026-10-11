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

    with patch.object(repo_service.github_client, "validate_url") as mock_val, \
         patch.object(repo_service.github_client, "fetch_repository_manifest") as mock_manifest:

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
        mock_manifest.return_value = {
            "total_files": 5,
            "files": [{"path": "main.py", "language": "python", "size_bytes": 100}],
            "directories": [],
            "languages": {"python": 1},
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
    assert response.json()["detail"]["code"] == "INVALID_URL"


def test_validate_repository_route_empty_repository(test_client: TestClient):
    """
    Test POST /repositories/validate with empty repository returns HTTP 409 and EMPTY_REPOSITORY code.
    """
    from app.github.client import EmptyRepositoryError
    repo_service = get_repository_service()

    with patch.object(repo_service.github_client, "validate_url") as mock_val:
        mock_val.side_effect = EmptyRepositoryError("This GitHub repository is empty. Add at least one committed file before analyzing it.")

        response = test_client.post(
            "/repositories/validate",
            json={"url": "https://github.com/octocat/empty-repo"},
        )

        assert response.status_code == status.HTTP_409_CONFLICT
        data = response.json()
        assert data["detail"]["code"] == "EMPTY_REPOSITORY"
        assert data["detail"]["recoverable"] is True
        assert "empty" in data["detail"]["message"].lower()


def test_validate_repository_route_branch_not_found(test_client: TestClient):
    """
    Test POST /repositories/validate with missing branch returns HTTP 404 and BRANCH_NOT_FOUND code.
    """
    from app.github.client import BranchNotFoundError
    repo_service = get_repository_service()

    with patch.object(repo_service.github_client, "validate_url") as mock_val:
        mock_val.side_effect = BranchNotFoundError(branch="feature-x", default_branch="master")

        response = test_client.post(
            "/repositories/validate",
            json={"url": "https://github.com/octocat/repo", "branch": "feature-x"},
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert data["detail"]["code"] == "BRANCH_NOT_FOUND"
        assert data["detail"]["recoverable"] is True
        assert "master" in data["detail"]["message"]
        assert data["detail"]["details"]["default_branch"] == "master"


def test_validate_repository_route_no_supported_files(test_client: TestClient):
    """
    Test POST /repositories/validate with repo having no supported source files returns HTTP 422.
    """
    from app.github.client import NoSupportedSourceFilesError
    repo_service = get_repository_service()

    with patch.object(repo_service.github_client, "validate_url") as mock_val:
        mock_val.side_effect = NoSupportedSourceFilesError("Repository contains no supported source-code files.")

        response = test_client.post(
            "/repositories/validate",
            json={"url": "https://github.com/octocat/docs-only"},
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert data["detail"]["code"] == "NO_SUPPORTED_SOURCE_FILES"
        assert data["detail"]["recoverable"] is True



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
        mock_emb.return_value = [[0.1] * repo_service.rag_pipeline.embedding_provider.dimension]

        response = test_client.post(
            "/repositories/index",
            json={"url": "https://github.com/octocat/Hello-World", "branch": "master"},
        )

        assert response.status_code == status.HTTP_202_ACCEPTED
        data = response.json()
        assert "job_id" in data
        assert data["repository_id"] == "octocat__hello-world"
        assert data["branch"] == "master"


def test_index_duplicate_job_protection(test_client: TestClient):
    """
    Test that submitting an index request while a job is already queued/indexing returns the active job.
    """
    repo_service = get_repository_service()
    res1 = repo_service.start_indexing_job(
        url="https://github.com/octocat/Hello-World",
        user_id="default_user",
        background_tasks=MagicMock(),
    )
    assert res1.status == "queued"

    # Second submission for the same repo should detect the active job
    res2 = repo_service.start_indexing_job(
        url="https://github.com/octocat/Hello-World",
        user_id="default_user",
        background_tasks=MagicMock(),
    )
    assert res2.job_id == res1.job_id
    assert "already" in res2.message.lower()


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
    from app.rag.chunker import CodeChunk
    from app.db.repository_store import get_data_store
    from app.rag.file_scanner import DiscoveredFile

    repo_service = get_repository_service()
    data_store = get_data_store()
    vec_size = repo_service.rag_pipeline.vector_store.vector_size

    # Seed metadata and vector store
    data_store.save_repository("default_user", "test_repo_route", {
        "repository_id": "test_repo_route",
        "owner": "test",
        "name": "repo",
        "full_name": "test/repo",
        "default_branch": "main",
        "manifest": {
            "total_files": 1,
            "files": [{"path": "src/app.py", "language": "python", "size_bytes": 100}],
            "directories": ["src"],
            "languages": {"python": 1},
        }
    })

    mock_discovered = [
        DiscoveredFile(
            path="src/app.py",
            absolute_path=Path("src/app.py"),
            language="python",
            content="def login(): return 'authenticated'",
            size_bytes=35,
            line_count=1,
        )
    ]

    with patch.object(repo_service.github_client, "fetch_files_by_paths", return_value=mock_discovered), \
         patch.object(repo_service.rag_pipeline.llm_provider, "generate_text") as mock_gen, \
         patch.object(repo_service.rag_pipeline.embedding_provider, "embed_text") as mock_emb, \
         patch.object(repo_service.rag_pipeline.embedding_provider, "embed_batch") as mock_batch:

        mock_emb.return_value = [0.1] * vec_size
        mock_batch.return_value = [[0.1] * vec_size]
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


def test_chat_route_empty_question_fails(test_client: TestClient):
    """
    Test POST /chat with empty question returns 400 Bad Request.
    """
    response = test_client.post(
        "/chat",
        json={"repository_id": "test_repo_route", "question": "   "},
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
