"""
Tests for newly added repository endpoints and semantic code search.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.repository_store import get_data_store

client = TestClient(app)


def test_get_repository_details():
    store = get_data_store()
    store.save_repository(
        user_id="default_user",
        repository_id="octocat__test-details",
        data={
            "owner": "octocat",
            "name": "test-details",
            "full_name": "octocat/test-details",
            "default_branch": "main",
            "selected_branch": "main",
            "stars_count": 42,
            "total_files": 5,
            "total_chunks": 15,
        },
    )

    # Test via /repositories/{id}
    res = client.get("/repositories/octocat__test-details")
    assert res.status_code == 200
    data = res.json()
    assert data["repository_id"] == "octocat__test-details"
    assert data["stars_count"] == 42
    assert data["full_name"] == "octocat/test-details"

    # Test via /api/repositories/{id}
    res_api = client.get("/api/repositories/octocat__test-details")
    assert res_api.status_code == 200
    assert res_api.json()["repository_id"] == "octocat__test-details"

    # Test via /api/v1/repositories/{id}
    res_v1 = client.get("/api/v1/repositories/octocat__test-details")
    assert res_v1.status_code == 200


def test_get_repository_details_not_found():
    res = client.get("/api/repositories/nonexistent__repo_xyz")
    assert res.status_code == 404


def test_reindex_repository():
    store = get_data_store()
    store.save_repository(
        user_id="default_user",
        repository_id="octocat__Hello-World",
        data={
            "owner": "octocat",
            "name": "Hello-World",
            "full_name": "octocat/Hello-World",
            "default_branch": "master",
        },
    )

    res = client.post("/api/repositories/octocat__Hello-World/reindex")
    assert res.status_code == 202
    data = res.json()
    assert data["repository_id"] == "octocat__hello-world"
    assert "job_id" in data


def test_semantic_search_endpoint_empty_query():
    res = client.post("/api/search", json={"query": ""})
    assert res.status_code in [400, 422]


def test_semantic_search_endpoint_with_mock_vector_store(monkeypatch):
    # Mock embedding and vector store search to avoid external network calls during fast unit test
    from app.services.repository_service import get_repository_service
    repo_svc = get_repository_service()

    monkeypatch.setattr(
        repo_svc.rag_pipeline.embedding_provider,
        "embed_text",
        lambda text: [0.1] * repo_svc.rag_pipeline.embedding_provider.dimension,
    )
    monkeypatch.setattr(
        repo_svc.rag_pipeline.vector_store,
        "search",
        lambda *args, **kwargs: [
            {
                "chunk_id": "test_chunk_1",
                "repository_id": "octocat__test-repo",
                "file_path": "main.py",
                "language": "python",
                "start_line": 1,
                "end_line": 10,
                "content": "def calculate_total(): pass",
                "score": 0.95,
                "metadata": {"branch": "main"},
            }
        ],
    )

    payload = {
        "query": "function to calculate total",
        "repository_id": "octocat__test-repo",
        "top_k": 5,
    }

    # Test /search
    res = client.post("/search", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["total_hits"] == 1
    assert data["hits"][0]["file_path"] == "main.py"
    assert data["hits"][0]["score"] == 0.95

    # Test /api/search
    res_api = client.post("/api/search", json=payload)
    assert res_api.status_code == 200
    assert res_api.json()["total_hits"] == 1

    # Test /api/v1/search
    res_v1 = client.post("/api/v1/search", json=payload)
    assert res_v1.status_code == 200
    assert res_v1.json()["total_hits"] == 1
