"""
Unit tests for GitHubClient with mocked HTTP requests.
"""

from unittest.mock import MagicMock
import pytest
import httpx

from app.github.client import (
    GitHubClient,
    GitHubError,
    RepositoryNotFoundError,
    RepositoryAccessDeniedError,
    RateLimitExceededError,
)


def test_get_repository_metadata_success():
    """
    Test successful metadata parsing from mocked GitHub API response.
    """
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "id": 12345,
        "name": "Hello-World",
        "full_name": "octocat/Hello-World",
        "owner": {"login": "octocat"},
        "default_branch": "master",
        "private": False,
        "description": "My first repo",
        "size": 108,
        "stargazers_count": 2500,
        "forks_count": 1800,
        "open_issues_count": 12,
        "language": "Python",
    }

    mock_http = MagicMock(spec=httpx.Client)
    mock_http.request.return_value = mock_resp
    mock_http.get.return_value = mock_resp

    client = GitHubClient(http_client=mock_http)
    meta = client.get_repository_metadata("octocat", "Hello-World")

    assert meta["id"] == 12345
    assert meta["owner"] == "octocat"
    assert meta["name"] == "Hello-World"
    assert meta["default_branch"] == "master"
    assert meta["is_private"] is False
    assert meta["stars_count"] == 2500


def test_get_repository_metadata_404_not_found():
    """
    Test 404 response raises RepositoryNotFoundError.
    """
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 404
    mock_resp.text = "Not Found"

    mock_http = MagicMock(spec=httpx.Client)
    mock_http.request.return_value = mock_resp
    mock_http.get.return_value = mock_resp

    client = GitHubClient(http_client=mock_http)
    with pytest.raises(RepositoryNotFoundError):
        client.get_repository_metadata("nonexistent_user", "ghost_repo")


def test_get_repository_metadata_403_rate_limited():
    """
    Test 403 rate limit response raises RateLimitExceededError.
    """
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 403
    mock_resp.headers = {"x-ratelimit-remaining": "0"}
    mock_resp.text = "API rate limit exceeded"

    mock_http = MagicMock(spec=httpx.Client)
    mock_http.request.return_value = mock_resp
    mock_http.get.return_value = mock_resp

    client = GitHubClient(http_client=mock_http)
    with pytest.raises(RateLimitExceededError):
        client.get_repository_metadata("octocat", "Hello-World")


def test_fetch_branch_tree_and_file_filtering():
    """
    Test that fetch_repository_source_files filters blobs, ignored directories, and extensions properly.
    """
    # 1. Metadata response
    meta_resp = MagicMock(spec=httpx.Response)
    meta_resp.status_code = 200
    meta_resp.json.return_value = {
        "id": 101,
        "name": "sample",
        "full_name": "owner/sample",
        "owner": {"login": "owner"},
        "default_branch": "main",
        "private": False,
        "size": 50,
    }

    # 2. Tree response
    tree_resp = MagicMock(spec=httpx.Response)
    tree_resp.status_code = 200
    tree_resp.json.return_value = {
        "tree": [
            {"path": "src/main.py", "type": "blob", "size": 150},
            {"path": "src/auth.java", "type": "blob", "size": 300},
            {"path": "src/__pycache__/cache.pyc", "type": "blob", "size": 100},  # ignored dir
            {"path": "node_modules/pkg/index.js", "type": "blob", "size": 200},  # ignored dir
            {"path": ".env", "type": "blob", "size": 50},                         # ignored file
            {"path": "image.png", "type": "blob", "size": 5000},                 # ignored ext
            {"path": "src", "type": "tree"},                                      # tree directory
        ]
    }

    # 3. File content responses
    file_content_resp = MagicMock(spec=httpx.Response)
    file_content_resp.status_code = 200
    file_content_resp.text = "print('hello from github')"

    mock_http = MagicMock(spec=httpx.Client)

    def mock_handler(*args, **kwargs):
        url = kwargs.get("url") or (args[1] if len(args) > 1 else args[0])
        if "/repos/owner/sample/git/trees" in url:
            return tree_resp
        elif "/repos/owner/sample" in url:
            return meta_resp
        else:
            return file_content_resp

    mock_http.request.side_effect = mock_handler
    mock_http.get.side_effect = mock_handler

    client = GitHubClient(http_client=mock_http)
    files = client.fetch_repository_source_files("owner", "sample", branch="main")

    assert len(files) == 2
    paths = [f.path for f in files]
    assert "src/main.py" in paths
    assert "src/auth.java" in paths
    assert "src/__pycache__/cache.pyc" not in paths
    assert "image.png" not in paths
    assert ".env" not in paths


def test_fetch_repository_source_files_excludes_keys_and_secrets():
    """
    Verify GitHub file fetching excludes .pem, .key, credentials.json, id_rsa, etc.
    """
    meta_resp = MagicMock(spec=httpx.Response)
    meta_resp.status_code = 200
    meta_resp.json.return_value = {
        "id": 202,
        "name": "secret-test",
        "full_name": "owner/secret-test",
        "owner": {"login": "owner"},
        "default_branch": "main",
        "private": False,
        "size": 50,
    }

    tree_resp = MagicMock(spec=httpx.Response)
    tree_resp.status_code = 200
    tree_resp.json.return_value = {
        "tree": [
            {"path": "src/index.ts", "type": "blob", "size": 150},
            {"path": ".env.production", "type": "blob", "size": 100},
            {"path": "secrets/server.key", "type": "blob", "size": 100},
            {"path": "certs/cert.pem", "type": "blob", "size": 100},
            {"path": "id_rsa", "type": "blob", "size": 100},
            {"path": "config/credentials.json", "type": "blob", "size": 100},
            {"path": "package-lock.json", "type": "blob", "size": 5000},
        ]
    }

    file_content_resp = MagicMock(spec=httpx.Response)
    file_content_resp.status_code = 200
    file_content_resp.text = "export const x = 1;"

    mock_http = MagicMock(spec=httpx.Client)

    def mock_request(*args, **kwargs):
        url = kwargs.get("url") or (args[1] if len(args) > 1 else args[0])
        if "/git/trees" in url:
            return tree_resp
        elif "/repos/owner/secret-test" in url:
            return meta_resp
        else:
            return file_content_resp

    mock_http.request.side_effect = mock_request
    mock_http.get.side_effect = mock_request

    client = GitHubClient(http_client=mock_http)
    files = client.fetch_repository_source_files("owner", "secret-test", branch="main")

    assert len(files) == 1
    assert files[0].path == "src/index.ts"


def test_github_client_retry_on_transient_502_error():
    """
    Verify GitHubClient retries on transient 502/503 errors and succeeds.
    """
    error_resp = MagicMock(spec=httpx.Response)
    error_resp.status_code = 502
    error_resp.text = "Bad Gateway"

    success_resp = MagicMock(spec=httpx.Response)
    success_resp.status_code = 200
    success_resp.json.return_value = {
        "id": 101,
        "name": "sample",
        "full_name": "owner/sample",
        "owner": {"login": "owner"},
        "default_branch": "main",
        "private": False,
        "size": 50,
        "stargazers_count": 10,
        "forks_count": 2,
        "open_issues_count": 0,
        "language": "Python",
    }

    mock_http = MagicMock(spec=httpx.Client)
    # Fail first, succeed second
    mock_http.request.side_effect = [error_resp, success_resp]
    mock_http.get.side_effect = [error_resp, success_resp]

    client = GitHubClient(http_client=mock_http)
    meta = client.get_repository_metadata("owner", "sample")

    assert meta["name"] == "sample"
    assert mock_http.get.call_count == 2 or mock_http.request.call_count == 2


def test_fetch_branch_tree_409_empty_repository():
    """
    Verify GitHub Git Trees API 409 'Git Repository is empty' raises EmptyRepositoryError.
    """
    from app.github.client import EmptyRepositoryError

    tree_409_resp = MagicMock(spec=httpx.Response)
    tree_409_resp.status_code = 409
    tree_409_resp.text = '{"message": "Git Repository is empty", "documentation_url": "https://docs.github.com/rest/git/trees#get-a-tree"}'

    mock_http = MagicMock(spec=httpx.Client)
    mock_http.get.return_value = tree_409_resp
    mock_http.request.return_value = tree_409_resp

    client = GitHubClient(http_client=mock_http)
    with pytest.raises(EmptyRepositoryError) as exc_info:
        client.fetch_branch_tree("octocat", "empty-repo", "main")

    assert exc_info.value.code == "EMPTY_REPOSITORY"
    assert exc_info.value.status_code == 409
    assert exc_info.value.recoverable is True
    assert "empty" in exc_info.value.message.lower()


def test_validate_url_detects_empty_repo_metadata():
    """
    Verify validate_url raises EmptyRepositoryError if size=0 and pushed_at is None.
    """
    from app.github.client import EmptyRepositoryError

    meta_resp = MagicMock(spec=httpx.Response)
    meta_resp.status_code = 200
    meta_resp.json.return_value = {
        "id": 999,
        "name": "brand-new-repo",
        "full_name": "octocat/brand-new-repo",
        "owner": {"login": "octocat"},
        "default_branch": "main",
        "private": False,
        "size": 0,
        "pushed_at": None,
    }

    mock_http = MagicMock(spec=httpx.Client)
    mock_http.get.return_value = meta_resp
    mock_http.request.return_value = meta_resp

    client = GitHubClient(http_client=mock_http)
    with pytest.raises(EmptyRepositoryError) as exc_info:
        client.validate_url("https://github.com/octocat/brand-new-repo")

    assert exc_info.value.code == "EMPTY_REPOSITORY"


def test_validate_url_branch_not_found():
    """
    Verify validate_url raises BranchNotFoundError with default_branch suggestion when branch returns 404.
    """
    from app.github.client import BranchNotFoundError

    meta_resp = MagicMock(spec=httpx.Response)
    meta_resp.status_code = 200
    meta_resp.json.return_value = {
        "id": 100,
        "name": "repo-with-master",
        "full_name": "octocat/repo-with-master",
        "owner": {"login": "octocat"},
        "default_branch": "master",
        "private": False,
        "size": 50,
        "pushed_at": "2024-01-01T00:00:00Z",
    }

    branch_404_resp = MagicMock(spec=httpx.Response)
    branch_404_resp.status_code = 404
    branch_404_resp.text = "Branch not found"

    mock_http = MagicMock(spec=httpx.Client)

    def mock_get(url, *args, **kwargs):
        if "/branches/" in url:
            return branch_404_resp
        return meta_resp

    mock_http.get.side_effect = mock_get
    mock_http.request.side_effect = mock_get

    client = GitHubClient(http_client=mock_http)
    with pytest.raises(BranchNotFoundError) as exc_info:
        client.validate_url("https://github.com/octocat/repo-with-master", branch="nonexistent-branch")

    assert exc_info.value.code == "BRANCH_NOT_FOUND"
    assert "nonexistent-branch" in exc_info.value.message
    assert "master" in exc_info.value.message
    assert exc_info.value.details["default_branch"] == "master"


def test_fetch_repository_manifest_no_supported_source_files():
    """
    Verify fetch_repository_manifest raises NoSupportedSourceFilesError when all tree items are ignored.
    """
    from app.github.client import NoSupportedSourceFilesError

    meta_resp = MagicMock(spec=httpx.Response)
    meta_resp.status_code = 200
    meta_resp.json.return_value = {
        "id": 101,
        "name": "image-only-repo",
        "full_name": "owner/image-only-repo",
        "owner": {"login": "owner"},
        "default_branch": "main",
        "private": False,
        "size": 500,
        "pushed_at": "2024-01-01T00:00:00Z",
    }

    tree_resp = MagicMock(spec=httpx.Response)
    tree_resp.status_code = 200
    tree_resp.json.return_value = {
        "tree": [
            {"path": "logo.png", "type": "blob", "size": 1000},
            {"path": "doc.pdf", "type": "blob", "size": 2000},
            {"path": "archive.zip", "type": "blob", "size": 3000},
        ]
    }

    mock_http = MagicMock(spec=httpx.Client)

    def mock_get(url, *args, **kwargs):
        if "/git/trees" in url:
            return tree_resp
        return meta_resp

    mock_http.get.side_effect = mock_get
    mock_http.request.side_effect = mock_get

    client = GitHubClient(http_client=mock_http)
    with pytest.raises(NoSupportedSourceFilesError) as exc_info:
        client.fetch_repository_manifest("owner", "image-only-repo", branch="main")

    assert exc_info.value.code == "NO_SUPPORTED_SOURCE_FILES"
    assert exc_info.value.status_code == 422

