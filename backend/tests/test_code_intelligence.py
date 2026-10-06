"""
Unit and Integration Tests for Advanced Code Intelligence (Step 16).

Tests:
- Function detection (Python AST & Tree-sitter JS/TS)
- Class detection
- Method detection
- Import detection & resolution
- Line-number accuracy (1-indexed start/end lines)
- Multiple files & Cross-file relationships (imports, located_in, contains)
- Invalid/unsupported syntax handling (graceful degradation)
- Unsupported language handling (regex fallback)
- Repository isolation
- RAG + structural retrieval together (detect_structural_context)
"""

import pytest
from pathlib import Path

from app.intelligence.models import (
    SymbolType,
    RelationshipType,
    CodeSymbol,
    CodeImport,
    ParsedFileIntelligence,
)
from app.intelligence.parser import (
    PythonAstCodeParser,
    TreeSitterCodeParser,
    GenericRegexParser,
    CodeParserService,
)
from app.intelligence.relationships import RelationshipBuilder
from app.intelligence.service import IntelligenceService
from app.rag.file_scanner import DiscoveredFile


# 1. Python AST Parser Tests
def test_python_ast_parser_functions_and_classes():
    parser = PythonAstCodeParser()
    py_code = '''"""Module docstring."""
import os
from math import sqrt, pi

GLOBAL_CONSTANT = 42

class Calculator:
    """A sample calculator class."""
    def __init__(self, val: int):
        self.val = val

    def add(self, x: int) -> int:
        return self.val + x

def calculate_area(radius: float) -> float:
    """Calculate area of circle."""
    return pi * radius * radius
'''
    res = parser.parse("calc.py", py_code, "python")
    assert res.file_path == "calc.py"
    assert res.language == "python"

    # Verify Classes
    classes = [s for s in res.symbols if s.symbol_type == SymbolType.CLASS]
    assert len(classes) == 1
    assert classes[0].name == "Calculator"
    assert classes[0].start_line == 7
    assert classes[0].end_line >= 12
    assert "calculator class" in (classes[0].docstring or "")

    # Verify Methods
    methods = [s for s in res.symbols if s.symbol_type == SymbolType.METHOD]
    assert len(methods) == 2
    method_names = {m.name for m in methods}
    assert "__init__" in method_names
    assert "add" in method_names
    for m in methods:
        assert m.parent_symbol == "Calculator"

    # Verify Functions
    funcs = [s for s in res.symbols if s.symbol_type == SymbolType.FUNCTION]
    assert len(funcs) == 1
    assert funcs[0].name == "calculate_area"
    assert funcs[0].parent_symbol is None
    assert funcs[0].start_line == 15
    assert "radius" in funcs[0].parameters

    # Verify Imports
    assert len(res.imports) == 2
    import_mods = {imp.source_module for imp in res.imports}
    assert "os" in import_mods
    assert "math" in import_mods

    # Verify Relationships
    contains_rels = [r for r in res.relationships if r.relationship_type == RelationshipType.CONTAINS]
    assert len(contains_rels) == 2
    assert any(r.source == "Calculator" and r.target == "add" for r in contains_rels)


def test_python_ast_syntax_error_resilience():
    parser = PythonAstCodeParser()
    malformed_py = "def broken_syntax(:\n  return {"
    res = parser.parse("broken.py", malformed_py, "python")
    # Must not raise exception, return empty symbols safely
    assert res.file_path == "broken.py"
    assert len(res.symbols) == 0
    assert len(res.imports) == 0


# 2. Tree-Sitter JavaScript / TypeScript Tests
def test_tree_sitter_js_ts_parsing():
    parser = TreeSitterCodeParser()
    if not parser.supports("typescript"):
        pytest.skip("Tree-sitter typescript grammar not active in this environment")

    ts_code = '''import { useState, useEffect } from "react";
import axios from "axios";

export interface User {
  id: string;
  name: string;
}

export class AuthService {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  public validateToken(): boolean {
    return this.token.length > 0;
  }
}

export function createSession(userId: string): string {
  return "session_" + userId;
}

export const logoutUser = () => {
  console.log("Logged out");
};
'''
    res = parser.parse("auth.ts", ts_code, "typescript")
    assert res.file_path == "auth.ts"

    # Classes
    classes = [s for s in res.symbols if s.symbol_type == SymbolType.CLASS]
    assert len(classes) == 1
    assert classes[0].name == "AuthService"

    # Methods
    methods = [s for s in res.symbols if s.symbol_type == SymbolType.METHOD]
    assert any(m.name == "validateToken" and m.parent_symbol == "AuthService" for m in methods)

    # Functions
    funcs = [s for s in res.symbols if s.symbol_type == SymbolType.FUNCTION]
    func_names = {f.name for f in funcs}
    assert "createSession" in func_names
    assert "logoutUser" in func_names

    # Imports
    assert len(res.imports) >= 2
    assert any("react" in imp.source_module for imp in res.imports)
    assert any("axios" in imp.source_module for imp in res.imports)


# 3. Generic Regex Fallback Tests (Java, Go, Rust)
def test_generic_regex_parser():
    parser = GenericRegexParser()
    java_code = '''package com.example.service;

import java.util.List;
import com.example.model.User;

public class OrderManager {
    public void processOrder(int orderId) {
        // process
    }
}
'''
    res = parser.parse("OrderManager.java", java_code, "java")
    assert any(s.name == "OrderManager" and s.symbol_type == SymbolType.CLASS for s in res.symbols)
    assert any(s.name == "processOrder" and s.symbol_type == SymbolType.FUNCTION for s in res.symbols)
    assert len(res.imports) >= 2


# 4. Cross-File Relationships & Dependency Graph
def test_cross_file_relationships():
    parser = CodeParserService()
    file_a_content = '''from .service import UserService

def handle_request():
    service = UserService()
    return service.get_user()
'''
    file_b_content = '''class UserService:
    def get_user(self):
        return {"id": 1, "name": "Alice"}
'''
    f_a = parser.parse_file("api/routes.py", file_a_content, "python")
    f_b = parser.parse_file("api/service.py", file_b_content, "python")

    parsed_files = {
        "api/routes.py": f_a,
        "api/service.py": f_b,
    }

    repo_intel = RelationshipBuilder.build_repository_intelligence(
        repository_id="test_repo",
        branch="main",
        parsed_files=parsed_files,
    )

    assert repo_intel.total_files == 2
    assert "UserService" in repo_intel.symbol_index
    assert "handle_request" in repo_intel.symbol_index

    # Cross-file dependency check
    assert "api/service.py" in repo_intel.file_dependencies["api/routes.py"]
    assert "api/routes.py" in repo_intel.file_dependents["api/service.py"]


# 5. Intelligence Service & Structural Retrieval Intent Detection
def test_intelligence_service_structural_queries():
    service = IntelligenceService()
    files = [
        DiscoveredFile(
            path="auth.py",
            absolute_path=Path("auth.py"),
            language="python",
            content='''def verify_token(token: str) -> bool:
    return len(token) > 10

class TokenValidator:
    def validate_jwt(self, jwt_str: str) -> dict:
        return {"valid": True}
''',
            size_bytes=150,
            line_count=7,
        ),
        DiscoveredFile(
            path="main.py",
            absolute_path=Path("main.py"),
            language="python",
            content='''from auth import verify_token, TokenValidator

def login_user(username: str):
    pass
''',
            size_bytes=90,
            line_count=4,
        ),
    ]

    repo_intel = service.analyze_repository_files("my_repo", "main", files)
    assert repo_intel.total_symbols >= 3

    # Symbol lookup
    found = service.lookup_symbol("my_repo", "verify_token", "main")
    assert len(found) == 1
    assert found[0].file_path == "auth.py"
    assert found[0].start_line == 1

    # Class lookup
    classes = service.lookup_symbol("my_repo", "TokenValidator", "main")
    assert len(classes) == 1
    assert classes[0].symbol_type == SymbolType.CLASS

    # Structural Intent: "Where is verify_token defined?"
    context = service.detect_structural_context("my_repo", "Where is verify_token defined?", "main")
    assert context is not None
    assert "verify_token" in context
    assert "auth.py" in context

    # Structural Intent: "What methods belong to TokenValidator?"
    cls_context = service.detect_structural_context("my_repo", "What methods belong to TokenValidator?", "main")
    assert cls_context is not None
    assert "TokenValidator" in cls_context
    assert "validate_jwt" in cls_context

    # Structural Intent: "Which files import auth.py?"
    import_context = service.detect_structural_context("my_repo", "Which files import auth.py?", "main")
    assert import_context is not None
    assert "main.py" in import_context


# 6. Repository Isolation
def test_repository_isolation():
    service = IntelligenceService()
    service.analyze_repository_files(
        repository_id="repo_A",
        branch="main",
        files=[
            DiscoveredFile(
                path="secret_a.py",
                absolute_path=Path("secret_a.py"),
                language="python",
                content="def repo_a_function(): pass\n",
                size_bytes=30,
                line_count=1,
            )
        ],
    )
    service.analyze_repository_files(
        repository_id="repo_B",
        branch="main",
        files=[
            DiscoveredFile(
                path="secret_b.py",
                absolute_path=Path("secret_b.py"),
                language="python",
                content="def repo_b_function(): pass\n",
                size_bytes=30,
                line_count=1,
            )
        ],
    )

    # Symbols from repo_A must not be visible in repo_B
    assert len(service.lookup_symbol("repo_A", "repo_a_function")) == 1
    assert len(service.lookup_symbol("repo_B", "repo_a_function")) == 0
    assert len(service.lookup_symbol("repo_B", "repo_b_function")) == 1
    assert len(service.lookup_symbol("repo_A", "repo_b_function")) == 0


# 7. Code Intelligence FastAPI REST Endpoint Tests
def test_code_intelligence_api_routes(test_client):
    from app.intelligence.service import get_intelligence_service
    service = get_intelligence_service()

    files = [
        DiscoveredFile(
            path="services/auth_service.py",
            absolute_path=Path("services/auth_service.py"),
            language="python",
            content='''"""Authentication Service Module."""
import jwt
from models import User

class AuthService:
    """Handles authentication."""
    def login(self, username: str) -> bool:
        """Login user."""
        return True

    def logout(self, user_id: int) -> None:
        pass

def generate_token() -> str:
    return "token"
''',
            size_bytes=250,
            line_count=16,
        ),
        DiscoveredFile(
            path="controllers/user_controller.py",
            absolute_path=Path("controllers/user_controller.py"),
            language="python",
            content='''from services.auth_service import AuthService

def handle_login(req):
    auth = AuthService()
    return auth.login("alice")
''',
            size_bytes=120,
            line_count=6,
        ),
    ]

    service.analyze_repository_files("api_test_repo", "main", files)

    # 1. GET /repositories/{id}/symbols
    res_syms = test_client.get("/repositories/api_test_repo/symbols")
    assert res_syms.status_code == 200
    syms_data = res_syms.json()
    assert len(syms_data) >= 3
    names = {s["name"] for s in syms_data}
    assert "AuthService" in names
    assert "login" in names

    # Filter by query
    res_q = test_client.get("/repositories/api_test_repo/symbols?query=login")
    assert res_q.status_code == 200
    assert any(s["name"] == "login" for s in res_q.json())

    # 2. GET /repositories/{id}/file-intelligence
    res_fi = test_client.get("/repositories/api_test_repo/file-intelligence?file_path=services/auth_service.py")
    assert res_fi.status_code == 200
    fi_data = res_fi.json()
    assert fi_data["file_path"] == "services/auth_service.py"
    assert len(fi_data["symbols"]) >= 3

    # 3. GET /repositories/{id}/relationships
    res_rel = test_client.get("/repositories/api_test_repo/relationships")
    assert res_rel.status_code == 200
    rel_data = res_rel.json()
    assert rel_data["total_files"] == 2
    assert "controllers/user_controller.py" in rel_data["file_dependencies"]

    # 4. GET /repositories/{id}/hotspots
    res_hot = test_client.get("/repositories/api_test_repo/hotspots")
    assert res_hot.status_code == 200
    hot_data = res_hot.json()
    assert "most_imported_files" in hot_data
    assert "most_symbols_files" in hot_data

    # 5. GET /repositories/{id}/symbols/search (Fuzzy search)
    res_fuzzy = test_client.get("/repositories/api_test_repo/symbols/search?q=AuthServ")
    assert res_fuzzy.status_code == 200
    fuzzy_data = res_fuzzy.json()
    assert len(fuzzy_data) > 0
    assert fuzzy_data[0]["symbol"]["name"] == "AuthService"
    assert fuzzy_data[0]["score"] > 0.6

    # 6. GET /repositories/{id}/classes/{class_name}/hierarchy
    res_hier = test_client.get("/repositories/api_test_repo/classes/AuthService/hierarchy")
    assert res_hier.status_code == 200
    hier_data = res_hier.json()
    assert hier_data["class_name"] == "AuthService"
    assert len(hier_data["definitions"]) >= 1
    method_names = {m["name"] for m in hier_data["definitions"][0]["methods"]}
    assert "login" in method_names
    assert "logout" in method_names

