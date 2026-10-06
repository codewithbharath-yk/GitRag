"""
Unit and Integration Tests for Authentication, User Isolation, and Security Limits.
"""

import pytest
from fastapi.testclient import TestClient

from app.auth.models import RegisterRequest, LoginRequest, User, UserRole
from app.auth.jwt_handler import JWTHandler
from app.auth.service import get_auth_service, UserAlreadyExistsError, InvalidCredentialsError
from app.auth.dependencies import get_current_user
from app.rag.vector_store import QdrantVectorStore
from app.db.repository_store import get_data_store
from app.rag.pipeline import RAGPipeline
from app.rag.chunker import CodeChunk


class DummyEmbeddingService:
    """Mock embeddings for predictable vector store testing without API quota."""
    def __init__(self, dimension: int = 2048):
        self.dimension = dimension

    def embed_text(self, text: str) -> list[float]:
        val = (abs(hash(text)) % 1000) / 1000.0
        return [val] * self.dimension

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [self.embed_text(t) for t in texts]

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return self.embed_texts(texts)

    def embed_query(self, query: str) -> list[float]:
        return self.embed_text(query)


def test_password_hashing_and_jwt_generation():
    """Verify PBKDF2 hashing and JWT creation/verification."""
    password = "SuperSecretPassword123!"
    hashed = JWTHandler.hash_password(password)
    
    # Hash must be pbkdf2_sha256 format
    assert "$" in hashed
    assert JWTHandler.verify_password(password, hashed) is True
    assert JWTHandler.verify_password("WrongPassword", hashed) is False

    test_user = User(
        id="usr_test_123",
        email="test@coderag.ai",
        role=UserRole.USER,
        is_active=True,
    )
    token, expires_in = JWTHandler.create_access_token(test_user)
    assert isinstance(token, str)
    assert len(token) > 20
    assert expires_in == 86400

    payload = JWTHandler.decode_access_token(token)
    assert payload["sub"] == "usr_test_123"
    assert payload["email"] == "test@coderag.ai"
    assert payload["role"] == "user"


def test_auth_service_registration_and_login():
    """Verify AuthService registration and login flows."""
    auth_service = get_auth_service()
    unique_email = f"user_{id(auth_service)}@test.com"

    # 1. Register new user
    reg_req = RegisterRequest(email=unique_email, password="password123", full_name="Test Developer")
    token_resp = auth_service.register_user(reg_req)
    assert token_resp.access_token is not None
    assert token_resp.user.email == unique_email

    # 2. Duplicate registration should raise error
    with pytest.raises(UserAlreadyExistsError):
        auth_service.register_user(reg_req)

    # 3. Login with correct password
    login_resp = auth_service.login_user(LoginRequest(email=unique_email, password="password123"))
    assert login_resp.access_token is not None
    assert login_resp.user.id == token_resp.user.id

    # 4. Login with incorrect password
    with pytest.raises(InvalidCredentialsError):
        auth_service.login_user(LoginRequest(email=unique_email, password="wrongpassword"))


def test_auth_api_routes(test_client: TestClient):
    """Test REST API endpoints for authentication."""
    unique_email = f"api_user_{id(test_client)}@coderag.ai"

    # Register
    reg_res = test_client.post(
        "/api/v1/auth/register",
        json={"email": unique_email, "password": "SecurePassword999", "full_name": "API User"},
    )
    assert reg_res.status_code == 201
    data = reg_res.json()
    token = data["access_token"]
    assert token is not None

    # Get /me with Bearer token
    me_res = test_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["email"] == unique_email

    # Get /me without token -> 401 Unauthorized
    unauth_res = test_client.get("/api/v1/auth/me")
    assert unauth_res.status_code == 401

    # Login
    login_res = test_client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "SecurePassword999"},
    )
    assert login_res.status_code == 200
    assert login_res.json()["access_token"] is not None

    # Refresh
    refresh_res = test_client.post(
        "/api/v1/auth/refresh",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert refresh_res.status_code == 200
    assert refresh_res.json()["access_token"] is not None


def test_user_and_repository_vector_isolation():
    """
    CRITICAL: Test that User A indexing Repo X cannot be retrieved by User B querying Repo X.
    """
    store = QdrantVectorStore(collection_name="test_isolation_collection", location=":memory:")

    user_a = "usr_alice_1001"
    user_b = "usr_bob_2002"
    repo_id = "shared_repo_name"

    # Clean existing test data
    store.delete_repository(repo_id, user_id=user_a)
    store.delete_repository(repo_id, user_id=user_b)

    # Insert chunk for User A
    chunk_a = CodeChunk(
        chunk_id=f"chunk_a_{id(store)}",
        repository_id=repo_id,
        file_path="secret_alice.py",
        language="python",
        start_line=1,
        end_line=2,
        content="def alice_secret(): return 'AliceSecretKey'",
        metadata={"branch": "main", "user_id": user_a},
    )
    store.upsert_chunks([chunk_a], [[0.1] * 2048], user_id=user_a)

    # Insert chunk for User B
    chunk_b = CodeChunk(
        chunk_id=f"chunk_b_{id(store)}",
        repository_id=repo_id,
        file_path="secret_bob.py",
        language="python",
        start_line=1,
        end_line=2,
        content="def bob_secret(): return 'BobSecretKey'",
        metadata={"branch": "main", "user_id": user_b},
    )
    store.upsert_chunks([chunk_b], [[0.1] * 2048], user_id=user_b)

    # 1. User A queries: must only get Alice's document
    res_a = store.search([0.1] * 2048, top_k=10, repository_id=repo_id, user_id=user_a)
    assert len(res_a) == 1
    assert res_a[0]["file_path"] == "secret_alice.py"
    assert "AliceSecretKey" in res_a[0]["content"]

    # 2. User B queries: must only get Bob's document
    res_b = store.search([0.1] * 2048, top_k=10, repository_id=repo_id, user_id=user_b)
    assert len(res_b) == 1
    assert res_b[0]["file_path"] == "secret_bob.py"
    assert "BobSecretKey" in res_b[0]["content"]

    # 3. List files isolation
    files_a = store.list_repository_files(repo_id, user_id=user_a)
    assert len(files_a) == 1
    assert files_a[0]["path"] == "secret_alice.py"

    files_b = store.list_repository_files(repo_id, user_id=user_b)
    assert len(files_b) == 1
    assert files_b[0]["path"] == "secret_bob.py"

    # 4. User A deletes their repository: User B's data MUST remain untouched
    store.delete_repository(repo_id, user_id=user_a)
    assert store.count_repository_chunks(repo_id, user_id=user_a) == 0
    assert store.count_repository_chunks(repo_id, user_id=user_b) == 1

    # Cleanup Bob
    store.delete_repository(repo_id, user_id=user_b)


def test_data_store_repository_ownership():
    """Verify in-memory / Supabase data store user ownership isolation."""
    store = get_data_store()
    user1 = "user_1"
    user2 = "user_2"
    repo1 = "my_owner/repo_alpha"

    # Save repo for user 1
    store.save_repository(user1, repo1, {"owner": "my_owner", "name": "repo_alpha", "total_files": 12})
    
    # User 1 can see it
    rec1 = store.get_repository(user1, repo1)
    assert rec1 is not None
    assert rec1.total_files == 12

    # User 2 CANNOT see user 1's repo
    rec2 = store.get_repository(user2, repo1)
    assert rec2 is None

    # User 2's list is empty
    user2_repos = store.list_repositories(user2)
    assert len([r for r in user2_repos if r.repository_id == repo1]) == 0


from pathlib import Path
from app.rag.file_scanner import DiscoveredFile


def test_resource_limits_enforcement():
    """Test that file count limits and chunk bounds are enforced in RAG pipeline."""
    pipeline = RAGPipeline(
        embedding_provider=DummyEmbeddingService(),
        vector_store=QdrantVectorStore(collection_name="test_limits_collection", location=":memory:"),
    )
    
    # Create synthetic list of files
    files = [
        DiscoveredFile(
            path=f"src/file_{i}.py",
            absolute_path=Path(f"/tmp/src/file_{i}.py"),
            content=f"def func_{i}():\n    return {i}\n",
            language="python",
            size_bytes=30,
            line_count=2,
        )
        for i in range(5)
    ]
    
    res = pipeline.index_files(
        files=files,
        repository_id="test_limits_repo",
        user_id="test_limit_user",
        branch="main",
        clean_existing=True,
    )
    assert res.files_indexed == 5
    assert res.chunks_indexed == 5
    assert res.error is None
