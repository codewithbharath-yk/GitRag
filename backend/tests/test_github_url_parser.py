"""
Unit tests for GitHub URL Parser and Validator.
"""

import pytest
from app.github.url_parser import parse_github_url, GitHubRepoIdentity, InvalidGitHubURLError


def test_valid_github_https_urls():
    """
    Test parsing various valid GitHub HTTPS URLs.
    """
    id1 = parse_github_url("https://github.com/octocat/Hello-World")
    assert id1.owner == "octocat"
    assert id1.name == "Hello-World"
    assert id1.full_name == "octocat/Hello-World"
    assert id1.repository_id == "octocat__hello-world"
    assert id1.normalized_url == "https://github.com/octocat/Hello-World"

    id2 = parse_github_url("https://github.com/fastapi/fastapi.git")
    assert id2.owner == "fastapi"
    assert id2.name == "fastapi"

    id3 = parse_github_url("https://github.com/torvalds/linux/")
    assert id3.owner == "torvalds"
    assert id3.name == "linux"


def test_valid_slug_and_domain_shorthands():
    """
    Test shorthand representations like 'owner/repo' or 'github.com/owner/repo'.
    """
    id1 = parse_github_url("octocat/Spoon-Knife")
    assert id1.owner == "octocat"
    assert id1.name == "Spoon-Knife"

    id2 = parse_github_url("github.com/pallets/flask")
    assert id2.owner == "pallets"
    assert id2.name == "flask"


def test_rejects_empty_and_whitespace():
    """
    Test empty URL raises InvalidGitHubURLError.
    """
    with pytest.raises(InvalidGitHubURLError):
        parse_github_url("")

    with pytest.raises(InvalidGitHubURLError):
        parse_github_url("   \n\t ")


def test_rejects_non_github_hosts():
    """
    Test that non-github hosts are rejected for security.
    """
    with pytest.raises(InvalidGitHubURLError) as exc_info:
        parse_github_url("https://gitlab.com/owner/repo")
    assert "Only repositories hosted on 'github.com' are supported" in str(exc_info.value)

    with pytest.raises(InvalidGitHubURLError):
        parse_github_url("https://bitbucket.org/owner/repo")

    with pytest.raises(InvalidGitHubURLError):
        parse_github_url("https://evil-site.com/octocat/repo")


def test_rejects_path_traversal_and_malicious_input():
    """
    Test rejection of path traversal sequences.
    """
    with pytest.raises(InvalidGitHubURLError):
        parse_github_url("https://github.com/../etc/passwd")

    with pytest.raises(InvalidGitHubURLError):
        parse_github_url("https://github.com/owner/..%2f..%2f")

    with pytest.raises(InvalidGitHubURLError):
        parse_github_url("https://github.com/owner/repo\\invalid")


def test_rejects_reserved_github_paths():
    """
    Test rejection of reserved GitHub system paths like /settings, /explore.
    """
    with pytest.raises(InvalidGitHubURLError) as exc_info:
        parse_github_url("https://github.com/settings/profile")
    assert "reserved GitHub path" in str(exc_info.value)
