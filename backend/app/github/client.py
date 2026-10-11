"""
GitHub API Client Module.

Provides robust, rate-limit aware communication with GitHub REST API for repository
metadata inspection, recursive tree traversal, source file content fetching,
and explicit error taxonomy handling (empty repository, branch not found, rate limit, etc.).
"""

from pathlib import Path
from typing import List, Dict, Any, Optional
import time
import httpx

from app.config.settings import Settings, get_settings
from app.github.url_parser import parse_github_url, GitHubRepoIdentity, InvalidGitHubURLError
from app.rag.file_scanner import (
    DiscoveredFile,
    DEFAULT_EXTENSION_MAP,
    DEFAULT_EXACT_FILENAME_MAP,
    DEFAULT_IGNORED_DIRS,
    DEFAULT_IGNORED_FILES,
    DEFAULT_MAX_FILE_SIZE,
    is_secret_or_sensitive_filename,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)

DEFAULT_GITHUB_API_BASE_URL = "https://api.github.com"
RAW_GITHUB_BASE_URL = "https://raw.githubusercontent.com"
DEFAULT_TIMEOUT_SECONDS = 30.0
DEFAULT_MAX_REPO_FILES = 500


# =====================================================================
# GitHub Domain Exception Hierarchy
# =====================================================================

class GitHubError(Exception):
    """Base exception for all GitHub API errors."""
    code: str = "GITHUB_ERROR"
    status_code: int = 502
    recoverable: bool = False

    def __init__(
        self,
        message: str,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        recoverable: bool = False,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code
        self.recoverable = recoverable
        self.details = details or {}

    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to structured application error dictionary."""
        data: Dict[str, Any] = {
            "code": self.code,
            "message": self.message,
            "recoverable": self.recoverable,
        }
        if self.details:
            data["details"] = self.details
        return data


class EmptyRepositoryError(GitHubError):
    """Raised when a GitHub repository exists but has no commits/tree yet (HTTP 409: Git Repository is empty)."""
    code: str = "EMPTY_REPOSITORY"
    status_code: int = 409
    recoverable: bool = True

    def __init__(
        self,
        message: str = "This GitHub repository is empty. Add at least one committed file before analyzing it.",
        **kwargs,
    ):
        super().__init__(
            message=message,
            code="EMPTY_REPOSITORY",
            status_code=409,
            recoverable=True,
            **kwargs,
        )


class BranchNotFoundError(GitHubError):
    """Raised when the specified branch does not exist in the repository."""
    code: str = "BRANCH_NOT_FOUND"
    status_code: int = 404
    recoverable: bool = True

    def __init__(
        self,
        branch: str,
        default_branch: Optional[str] = None,
        message: Optional[str] = None,
        **kwargs,
    ):
        msg = message or (
            f"The selected branch '{branch}' does not exist. Available/default branch: '{default_branch or 'main'}'."
            if default_branch
            else f"Branch '{branch}' not found in repository."
        )
        super().__init__(
            message=msg,
            code="BRANCH_NOT_FOUND",
            status_code=404,
            recoverable=True,
            details={"branch": branch, "default_branch": default_branch},
            **kwargs,
        )


class NoSupportedSourceFilesError(GitHubError):
    """Raised when repository has commits but no eligible source files were found after filtering."""
    code: str = "NO_SUPPORTED_SOURCE_FILES"
    status_code: int = 422
    recoverable: bool = True

    def __init__(
        self,
        message: str = "Repository contains no supported source-code files.",
        **kwargs,
    ):
        super().__init__(
            message=message,
            code="NO_SUPPORTED_SOURCE_FILES",
            status_code=422,
            recoverable=True,
            **kwargs,
        )


class RepositoryNotFoundError(GitHubError):
    """Raised when the specified repository is not found or inaccessible."""
    code: str = "REPOSITORY_NOT_FOUND"
    status_code: int = 404
    recoverable: bool = False

    def __init__(
        self,
        message: str = "Repository not found or inaccessible. Please verify the repository owner and name.",
        **kwargs,
    ):
        super().__init__(
            message=message,
            code="REPOSITORY_NOT_FOUND",
            status_code=404,
            recoverable=False,
            **kwargs,
        )


class RepositoryAccessDeniedError(GitHubError):
    """Raised when repository access is unauthorized (private repo or missing token)."""
    code: str = "GITHUB_PERMISSION_DENIED"
    status_code: int = 403
    recoverable: bool = True

    def __init__(
        self,
        message: str = "Access denied to repository. If this is a private repository, ensure your GITHUB_TOKEN has 'repo' read permissions.",
        **kwargs,
    ):
        super().__init__(
            message=message,
            code="GITHUB_PERMISSION_DENIED",
            status_code=403,
            recoverable=True,
            **kwargs,
        )


class GitHubAuthError(GitHubError):
    """Raised when GitHub token authentication fails (401)."""
    code: str = "GITHUB_AUTH_ERROR"
    status_code: int = 401
    recoverable: bool = True

    def __init__(
        self,
        message: str = "GitHub authentication failed. Your configured GITHUB_TOKEN is invalid or expired.",
        **kwargs,
    ):
        super().__init__(
            message=message,
            code="GITHUB_AUTH_ERROR",
            status_code=401,
            recoverable=True,
            **kwargs,
        )


class RateLimitExceededError(GitHubError):
    """Raised when GitHub API rate limits (60/hr unauthenticated, 5000/hr authenticated) are reached."""
    code: str = "RATE_LIMITED"
    status_code: int = 429
    recoverable: bool = True

    def __init__(
        self,
        message: str = "GitHub API rate limit exceeded. Configure a personal GITHUB_TOKEN in your .env file to increase limit to 5,000 requests/hour.",
        **kwargs,
    ):
        super().__init__(
            message=message,
            code="RATE_LIMITED",
            status_code=429,
            recoverable=True,
            **kwargs,
        )


class GitHubConflictError(GitHubError):
    """Raised when GitHub returns 409 for non-empty reasons."""
    code: str = "GITHUB_CONFLICT"
    status_code: int = 409
    recoverable: bool = False

    def __init__(
        self,
        message: str = "GitHub conflict error (HTTP 409).",
        **kwargs,
    ):
        super().__init__(
            message=message,
            code="GITHUB_CONFLICT",
            status_code=409,
            recoverable=False,
            **kwargs,
        )


class GitHubInvalidRequestError(GitHubError):
    """Raised when GitHub returns 422 for invalid API requests."""
    code: str = "INVALID_GITHUB_REQUEST"
    status_code: int = 422
    recoverable: bool = False

    def __init__(
        self,
        message: str = "Invalid GitHub API request (HTTP 422).",
        **kwargs,
    ):
        super().__init__(
            message=message,
            code="INVALID_GITHUB_REQUEST",
            status_code=422,
            recoverable=False,
            **kwargs,
        )


class GitHubServerError(GitHubError):
    """Raised when GitHub returns 5xx."""
    code: str = "GITHUB_SERVER_ERROR"
    status_code: int = 502
    recoverable: bool = True

    def __init__(
        self,
        message: str = "GitHub service is currently unavailable (HTTP 5xx). Please try again later.",
        **kwargs,
    ):
        super().__init__(
            message=message,
            code="GITHUB_SERVER_ERROR",
            status_code=502,
            recoverable=True,
            **kwargs,
        )


class GitHubTimeoutError(GitHubError):
    """Raised when communication with GitHub times out."""
    code: str = "GITHUB_TIMEOUT"
    status_code: int = 504
    recoverable: bool = True

    def __init__(
        self,
        message: str = "GitHub request timed out. Please check your network connection and try again.",
        **kwargs,
    ):
        super().__init__(
            message=message,
            code="GITHUB_TIMEOUT",
            status_code=504,
            recoverable=True,
            **kwargs,
        )


# =====================================================================
# GitHub Client
# =====================================================================

class GitHubClient:
    """
    Client for querying GitHub API and fetching repository source trees.
    Includes bounded exponential backoff for transient failures and rate limits.
    """

    def __init__(
        self,
        token: Optional[str] = None,
        timeout: Optional[float] = None,
        max_files: Optional[int] = None,
        max_file_size_bytes: Optional[int] = None,
        api_base_url: Optional[str] = None,
        http_client: Optional[httpx.Client] = None,
    ):
        settings = get_settings()
        self.token = token if token is not None else settings.github_token
        self.timeout = timeout or getattr(settings, "github_request_timeout_seconds", DEFAULT_TIMEOUT_SECONDS)
        self.max_files = max_files or getattr(settings, "max_files_per_repo", DEFAULT_MAX_REPO_FILES)
        self.max_file_size_bytes = max_file_size_bytes or getattr(settings, "max_file_size_bytes", DEFAULT_MAX_FILE_SIZE)
        self.api_base_url = (api_base_url or getattr(settings, "github_api_base_url", DEFAULT_GITHUB_API_BASE_URL)).rstrip("/")
        self._client = http_client

    def _get_headers(self, accept: str = "application/vnd.github.v3+json") -> Dict[str, str]:
        """
        Build request headers with optional GitHub authorization token.
        Never logs or exposes the raw token.
        """
        headers = {
            "Accept": accept,
            "User-Agent": "CodeRAG-Assistant/1.0.0",
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

    def _request_with_retry(
        self,
        method: str,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        params: Optional[Dict[str, Any]] = None,
        max_retries: int = 3,
    ) -> httpx.Response:
        """
        Execute an HTTP request with bounded exponential backoff on transient errors (429, 502, 503, 504, timeout).
        """
        client = self._get_http_client()
        req_headers = headers or self._get_headers()

        last_err: Optional[Exception] = None
        for attempt in range(1, max_retries + 1):
            try:
                if method.upper() == "GET":
                    resp = client.get(url, headers=req_headers, params=params)
                else:
                    resp = client.request(method, url, headers=req_headers, params=params)

                # Check for transient server errors (502, 503, 504)
                if resp.status_code in (502, 503, 504) and attempt < max_retries:
                    wait_sec = attempt * 1.5
                    logger.warning(
                        f"GitHub API returned HTTP {resp.status_code} on attempt {attempt}/{max_retries}. Retrying in {wait_sec}s..."
                    )
                    time.sleep(wait_sec)
                    continue

                # Check for secondary rate limit with Retry-After header
                if resp.status_code in (403, 429) and attempt < max_retries:
                    retry_after = resp.headers.get("retry-after")
                    if retry_after and retry_after.isdigit():
                        wait_sec = min(float(retry_after), 10.0)
                        logger.warning(f"GitHub rate limit retry-after {wait_sec}s on attempt {attempt}/{max_retries}...")
                        time.sleep(wait_sec)
                        continue

                return resp
            except httpx.TimeoutException as time_err:
                last_err = time_err
                if attempt < max_retries:
                    wait_sec = attempt * 1.5
                    logger.warning(
                        f"GitHub request timeout on attempt {attempt}/{max_retries}. Retrying in {wait_sec}s..."
                    )
                    time.sleep(wait_sec)
                    continue
                raise GitHubTimeoutError(
                    "GitHub request timed out. Please check your network connection and try again."
                ) from time_err
            except (httpx.NetworkError, httpx.RemoteProtocolError) as net_err:
                last_err = net_err
                if attempt < max_retries:
                    wait_sec = attempt * 1.5
                    logger.warning(
                        f"GitHub network error on attempt {attempt}/{max_retries} ({net_err}). Retrying in {wait_sec}s..."
                    )
                    time.sleep(wait_sec)
                    continue
                break

        if last_err:
            raise GitHubError(f"Network error communicating with GitHub API: {last_err}") from last_err
        raise GitHubError("Failed to communicate with GitHub API after retries.")

    def _handle_response_errors(
        self,
        response: httpx.Response,
        owner: str,
        repo: str,
        branch: Optional[str] = None,
        default_branch: Optional[str] = None,
    ) -> None:
        """
        Translate HTTP status codes to descriptive domain exceptions with structured error codes.
        Distinguishes empty repository (HTTP 409), wrong branch (404), auth (401), rate limits (403/429), etc.
        """
        if response.status_code == 200:
            return

        body_text = response.text or ""
        body_lower = body_text.lower()

        if response.status_code == 404:
            if branch and default_branch and branch != default_branch:
                raise BranchNotFoundError(
                    branch=branch,
                    default_branch=default_branch,
                    message=f"The selected branch '{branch}' does not exist. Available/default branch: '{default_branch}'."
                )
            raise RepositoryNotFoundError(
                f"Repository '{owner}/{repo}' not found on GitHub. "
                "Please verify the repository owner and name or check access permissions."
            )

        if response.status_code == 401:
            raise GitHubAuthError(
                "GitHub authentication failed. Your configured GITHUB_TOKEN is invalid or expired."
            )

        if response.status_code == 403:
            # Check if rate limit was exceeded
            rate_limit_remaining = response.headers.get("x-ratelimit-remaining")
            if rate_limit_remaining == "0" or "rate limit" in body_lower or "secondary rate" in body_lower:
                raise RateLimitExceededError(
                    "GitHub API rate limit exceeded. "
                    "Configure a personal GITHUB_TOKEN in your .env file to increase limit to 5,000 requests/hour."
                )
            raise RepositoryAccessDeniedError(
                f"Access denied to repository '{owner}/{repo}'. "
                "If this is a private repository, ensure your GITHUB_TOKEN has 'repo' read permissions."
            )

        if response.status_code == 409:
            # GitHub returns HTTP 409 for "Git Repository is empty" on Git trees and commits endpoints
            if "git repository is empty" in body_lower or "repository is empty" in body_lower or "empty" in body_lower:
                logger.info(f"[GitHub] Repository {owner}/{repo} has no commits (HTTP 409: Git Repository is empty)")
                raise EmptyRepositoryError(
                    "This GitHub repository is empty. Add at least one committed file before analyzing it."
                )
            raise GitHubConflictError(
                f"GitHub conflict error (HTTP 409): {body_text[:200]}"
            )

        if response.status_code == 422:
            raise GitHubInvalidRequestError(
                f"Invalid GitHub API request (HTTP 422): {body_text[:200]}"
            )

        if response.status_code == 429:
            raise RateLimitExceededError(
                "GitHub API rate limit exceeded (HTTP 429). Configure a personal GITHUB_TOKEN in backend .env."
            )

        if response.status_code >= 500:
            raise GitHubServerError(
                f"GitHub service is currently unavailable (HTTP {response.status_code}). Please try again later."
            )

        raise GitHubError(
            f"GitHub API returned error HTTP {response.status_code}: {body_text[:200]}"
        )

    def get_repository_metadata(self, owner: str, repo: str) -> Dict[str, Any]:
        """
        Retrieve public metadata for a repository.
        Inspects size, default_branch, pushed_at, etc.
        """
        url = f"{self.api_base_url}/repos/{owner}/{repo}"
        logger.info(f"[GitHub] Validating repository {owner}/{repo}")

        resp = self._request_with_retry("GET", url)
        self._handle_response_errors(resp, owner, repo)

        data = resp.json()
        default_branch = data.get("default_branch") or "main"
        size_kb = data.get("size", 0)
        pushed_at = data.get("pushed_at")

        logger.info(
            f"[GitHub] Repository found: {owner}/{repo} "
            f"(default_branch={default_branch}, size={size_kb}KB, pushed_at={pushed_at})"
        )

        return {
            "id": data.get("id"),
            "owner": data.get("owner", {}).get("login", owner),
            "name": data.get("name", repo),
            "full_name": data.get("full_name", f"{owner}/{repo}"),
            "default_branch": default_branch,
            "is_private": data.get("private", False),
            "description": data.get("description"),
            "size_kb": size_kb,
            "stars_count": data.get("stargazers_count", 0),
            "forks_count": data.get("forks_count", 0),
            "open_issues_count": data.get("open_issues_count", 0),
            "language": data.get("language"),
            "html_url": data.get("html_url", f"https://github.com/{owner}/{repo}"),
            "pushed_at": pushed_at,
        }

    def validate_url(self, repo_url: str, branch: Optional[str] = None) -> Dict[str, Any]:
        """
        Validate URL syntax, verify existence on GitHub, verify default branch,
        and check whether target branch exists.
        """
        identity = parse_github_url(repo_url)
        meta = self.get_repository_metadata(identity.owner, identity.name)

        target_branch = branch or meta["default_branch"]

        # Check for empty repository metadata signature (size=0 and pushed_at is None)
        if meta.get("size_kb", 0) == 0 and meta.get("pushed_at") is None:
            logger.info(f"[GitHub] Repository {identity.full_name} has size=0 and no pushed_at -> EMPTY_REPOSITORY")
            raise EmptyRepositoryError(
                "This GitHub repository is empty. Add at least one committed file before analyzing it."
            )

        # Check if the requested branch exists
        logger.info(f"[GitHub] Checking repository history and branch '{target_branch}' for {identity.full_name}")
        branch_url = f"{self.api_base_url}/repos/{identity.owner}/{identity.name}/branches/{target_branch}"
        branch_resp = self._request_with_retry("GET", branch_url)

        if branch_resp.status_code == 404:
            logger.warning(f"[GitHub] Branch '{target_branch}' not found in {identity.full_name}")
            raise BranchNotFoundError(
                branch=target_branch,
                default_branch=meta["default_branch"],
                message=f"The selected branch '{target_branch}' does not exist. Available/default branch: '{meta['default_branch']}'."
            )

        self._handle_response_errors(
            branch_resp,
            identity.owner,
            identity.name,
            branch=target_branch,
            default_branch=meta["default_branch"],
        )

        meta["selected_branch"] = target_branch
        meta["repository_id"] = identity.repository_id
        return meta

    def fetch_branch_tree(
        self,
        owner: str,
        repo: str,
        branch: str,
        default_branch: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Fetch the recursive Git tree for the specified branch in a single fast API call.
        Catches HTTP 409 ("Git Repository is empty") and converts to EmptyRepositoryError.
        """
        url = f"{self.api_base_url}/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
        logger.info(f"[GitHub] Fetching Git tree for {owner}/{repo} (branch={branch})...")

        resp = self._request_with_retry("GET", url)
        self._handle_response_errors(resp, owner, repo, branch=branch, default_branch=default_branch)

        data = resp.json()
        tree = data.get("tree", [])

        if not tree:
            logger.info(f"[GitHub] Git tree returned 0 items for {owner}/{repo}@{branch} -> EMPTY_REPOSITORY")
            raise EmptyRepositoryError(
                "This GitHub repository is empty. Add at least one committed file before analyzing it."
            )

        if data.get("truncated", False):
            logger.warning(
                f"[GitHub] Repository tree for {owner}/{repo} was truncated by GitHub API (very large repository)."
            )

        logger.info(f"[GitHub] Tree retrieved for {owner}/{repo}@{branch}: {len(tree)} git objects.")
        return tree

    def fetch_file_content(self, owner: str, repo: str, file_path: str, ref: str) -> str:
        """
        Fetch raw text content for a single repository file.
        """
        # If authenticated, use contents API with raw accept header to support private repos
        if self.token and self.token.strip():
            url = f"{self.api_base_url}/repos/{owner}/{repo}/contents/{file_path}?ref={ref}"
            headers = self._get_headers(accept="application/vnd.github.v3.raw")
        else:
            # For public repos, raw.githubusercontent.com is fast and direct
            url = f"{RAW_GITHUB_BASE_URL}/{owner}/{repo}/{ref}/{file_path}"
            headers = self._get_headers(accept="text/plain")

        resp = self._request_with_retry("GET", url, headers=headers)

        if resp.status_code == 404:
            raise RepositoryNotFoundError(f"File '{file_path}' not found at ref '{ref}'.")

        self._handle_response_errors(resp, owner, repo)

        # Decode content safely
        try:
            return resp.text
        except UnicodeDecodeError:
            return resp.content.decode("utf-8", errors="replace")

    def fetch_repository_manifest(
        self,
        owner: str,
        repo: str,
        branch: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Fetch lightweight repository manifest (tree paths, types, sizes, languages, commit SHA)
        without downloading source file bodies. Instant and rate-limit friendly.

        Validates tree existence and filters out non-source files.
        Raises EmptyRepositoryError if repository is empty.
        Raises NoSupportedSourceFilesError if no supported source code files are found.
        """
        meta = self.get_repository_metadata(owner, repo)
        selected_branch = branch or meta["default_branch"]

        tree = self.fetch_branch_tree(owner, repo, selected_branch, default_branch=meta["default_branch"])
        eligible_files: List[Dict[str, Any]] = []
        directories: set = set()
        languages_count: Dict[str, int] = {}

        for item in tree:
            if item.get("type") != "blob":
                if item.get("type") == "tree":
                    directories.add(item.get("path", ""))
                continue

            file_path = item.get("path", "")
            size_bytes = item.get("size", 0)
            sha = item.get("sha")

            # Check secret/sensitive rules
            if is_secret_or_sensitive_filename(file_path):
                continue

            parts = file_path.split("/")
            if any(part in DEFAULT_IGNORED_DIRS or part.startswith(".") for part in parts[:-1]):
                continue

            filename = parts[-1]
            if filename in DEFAULT_IGNORED_FILES or filename.lower().endswith((".min.js", ".min.css", ".bundle.js", ".map")):
                continue

            ext = Path(filename).suffix.lower()
            language = DEFAULT_EXTENSION_MAP.get(ext) or DEFAULT_EXACT_FILENAME_MAP.get(filename.lower())
            if not language:
                continue

            if size_bytes > self.max_file_size_bytes:
                continue

            parent_dir = "/".join(parts[:-1])
            if parent_dir:
                directories.add(parent_dir)

            languages_count[language] = languages_count.get(language, 0) + 1

            eligible_files.append({
                "path": file_path,
                "type": "file",
                "language": language,
                "size_bytes": size_bytes,
                "sha": sha,
            })

        logger.info(
            f"[GitHub] Filtered source files for {owner}/{repo}@{selected_branch}: "
            f"{len(eligible_files)} eligible source files across {len(directories)} directories."
        )

        if len(eligible_files) == 0:
            logger.info(f"[GitHub] No supported source files found in {owner}/{repo}@{selected_branch}")
            raise NoSupportedSourceFilesError(
                "Repository contains no supported source-code files."
            )

        return {
            "repository_id": f"{owner}__{repo}".lower(),
            "owner": owner,
            "name": repo,
            "full_name": f"{owner}/{repo}",
            "branch": selected_branch,
            "selected_branch": selected_branch,
            "total_files": len(eligible_files),
            "files": eligible_files,
            "directories": sorted(list(directories)),
            "languages": languages_count,
            "default_branch": meta["default_branch"],
            "description": meta.get("description"),
            "stars_count": meta.get("stars_count", 0),
            "forks_count": meta.get("forks_count", 0),
        }

    def fetch_files_by_paths(
        self,
        owner: str,
        repo: str,
        file_paths: List[str],
        ref: str,
    ) -> List[DiscoveredFile]:
        """
        Fetch text content only for the specified candidate file paths.
        Fault-tolerant: skips any unreadable/missing file without failing the entire batch.
        """
        discovered: List[DiscoveredFile] = []
        for file_path in file_paths:
            try:
                content = self.fetch_file_content(owner, repo, file_path, ref=ref)
                filename = file_path.split("/")[-1]
                ext = Path(filename).suffix.lower()
                language = DEFAULT_EXTENSION_MAP.get(ext) or DEFAULT_EXACT_FILENAME_MAP.get(filename.lower(), "unknown")
                line_count = len(content.splitlines()) if content else 0

                discovered.append(
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
                logger.warning(f"Fault-tolerant fetch skip for candidate file '{file_path}': {e}")
                continue

        logger.info(f"Fetched content for {len(discovered)}/{len(file_paths)} candidate files from {owner}/{repo}@{ref}.")
        return discovered

    def fetch_repository_source_files(
        self,
        owner: str,
        repo: str,
        branch: Optional[str] = None,
    ) -> List[DiscoveredFile]:
        """
        Discover eligible source files in the repository tree and download their contents.
        Applies extension whitelist, directory blacklist, secret pattern blacklist, and size limits.
        """
        meta = self.get_repository_metadata(owner, repo)
        selected_branch = branch or meta["default_branch"]

        tree = self.fetch_branch_tree(owner, repo, selected_branch, default_branch=meta["default_branch"])
        eligible_entries: List[Dict[str, Any]] = []

        for item in tree:
            # Only process file blobs
            if item.get("type") != "blob":
                continue

            file_path = item.get("path", "")
            size_bytes = item.get("size", 0)

            # Check secret and sensitive filename rules
            if is_secret_or_sensitive_filename(file_path):
                logger.debug(f"Skipping secret/sensitive file '{file_path}'")
                continue

            # Check directory ignore rules
            parts = file_path.split("/")
            if any(part in DEFAULT_IGNORED_DIRS or part.startswith(".") for part in parts[:-1]):
                continue

            filename = parts[-1]
            if filename in DEFAULT_IGNORED_FILES or filename.lower().endswith((".min.js", ".min.css", ".bundle.js", ".map")):
                continue

            ext = Path(filename).suffix.lower()
            language = DEFAULT_EXTENSION_MAP.get(ext) or DEFAULT_EXACT_FILENAME_MAP.get(filename.lower())
            if not language:
                continue

            if size_bytes > self.max_file_size_bytes:
                logger.debug(f"Skipping oversized GitHub file '{file_path}' ({size_bytes} bytes)")
                continue

            eligible_entries.append(item)

        if len(eligible_entries) == 0:
            logger.info(f"[GitHub] No supported source files found in {owner}/{repo}@{selected_branch}")
            raise NoSupportedSourceFilesError("Repository contains no supported source-code files.")

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
        url = f"{self.api_base_url}/repos/{owner}/{repo}/commits"
        params: Dict[str, Any] = {
            "page": max(1, page),
            "per_page": min(100, max(1, per_page)),
        }
        if branch:
            params["sha"] = branch
        if path:
            params["path"] = path

        logger.info(f"[GitHub] Listing commits for {owner}/{repo} (branch={branch}, path={path}, page={page})...")
        resp = self._request_with_retry("GET", url, params=params)
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

        url = f"{self.api_base_url}/repos/{owner}/{repo}/commits/{commit_sha}"
        logger.info(f"[GitHub] Fetching commit details for {owner}/{repo}@{commit_sha[:7]}...")

        resp = self._request_with_retry("GET", url)
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

        url = f"{self.api_base_url}/repos/{owner}/{repo}/compare/{base}...{head}"
        logger.info(f"[GitHub] Comparing revisions {base}...{head} on {owner}/{repo}...")

        resp = self._request_with_retry("GET", url)
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
