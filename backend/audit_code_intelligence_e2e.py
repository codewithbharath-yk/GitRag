"""
End-to-End Verification Script for Code Intelligence and Structural Retrieval.
Tests full pipeline: File parsing, symbol extraction, cross-file relationships,
FastAPI REST endpoints, and grounded LLM structural question answering.
"""

import sys
from pathlib import Path

# Add backend to sys.path
BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.main import app
from app.rag.pipeline import RAGPipeline
from app.intelligence.service import get_intelligence_service
from app.intelligence.models import SymbolType

def run_e2e_code_intelligence_audit():
    print("==================================================================")
    print("STEP 18: CODE INTELLIGENCE END-TO-END VERIFICATION")
    print("==================================================================")

    sample_dir = ROOT_DIR / "sample_code" / "sample_repo"
    assert sample_dir.exists(), f"Sample directory {sample_dir} must exist"

    # 1. Index sample repo using RAG Pipeline
    print("\n--- 1. Indexing Sample Repository with Code Intelligence ---")
    pipeline = RAGPipeline()
    idx_res = pipeline.index_directory(
        directory_path=sample_dir,
        repository_id="sample_repo_audit",
        branch="main",
        clean_existing=True,
    )
    print(f"Files discovered: {idx_res.files_discovered}")
    print(f"Files indexed: {idx_res.files_indexed}")
    print(f"Chunks indexed: {idx_res.chunks_indexed}")
    assert idx_res.files_indexed >= 4, "Must index at least 4 files"

    # 2. Verify In-Memory Repository Intelligence Data
    print("\n--- 2. Verifying Repository Intelligence Data ---")
    intel_service = get_intelligence_service()
    repo_intel = intel_service.get_repository_intelligence("sample_repo_audit", "main")
    assert repo_intel is not None, "Repository intelligence must be cached"
    print(f"Total symbols extracted: {repo_intel.total_symbols}")
    print(f"Total files parsed: {repo_intel.total_files}")
    assert repo_intel.total_symbols > 5, "Expected more than 5 symbols in sample repo"

    # Check key symbols
    assert "verify_token" in repo_intel.symbol_index, "verify_token function must be indexed"
    assert "UserService" in repo_intel.symbol_index, "UserService class must be indexed"
    assert "DatabaseConnection" in repo_intel.symbol_index, "DatabaseConnection class must be indexed"
    print("  [OK] Key symbols verified: verify_token, UserService, DatabaseConnection")

    # 3. Verify Cross-File Dependency Graph
    print("\n--- 3. Verifying Cross-File Dependency Graph ---")
    main_deps = repo_intel.file_dependencies.get("main.py", [])
    print(f"Files imported by main.py: {main_deps}")
    assert any("auth.py" in d for d in main_deps), "main.py must depend on auth.py"
    assert any("user_service.py" in d for d in main_deps), "main.py must depend on user_service.py"

    auth_dependents = repo_intel.file_dependents.get("auth.py", [])
    print(f"Files importing auth.py: {auth_dependents}")
    assert any("main.py" in d for d in auth_dependents), "auth.py must be imported by main.py"
    print("  [OK] Cross-file dependency resolution verified.")

    # 4. Verify FastAPI Endpoints via TestClient
    print("\n--- 4. Testing Code Intelligence API Endpoints ---")
    client = TestClient(app)

    # 4a. GET /symbols?query=verify_token
    res_sym = client.get("/api/v1/repositories/sample_repo_audit/symbols?query=verify_token")
    assert res_sym.status_code == 200, f"Expected 200, got {res_sym.status_code}: {res_sym.text}"
    sym_list = res_sym.json()
    assert len(sym_list) >= 1
    assert sym_list[0]["name"] == "verify_token"
    assert sym_list[0]["file_path"] == "auth.py"
    print(f"  [OK] GET /symbols?query=verify_token -> {sym_list[0]['name']} at {sym_list[0]['file_path']}:{sym_list[0]['start_line']}")

    # 4b. GET /symbols?symbol_type=class
    res_cls = client.get("/api/v1/repositories/sample_repo_audit/symbols?symbol_type=class")
    assert res_cls.status_code == 200
    cls_list = res_cls.json()
    cls_names = {c["name"] for c in cls_list}
    assert "UserService" in cls_names
    assert "DatabaseConnection" in cls_names
    print(f"  [OK] GET /symbols?symbol_type=class -> {cls_names}")

    # 4c. GET /file-intelligence?file_path=auth.py
    res_file = client.get("/api/v1/repositories/sample_repo_audit/file-intelligence?file_path=auth.py")
    assert res_file.status_code == 200
    file_data = res_file.json()
    assert file_data["file_path"] == "auth.py"
    assert len(file_data["symbols"]) >= 3
    print(f"  [OK] GET /file-intelligence?file_path=auth.py -> {len(file_data['symbols'])} symbols, {len(file_data['imports'])} imports")

    # 4d. GET /relationships
    res_rel = client.get("/api/v1/repositories/sample_repo_audit/relationships")
    assert res_rel.status_code == 200
    rel_data = res_rel.json()
    assert "file_dependencies" in rel_data
    assert "file_dependents" in rel_data
    print(f"  [OK] GET /relationships -> {rel_data['total_symbols']} symbols across {rel_data['total_files']} files")

    # 5. Grounded RAG Question Answering with Structural Intelligence
    print("\n--- 5. Testing Grounded RAG Answering with Structural Context ---")
    struct_query = "Where is verify_token defined and what does it do?"
    rag_res = pipeline.answer_question(
        question=struct_query,
        repository_id="sample_repo_audit",
        branch="main",
    )
    print("\n--- Answer ---")
    print(rag_res.answer[:300] + ("..." if len(rag_res.answer) > 300 else ""))
    print("--------------")
    assert "auth.py" in rag_res.answer, "Answer must cite auth.py"
    assert "verify_token" in rag_res.answer, "Answer must explain verify_token"
    print("  [OK] Grounded answer incorporates structural symbol context.")

    print("\n==================================================================")
    print("ALL CODE INTELLIGENCE E2E CHECKS PASSED SUCCESSFULLY!")
    print("==================================================================")


if __name__ == "__main__":
    run_e2e_code_intelligence_audit()
