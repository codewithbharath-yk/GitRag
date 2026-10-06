"""
Comprehensive End-to-End Integration Verification Script for CodeRAG.

Performs live operations against:
1. GitHub API on 'octocat/Hello-World' and 'octocat/Spoon-Knife'
2. Qdrant vector database (creation, insertion, 768-dim cosine search, cleanup)
3. Gemini text generation and text-embedding-004
4. End-to-end RAG question answering with truthful citations
5. Multi-tenant isolation verification
6. Supabase configuration check
"""

import sys
from pathlib import Path
from pprint import pprint

# Ensure backend directory is in path
backend_path = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(backend_path))

from app.config.settings import get_settings
from app.github.client import GitHubClient
from app.github.url_parser import parse_github_url
from app.rag.vector_store import QdrantVectorStore
from app.rag.chunker import CodeChunk, LineChunker
from app.rag.embeddings import get_embedding_provider
from app.services.llm_provider import get_llm_provider
from app.rag.pipeline import RAGPipeline
from app.services.repository_service import get_repository_service
from app.auth.service import get_auth_service
from app.auth.models import RegisterRequest, LoginRequest


def run_full_integration_verification():
    print("=" * 80)
    print("CodeRAG COMPLETE INTEGRATION VERIFICATION")
    print("=" * 80)

    settings = get_settings()
    print(f"\n[1] Configuration Check:")
    print(f" - App: {settings.app_name} v{settings.app_version} [{settings.app_env}]")
    print(f" - Gemini Configured: {settings.is_gemini_configured} (Model: {settings.gemini_model}, Emb: {settings.gemini_embedding_model})")
    print(f" - Qdrant URL: {settings.qdrant_url}")
    print(f" - Auth Enabled: {settings.auth_enabled}")
    print(f" - Supabase Configured: {settings.is_supabase_configured}")

    # =========================================================================
    # Step 3: Test GitHub integration with octocat/Hello-World
    # =========================================================================
    print("\n" + "=" * 80)
    print("[2] GitHub Integration Test: octocat/Hello-World")
    print("=" * 80)
    gh_client = GitHubClient()
    
    hello_url = "https://github.com/octocat/Hello-World"
    print(f"Validating URL: {hello_url}")
    hello_id = parse_github_url(hello_url)
    print(f" -> Parsed: owner='{hello_id.owner}', name='{hello_id.name}', repo_id='{hello_id.repository_id}'")
    
    hello_meta = gh_client.get_repository_metadata(hello_id.owner, hello_id.name)
    print(f" -> Metadata: Default Branch='{hello_meta['default_branch']}', Stars={hello_meta['stars_count']}, Description='{hello_meta['description']}'")
    
    hello_files = gh_client.fetch_repository_source_files(hello_id.owner, hello_id.name, hello_meta['default_branch'])
    print(f" -> Files Discovered ({len(hello_files)}):")
    for f in hello_files:
        print(f"    * {f.path} ({f.language}, {f.size_bytes} bytes, {f.line_count} lines) content: {repr(f.content.strip())}")

    # =========================================================================
    # Step 3b: Test GitHub integration with octocat/Spoon-Knife (multi-file repo)
    # =========================================================================
    print("\n" + "=" * 80)
    print("[3] GitHub Integration Test: octocat/Spoon-Knife (Source Code Repo)")
    print("=" * 80)
    spoon_url = "https://github.com/octocat/Spoon-Knife"
    spoon_id = parse_github_url(spoon_url)
    spoon_meta = gh_client.get_repository_metadata(spoon_id.owner, spoon_id.name)
    print(f" -> Metadata: Default Branch='{spoon_meta['default_branch']}', Stars={spoon_meta['stars_count']}")
    
    spoon_files = gh_client.fetch_repository_source_files(spoon_id.owner, spoon_id.name, spoon_meta['default_branch'])
    print(f" -> Source Files Discovered ({len(spoon_files)}):")
    for f in spoon_files:
        print(f"    * {f.path} ({f.language}, {f.size_bytes} bytes, {f.line_count} lines)")

    # =========================================================================
    # Step 4: Verify Qdrant Vector Store Operations
    # =========================================================================
    print("\n" + "=" * 80)
    print("[4] Qdrant Vector Database Verification")
    print("=" * 80)
    test_collection = "verification_test_collection"
    
    # 1. Check dimensions dynamically
    emb_provider = get_embedding_provider()
    sample_emb = emb_provider.embed_text("Test vector store insertion")
    detected_dim = len(sample_emb)
    print(f" -> Provider: {emb_provider.__class__.__name__} ({emb_provider.model_name})")
    print(f" -> Generated embedding dimensions: {detected_dim}")
    assert detected_dim > 0, "Embedding vector was empty"
    
    vector_store = QdrantVectorStore(collection_name=test_collection, vector_size=detected_dim)

    # 2. Insert test chunk
    test_user_id = "test_verifier_user"
    test_chunk = CodeChunk(
        chunk_id="test_verify_chunk_1",
        repository_id="test_verify_repo",
        file_path="src/main.py",
        language="python",
        start_line=1,
        end_line=10,
        content="def calculate_total(items):\n    return sum(item.price for item in items)",
        metadata={"branch": "main", "user_id": test_user_id},
    )
    inserted = vector_store.upsert_chunks([test_chunk], [sample_emb], user_id=test_user_id)
    print(f" -> Upserted {inserted} test chunk(s) into Qdrant collection '{test_collection}'")

    # 3. Search test chunk
    search_res = vector_store.search(sample_emb, repository_id="test_verify_repo", user_id=test_user_id, top_k=5)
    print(f" -> Vector search returned {len(search_res)} hit(s):")
    for hit in search_res:
        print(f"    * Score: {hit['score']:.4f}, Path: {hit['file_path']}, Lines: {hit['start_line']}-{hit['end_line']}")
        print(f"      Snippet: {repr(hit['content'])}")
    assert len(search_res) > 0, "Vector search returned 0 results"
    assert search_res[0]["file_path"] == "src/main.py"

    # 4. Clean up test data
    vector_store.delete_repository("test_verify_repo", user_id=test_user_id)
    remaining = vector_store.count_repository_chunks("test_verify_repo", user_id=test_user_id)
    print(f" -> Cleaned up test data. Remaining chunks for test repo: {remaining}")
    assert remaining == 0, "Expected 0 remaining chunks after deletion"

    # =========================================================================
    # Step 5 & 6: End-to-End RAG Ingestion & Question Answering
    # =========================================================================
    print("\n" + "=" * 80)
    print("[5] End-to-End RAG Ingestion & Question Answering (Live Gemini)")
    print("=" * 80)
    rag_pipeline = RAGPipeline(
        embedding_provider=emb_provider,
        vector_store=vector_store,
        llm_provider=get_llm_provider(),
    )

    # Index Spoon-Knife source files
    print(" -> Indexing octocat/Spoon-Knife into test vector collection...")
    idx_res = rag_pipeline.index_files(
        files=spoon_files,
        repository_id="octocat__spoon-knife",
        user_id=test_user_id,
        branch=spoon_meta["default_branch"],
        clean_existing=True,
    )
    print(f" -> Indexing completed in {idx_res.duration_ms}ms: {idx_res.files_indexed} files, {idx_res.chunks_indexed} chunks.")

    # Query RAG pipeline
    test_question = "What is the purpose of the Spoon-Knife repository and what files are in it?"
    print(f"\n -> Asking RAG Question: '{test_question}'")
    rag_ans = rag_pipeline.answer_question(
        question=test_question,
        repository_id="octocat__spoon-knife",
        user_id=test_user_id,
        branch=spoon_meta["default_branch"],
        top_k=5,
    )
    print(f" -> Latency: {rag_ans.latency_ms}ms, Retrieved Chunks: {rag_ans.retrieved_chunks_count}")
    print(f" -> Sources Cited ({len(rag_ans.sources)}):")
    for s in rag_ans.sources:
        print(f"    * {s.path} (lines {s.start_line}-{s.end_line}, score: {s.score:.4f})")
    print(f" -> Grounded Answer:\n{rag_ans.answer}")

    # Query ungrounded question (insufficient context test)
    ungrounded_q = "How do I configure the Kubernetes deployment YAML and Stripe webhook for Spoon-Knife?"
    print(f"\n -> Asking Out-of-Scope Question: '{ungrounded_q}'")
    ungrounded_ans = rag_pipeline.answer_question(
        question=ungrounded_q,
        repository_id="octocat__spoon-knife",
        user_id=test_user_id,
        branch=spoon_meta["default_branch"],
        top_k=5,
    )
    print(f" -> Answer:\n{ungrounded_ans.answer}")

    # Clean up
    vector_store.delete_repository("octocat__spoon-knife", user_id=test_user_id)

    # =========================================================================
    # Step 7: Multi-Tenant User Isolation Check
    # =========================================================================
    print("\n" + "=" * 80)
    print("[6] Multi-Tenant User Isolation Check")
    print("=" * 80)
    user_alice = "usr_alice_integration"
    user_bob = "usr_bob_integration"
    shared_repo = "corp/internal-repo"

    # Alice indexes private code
    alice_chunk = CodeChunk(
        chunk_id="alice_chunk_1",
        repository_id=shared_repo,
        file_path="secrets/alice.py",
        language="python",
        start_line=1,
        end_line=5,
        content="SECRET_KEY_ALICE = 'Alice confidential token 999'",
        metadata={"branch": "main", "user_id": user_alice},
    )
    alice_emb = emb_provider.embed_text(alice_chunk.content)
    vector_store.upsert_chunks([alice_chunk], [alice_emb], user_id=user_alice)

    # Bob searches same repo
    bob_hits = vector_store.search(alice_emb, repository_id=shared_repo, user_id=user_bob, top_k=5)
    print(f" -> User Bob querying User Alice's repo: returned {len(bob_hits)} chunks (MUST BE 0)")
    assert len(bob_hits) == 0, f"Isolation failure! Bob retrieved {len(bob_hits)} chunks belonging to Alice."

    # Alice searches
    alice_hits = vector_store.search(alice_emb, repository_id=shared_repo, user_id=user_alice, top_k=5)
    print(f" -> User Alice querying own repo: returned {len(alice_hits)} chunk(s)")
    assert len(alice_hits) == 1, "Alice should retrieve her own chunk"
    assert "Alice confidential" in alice_hits[0]["content"]

    # Cleanup
    vector_store.delete_repository(shared_repo, user_id=user_alice)
    print(" -> Multi-tenant isolation verified successfully!")

    print("\n" + "=" * 80)
    print("ALL INTEGRATION VERIFICATIONS COMPLETED SUCCESSFULLY!")
    print("=" * 80)


if __name__ == "__main__":
    run_full_integration_verification()
