"""
Question Analyzer Module for Question-Driven / Lazy RAG.

Analyzes natural language questions to infer user intent, targeted components,
likely directories, target filenames, programming concepts, and candidate keywords.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Set, Dict, Optional, Any
import re
from pathlib import Path


class QuestionCategory(str, Enum):
    SPECIFIC_FEATURE = "specific_feature"
    ARCHITECTURE_OVERVIEW = "architecture_overview"
    DATABASE_STORAGE = "database_storage"
    API_ROUTING = "api_routing"
    CONFIG_SETUP = "config_setup"
    AUTH_SECURITY = "auth_security"
    TESTING_QA = "testing_qa"
    GENERAL_CODE = "general_code"


@dataclass
class QuestionAnalysis:
    """
    Structured outcome of question analysis for candidate file ranking.
    """
    raw_question: str
    category: QuestionCategory
    is_broad_architecture: bool
    likely_directories: List[str] = field(default_factory=list)
    likely_filenames: List[str] = field(default_factory=list)
    target_extensions: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    extracted_symbols: List[str] = field(default_factory=list)
    priority_files: List[str] = field(default_factory=list)


# Heuristic keyword and directory taxonomy for rapid Stage-1 matching
CATEGORY_RULES: Dict[QuestionCategory, Dict[str, Any]] = {
    QuestionCategory.AUTH_SECURITY: {
        "triggers": [
            "auth", "authenticate", "authentication", "login", "signin", "sign-in",
            "signup", "sign-up", "register", "registration", "jwt", "token", "oauth",
            "bearer", "password", "hash", "crypto", "security", "session", "permission",
            "role", "rbac", "user", "credential", "cookie", "middleware", "guard",
        ],
        "directories": [
            "auth", "authentication", "login", "security", "session", "users", "user",
            "middleware", "middlewares", "guards", "services/auth", "lib/auth", "pkg/auth",
        ],
        "filenames": [
            "auth", "login", "signin", "signup", "jwt", "session", "user", "security",
            "middleware", "guard", "tokens", "passwords", "authenticator", "userservice",
        ],
    },
    QuestionCategory.DATABASE_STORAGE: {
        "triggers": [
            "db", "database", "sql", "postgres", "postgresql", "mysql", "sqlite",
            "mongo", "mongodb", "schema", "model", "models", "entity", "entities",
            "migration", "migrations", "table", "tables", "orm", "prisma", "drizzle",
            "sqlalchemy", "typeorm", "mongoose", "connection", "datasource", "pool",
            "repository", "storage",
        ],
        "directories": [
            "db", "database", "models", "entities", "schema", "schemas", "migrations",
            "repositories", "storage", "dao", "data", "store",
        ],
        "filenames": [
            "db", "database", "schema", "models", "connection", "datasource",
            "client", "prisma", "drizzle", "storage", "pool", ".env.example",
        ],
    },
    QuestionCategory.API_ROUTING: {
        "triggers": [
            "api", "route", "routes", "router", "endpoint", "endpoints", "controller",
            "controllers", "handler", "handlers", "request", "response", "view",
            "views", "http", "rest", "graphql", "grpc", "webhook", "webhooks",
        ],
        "directories": [
            "api", "routes", "router", "routers", "controllers", "handlers",
            "endpoints", "views", "server", "gateway",
        ],
        "filenames": [
            "routes", "router", "api", "controller", "handler", "server",
            "endpoints", "views", "urls",
        ],
    },
    QuestionCategory.CONFIG_SETUP: {
        "triggers": [
            "config", "configuration", "setting", "settings", "env", "environment",
            "variable", "variables", "setup", "initialize", "init", "docker",
            "dockerfile", "docker-compose", "yaml", "toml", "properties",
        ],
        "directories": [
            "config", "configs", "configuration", "settings", "env", "setup",
        ],
        "filenames": [
            "config", "settings", "env", ".env", ".env.example", "dockerfile",
            "docker-compose.yml", "package.json", "pyproject.toml", "cargo.toml",
            "go.mod", "tsconfig.json", "settings.py", "config.py", "config.ts",
        ],
    },
    QuestionCategory.ARCHITECTURE_OVERVIEW: {
        "triggers": [
            "architecture", "explain this project", "project structure", "how does this work",
            "explain the architecture", "overview", "main components", "high level",
            "onboard", "summary", "what does this project do", "tech stack", "purpose",
            "entry point", "how is it organized",
        ],
        "directories": [
            "src", "app", "lib", "core", "pkg", "docs",
        ],
        "filenames": [
            "readme.md", "package.json", "pyproject.toml", "cargo.toml", "go.mod",
            "main.py", "index.ts", "index.js", "app.py", "app.ts", "app.tsx",
            "server.ts", "server.js", "main.go", "main.rs", "architecture.md",
        ],
    },
    QuestionCategory.TESTING_QA: {
        "triggers": [
            "test", "tests", "testing", "spec", "specs", "mock", "mocks",
            "e2e", "unit test", "integration test", "fixture", "fixtures",
            "pytest", "jest", "vitest", "coverage",
        ],
        "directories": [
            "tests", "test", "__tests__", "spec", "specs", "e2e", "fixtures",
        ],
        "filenames": [
            "test_", "_test", ".spec", ".test", "conftest.py", "setup_test",
        ],
    },
}

STOP_WORDS = {
    "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "with",
    "by", "about", "against", "between", "into", "through", "during", "before",
    "after", "above", "below", "from", "up", "down", "is", "are", "was", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did", "how",
    "where", "what", "which", "who", "whom", "this", "that", "these", "those",
    "i", "me", "my", "we", "our", "you", "your", "he", "him", "she", "her",
    "it", "its", "they", "them", "their", "can", "could", "would", "should",
    "will", "shall", "tell", "show", "explain", "implemented", "handle", "handled",
    "work", "works", "find", "locate", "code", "codebase", "project", "repo",
}


class QuestionAnalyzer:
    """
    Lightweight rule-based question analyzer for candidate retrieval guidance.
    Extracts semantic signals, symbols, and priority search vectors.
    """

    @classmethod
    def extract_symbols(cls, text: str) -> List[str]:
        """
        Extract code symbols (CamelCase, snake_case, PascalCase, hyphenated identifiers).
        """
        symbols = set()

        # 1. Backtick enclosed identifiers: `MyService`
        backtick_matches = re.findall(r"`([a-zA-Z0-9_.-]+)`", text)
        for m in backtick_matches:
            if len(m) > 1 and m.lower() not in STOP_WORDS:
                symbols.add(m)

        # 2. PascalCase / camelCase identifiers: UserService, handleAuthRequest
        camel_matches = re.findall(r"\b[A-Z][a-zA-Z0-9]+|[a-z]+[A-Z][a-zA-Z0-9]*\b", text)
        for m in camel_matches:
            if len(m) > 2 and m.lower() not in STOP_WORDS:
                symbols.add(m)

        # 3. snake_case identifiers: get_user_by_id, auth_middleware
        snake_matches = re.findall(r"\b[a-zA-Z0-9]+_[a-zA-Z0-9_]+\b", text)
        for m in snake_matches:
            if len(m) > 3 and m.lower() not in STOP_WORDS:
                symbols.add(m)

        # 4. File-like mentions: auth.ts, login.py, README.md
        file_matches = re.findall(r"\b[a-zA-Z0-9_-]+\.[a-zA-Z0-9]{1,4}\b", text)
        for m in file_matches:
            symbols.add(m)

        return sorted(list(symbols))

    @classmethod
    def extract_keywords(cls, text: str) -> List[str]:
        """
        Extract normalized keyword tokens from question text.
        """
        # Strip punctuation except underscores/hyphens inside tokens
        clean_text = re.sub(r"[^\w\s-]", " ", text)
        tokens = clean_text.lower().split()

        keywords = []
        for tok in tokens:
            tok = tok.strip("-").strip("_")
            if len(tok) >= 2 and tok not in STOP_WORDS:
                keywords.append(tok)

        return sorted(list(set(keywords)))

    @classmethod
    def analyze(
        cls,
        question: str,
        repo_languages: Optional[List[str]] = None,
    ) -> QuestionAnalysis:
        """
        Perform complete analysis on the input question.
        """
        trimmed = question.strip()
        lower_q = trimmed.lower()

        keywords = cls.extract_keywords(trimmed)
        symbols = cls.extract_symbols(trimmed)

        # Match category based on trigger frequency
        category_scores: Dict[QuestionCategory, int] = {}
        for cat, rules in CATEGORY_RULES.items():
            score = 0
            for trig in rules["triggers"]:
                if trig in lower_q or trig in keywords:
                    score += 2 if f" {trig} " in f" {lower_q} " else 1
            category_scores[cat] = score

        # Check for broad architecture intent
        is_broad = (
            category_scores.get(QuestionCategory.ARCHITECTURE_OVERVIEW, 0) > 0
            or any(phrase in lower_q for phrase in [
                "explain this project", "explain the project", "explain architecture",
                "how does this work", "project overview", "what does this app do",
                "high level", "how is this repo organized", "walk me through",
            ])
        )

        # Pick primary category
        best_cat = QuestionCategory.GENERAL_CODE
        best_score = 0
        for cat, score in category_scores.items():
            if score > best_score:
                best_score = score
                best_cat = cat

        if is_broad:
            best_cat = QuestionCategory.ARCHITECTURE_OVERVIEW

        # Gather suggested directories and filenames
        cat_rules = CATEGORY_RULES.get(best_cat, {})
        likely_dirs = list(cat_rules.get("directories", []))
        likely_filenames = list(cat_rules.get("filenames", []))

        # Add explicit file mentions from symbols to likely filenames
        for sym in symbols:
            if "." in sym:
                likely_filenames.insert(0, sym.lower())
            else:
                likely_filenames.append(sym.lower())

        # Determine target extensions from repo languages or keywords
        target_exts = [".ts", ".js", ".tsx", ".jsx", ".py", ".go", ".rs", ".java", ".cpp", ".c", ".rb", ".php", ".cs"]
        if is_broad:
            priority_files = [
                "README.md", "package.json", "pyproject.toml", "Cargo.toml", "go.mod",
                "main.py", "app.py", "index.ts", "index.js", "server.ts", "server.js",
            ]
        else:
            priority_files = []

        return QuestionAnalysis(
            raw_question=trimmed,
            category=best_cat,
            is_broad_architecture=is_broad,
            likely_directories=likely_dirs,
            likely_filenames=likely_filenames,
            target_extensions=target_exts,
            keywords=keywords,
            extracted_symbols=symbols,
            priority_files=priority_files,
        )
