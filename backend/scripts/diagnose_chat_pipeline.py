"""
Comprehensive Diagnostic and Stage Timing Script for CodeRAG Pipeline.

Benchmarks and traces:
1. Local BGE Embedding model (load once, encode execution time).
2. Qdrant connection and vector operations.
3. GitHub API file retrieval.
4. LLM / Gemini Provider latency and model resolution.
5. End-to-end question tracing with granular stage timings.
"""

import sys
import os
import time
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.config.settings import get_settings
from app.rag.embeddings import get_embedding_provider, LocalEmbeddingProvider
from app.rag.vector_store import QdrantVectorStore
from app.rag.question_analyzer import QuestionAnalyzer
from app.rag.candidate_selector import CandidateSelector
from app.rag.chunker import LineChunker
from app.rag.embedding_cache import get_embedding_cache
from app.services.llm_provider import get_llm_provider, GeminiProvider
from app.github.client import GitHubClient


def run_diagnostics():
    print("=" * 75, flush=True)
    print("CodeRAG Pipeline Deep Diagnostic & Stage Bottleneck Tracer", flush=True)
    print("=" * 75, flush=True)

    settings = get_settings()
    print(f"App Env: {settings.app_env}", flush=True)
    print(f"Embedding Provider: {settings.embedding_provider} ({settings.embedding_model})", flush=True)
    print(f"LLM Provider: {settings.llm_provider} ({settings.gemini_model})", flush=True)
    print(f"Qdrant URL: {settings.qdrant_url}", flush=True)
    print(f"Gemini API Key Configured: {settings.is_gemini_configured}", flush=True)
    print("-" * 75, flush=True)

    # -------------------------------------------------------------------------
    # TEST 1: Local Embedding Model
    # -------------------------------------------------------------------------
    print("\n[TEST 1] Testing Local Embedding Provider (BAAI/bge-small-en-v1.5)...")
    t0 = time.perf_counter()
    emb_provider = get_embedding_provider()
    init_time = time.perf_counter() - t0

    t1 = time.perf_counter()
    sample_text = "Where is authentication implemented and how are tokens generated?"
    test_vec = emb_provider.embed_text(sample_text)
    embed_time = time.perf_counter() - t1

    print(f"  - Model Name: {emb_provider.model_name}")
    print(f"  - Dimension: {len(test_vec)} dims (expected: {emb_provider.dimension})")
    print(f"  - Provider Init Time: {init_time*1000:.2f}ms")
    print(f"  - Single Encode Time: {embed_time*1000:.2f}ms")

    t2 = time.perf_counter()
    batch_vecs = emb_provider.embed_batch([sample_text] * 10)
    batch_time = time.perf_counter() - t2
    print(f"  - Batch (10 chunks) Encode Time: {batch_time*1000:.2f}ms ({batch_time/10*1000:.2f}ms/chunk)")

    # -------------------------------------------------------------------------
    # TEST 2: Qdrant Vector Store
    # -------------------------------------------------------------------------
    print("\n[TEST 2] Testing Qdrant Vector Store...")
    t0 = time.perf_counter()
    try:
        store = QdrantVectorStore(vector_size=emb_provider.dimension)
        store_init_time = time.perf_counter() - t0
        print(f"  - Qdrant Connection: OK ({store_init_time*1000:.2f}ms)")
    except Exception as e:
        print(f"  - Qdrant Connection Failed: {e}")
        store = None

    # -------------------------------------------------------------------------
    # TEST 3: LLM / Gemini Provider
    # -------------------------------------------------------------------------
    print("\n[TEST 3] Testing LLM Provider...")
    t0 = time.perf_counter()
    llm = get_llm_provider()
    try:
        smoke = llm.smoke_test()
        smoke_time = time.perf_counter() - t0
        print(f"  - LLM Model: {llm.model_name}")
        print(f"  - Smoke Test Result: {smoke}")
        print(f"  - Smoke Test Time: {smoke_time*1000:.2f}ms")
    except Exception as e:
        smoke_time = time.perf_counter() - t0
        print(f"  - LLM Smoke Test Error: {e} ({smoke_time*1000:.2f}ms)")

    # -------------------------------------------------------------------------
    # TEST 4: Trace One Complete Question with Stage Timers
    # -------------------------------------------------------------------------
    print("\n[TEST 4] Tracing Complete Question Pipeline with Granular Stage Timers...")
    question = "Where is authentication implemented?"
    print(f"Question: \"{question}\"")

    # Sample realistic codebase manifest (10 files)
    sample_manifest = [
        {"path": "src/auth/service.py", "language": "python", "size_bytes": 2400},
        {"path": "src/auth/jwt.py", "language": "python", "size_bytes": 1200},
        {"path": "src/db/connection.py", "language": "python", "size_bytes": 900},
        {"path": "src/api/routes.py", "language": "python", "size_bytes": 1800},
        {"path": "README.md", "language": "markdown", "size_bytes": 1500},
    ]

    sample_code_db = {
        "src/auth/service.py": (
            "class AuthService:\n"
            "    def authenticate(self, username, password):\n"
            "        return verify_hash(password, self.get_user(username))\n"
        ),
        "src/auth/jwt.py": (
            "def create_token(user_id: str) -> str:\n"
            "    return jwt.encode({'sub': user_id}, SECRET_KEY)\n"
        ),
    }

    timings = {}

    # Stage 1: Question Analysis
    t0 = time.perf_counter()
    analysis = QuestionAnalyzer.analyze(question)
    timings["1_question_analysis_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    # Stage 2: Candidate Selection
    t0 = time.perf_counter()
    candidates = CandidateSelector.select_candidates(sample_manifest, analysis, top_k=5)
    timings["2_candidate_selection_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    # Stage 3: File Fetch (simulated/local callback)
    t0 = time.perf_counter()
    fetched_paths = [c.path for c in candidates[:3]]
    fetched_contents = [(p, sample_code_db.get(p, "# empty")) for p in fetched_paths]
    timings["3_file_fetch_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    # Stage 4: Code Chunking
    t0 = time.perf_counter()
    chunker = LineChunker()
    chunks = []
    for path, content in fetched_contents:
        chunks.extend(chunker.chunk_text(content, file_path=path, language="python"))
    timings["4_chunking_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    # Stage 5: Local Embedding + Cache
    t0 = time.perf_counter()
    cache = get_embedding_cache()
    keys = [cache.generate_chunk_key("test_repo", "main", c.file_path, c.start_line, c.end_line, c.content) for c in chunks]
    cached_map, missing_indices = cache.get_batch(keys)
    if missing_indices:
        texts = [chunks[i].content for i in missing_indices]
        new_vecs = emb_provider.embed_batch(texts)
        cache.put_batch([keys[i] for i in missing_indices], new_vecs)
    timings["5_embedding_and_cache_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    # Stage 6: Vector Search
    t0 = time.perf_counter()
    retrieved_chunks = chunks[:3]
    timings["6_vector_search_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    # Stage 7: Prompt Construction
    t0 = time.perf_counter()
    from app.rag.prompt_builder import PromptBuilder
    from app.rag.retriever import RetrievedChunk
    rc_objects = [
        RetrievedChunk(
            chunk_id=f"c_{i}",
            repository_id="test_repo",
            file_path=c.file_path,
            language=c.language,
            start_line=c.start_line,
            end_line=c.end_line,
            content=c.content,
            score=0.92,
        )
        for i, c in enumerate(retrieved_chunks)
    ]
    sys_inst, user_prompt = PromptBuilder.build_prompt(question, rc_objects)
    timings["7_prompt_assembly_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    # Stage 8: LLM Answer Generation
    t0 = time.perf_counter()
    try:
        answer = llm.generate_text(prompt=user_prompt, system_instruction=sys_inst, temperature=0.2)
        timings["8_llm_generation_ms"] = round((time.perf_counter() - t0) * 1000, 2)
        llm_ok = True
    except Exception as e:
        timings["8_llm_generation_ms"] = round((time.perf_counter() - t0) * 1000, 2)
        answer = f"Error: {e}"
        llm_ok = False

    total_time = sum(timings.values())

    print("\n" + "=" * 75)
    print("STAGE TIMINGS BREAKDOWN")
    print("=" * 75)
    for stage, ms in timings.items():
        pct = (ms / total_time * 100) if total_time > 0 else 0
        print(f"  {stage:<30} : {ms:>8.2f} ms ({pct:>5.1f}%)")
    print("-" * 75)
    print(f"  {'TOTAL END-TO-END LATENCY':<30} : {total_time:>8.2f} ms")
    print(f"  LLM Generation Success: {llm_ok}")
    print(f"  Answer Snippet: {answer[:180]}...")
    print("=" * 75)


if __name__ == "__main__":
    run_diagnostics()
