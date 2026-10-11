"""
Unit Tests for QuestionAnalyzer in Question-Driven / Lazy RAG.
"""

import pytest
from app.rag.question_analyzer import QuestionAnalyzer, QuestionCategory


def test_question_analyzer_auth_intent():
    """Verify auth and security intent detection and keyword extraction."""
    q = "Where is authentication implemented and how is JWT handled?"
    analysis = QuestionAnalyzer.analyze(q)

    assert analysis.category == QuestionCategory.AUTH_SECURITY
    assert analysis.is_broad_architecture is False
    assert any(k in analysis.keywords for k in ["authentication", "jwt"])
    assert any("auth" in d for d in analysis.likely_directories)
    assert any("jwt" in f for f in analysis.likely_filenames)


def test_question_analyzer_architecture_intent():
    """Verify broad architecture / project overview intent detection."""
    q = "Explain this project architecture and main entry points."
    analysis = QuestionAnalyzer.analyze(q)

    assert analysis.category == QuestionCategory.ARCHITECTURE_OVERVIEW
    assert analysis.is_broad_architecture is True
    assert any("readme" in f.lower() for f in analysis.likely_filenames)
    assert len(analysis.priority_files) > 0


def test_question_analyzer_database_intent():
    """Verify database, ORM, and schema intent detection."""
    q = "Where is the database connection and schema defined?"
    analysis = QuestionAnalyzer.analyze(q)

    assert analysis.category == QuestionCategory.DATABASE_STORAGE
    assert "database" in analysis.keywords or "db" in analysis.keywords
    assert any("db" in d or "models" in d for d in analysis.likely_directories)


def test_question_analyzer_symbol_extraction():
    """Verify CamelCase, snake_case, and backtick symbol extraction."""
    q = "How does `AuthenticationService` and `user_login` work in `auth.ts`?"
    analysis = QuestionAnalyzer.analyze(q)

    symbols = analysis.extracted_symbols
    assert "AuthenticationService" in symbols
    assert "user_login" in symbols
    assert "auth.ts" in symbols
