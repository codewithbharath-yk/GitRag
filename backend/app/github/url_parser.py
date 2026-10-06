"""
GitHub Repository URL Parser and Validator.

Safely parses and validates GitHub repository URLs, extracting owner and repository names
while rejecting invalid schemes, non-GitHub domains, and malicious payloads.
"""

from dataclasses import dataclass
from urllib.parse import urlparse
import re


class InvalidGitHubURLError(ValueError):
    """Raised when an invalid or unsupported GitHub repository URL is provided."""
    pass


# Strict regex for GitHub usernames / org names and repository names
GITHUB_IDENTIFIER_PATTERN = re.compile(r"^[a-zA-Z0-9_\.\-]+$")


@dataclass(frozen=True)
class GitHubRepoIdentity:
    """
    Structured representation of a validated GitHub repository identity.
    """
    owner: str
    name: str

    @property
    def full_name(self) -> str:
        """Returns standard 'owner/repo' format."""
        return f"{self.owner}/{self.name}"

    @property
    def normalized_url(self) -> str:
        """Returns standard canonical https://github.com/owner/repo URL."""
        return f"https://github.com/{self.owner}/{self.name}"

    @property
    def repository_id(self) -> str:
        """Returns safe sanitized identifier for vector store isolation."""
        return f"{self.owner.lower()}__{self.name.lower()}"


def parse_github_url(url: str) -> GitHubRepoIdentity:
    """
    Parses and validates a GitHub repository URL or slug.

    Accepts formats such as:
      - https://github.com/owner/repo
      - http://github.com/owner/repo.git
      - github.com/owner/repo
      - owner/repo

    Raises:
      InvalidGitHubURLError: If the input is malformed, not a GitHub URL, or contains invalid characters.
    """
    raw = (url or "").strip()
    if not raw:
        raise InvalidGitHubURLError("Repository URL cannot be empty.")

    # Disallow path traversal attempts
    if ".." in raw or "\\" in raw or "%2e%2e" in raw.lower():
        raise InvalidGitHubURLError("URL contains forbidden path traversal sequences.")

    # If format is simple 'owner/repo' without scheme or domain
    if "/" in raw and "://" not in raw and "." not in raw.split("/")[0]:
        parts = raw.split("/")
        if len(parts) == 2 and parts[0] and parts[1]:
            owner = parts[0].strip()
            name = parts[1].strip()
            if name.endswith(".git"):
                name = name[:-4]
            return _validate_and_build(owner, name)

    # Ensure URL has scheme for urlparse
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw

    try:
        parsed = urlparse(raw)
    except Exception as e:
        raise InvalidGitHubURLError(f"Malformed URL: {e}") from e

    # Validate hostname is strictly github.com (or www.github.com)
    hostname = (parsed.hostname or "").lower()
    if hostname not in ("github.com", "www.github.com"):
        raise InvalidGitHubURLError(
            f"Unsupported host '{hostname}'. Only repositories hosted on 'github.com' are supported."
        )

    # Extract path components (e.g. /owner/repo/...)
    path_segments = [seg for seg in parsed.path.strip("/").split("/") if seg]
    if len(path_segments) < 2:
        raise InvalidGitHubURLError(
            f"Invalid GitHub repository URL '{url}'. Expected format: 'https://github.com/owner/repository'."
        )

    owner = path_segments[0].strip()
    name = path_segments[1].strip()

    if name.endswith(".git"):
        name = name[:-4]

    return _validate_and_build(owner, name)


def _validate_and_build(owner: str, name: str) -> GitHubRepoIdentity:
    """
    Validate individual owner and repository identifiers against GitHub constraints.
    """
    if not owner or not name:
        raise InvalidGitHubURLError("Both owner and repository name must be non-empty.")

    if not GITHUB_IDENTIFIER_PATTERN.match(owner):
        raise InvalidGitHubURLError(
            f"Invalid GitHub owner name '{owner}'. Must contain only alphanumeric characters, dots, dashes, or underscores."
        )

    if not GITHUB_IDENTIFIER_PATTERN.match(name):
        raise InvalidGitHubURLError(
            f"Invalid GitHub repository name '{name}'. Must contain only alphanumeric characters, dots, dashes, or underscores."
        )

    # Disallow reserved GitHub routes
    reserved_owners = {"settings", "organizations", "users", "explore", "trending", "pricing", "marketplace"}
    if owner.lower() in reserved_owners:
        raise InvalidGitHubURLError(f"'{owner}' is a reserved GitHub path, not a user repository.")

    return GitHubRepoIdentity(owner=owner, name=name)
