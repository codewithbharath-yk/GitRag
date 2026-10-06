"""
Script for Step 5: Gemini LLM & Embeddings Audit Verification
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.llm_provider import get_llm_provider
from app.rag.embeddings import get_embedding_provider

def test_gemini_and_embeddings():
    print("=" * 60)
    print("STEP 5: GEMINI LLM & EMBEDDINGS REAL API AUDIT")
    print("=" * 60)

    # 1. Test LLM Generation Provider
    print("\n[1] Testing Gemini LLM Provider (Chat & Explanations)...")
    llm = get_llm_provider()
    
    # Smoke test
    smoke_res = llm.smoke_test()
    print(f"    Smoke test status: {smoke_res.get('status')}")
    print(f"    Model: {smoke_res.get('model')}")
    print(f"    Latency: {smoke_res.get('latency_ms', 0):.2f} ms")
    assert smoke_res.get("status") == "success", f"Smoke test failed: {smoke_res}"

    # Real Text Generation
    prompt = "Reply with exactly the phrase: 'CodeRAG LLM verification succeeded.'"
    print(f"\n[2] Executing live text generation request to Gemini...")
    answer = llm.generate_text(prompt=prompt, temperature=0.1)
    print(f"    Received Response: {answer.strip()}")
    assert len(answer.strip()) > 0, "Received empty text from Gemini"

    # 2. Test Embedding Provider
    print("\n[3] Testing Gemini Embedding Provider...")
    embedder = get_embedding_provider()
    print(f"    Embedding Model: {embedder.model_name}")
    print(f"    Configured Dimension: {embedder.dimension}")

    # Single text embedding
    code_sample = "def authenticate_user(token: str) -> bool:\n    return verify_jwt(token)"
    print(f"\n[4] Generating embedding for sample code snippet ({len(code_sample)} chars)...")
    vec = embedder.embed_text(code_sample)
    print(f"    Returned vector length: {len(vec)}")
    print(f"    Sample vector values (first 5): {[round(x, 4) for x in vec[:5]]}")
    assert len(vec) == 768, f"Dimension mismatch! Expected 768, got {len(vec)}"

    # Batch embedding
    print(f"\n[5] Generating batch embeddings for 3 code snippets...")
    batch_snippets = [
        "import fastapi",
        "class DatabasePool:\n    pass",
        "SELECT * FROM users WHERE active = true",
    ]
    batch_vecs = embedder.embed_batch(batch_snippets)
    print(f"    Batch count: {len(batch_vecs)}")
    for i, b_vec in enumerate(batch_vecs):
        print(f"    Snippet {i+1} dimension: {len(b_vec)}")
        assert len(b_vec) == 768, f"Batch snippet {i+1} dimension mismatch: {len(b_vec)}"

    print("\n" + "=" * 60)
    print("[SUCCESS] Gemini LLM and Embedding Providers verified live!")
    print("=" * 60)

if __name__ == "__main__":
    test_gemini_and_embeddings()
