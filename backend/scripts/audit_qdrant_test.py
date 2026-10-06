"""
Script for Step 3: Qdrant Vector Store Audit Verification
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.rag.vector_store import QdrantVectorStore
from app.rag.chunker import CodeChunk

def test_qdrant():
    print("[1] Initializing QdrantVectorStore...")
    vs = QdrantVectorStore()
    print(f"    Collection: {vs.collection_name}")
    print(f"    Vector Size: {vs.vector_size}")

    print("\n[2] Creating 2 synthetic CodeChunks...")
    chunks = [
        CodeChunk(
            chunk_id="audit_test:main:auth.py:1:10",
            repository_id="audit_test",
            file_path="auth.py",
            language="python",
            start_line=1,
            end_line=10,
            content="def login(username, password):\n    return verify_password(password)",
            metadata={"branch": "main"},
        ),
        CodeChunk(
            chunk_id="audit_test:main:db.py:1:10",
            repository_id="audit_test",
            file_path="db.py",
            language="python",
            start_line=1,
            end_line=10,
            content="def connect():\n    return db_pool.get_connection()",
            metadata={"branch": "main"},
        ),
    ]

    # Create synthetic 768-dim embeddings
    vec1 = [0.05] * 768
    vec1[0] = 0.95
    vec2 = [0.05] * 768
    vec2[1] = 0.95

    print("\n[3] Upserting vectors and metadata...")
    upserted = vs.upsert_chunks(chunks, [vec1, vec2])
    print(f"    Upserted count: {upserted}")
    assert upserted == 2, "Expected 2 chunks upserted"

    print("\n[4] Querying vector similarity with repository_id='audit_test'...")
    hits = vs.search(query_embedding=vec1, repository_id="audit_test", top_k=2)
    print(f"    Hits found: {len(hits)}")
    for h in hits:
        print(f"    - Hit: {h['file_path']} (Lines {h['start_line']}-{h['end_line']}) | Score: {h['score']:.4f}")
    assert len(hits) > 0, "Expected at least 1 hit"
    assert hits[0]["file_path"] == "auth.py", "Top hit should be auth.py"

    print("\n[5] Testing repository isolation (search repository_id='other_repo')...")
    other_hits = vs.search(query_embedding=vec1, repository_id="other_repo", top_k=2)
    print(f"    Hits found for other_repo: {len(other_hits)}")
    assert len(other_hits) == 0, "Isolation failure: records leaked to other repo"

    print("\n[6] Cleaning up test records...")
    deleted = vs.delete_repository("audit_test")
    print(f"    Deleted records: {deleted}")
    count_remaining = vs.count_repository_chunks("audit_test")
    print(f"    Remaining chunks for audit_test: {count_remaining}")
    assert count_remaining == 0, "Expected 0 chunks remaining after cleanup"
    print("\n[SUCCESS] Qdrant Vector Store audit tests completed successfully!")

if __name__ == "__main__":
    test_qdrant()
