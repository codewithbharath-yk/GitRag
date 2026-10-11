"""
Unit Tests for CandidateSelector in Question-Driven / Lazy RAG.
"""

import pytest
from app.rag.question_analyzer import QuestionAnalyzer
from app.rag.candidate_selector import CandidateSelector


def test_candidate_selector_auth_ranking():
    """Verify CandidateSelector prioritizes auth files for auth questions."""
    manifest = [
        {"path": "src/auth/login.ts", "language": "typescript", "size_bytes": 1200},
        {"path": "src/auth/service.ts", "language": "typescript", "size_bytes": 3500},
        {"path": "src/middleware/auth.ts", "language": "typescript", "size_bytes": 800},
        {"path": "styles/global.css", "language": "css", "size_bytes": 450},
        {"path": "public/logo.png", "language": "text", "size_bytes": 10000},
        {"path": "README.md", "language": "markdown", "size_bytes": 2000},
    ]

    analysis = QuestionAnalyzer.analyze("Where is authentication and login implemented?")
    candidates = CandidateSelector.select_candidates(manifest, analysis, top_k=5)

    assert len(candidates) > 0
    top_paths = [c.path for c in candidates[:3]]
    assert "src/auth/login.ts" in top_paths
    assert "src/auth/service.ts" in top_paths
    assert "src/middleware/auth.ts" in top_paths

    # CSS and PNG should NOT be top candidates
    assert candidates[0].path != "styles/global.css"
    assert candidates[0].path != "public/logo.png"


def test_candidate_selector_architecture_ranking():
    """Verify CandidateSelector prioritizes README and main files for architecture questions."""
    manifest = [
        {"path": "README.md", "language": "markdown", "size_bytes": 3000},
        {"path": "package.json", "language": "json", "size_bytes": 500},
        {"path": "src/index.ts", "language": "typescript", "size_bytes": 1500},
        {"path": "src/components/Button.tsx", "language": "typescript", "size_bytes": 800},
        {"path": "tests/button.test.ts", "language": "typescript", "size_bytes": 600},
    ]

    analysis = QuestionAnalyzer.analyze("Explain this project and its architecture.")
    candidates = CandidateSelector.select_candidates(manifest, analysis, top_k=5)

    top_paths = [c.path for c in candidates[:3]]
    assert "README.md" in top_paths
    assert "package.json" in top_paths
    assert "src/index.ts" in top_paths
