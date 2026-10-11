"""
Fast direct test runner for GitHub validation & error handling.
Writes results to verification_results.json.
"""
import sys
import json
import httpx
from pathlib import Path
from unittest.mock import MagicMock

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.github.client import (
    GitHubClient,
    EmptyRepositoryError,
    BranchNotFoundError,
    NoSupportedSourceFilesError,
    RepositoryNotFoundError,
    RateLimitExceededError,
    GitHubAuthError,
    GitHubConflictError,
    GitHubServerError,
    GitHubTimeoutError,
)

results = {}

# TEST 1: Empty Repository (HTTP 409)
def run_test_1():
    mock_resp_409 = MagicMock(spec=httpx.Response)
    mock_resp_409.status_code = 409
    mock_resp_409.text = '{"message": "Git Repository is empty"}'
    
    mock_meta_resp = MagicMock(spec=httpx.Response)
    mock_meta_resp.status_code = 200
    mock_meta_resp.json.return_value = {
        "id": 1, "name": "empty-repo", "full_name": "user/empty-repo",
        "owner": {"login": "user"}, "default_branch": "main",
        "size": 0, "pushed_at": "2024-01-01T00:00:00Z",
    }
    
    branch_resp = MagicMock(spec=httpx.Response)
    branch_resp.status_code = 200
    branch_resp.json.return_value = {"name": "main"}

    mock_http = MagicMock(spec=httpx.Client)
    def mock_get(url, *args, **kwargs):
        if "/git/trees" in url:
            return mock_resp_409
        elif "/branches/" in url:
            return branch_resp
        return mock_meta_resp

    mock_http.get.side_effect = mock_get
    mock_http.request.side_effect = mock_get

    client = GitHubClient(http_client=mock_http)
    try:
        client.fetch_branch_tree("user", "empty-repo", "main")
        return {"passed": False, "error": "Did not raise EmptyRepositoryError"}
    except EmptyRepositoryError as e:
        return {
            "passed": True,
            "code": e.code,
            "status_code": e.status_code,
            "recoverable": e.recoverable,
            "message": e.message,
            "details": e.details,
        }

# TEST 2: Non-Empty Public Repository
def run_test_2():
    mock_meta_resp = MagicMock(spec=httpx.Response)
    mock_meta_resp.status_code = 200
    mock_meta_resp.json.return_value = {
        "id": 100, "name": "sample-project", "full_name": "org/sample-project",
        "owner": {"login": "org"}, "default_branch": "develop",
        "size": 500, "language": "TypeScript", "pushed_at": "2024-01-01T00:00:00Z",
    }

    mock_tree_resp = MagicMock(spec=httpx.Response)
    mock_tree_resp.status_code = 200
    mock_tree_resp.json.return_value = {
        "tree": [
            {"path": "src/index.ts", "type": "blob", "size": 1024, "sha": "abc1"},
            {"path": "package.json", "type": "blob", "size": 512, "sha": "abc2"},
            {"path": "README.md", "type": "blob", "size": 256, "sha": "abc3"},
            {"path": "node_modules/dep/index.js", "type": "blob", "size": 1000, "sha": "ign1"},
        ]
    }

    mock_branch_resp = MagicMock(spec=httpx.Response)
    mock_branch_resp.status_code = 200
    mock_branch_resp.json.return_value = {"name": "develop"}

    mock_http = MagicMock(spec=httpx.Client)
    def mock_get(url, *args, **kwargs):
        if "/git/trees" in url:
            return mock_tree_resp
        elif "/branches/" in url:
            return mock_branch_resp
        return mock_meta_resp

    mock_http.get.side_effect = mock_get
    mock_http.request.side_effect = mock_get

    client = GitHubClient(http_client=mock_http)
    manifest = client.fetch_repository_manifest("org", "sample-project", branch="develop")
    file_paths = [f["path"] for f in manifest["files"]]
    
    # Verify node_modules filtered out, source files kept
    passed = ("src/index.ts" in file_paths and "package.json" in file_paths and "node_modules/dep/index.js" not in file_paths)
    return {
        "passed": passed,
        "total_files": manifest["total_files"],
        "default_branch": manifest["default_branch"],
        "selected_branch": manifest["selected_branch"],
        "files": file_paths,
    }

# TEST 3: Wrong Branch (BRANCH_NOT_FOUND)
def run_test_3():
    mock_meta_resp = MagicMock(spec=httpx.Response)
    mock_meta_resp.status_code = 200
    mock_meta_resp.json.return_value = {
        "id": 100, "name": "sample", "full_name": "user/sample",
        "owner": {"login": "user"}, "default_branch": "master",
        "size": 50, "pushed_at": "2024-01-01T00:00:00Z",
    }

    branch_404_resp = MagicMock(spec=httpx.Response)
    branch_404_resp.status_code = 404
    branch_404_resp.text = "Not Found"

    mock_http = MagicMock(spec=httpx.Client)
    def mock_get(url, *args, **kwargs):
        if "/branches/" in url:
            return branch_404_resp
        return mock_meta_resp

    mock_http.get.side_effect = mock_get
    mock_http.request.side_effect = mock_get

    client = GitHubClient(http_client=mock_http)
    try:
        client.validate_url("https://github.com/user/sample", branch="nonexistent")
        return {"passed": False, "error": "Did not raise BranchNotFoundError"}
    except BranchNotFoundError as e:
        return {
            "passed": True,
            "code": e.code,
            "status_code": e.status_code,
            "message": e.message,
            "default_branch": e.details.get("default_branch"),
        }

# TEST 4: Nonexistent Repository (REPOSITORY_NOT_FOUND)
def run_test_4():
    resp_404 = MagicMock(spec=httpx.Response)
    resp_404.status_code = 404
    resp_404.text = '{"message": "Not Found"}'

    mock_http = MagicMock(spec=httpx.Client)
    mock_http.get.return_value = resp_404
    mock_http.request.return_value = resp_404

    client = GitHubClient(http_client=mock_http)
    try:
        client.get_repository_metadata("nonexistent-org", "nonexistent-repo")
        return {"passed": False, "error": "Did not raise RepositoryNotFoundError"}
    except RepositoryNotFoundError as e:
        return {
            "passed": True,
            "code": e.code,
            "status_code": e.status_code,
            "message": e.message,
        }

# TEST 5: No Supported Source Files
def run_test_5():
    mock_meta_resp = MagicMock(spec=httpx.Response)
    mock_meta_resp.status_code = 200
    mock_meta_resp.json.return_value = {
        "id": 100, "name": "binary-only", "full_name": "org/binary-only",
        "owner": {"login": "org"}, "default_branch": "main",
        "size": 500, "pushed_at": "2024-01-01T00:00:00Z",
    }

    mock_tree_resp = MagicMock(spec=httpx.Response)
    mock_tree_resp.status_code = 200
    mock_tree_resp.json.return_value = {
        "tree": [
            {"path": "images/banner.png", "type": "blob", "size": 10240, "sha": "img1"},
            {"path": "videos/intro.mp4", "type": "blob", "size": 50240, "sha": "vid1"},
        ]
    }

    branch_resp = MagicMock(spec=httpx.Response)
    branch_resp.status_code = 200
    branch_resp.json.return_value = {"name": "main"}

    mock_http = MagicMock(spec=httpx.Client)
    def mock_get(url, *args, **kwargs):
        if "/git/trees" in url:
            return mock_tree_resp
        elif "/branches/" in url:
            return branch_resp
        return mock_meta_resp

    mock_http.get.side_effect = mock_get
    mock_http.request.side_effect = mock_get

    client = GitHubClient(http_client=mock_http)
    try:
        client.fetch_repository_manifest("org", "binary-only", branch="main")
        return {"passed": False, "error": "Did not raise NoSupportedSourceFilesError"}
    except NoSupportedSourceFilesError as e:
        return {
            "passed": True,
            "code": e.code,
            "status_code": e.status_code,
            "message": e.message,
        }

# Execute tests
results["test_1_empty_repo"] = run_test_1()
results["test_2_non_empty_repo"] = run_test_2()
results["test_3_wrong_branch"] = run_test_3()
results["test_4_not_found"] = run_test_4()
results["test_5_no_supported_files"] = run_test_5()

all_passed = all(r.get("passed", False) for r in results.values())
results["summary"] = {
    "all_passed": all_passed,
    "total_tests": len([k for k in results if k != "summary"]),
    "passed_tests": sum(1 for k, v in results.items() if k != "summary" and v.get("passed")),
}

out_path = BACKEND_DIR / "verification_results.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print(json.dumps(results, indent=2))
