"""
File Scanner and Repository Ingestion Discovery Module.

Safely traverses a local directory or repository workspace, discovers supported
source code files, respects ignore rules and file size limits, and extracts
file metadata without ever executing the code.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import List, Set, Optional, Dict
import os

from app.utils.logger import get_logger

logger = get_logger(__name__)

# Standard language mappings for common file extensions
DEFAULT_EXTENSION_MAP: Dict[str, str] = {
    ".py": "python",
    ".java": "java",
    ".js": "javascript",
    ".jsx": "javascript_react",
    ".ts": "typescript",
    ".tsx": "typescript_react",
    ".c": "c",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".h": "c_header",
    ".hpp": "cpp_header",
    ".go": "go",
    ".rs": "rust",
    ".cs": "csharp",
    ".php": "php",
    ".rb": "ruby",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
    ".sql": "sql",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "scss",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".md": "markdown",
    ".txt": "text",
    ".sh": "shell",
    ".bat": "batch",
    ".ps1": "powershell",
}

# Well-known exact filenames without extensions or special files
DEFAULT_EXACT_FILENAME_MAP: Dict[str, str] = {
    "readme": "markdown",
    "license": "text",
    "dockerfile": "dockerfile",
    "makefile": "makefile",
    "jenkinsfile": "groovy",
    "procfile": "yaml",
}

# Directories that should never be indexed
DEFAULT_IGNORED_DIRS: Set[str] = {
    ".git",
    ".github",
    ".venv",
    "venv",
    "env",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".idea",
    ".vscode",
    "dist",
    "build",
    "target",
    "bin",
    "obj",
    "coverage",
    ".next",
    ".nuxt",
    "qdrant_storage",
    "snapshots",
    "storage",
}

# Files or patterns that should be ignored
DEFAULT_IGNORED_FILES: Set[str] = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "poetry.lock",
    "Pipfile.lock",
    "Cargo.lock",
    "go.sum",
    "composer.lock",
    ".DS_Store",
    "thumbs.db",
}

# Sensitive / Secret file extensions that must NEVER be indexed
SECRET_FILE_EXTENSIONS: Set[str] = {
    ".pem",
    ".key",
    ".pkcs12",
    ".p12",
    ".pfx",
    ".crt",
    ".der",
    ".cer",
    ".keystore",
    ".jks",
    ".token",
    ".secret",
    ".p8",
}

# Sensitive / Secret filename substrings/patterns (lowercase)
SECRET_FILENAME_PATTERNS: Set[str] = {
    ".env",
    "id_rsa",
    "id_ed25519",
    "id_dsa",
    "id_ecdsa",
    "credentials.json",
    "service_account.json",
    "service-account",
    "client_secret",
    "google-services.json",
    "auth.json",
    "secret_key",
    "private_key",
}

DEFAULT_MAX_FILE_SIZE = 512 * 1024  # 512 KB limit per file


def is_secret_or_sensitive_filename(file_name_or_path: str) -> bool:
    """
    Check if a filename or path represents an environment variable file,
    private key, TLS certificate, or secret credential file.
    """
    clean = file_name_or_path.replace("\\", "/").lower().strip()
    name = clean.split("/")[-1]

    # Check .env variants
    if name.startswith(".env") or name == ".env" or ".env." in name:
        return True

    # Check sensitive extensions
    for ext in SECRET_FILE_EXTENSIONS:
        if name.endswith(ext):
            return True

    # Check secret filename patterns
    for pat in SECRET_FILENAME_PATTERNS:
        if pat in name:
            return True

    return False


@dataclass
class DiscoveredFile:
    """
    Represents a discovered and validated source code file.
    """
    path: str  # Relative path to repository root with normalized forward slashes
    absolute_path: Path
    language: str
    content: str
    size_bytes: int
    line_count: int


class FileScanner:
    """
    Scans a directory tree and returns a list of supported source files.
    """

    def __init__(
        self,
        extension_map: Optional[Dict[str, str]] = None,
        ignored_dirs: Optional[Set[str]] = None,
        ignored_files: Optional[Set[str]] = None,
        max_file_size_bytes: int = DEFAULT_MAX_FILE_SIZE,
    ):
        self.extension_map = extension_map or DEFAULT_EXTENSION_MAP
        self.ignored_dirs = ignored_dirs or DEFAULT_IGNORED_DIRS
        self.ignored_files = ignored_files or DEFAULT_IGNORED_FILES
        self.max_file_size_bytes = max_file_size_bytes

    def is_dir_ignored(self, dir_name: str) -> bool:
        """
        Check if directory name matches ignore list.
        """
        return dir_name in self.ignored_dirs or dir_name.startswith(".")

    def is_file_ignored(self, file_path: Path) -> bool:
        """
        Check if file name, secret patterns, or extension should be ignored.
        """
        file_name = file_path.name
        if is_secret_or_sensitive_filename(file_name):
            return True
        if file_name in self.ignored_files:
            return True
        if file_name.lower().endswith((".min.js", ".min.css", ".bundle.js", ".map")):
            return True
        if file_name.lower() in DEFAULT_EXACT_FILENAME_MAP:
            return False
        if file_path.suffix.lower() not in self.extension_map:
            return True
        return False

    def scan_directory(self, root_path: Path) -> List[DiscoveredFile]:
        """
        Recursively scan the root directory and return all discovered source files.
        """
        root = root_path.resolve()
        if not root.exists() or not root.is_dir():
            raise ValueError(f"Target directory does not exist or is not a directory: {root}")

        discovered: List[DiscoveredFile] = []
        logger.info(f"Scanning directory for indexable source files: {root}")

        for dirpath, dirnames, filenames in os.walk(root):
            # Prune ignored directories in-place to avoid descending into them
            dirnames[:] = [d for d in dirnames if not self.is_dir_ignored(d)]

            current_dir = Path(dirpath)

            for filename in filenames:
                file_path = current_dir / filename

                if self.is_file_ignored(file_path):
                    continue

                try:
                    # Check file size before reading
                    stat = file_path.stat()
                    if stat.st_size > self.max_file_size_bytes:
                        logger.warning(
                            f"Skipping file exceeding size limit ({stat.st_size} bytes): {file_path.name}"
                        )
                        continue

                    # Read file safely as text with utf-8 fallback
                    try:
                        content = file_path.read_text(encoding="utf-8")
                    except UnicodeDecodeError:
                        content = file_path.read_text(encoding="latin-1", errors="replace")

                    # Calculate relative path with standard forward slashes
                    rel_path = file_path.relative_to(root).as_posix()
                    ext = file_path.suffix.lower()
                    language = self.extension_map.get(ext) or DEFAULT_EXACT_FILENAME_MAP.get(filename.lower(), "unknown")
                    line_count = len(content.splitlines()) if content else 0

                    discovered.append(
                        DiscoveredFile(
                            path=rel_path,
                            absolute_path=file_path,
                            language=language,
                            content=content,
                            size_bytes=stat.st_size,
                            line_count=line_count,
                        )
                    )

                except Exception as e:
                    logger.warning(f"Error reading source file {file_path}: {e}")
                    continue

        logger.info(f"Discovered {len(discovered)} valid source files in {root}")
        return discovered
