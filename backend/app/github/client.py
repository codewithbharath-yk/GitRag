"""
GitHub API Client Module.

Provides robust, rate-limit aware communication with GitHub REST API for repository
metadata inspection, recursive tree traversal, and source file content fetching.
"""

from pathlib import Path
from typing import List, Dict, Any, Optional
import httpx

from app.config.settings import Settings, get_settings
from app.github.url_parser import parse_github_url, GitHubRepoIdentity
from app.rag.file_scanner import (
    DiscoveredFile,
    DEFAULT_EXTENSION_MAP,
    DEFAULT_EXACT_FILENAME_MAP,
    DEFAULT_IGNORED_DIRS,
    DEFAULT_IGNORED_FILES,
    DEFAULT_MAX_FILE_SIZE,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)

GITHUB_API_BASE_URL = "https://api.github.com"
RAW_GITHUB_BASE_URL = "https://raw.githubusercontent.com"
DEFAULT_TIMEOUT_SECONDS = 20.0
DEFAULT_MAX_REPO_FILES = 150


class GitHubError(Exception):
    """Base exception for all GitHub API errors."""
    pass


class RepositoryNotFoundError(GitHubError):
    """Raised when the specified repository or branch is not found."""
    pass


class RepositoryAccessDeniedError(GitHubError):
    """Raised when repository access is unauthorized (private repo or missing token)."""
    pass


class RateLimitExceededError(GitHubError):
    """Raised when GitHub API rate limits (60/hr unauthenticated, 5000/hr authenticated) are reached."""
    pass


class GitHubClient:
    """
    Client for querying GitHub API and fetching repository source trees.
    """

    def __init__(
        self,
        token: Optional[str] = None,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        max_files: int = DEFAULT_MAX_REPO_FILES,
        max_file_size_bytes: int = DEFAULT_MAX_FILE_SIZE,
        http_client: Optional[httpx.Client] = None,
    ):
        settings = get_settings()
        self.token = token if token is not None else settings.github_token
        self.timeout = timeout
        self.max_files = max_files
        self.max_file_size_bytes = max_file_size_bytes
        self._client = http_client

    def _get_headers(self, accept: str = "application/vnd.github.v3+json") -> Dict[str, str]:
        """
        Build request headers with optional GitHub authorization token.
        Never logs or exposes the raw token.
        """
        headers = {
            "Accept": accept,
            "User-Agent": "CodeRAG-Assistant/0.1.0",
        }
        if self.token and self.token.strip():
            headers["Authorization"] = f"Bearer {self.token.strip()}"
        return headers

    def _get_http_client(self) -> httpx.Client:
        """
        Return active httpx client or create a new instance.
        """
        if self._client is None:
            self._client = httpx.Client(timeout=self.timeout)
        return self._client

    def _handle_response_errors(self, response: httpx.Response, owner: str, repo: str) -> None:
        """
        Translate HTTP status codes to descriptive domain exceptions.
        """
        if response.status_code == 200:
            return

        if response.status_code == 404:
            raise RepositoryNotFoundError(
                f"Repository '{owner}/{repo}' not found on GitHub. "
                "Please verify the repository owner and name."
            )

        if response.status_code == 401:
            raise RepositoryAccessDeniedError(
                "GitHub authentication failed. Your configured GITHUB_TOKEN is invalid or expired."
            )

        if response.status_code == 403:
            # Check if rate limit was exceeded
            rate_limit_remaining = response.headers.get("x-ratelimit-remaining")
            if rate_limit_remaining == "0" or "rate limit" in response.text.lower():
                raise RateLimitExceededError(
                    "GitHub API rate limit exceeded. "
                    "Configure a personal GITHUB_TOKEN in your .env file to increase limit to 5,000 requests/hour."
                )
            raise RepositoryAccessDeniedError(
                f"Access denied to repository '{owner}/{repo}'. "
                "If this is a private repository, ensure your GITHUB_TOKEN has 'repo' read permissions."
            )

        raise GitHubError(
            f"GitHub API returned error HTTP {response.status_code}: {response.text[:200]}"
        )

    def get_repository_metadata(self, owner: str, repo: str) -> Dict[str, Any]:
        """
        Retrieve public metadata for a repository.
        """
        client = self._get_http_client()
        url = f"{GITHUB_API_BASE_URL}/repos/{owner}/{repo}"

        logger.info(f"Fetching GitHub metadata for repository: {owner}/{repo}")
        try:
            resp = client.get(url, headers=self._get_headers())
        except httpx.RequestError as e:
            raise GitHubError(f"Network error communicating with GitHub API: {e}") from e

        self._handle_response_errors(resp, owner, repo)

        data = resp.json()
        return {
            "id": data.get("id"),
            "owner": data.get("owner", {}).get("login", owner),
            "name": data.get("name", repo),
            "full_name": data.get("full_name", f"{owner}/{repo}"),
            "default_branch": data.get("default_branch", "main"),
            "is_private": data.get("private", False),
            "description": data.get("description"),
            "size_kb": data.get("size", 0),
            "stars_count": data.get("stargazers_count", 0),
            "forks_count": data.get("forks_count", 0),
            "open_issues_count": data.get("open_issues_count", 0),
            "language": data.get("language"),
            "html_url": data.get("html_url", f"https://github.com/{owner}/{repo}"),
        }

    def validate_url(self, repo_url: str, branch: Optional[str] = None) -> Dict[str, Any]:
        """
        Validate URL syntax and verify existence on GitHub.
        """
        identity = parse_github_url(repo_url)
        meta = self.get_repository_metadata(identity.owner, identity.name)

        target_branch = branch or meta["default_branch"]
        if branch and branch != meta["default_branch"]:
            # Verify branch exists
            client = self._get_http_client()
            branch_url = f"{GITHUB_API_BASE_URL}/repos/{identity.owner}/{identity.name}/branches/{branch}"
            resp = client.get(branch_url, headers=self._get_headers())
            if resp.status_code == 404:
                raise RepositoryNotFoundError(
                    f"Branch '{branch}' not found in repository '{identity.full_name}'."
                )
            self._handle_response_errors(resp, identity.owner, identity.name)

        meta["selected_branch"] = target_branch
        meta["repository_id"] = identity.repository_id
        return meta

    def fetch_branch_tree(self, owner: str, repo: str, branch: str) -> List[Dict[str, Any]]:
        """
        Fetch the recursive Git tree for the specified branch in a single fast API call.
        """
        client = self._get_http_client()
        url = f"{GITHUB_API_BASE_URL}/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"

        logger.info(f"Fetching Git tree for {owner}/{repo} (branch={branch})...")
        try:
            resp = client.get(url, headers=self._get_headers())
        except httpx.RequestError as e:
            raise GitHubError(f"Network error fetching Git tree from GitHub: {e}") from e

        self._handle_response_errors(resp, owner, repo)

        data = resp.json()
        tree = data.get("tree", [])
        if data.get("truncated", False):
            logger.warning(
                f"Repository tree for {owner}/{repo} was truncated by GitHub API (very large repository)."
            )
        return tree

    def fetch_file_content(self, owner: str, repo: str, file_path: str, ref: str) -> str:
        """
        Fetch raw text content for a single repository file.
        """
        client = self._get_http_client()

        # If authenticated, use contents API with raw accept header to support private repos
        if self.token and self.token.strip():
            url = f"{GITHUB_API_BASE_URL}/repos/{owner}/{repo}/contents/{file_path}?ref={ref}"
            headers = self._get_headers(accept="application/vnd.github.v3.raw")
        else:
            # For public repos, raw.githubusercontent.com is fast and direct
            url = f"{RAW_GITHUB_BASE_URL}/{owner}/{repo}/{ref}/{file_path}"
            headers = self._get_headers(accept="text/plain")

        try:
            resp = client.get(url, headers=headers)
        except httpx.RequestError as e:
            raise GitHubError(f"Network error downloading file '{file_path}': {e}") from e

        if resp.status_code == 404:
            raise RepositoryNotFoundError(f"File '{file_path}' not found at ref '{ref}'.")

        self._handle_response_errors(resp, owner, repo)

        # Decode content safely
        try:
            return resp.text
        except UnicodeDecodeError:
            return resp.content.decode("utf-8", errors="replace")

    def fetch_repository_source_files(
        self,
        owner: str,
        repo: str,
        branch: Optional[str] = None,
    ) -> List[DiscoveredFile]:
        """
        Discover eligible source files in the repository tree and download their contents.
        Applies extension whitelist, directory blacklist, file blacklist, and size limits.
        """
        meta = self.get_repository_metadata(owner, repo)
        selected_branch = branch or meta["default_branch"]

        tree = self.fetch_branch_tree(owner, repo, selected_branch)
        eligible_entries: List[Dict[str, Any]] = []

        for item in tree:
            # Only process file blobs
            if item.get("type") != "blob":
                continue

            file_path = item.get("path", "")
            size_bytes = item.get("size", 0)

            # Check directory ignore rules
            parts = file_path.split("/")
            if any(part in DEFAULT_IGNORED_DIRS or part.startswith(".") for part in parts[:-1]):
                continue

            filename = parts[-1]
            if filename in DEFAULT_IGNORED_FILES or filename.startswith(".env"):
                continue

            ext = Path(filename).suffix.lower()
            language = DEFAULT_EXTENSION_MAP.get(ext) or DEFAULT_EXACT_FILENAME_MAP.get(filename.lower())
            if not language:
                continue

            if size_bytes > self.max_file_size_bytes:
                logger.debug(f"Skipping oversized GitHub file '{file_path}' ({size_bytes} bytes)")
                continue

            eligible_entries.append(item)

        # Cap total files to prevent unbounded downloads
        capped_entries = eligible_entries[: self.max_files]
        if len(eligible_entries) > self.max_files:
            logger.warning(
                f"Repository contains {len(eligible_entries)} source files. Capping ingestion to {self.max_files} files."
            )

        logger.info(f"Downloading {len(capped_entries)} eligible source files for {owner}/{repo}@{selected_branch}...")

        discovered_files: List[DiscoveredFile] = []
        for entry in capped_entries:
            file_path = entry["path"]
            try:
                content = self.fetch_file_content(owner, repo, file_path, ref=selected_branch)
                filename = file_path.split("/")[-1]
                ext = Path(filename).suffix.lower()
                language = DEFAULT_EXTENSION_MAP.get(ext) or DEFAULT_EXACT_FILENAME_MAP.get(filename.lower(), "unknown")
                line_count = len(content.splitlines()) if content else 0

                discovered_files.append(
                    DiscoveredFile(
                        path=file_path,
                        absolute_path=Path(file_path),
                        language=language,
                        content=content,
                        size_bytes=len(content.encode("utf-8")),
                        line_count=line_count,
                    )
                )
            except Exception as e:
                logger.warning(f"Failed to fetch content for file '{file_path}': {e}")
                continue

        logger.info(
            f"Successfully downloaded {len(discovered_files)} source files from GitHub repository {owner}/{repo}."
        )
        return discovered_files

    def list_commits(
        self,
        owner: str,
        repo: str,
        branch: Optional[str] = None,
        path: Optional[str] = None,
        page: int = 1,
        per_page: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        List commits from a repository with optional branch, file path, and pagination filters.
        """
        client = self._get_http_client()
        url = f"{GITHUB_API_BASE_URL}/repos/{owner}/{repo}/commits"
        params: Dict[str, Any] = {
            "page": max(1, page),
            "per_page": min(100, max(1, per_page)),
        }
        if branch:
            params["sha"] = branch
        if path:
            params["path"] = path

        logger.info(f"Listing GitHub commits for {owner}/{repo} (branch={branch}, path={path}, page={page})...")
        try:
            resp = client.get(url, headers=self._get_headers(), params=params)
        except httpx.RequestError as e:
            raise GitHubError(f"Network error listing commits for {owner}/{repo}: {e}") from e

        self._handle_response_errors(resp, owner, repo)

        data = resp.json()
        if not isinstance(data, list):
            return []

        commits = []
        for item in data:
            sha = item.get("sha", "")
            commit_meta = item.get("commit", {})
            author_meta = commit_meta.get("author", {}) or {}
            gh_author = item.get("author") or {}
            parents = [p.get("sha") for p in item.get("parents", []) if p.get("sha")]

            commits.append({
                "sha": sha,
                "short_sha": sha[:7] if sha else "",
                "message": commit_meta.get("message", "").strip(),
                "author": {
                    "name": author_meta.get("name", "Unknown"),
                    "email": author_meta.get("email"),
                    "date": author_meta.get("date", ""),
                    "login": gh_author.get("login"),
                    "avatar_url": gh_author.get("avatar_url"),
                },
                "parents": parents,
                "html_url": item.get("html_url", f"https://github.com/{owner}/{repo}/commit/{sha}"),
            })

        return commits

    def get_commit_detail(self, owner: str, repo: str, commit_sha: str) -> Dict[str, Any]:
        """
        Retrieve complete details for a single commit, including changed files,
        stats, and patch diffs (with safe truncation caps).
        """
        from app.services.diff_service import get_diff_service

        client = self._get_http_client()
        url = f"{GITHUB_API_BASE_URL}/repos/{owner}/{repo}/commits/{commit_sha}"

        logger.info(f"Fetching commit details for {owner}/{repo}@{commit_sha[:7]}...")
        try:
            resp = client.get(url, headers=self._get_headers())
        except httpx.RequestError as e:
            raise GitHubError(f"Network error fetching commit {commit_sha}: {e}") from e

        if resp.status_code == 404:
            raise RepositoryNotFoundError(f"Commit '{commit_sha}' not found in repository {owner}/{repo}.")

        self._handle_response_errors(resp, owner, repo)

        data = resp.json()
        commit_meta = data.get("commit", {})
        author_meta = commit_meta.get("author", {}) or {}
        gh_author = data.get("author") or {}
        parents = [p.get("sha") for p in data.get("parents", []) if p.get("sha")]
        stats_meta = data.get("stats") or {}

        diff_service = get_diff_service()
        files = []
        for f in data.get("files", []):
            raw_patch = f.get("patch")
            capped_patch, is_truncated = diff_service.sanitize_and_cap_patch(raw_patch)

            files.append({
                "filename": f.get("filename", ""),
                "status": f.get("status", "modified"),
                "additions": f.get("additions", 0),
                "deletions": f.get("deletions", 0),
                "changes": f.get("changes", 0),
                "patch": capped_patch,
                "patch_truncated": is_truncated,
                "previous_filename": f.get("previous_filename"),
            })

        return {
            "sha": data.get("sha", commit_sha),
            "short_sha": data.get("sha", commit_sha)[:7],
            "message": commit_meta.get("message", "").strip(),
            "author": {
                "name": author_meta.get("name", "Unknown"),
                "email": author_meta.get("email"),
                "date": author_meta.get("date", ""),
                "login": gh_author.get("login"),
                "avatar_url": gh_author.get("avatar_url"),
            },
            "parents": parents,
            "html_url": data.get("html_url", f"https://github.com/{owner}/{repo}/commit/{commit_sha}"),
            "stats": {
                "total": stats_meta.get("total", 0),
                "additions": stats_meta.get("additions", 0),
                "deletions": stats_meta.get("deletions", 0),
            },
            "files": files,
        }

    def compare_commits(self, owner: str, repo: str, base: str, head: str) -> Dict[str, Any]:
        """
        Compare two revisions or commits on GitHub.
        """
        from app.services.diff_service import get_diff_service

        client = self._get_http_client()
        url = f"{GITHUB_API_BASE_URL}/repos/{owner}/{repo}/compare/{base}...{head}"

        logger.info(f"Comparing revisions {base}...{head} on {owner}/{repo}...")
        try:
            resp = client.get(url, headers=self._get_headers())
        except httpx.RequestError as e:
            raise GitHubError(f"Network error comparing {base}...{head}: {e}") from e

        self._handle_response_errors(resp, owner, repo)

        data = resp.json()
        diff_service = get_diff_service()
        files = []
        for f in data.get("files", []):
            raw_patch = f.get("patch")
            capped_patch, is_truncated = diff_service.sanitize_and_cap_patch(raw_patch)

            files.append({
                "filename": f.get("filename", ""),
                "status": f.get("status", "modified"),
                "additions": f.get("additions", 0),
                "deletions": f.get("deletions", 0),
                "changes": f.get("changes", 0),
                "patch": capped_patch,
                "patch_truncated": is_truncated,
                "previous_filename": f.get("previous_filename"),
            })

        return {
            "base_commit": base,
            "head_commit": head,
            "status": data.get("status", "unknown"),
            "ahead_by": data.get("ahead_by", 0),
            "behind_by": data.get("behind_by", 0),
            "total_commits": data.get("total_commits", 0),
            "files": files,
        }

