"""
Script for Step 6: End-to-End RAG Verification with Synthetic Repository
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.rag.pipeline import RAGPipeline
from app.rag.file_scanner import FileScanner
from app.rag.chunker import LineChunker
from app.rag.embeddings import get_embedding_provider
from app.rag.vector_store import QdrantVectorStore
from app.services.llm_provider import get_llm_provider

def test_end_to_end_rag():
    print("=" * 65)
    print("STEP 6: END-TO-END RAG PIPELINE AUDIT VERIFICATION")
    print("=" * 65)

    sample_repo_path = Path(__file__).resolve().parent.parent.parent / "sample_code" / "sample_repo"
    print(f"Target synthetic repo path: {sample_repo_path}")
    assert sample_repo_path.exists(), f"Path not found: {sample_repo_path}"

    test_repo_id = "audit_sample_repo"

    # Initialize live pipeline components
    scanner = FileScanner()
    chunker = LineChunker(chunk_size_lines=35, chunk_overlap_lines=5)
    embedder = get_embedding_provider()
    vector_store = QdrantVectorStore()
    llm = get_llm_provider()

    pipeline = RAGPipeline(
        file_scanner=scanner,
        chunker=chunker,
        embedding_provider=embedder,
        vector_store=vector_store,
        llm_provider=llm,
    )

    # 1. Index the synthetic repository
    print(f"\n[1] Indexing '{test_repo_id}' from local source files...")
    idx_result = pipeline.index_directory(
        directory_path=sample_repo_path,
        repository_id=test_repo_id,
        clean_existing=True,
    )

    print(f"    Indexed files: {idx_result.files_indexed}")
    print(f"    Indexed chunks: {idx_result.chunks_indexed}")
    print(f"    Duration: {idx_result.duration_ms:.2f} ms")
    assert idx_result.files_indexed >= 4, f"Expected at least 4 files indexed, got {idx_result.files_indexed}"
    assert idx_result.chunks_indexed > 0, "Expected >0 chunks indexed"

    # 2. Verify records in Qdrant
    print(f"\n[2] Verifying records stored in Qdrant...")
    total_stored = vector_store.count_repository_chunks(test_repo_id)
    print(f"    Total chunks in Qdrant: {total_stored}")
    assert total_stored == idx_result.chunks_indexed, "Chunk count mismatch in Qdrant!"

    indexed_files = vector_store.list_repository_files(test_repo_id)
    print(f"    Distinct files in index: {[f['path'] for f in indexed_files]}")

    # 3. Present Question: JWT Validation
    question_present = "Where is JWT token validation implemented and how is expiration verified?"
    print(f"\n[3] Testing PRESENT question: '{question_present}'...")
    res_present = pipeline.answer_question(
        question=question_present,
        repository_id=test_repo_id,
        top_k=4,
    )

    print(f"    Latency: {res_present.latency_ms:.2f} ms")
    print(f"    Retrieved chunks: {res_present.retrieved_chunks_count}")
    print(f"    Insufficient context flag: {res_present.insufficient_context}")
    assert not res_present.insufficient_context, "Expected sufficient context for JWT question"
    assert len(res_present.sources) > 0, "Expected source citations"

    print("\n    --- Retrieved Sources ---")
    auth_found = False
    for s in res_present.sources:
        print(f"    - {s.path} (Lines {s.start_line}-{s.end_line}) | Score: {s.score:.4f}")
        if "auth.py" in s.path:
            auth_found = True
    assert auth_found, "Expected auth.py in source citations for JWT query!"

    print("\n    --- Gemini Grounded Answer Snippet ---")
    print("    " + res_present.answer[:300].replace("\n", "\n    ") + "...")

    # 4. Absent Question: Stripe Payment Processing
    question_absent = "How is Stripe credit card payment processing implemented in this codebase?"
    print(f"\n[4] Testing ABSENT question: '{question_absent}'...")
    res_absent = pipeline.answer_question(
        question=question_absent,
        repository_id=test_repo_id,
        top_k=4,
    )

    print(f"    Insufficient context flag: {res_absent.insufficient_context}")
    print(f"    Retrieved chunks: {res_absent.retrieved_chunks_count}")
    print("\n    --- Gemini Response to Absent Question ---")
    print("    " + res_absent.answer[:300].replace("\n", "\n    ") + "...")

    # Validate honest insufficiency
    admitted_missing = (
        res_absent.insufficient_context
        or "not found" in res_absent.answer.lower()
        or "no evidence" in res_absent.answer.lower()
        or "does not contain" in res_absent.answer.lower()
        or "no mention" in res_absent.answer.lower()
        or "no information" in res_absent.answer.lower()
    )
    assert admitted_missing, "Model should honestly state that payment processing is absent!"

    # 5. Cleanup test records
    print(f"\n[5] Cleaning up test records from Qdrant...")
    vector_store.delete_repository(test_repo_id)
    rem = vector_store.count_repository_chunks(test_repo_id)
    print(f"    Remaining chunks: {rem}")
    assert rem == 0, "Test records were not deleted"

    print("\n" + "=" * 65)
    print("[SUCCESS] End-to-End RAG Pipeline verified with real Gemini & Qdrant!")
    print("=" * 65)

if __name__ == "__main__":
    test_end_to_end_rag()
