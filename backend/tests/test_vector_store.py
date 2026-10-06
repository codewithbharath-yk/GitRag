"""
Unit tests for QdrantVectorStore using in-memory Qdrant instance.
"""

from app.rag.vector_store import QdrantVectorStore
from app.rag.chunker import CodeChunk


def test_qdrant_in_memory_upsert_and_search():
    """
    Test that chunks can be upserted into in-memory Qdrant and searched via cosine similarity.
    """
    store = QdrantVectorStore(
        collection_name="test_chunks",
        vector_size=4,
        location=":memory:",
    )

    chunks = [
        CodeChunk(
            chunk_id="chunk_auth_1",
            repository_id="repo_a",
            file_path="src/auth.py",
            language="python",
            start_line=1,
            end_line=20,
            content="def authenticate_user(): pass",
        ),
        CodeChunk(
            chunk_id="chunk_db_1",
            repository_id="repo_a",
            file_path="src/database.py",
            language="python",
            start_line=1,
            end_line=30,
            content="def connect_database(): pass",
        ),
        CodeChunk(
            chunk_id="chunk_other_repo",
            repository_id="repo_b",
            file_path="main.py",
            language="python",
            start_line=1,
            end_line=10,
            content="def run_app(): pass",
        ),
    ]

    # Deterministic 4D mock vectors
    embeddings = [
        [1.0, 0.0, 0.0, 0.0],  # Vector for auth
        [0.0, 1.0, 0.0, 0.0],  # Vector for database
        [1.0, 0.0, 0.0, 0.0],  # Vector for other repo (auth-like vector)
    ]

    upserted = store.upsert_chunks(chunks, embeddings)
    assert upserted == 3

    # Count repo_a chunks
    count_a = store.count_repository_chunks("repo_a")
    assert count_a == 2

    count_b = store.count_repository_chunks("repo_b")
    assert count_b == 1

    # Search with query vector closest to auth in repo_a
    query_auth = [0.95, 0.05, 0.0, 0.0]
    hits = store.search(query_embedding=query_auth, repository_id="repo_a", top_k=2)

    assert len(hits) == 2
    # First hit must be auth.py with highest similarity
    assert hits[0]["file_path"] == "src/auth.py"
    assert hits[0]["chunk_id"] == "chunk_auth_1"
    assert hits[0]["score"] > 0.9

    # Delete repo_a
    store.delete_repository("repo_a")
    assert store.count_repository_chunks("repo_a") == 0
    # repo_b should remain untouched
    assert store.count_repository_chunks("repo_b") == 1
