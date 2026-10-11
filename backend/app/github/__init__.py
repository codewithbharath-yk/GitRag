"""
GitHub Integration Module for CodeRAG.
"""

from app.github.url_parser import parse_github_url, GitHubRepoIdentity, InvalidGitHubURLError
from app.github.client import (
    GitHubClient,
    GitHubError,
    EmptyRepositoryError,
    BranchNotFoundError,
    NoSupportedSourceFilesError,
    RepositoryNotFoundError,
    RepositoryAccessDeniedError,
    GitHubAuthError,
    RateLimitExceededError,
    GitHubConflictError,
    GitHubInvalidRequestError,
    GitHubServerError,
    GitHubTimeoutError,
)

__all__ = [
    "parse_github_url",
    "GitHubRepoIdentity",
    "InvalidGitHubURLError",
    "GitHubClient",
    "GitHubError",
    "EmptyRepositoryError",
    "BranchNotFoundError",
    "NoSupportedSourceFilesError",
    "RepositoryNotFoundError",
    "RepositoryAccessDeniedError",
    "GitHubAuthError",
    "RateLimitExceededError",
    "GitHubConflictError",
    "GitHubInvalidRequestError",
    "GitHubServerError",
    "GitHubTimeoutError",
]
