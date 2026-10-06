"""
Complete RAG Pipeline Audit on Controlled Test Repository (sample_code/sample_repo).
Validates discovery, line chunking, embeddings, Qdrant storage, retrieval,
Gemini grounded answering, source citations, and hallucination resistance.
"""

import sys
import os
from pathlib import Path

# Add backend to sys.path
BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.rag.file_scanner import FileScanner
from app.rag.chunker import LineChunker
from app.rag.embeddings import GeminiEmbeddingProvider
from app.rag.vector_store import QdrantVectorStore
from app.rag.retriever import CodeRetriever
from app.rag.prompt_builder import PromptBuilder
from app.services.llm_provider import GeminiProvider
from app.config.settings import get_settings


def run_rag_audit():
    print("================================================================")
    print("STEP 3: COMPLETE RAG ENGINE AUDIT ON CONTROLLED TEST REPOSITORY")
    print("================================================================")
    
    settings = get_settings()
    sample_dir = ROOT_DIR / "sample_code" / "sample_repo"
    assert sample_dir.exists(), f"Sample directory {sample_dir} must exist"

    # 1. File Discovery & Filtering
    print("\n--- 1. File Discovery & Filtering ---")
    scanner = FileScanner()
    discovered_files = scanner.scan_directory(sample_dir)
    print(f"Files discovered: {len(discovered_files)}")
    discovered_rel_paths = sorted([f.path for f in discovered_files])
    for p in discovered_rel_paths:
        print(f"  [OK] {p}")
    assert len(discovered_files) >= 4, "Should discover at least 4 python files"
    assert "auth.py" in discovered_rel_paths, "auth.py must be discovered"
    assert "user_service.py" in discovered_rel_paths, "user_service.py must be discovered"
    print("=> File discovery passed.")

    # 2. Line Chunking & Boundary Tracking
    print("\n--- 2. Line Chunking & Boundary Tracking ---")
    chunker = LineChunker(chunk_size_lines=30, chunk_overlap_lines=5)
    all_chunks = []
    for f in discovered_files:
        chunks = chunker.chunk_file(
            file=f,
            repository_id="test_local_repo",
            branch="main",
        )
        all_chunks.extend(chunks)
        print(f"  - {f.path}: {len(chunks)} chunk(s)")

    print(f"Total chunks created: {len(all_chunks)}")
    for chunk in all_chunks[:2]:
        print(f"    Sample: [{chunk.file_path}:{chunk.start_line}-{chunk.end_line}] ({len(chunk.content)} chars)")
        # Verify line numbers are 1-indexed and correct
        file_lines = (sample_dir / chunk.file_path).read_text(encoding="utf-8").splitlines()
        expected_slice = "\n".join(file_lines[chunk.start_line - 1 : chunk.end_line])
        assert chunk.content.strip() in expected_slice or expected_slice.strip() in chunk.content.strip(), \
            f"Chunk content must match actual source file lines {chunk.start_line}-{chunk.end_line}"
    print("=> Line chunking and boundary verification passed.")

    # 3. Embedding Generation
    print("\n--- 3. Gemini Embedding Generation ---")
    embedding_provider = GeminiEmbeddingProvider()
    sample_texts = [c.content for c in all_chunks[:3]]
    embeddings = embedding_provider.embed_batch(sample_texts)
    print(f"Generated {len(embeddings)} embeddings.")
    print(f"Vector dimension: {len(embeddings[0])} (expected 768)")
    assert len(embeddings[0]) == 768, f"Expected 768 dimensions, got {len(embeddings[0])}"
    print("=> Embedding generation passed.")

    # 4. Qdrant Vector Storage (In-memory verification)
    print("\n--- 4. Qdrant Vector Storage ---")
    vector_store = QdrantVectorStore(location=":memory:", collection_name="audit_test_collection")
    all_texts = [c.content for c in all_chunks]
    all_embeddings = embedding_provider.embed_batch(all_texts)
    upserted = vector_store.upsert_chunks(all_chunks, all_embeddings)
    print(f"Upserted chunks into Qdrant: {upserted}")
    assert upserted == len(all_chunks), f"Expected {len(all_chunks)} vectors upserted, got {upserted}"
    
    count = vector_store.client.count(collection_name=vector_store.collection_name).count
    print(f"Stored chunks in Qdrant: {count}")
    assert count == len(all_chunks), f"Expected {len(all_chunks)} vectors in Qdrant, got {count}"
    print("=> Qdrant insertion and count passed.")

    # 5. Semantic Retrieval
    print("\n--- 5. Semantic Retrieval ---")
    retriever = CodeRetriever(vector_store=vector_store, embedding_provider=embedding_provider)
    query = "How does JWT validation and token decoding work?"
    print(f"Query: '{query}'")
    retrieval_res = retriever.retrieve(
        query=query,
        repository_id="test_local_repo",
        branch="main",
        top_k=3,
    )
    retrieved = retrieval_res.chunks
    print(f"Retrieved {len(retrieved)} chunk(s):")
    for r in retrieved:
        print(f"  * Score {r.score:.3f} | {r.file_path}:{r.start_line}-{r.end_line}")
    assert len(retrieved) > 0, "Retrieval must return at least 1 relevant chunk"
    top_file = retrieved[0].file_path
    assert "auth.py" in top_file or "main.py" in top_file, f"Top chunk should be auth-related, got {top_file}"
    print("=> Semantic retrieval returned correct source chunks.")

    # 6. Gemini Grounded Answer Generation
    print("\n--- 6. Gemini Grounded Answer Generation ---")
    llm = GeminiProvider()
    sys_inst, user_prompt = PromptBuilder.build_prompt(
        question=query,
        chunks=retrieved,
    )
    answer = llm.generate_text(prompt=user_prompt, system_instruction=sys_inst, temperature=0.1)
    print("\n--- Generated Answer ---")
    print(answer[:400] + ("..." if len(answer) > 400 else ""))
    print("------------------------")
    assert "jwt" in answer.lower() or "token" in answer.lower() or "auth" in answer.lower(), \
        "Answer must be grounded in authentication code"
    assert "auth.py" in answer or "main.py" in answer, "Answer must cite source file"
    print("=> Grounded answer generation and citations passed.")

    # 7. Hallucination Resistance / Unknown Question Test
    print("\n--- 7. Hallucination Resistance Test ---")
    unknown_query = "What is the consensus algorithm used for Bitcoin blockchain mining in this project?"
    print(f"Unknown Query: '{unknown_query}'")
    unknown_res = retriever.retrieve(
        query=unknown_query,
        repository_id="test_local_repo",
        branch="main",
        top_k=2,
    )
    unknown_retrieved = unknown_res.chunks
    sys_inst2, user_prompt2 = PromptBuilder.build_prompt(
        question=unknown_query,
        chunks=unknown_retrieved,
    )
    unknown_answer = llm.generate_text(prompt=user_prompt2, system_instruction=sys_inst2, temperature=0.1)
    print("\n--- Unknown Answer Response ---")
    print(unknown_answer[:350] + ("..." if len(unknown_answer) > 350 else ""))
    print("-------------------------------")
    low_ans = unknown_answer.lower()
    assert (
        "not have enough information" in low_ans
        or "does not contain" in low_ans
        or "insufficient" in low_ans
        or "not mentioned" in low_ans
        or "no evidence" in low_ans
        or "not provided" in low_ans
        or "not found" in low_ans
        or "cannot answer" in low_ans
    ), "LLM must decline to fabricate an answer when evidence does not support it"
    print("=> Hallucination resistance verified: Gemini admitted insufficient context.")

    print("\n================================================================")
    print("ALL STEP 3 RAG ENGINE CHECKS PASSED SUCCESSFULLY!")
    print("================================================================")


if __name__ == "__main__":
    run_rag_audit()
