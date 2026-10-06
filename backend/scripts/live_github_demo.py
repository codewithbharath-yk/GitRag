"""
Live GitHub Repository Ingestion & QA Demo Script.

Demonstrates validating a public repository on GitHub, ingesting and chunking
its source code files, generating embeddings, and answering natural-language
questions with line-accurate citations.
"""

import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.repository_service import get_repository_service
from app.schemas.chat import ChatRequest


def main():
    repo_url = "https://github.com/octocat/Spoon-Knife"
    print(f"==================================================")
    print(f" CodeRAG: Live GitHub Repository Ingestion Demo   ")
    print(f" Target Repository: {repo_url}")
    print(f"==================================================\n")

    svc = get_repository_service()

    # 1. URL Validation & Metadata
    print("[1] Validating repository URL with GitHub API...")
    val = svc.validate_repository(repo_url)
    print(f"    [OK] Validated: {val.full_name}")
    print(f"    [OK] Default Branch: {val.default_branch}")
    print(f"    [OK] Stars: {val.stars_count} | Forks: {val.forks_count}")

    # 2. Ingestion & Indexing
    print("\n[2] Ingesting and indexing repository into Qdrant...")
    idx_resp = svc.start_indexing_job(url=repo_url, clean_existing=True)
    print(f"    [OK] Indexing Status: {idx_resp.status}")
    print(f"    [OK] Message: {idx_resp.message}")

    # 3. Status & Vector Index
    print("\n[3] Checking indexing status...")
    status = svc.get_repository_status(val.repository_id)
    print(f"    [OK] Status: {status.status}")
    print(f"    [OK] Files Indexed: {status.files_indexed}")
    print(f"    [OK] Chunks Indexed: {status.chunks_indexed}")
    print(f"    [OK] Duration: {status.duration_ms} ms")

    # 4. List Indexed Files
    print("\n[4] Discovered source code files:")
    files_resp = svc.list_repository_files(val.repository_id)
    for f in files_resp.files:
        print(f"    - {f.path:<20} | {f.language:<10} | {f.chunks_count} chunk(s) | {f.line_count} lines")

    # 5. Question Answering
    question = "What is the purpose of this project and what HTML/CSS elements are defined?"
    print(f"\n[5] Asking Question: '{question}'")
    chat_resp = svc.query_repository(ChatRequest(
        repository_id=val.repository_id,
        question=question,
        top_k=5,
    ))

    print("\n" + "=" * 50)
    print(" GEMINI EVIDENCE-BACKED ANSWER")
    print("=" * 50)
    print(chat_resp.answer)

    print("\n" + "=" * 50)
    print(" RETRIEVED SOURCE CITATIONS")
    print("=" * 50)
    for s in chat_resp.sources:
        print(f" -> {s.path} (Lines {s.start_line}-{s.end_line}) [Score: {s.score:.3f}]")
    print("=" * 50)


if __name__ == "__main__":
    main()
