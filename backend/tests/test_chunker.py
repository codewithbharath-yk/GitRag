"""
Unit tests for LineChunker module.
"""

import pytest
from app.rag.chunker import LineChunker, CodeChunk
from app.rag.file_scanner import DiscoveredFile
from pathlib import Path


def test_chunker_empty_content():
    """
    Test that chunking empty content produces an empty list.
    """
    chunker = LineChunker(chunk_size_lines=10, chunk_overlap_lines=2)
    chunks = chunker.chunk_text("", file_path="test.py")
    assert chunks == []

    whitespace_chunks = chunker.chunk_text("   \n\n  \t\n", file_path="test.py")
    assert whitespace_chunks == []


def test_chunker_single_short_file():
    """
    Test that a file smaller than chunk size produces exactly one chunk with accurate lines.
    """
    content = "line 1\nline 2\nline 3\n"
    chunker = LineChunker(chunk_size_lines=10, chunk_overlap_lines=2)

    chunks = chunker.chunk_text(
        content=content,
        file_path="src/hello.py",
        language="python",
        repository_id="repo1",
    )

    assert len(chunks) == 1
    chunk = chunks[0]
    assert chunk.repository_id == "repo1"
    assert chunk.file_path == "src/hello.py"
    assert chunk.language == "python"
    assert chunk.start_line == 1
    assert chunk.end_line == 3
    assert "line 1" in chunk.content
    assert chunk.chunk_id.startswith("chunk_")


def test_chunker_overlapping_lines():
    """
    Test that large files are chunked into multiple overlapping windows with precise line bounds.
    """
    # Create a 25-line string
    lines = [f"Code line {i}" for i in range(1, 26)]
    content = "\n".join(lines)

    # 10 lines per chunk, 2 lines overlap -> step = 8 lines
    chunker = LineChunker(chunk_size_lines=10, chunk_overlap_lines=2)
    chunks = chunker.chunk_text(content=content, file_path="main.py")

    # Expected chunks:
    # Chunk 0: lines 1..10 (start_idx 0..10)
    # Chunk 1: lines 9..18 (start_idx 8..18)
    # Chunk 2: lines 17..25 (start_idx 16..25)
    assert len(chunks) == 3

    assert chunks[0].start_line == 1
    assert chunks[0].end_line == 10

    assert chunks[1].start_line == 9
    assert chunks[1].end_line == 18

    assert chunks[2].start_line == 17
    assert chunks[2].end_line == 25


def test_chunker_invalid_overlap_raises():
    """
    Test that overlap >= chunk size raises a ValueError.
    """
    with pytest.raises(ValueError):
        LineChunker(chunk_size_lines=10, chunk_overlap_lines=10)

    with pytest.raises(ValueError):
        LineChunker(chunk_size_lines=5, chunk_overlap_lines=8)


def test_chunker_with_discovered_file():
    """
    Test chunk_file helper method.
    """
    df = DiscoveredFile(
        path="src/auth.py",
        absolute_path=Path("/abs/src/auth.py"),
        language="python",
        content="def login():\n    pass\n",
        size_bytes=24,
        line_count=2,
    )
    chunker = LineChunker(chunk_size_lines=50, chunk_overlap_lines=10)
    chunks = chunker.chunk_file(df, repository_id="my_repo")

    assert len(chunks) == 1
    assert chunks[0].file_path == "src/auth.py"
    assert chunks[0].start_line == 1
    assert chunks[0].end_line == 2
    assert chunks[0].metadata.get("size_bytes") == 24
