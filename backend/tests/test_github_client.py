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

    def mock_get(url, headers=None):
        if "/repos/owner/sample/git/trees" in url:
            return tree_resp
        elif "/repos/owner/sample" in url:
            return meta_resp
        else:
            return file_content_resp

    mock_http.get.side_effect = mock_get

    client = GitHubClient(http_client=mock_http)
    files = client.fetch_repository_source_files("owner", "sample", branch="main")

    assert len(files) == 2
    paths = [f.path for f in files]
    assert "src/main.py" in paths
    assert "src/auth.java" in paths
    assert "src/__pycache__/cache.pyc" not in paths
    assert "image.png" not in paths
