"""
Unit tests for FileScanner source file discovery.
"""

from pathlib import Path
import tempfile
import pytest

from app.rag.file_scanner import FileScanner, DiscoveredFile


def test_scanner_discovers_sample_repo():
    """
    Test scanning the sample_repo directory finds the expected sample files.
    """
    scanner = FileScanner()
    root = Path(__file__).resolve().parent.parent.parent / "sample_code" / "sample_repo"

    files = scanner.scan_directory(root)
    assert len(files) >= 4

    paths = [f.path for f in files]
    assert "auth.py" in paths
    assert "database.py" in paths
    assert "user_service.py" in paths
    assert "main.py" in paths

    # Check language mapping
    for f in files:
        if f.path.endswith(".py"):
            assert f.language == "python"
        assert f.line_count > 0
        assert f.size_bytes > 0


def test_scanner_ignores_blacklisted_directories():
    """
    Verify that ignored directories (.git, .venv, node_modules, __pycache__) are skipped.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        base = Path(tmpdir)

        # Valid source file
        (base / "valid.py").write_text("print('hello')", encoding="utf-8")

        # Files in ignored directories
        git_dir = base / ".git"
        git_dir.mkdir()
        (git_dir / "HEAD.py").write_text("invalid", encoding="utf-8")

        venv_dir = base / ".venv" / "lib"
        venv_dir.mkdir(parents=True)
        (venv_dir / "pkg.py").write_text("invalid", encoding="utf-8")

        pycache_dir = base / "__pycache__"
        pycache_dir.mkdir()
        (pycache_dir / "mod.cpython-313.pyc").write_text("invalid", encoding="utf-8")

        scanner = FileScanner()
        discovered = scanner.scan_directory(base)

        discovered_names = [f.path for f in discovered]
        assert discovered_names == ["valid.py"]


def test_scanner_ignores_unsupported_extensions_and_env_files():
    """
    Verify binary or ignored file extensions are excluded.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        base = Path(tmpdir)

        (base / "valid.java").write_text("class Test {}", encoding="utf-8")
        (base / "image.png").write_bytes(b"\x89PNG\r\n\x1a\n")
        (base / ".env").write_text("SECRET=123", encoding="utf-8")
        (base / ".env.local").write_text("SECRET=123", encoding="utf-8")
        (base / "app.exe").write_bytes(b"binary")

        scanner = FileScanner()
        discovered = scanner.scan_directory(base)

        discovered_names = [f.path for f in discovered]
        assert discovered_names == ["valid.java"]


def test_scanner_handles_nonexistent_directory():
    """
    Verify scanner raises ValueError on non-existent path.
    """
    scanner = FileScanner()
    with pytest.raises(ValueError):
        scanner.scan_directory(Path("/nonexistent_directory_abc123"))
