"""
Tests for Git History Intelligence and Diff Analysis.

Validates commit pagination, diff hunk parsing, patch truncation limits,
file statuses (added/modified/deleted/renamed), history prompt grounding,
and FastAPI commit endpoints.
"""

from unittest.mock import MagicMock, patch
import httpx
import pytest
from fastapi.testclient import TestClient

from app.github.client import (
    GitHubClient,
    RateLimitExceededError,
    RepositoryNotFoundError,
)
from app.rag.prompt_builder import HistoryPromptBuilder
from app.schemas.commit import (
    CommitAuthor,
    CommitDetail,
    CommitFileChange,
    CommitStats,
    CommitItem,
    CommitListResponse,
    CommitExplainResponse,
    HistoryChatResponse,
)
from app.services.diff_service import DiffAnalysisService
from app.services.repository_service import get_repository_service


# ============================================================================
# DiffAnalysisService Tests
# ============================================================================

def test_parse_diff_hunks_standard():
    service = DiffAnalysisService()
    sample_patch = (
        "@@ -10,6 +10,12 @@ def authenticate_user(token):\n"
        "     if not token:\n"
        "+        logger.warning('Empty token received')\n"
        "+        raise AuthenticationError('Token required')\n"
        "     return verify_jwt(token)\n"
    )
    hunks = service.parse_patch(sample_patch)
    assert len(hunks) == 1
    hunk = hunks[0]
    assert hunk.old_start == 10
    assert hunk.old_lines == 6
    assert hunk.new_start == 10
    assert hunk.new_lines == 12
    assert "def authenticate_user" in hunk.header
    assert len(hunk.added_lines) == 2
    assert len(hunk.deleted_lines) == 0


def test_parse_diff_hunks_missing_or_empty():
    service = DiffAnalysisService()
    assert service.parse_patch(None) == []
    assert service.parse_patch("") == []
    assert service.parse_patch("   ") == []


def test_sanitize_and_cap_patch_under_limits():
    service = DiffAnalysisService()
    small_patch = "@@ -1,2 +1,3 @@\n line1\n+line2\n line3\n"
    capped, is_truncated = service.sanitize_and_cap_patch(small_patch)
    assert not is_truncated
    assert capped == small_patch


def test_sanitize_and_cap_patch_exceeding_line_limit():
    service = DiffAnalysisService()
    # Generate 350 lines (exceeds default MAX_DIFF_PATCH_LINES=300)
    lines = ["+line %d" % i for i in range(350)]
    big_patch = "\n".join(lines)

    capped, is_truncated = service.sanitize_and_cap_patch(big_patch)
    assert is_truncated is True
    assert "[Diff truncated:" in capped
    assert "lines omitted" in capped
    # Count lines up to truncation notice
    assert len(capped.splitlines()) <= 305


def test_sanitize_and_cap_patch_exceeding_byte_limit():
    service = DiffAnalysisService()
    # Create patch with long lines exceeding MAX_DIFF_PATCH_BYTES (30KB)
    long_line = "+" + ("A" * 1024)
    big_patch = "\n".join([long_line for _ in range(40)]) # ~40KB

    capped, is_truncated = service.sanitize_and_cap_patch(big_patch)
    assert is_truncated is True
    assert "[Diff truncated:" in capped


def test_summarize_commit_diff_and_statuses():
    service = DiffAnalysisService()
    commit_detail = CommitDetail(
        repository_id="octocat__test-repo",
        sha="1234567890abcdef1234567890abcdef12345678",
        short_sha="1234567",
        message="feat: refactor auth and add config",
        author=CommitAuthor(name="Alice", email="alice@example.com", date="2026-03-01T12:00:00Z"),
        parents=["0000000000000000000000000000000000000000"],
        html_url="https://github.com/octocat/test-repo/commit/1234567",
        stats=CommitStats(total=25, additions=20, deletions=5),
        files=[
            CommitFileChange(
                filename="src/auth.py",
                status="modified",
                additions=15,
                deletions=5,
                changes=20,
                patch="@@ -1,5 +1,15 @@ def login():\n+    pass",
                patch_truncated=False,
            ),
            CommitFileChange(
                filename="src/config.py",
                status="added",
                additions=5,
                deletions=0,
                changes=5,
                patch="@@ -0,0 +1,5 @@\n+SECRET='xyz'",
                patch_truncated=False,
            ),
            CommitFileChange(
                filename="old_docs/guide.md",
                status="removed",
                additions=0,
                deletions=10,
                changes=10,
                patch=None,
                patch_truncated=False,
            ),
            CommitFileChange(
                filename="new_name.py",
                status="renamed",
                additions=0,
                deletions=0,
                changes=0,
                patch=None,
                patch_truncated=False,
                previous_filename="old_name.py",
            ),
        ],
    )

    summary = service.summarize_commit_diff(commit_detail)
    assert summary["sha"] == "1234567890abcdef1234567890abcdef12345678"
    assert summary["total_files"] == 4
    assert summary["additions"] == 20
    assert summary["deletions"] == 5
    assert len(summary["files"]) == 4

    evidence_str = service.format_commit_evidence_for_prompt(commit_detail)
    assert "<untrusted_commit_metadata>" in evidence_str
    assert "<untrusted_diff_evidence>" in evidence_str
    assert "src/auth.py [MODIFIED]" in evidence_str
    assert "src/config.py [ADDED]" in evidence_str
    assert "old_docs/guide.md [REMOVED]" in evidence_str
    assert "Renamed from: old_name.py" in evidence_str


# ============================================================================
# HistoryPromptBuilder Tests
# ============================================================================

def test_history_prompt_builder_explain_commit():
    evidence = "<commit_evidence sha=\"abc1234\">Diff content</commit_evidence>"
    sys_inst, user_prompt = HistoryPromptBuilder.build_commit_explain_prompt(
        commit_evidence=evidence,
        detail_level="detailed",
    )
    assert "STRICT EVIDENCE & GROUNDING RULES" in sys_inst
    assert "UNTRUSTED DATA" in sys_inst
    assert "commit_evidence" in user_prompt
    assert "detailed" in user_prompt


def test_history_prompt_builder_history_query():
    summaries = "Commit 1: abc - fix bug\nCommit 2: def - add tests"
    sys_inst, user_prompt = HistoryPromptBuilder.build_history_query_prompt(
        question="When was the bug fixed?",
        commit_summaries=summaries,
        diff_evidence=None,
    )
    assert "When was the bug fixed?" in user_prompt
    assert "Commit 1: abc - fix bug" in user_prompt
    assert "Relevant Diff Evidence" not in user_prompt


def test_history_prompt_builder_compare_prompt():
    evidence = "Diff between main and feature"
    sys_inst, user_prompt = HistoryPromptBuilder.build_compare_prompt(
        base_commit="main",
        head_commit="feature",
        diff_evidence=evidence,
    )
    assert "Comparison: main ... feature" in user_prompt
    assert evidence in user_prompt


# ============================================================================
# GitHub Client Commit Retrieval Tests
# ============================================================================

def test_github_client_list_commits_success():
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = [
        {
            "sha": "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
            "commit": {
                "message": "fix: update token validation",
                "author": {
                    "name": "Bob",
                    "email": "bob@example.com",
                    "date": "2026-03-02T10:00:00Z",
                },
            },
            "parents": [{"sha": "parent111"}],
            "html_url": "https://github.com/octocat/repo/commit/a1b2c3d",
        }
    ]

    mock_http = MagicMock(spec=httpx.Client)
    mock_http.get.return_value = mock_resp

    client = GitHubClient(token="mock-token", http_client=mock_http)
    commits = client.list_commits(owner="octocat", repo="repo", page=1, per_page=10)
    assert len(commits) == 1
    assert commits[0]["sha"] == "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"
    assert commits[0]["short_sha"] == "a1b2c3d"
    assert commits[0]["author"]["name"] == "Bob"
    assert commits[0]["parents"] == ["parent111"]

    mock_http.get.assert_called_once()
    called_url = mock_http.get.call_args[0][0]
    assert "/repos/octocat/repo/commits" in called_url


def test_github_client_list_commits_rate_limited():
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 403
    mock_resp.headers = {"x-ratelimit-remaining": "0"}
    mock_resp.text = "API rate limit exceeded"

    mock_http = MagicMock(spec=httpx.Client)
    mock_http.get.return_value = mock_resp

    client = GitHubClient(token="mock-token", http_client=mock_http)
    with pytest.raises(RateLimitExceededError):
        client.list_commits(owner="octocat", repo="repo")


def test_github_client_get_commit_detail_success():
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "sha": "1234567890abcdef1234567890abcdef12345678",
        "commit": {
            "message": "docs: update README",
            "author": {
                "name": "Alice",
                "email": "alice@example.com",
                "date": "2026-03-02T11:00:00Z",
            },
        },
        "parents": [{"sha": "p001"}],
        "html_url": "https://github.com/octocat/repo/commit/1234567",
        "stats": {"total": 3, "additions": 2, "deletions": 1},
        "files": [
            {
                "filename": "README.md",
                "status": "modified",
                "additions": 2,
                "deletions": 1,
                "changes": 3,
                "patch": "@@ -1,2 +1,3 @@\n-# Old Title\n+# New Title\n+Extra line",
            }
        ],
    }

    mock_http = MagicMock(spec=httpx.Client)
    mock_http.get.return_value = mock_resp

    client = GitHubClient(token="mock-token", http_client=mock_http)
    detail = client.get_commit_detail(owner="octocat", repo="repo", commit_sha="1234567")
    assert detail["sha"] == "1234567890abcdef1234567890abcdef12345678"
    assert len(detail["files"]) == 1
    assert detail["files"][0]["filename"] == "README.md"
    assert detail["files"][0]["patch_truncated"] is False


def test_github_client_get_commit_detail_not_found():
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 404
    mock_resp.headers = {}
    mock_resp.text = "Not Found"

    mock_http = MagicMock(spec=httpx.Client)
    mock_http.get.return_value = mock_resp

    client = GitHubClient(token="mock-token", http_client=mock_http)
    with pytest.raises(RepositoryNotFoundError):
        client.get_commit_detail(owner="octocat", repo="repo", commit_sha="nonexistent")


# ============================================================================
# FastAPI Route Tests (Repositories / Commits)
# ============================================================================

def test_api_list_commits_route(test_client: TestClient):
    repo_service = get_repository_service()
    with patch.object(repo_service, "list_repository_commits") as mock_list:
        mock_list.return_value = CommitListResponse(
            repository_id="octocat__repo",
            branch="main",
            path=None,
            page=1,
            per_page=30,
            total_returned=1,
            commits=[
                CommitItem(
                    sha="a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
                    short_sha="a1b2c3d",
                    message="Initial commit",
                    author=CommitAuthor(
                        name="Octocat",
                        email="octo@github.com",
                        date="2026-01-01T00:00:00Z",
                    ),
                    parents=[],
                    html_url="https://github.com/octocat/repo/commit/a1b2c3d",
                )
            ],
        )

        response = test_client.get("/api/v1/repositories/octocat__repo/commits?branch=main")
        assert response.status_code == 200
        data = response.json()
        assert data["repository_id"] == "octocat__repo"
        assert len(data["commits"]) == 1
        assert data["commits"][0]["short_sha"] == "a1b2c3d"


def test_api_get_commit_detail_route(test_client: TestClient):
    repo_service = get_repository_service()
    with patch.object(repo_service, "get_commit_detail") as mock_detail:
        mock_detail.return_value = CommitDetail(
            repository_id="octocat__repo",
            sha="a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
            short_sha="a1b2c3d",
            message="fix: bugfix in parser",
            author=CommitAuthor(
                name="Octocat",
                email="octo@github.com",
                date="2026-01-01T00:00:00Z",
            ),
            parents=["p1"],
            html_url="https://github.com/octocat/repo/commit/a1b2c3d",
            stats=CommitStats(total=5, additions=4, deletions=1),
            files=[
                CommitFileChange(
                    filename="parser.py",
                    status="modified",
                    additions=4,
                    deletions=1,
                    changes=5,
                    patch="@@ -1,2 +1,5 @@\n+new line",
                    patch_truncated=False,
                    previous_filename=None,
                )
            ],
        )

        response = test_client.get("/api/v1/repositories/octocat__repo/commits/a1b2c3d")
        assert response.status_code == 200
        data = response.json()
        assert data["sha"] == "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"
        assert len(data["files"]) == 1
        assert data["files"][0]["filename"] == "parser.py"


def test_api_explain_commit_route(test_client: TestClient):
    repo_service = get_repository_service()
    with patch.object(repo_service, "explain_commit") as mock_explain:
        mock_explain.return_value = CommitExplainResponse(
            repository_id="octocat__repo",
            commit_sha="a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
            short_sha="a1b2c3d",
            message="feat: add JWT auth",
            explanation="This commit introduces JWT authentication logic in `auth.py`.",
            observed_changes=["MODIFIED src/auth.py (+15/-2)"],
            inferred_intent="feat: add JWT auth",
            files_analyzed=["src/auth.py"],
            latency_ms=142.5,
        )

        response = test_client.post(
            "/api/v1/repositories/octocat__repo/commits/a1b2c3d/explain",
            json={"detail_level": "standard"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "JWT authentication" in data["explanation"]
        assert data["files_analyzed"] == ["src/auth.py"]


def test_api_history_chat_route(test_client: TestClient):
    repo_service = get_repository_service()
    with patch.object(repo_service, "answer_history_query") as mock_chat:
        mock_chat.return_value = HistoryChatResponse(
            question="Which commit added authentication?",
            repository_id="octocat__repo",
            commit_sha=None,
            answer="Commit `a1b2c3d` added the JWT authentication handler.",
            referenced_commits=["a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"],
            referenced_files=["src/auth.py"],
            insufficient_evidence=False,
            latency_ms=250.0,
        )

        response = test_client.post(
            "/api/v1/repositories/octocat__repo/commits/chat",
            json={
                "question": "Which commit added authentication?",
                "branch": "main",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "Commit `a1b2c3d`" in data["answer"]
        assert len(data["referenced_commits"]) == 1


