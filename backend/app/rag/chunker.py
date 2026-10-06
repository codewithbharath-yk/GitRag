"""
Code Chunking Module.

Splits source files into manageable, overlapping code blocks while preserving
accurate line ranges, relative file paths, and language metadata.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import hashlib

from app.rag.file_scanner import DiscoveredFile
from app.utils.logger import get_logger

logger = get_logger(__name__)

DEFAULT_CHUNK_SIZE_LINES = 50
DEFAULT_CHUNK_OVERLAP_LINES = 10


@dataclass
class CodeChunk:
    """
    Represents an atomic, indexable chunk of source code.
    """
    chunk_id: str
    repository_id: str
    file_path: str  # Relative path to repository root
    language: str
    start_line: int  # 1-indexed
    end_line: int  # 1-indexed
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def line_count(self) -> int:
        return max(1, self.end_line - self.start_line + 1)


class LineChunker:
    """
    Splits text or source code files into overlapping line-based chunks.
    """

    def __init__(
        self,
        chunk_size_lines: int = DEFAULT_CHUNK_SIZE_LINES,
        chunk_overlap_lines: int = DEFAULT_CHUNK_OVERLAP_LINES,
    ):
        if chunk_overlap_lines >= chunk_size_lines:
            raise ValueError(
                f"Overlap lines ({chunk_overlap_lines}) must be strictly less than chunk size ({chunk_size_lines})"
            )
        self.chunk_size_lines = max(1, chunk_size_lines)
        self.chunk_overlap_lines = max(0, chunk_overlap_lines)

    def _generate_chunk_id(
        self,
        repository_id: str,
        file_path: str,
        start_line: int,
        end_line: int,
    ) -> str:
        """
        Generate a deterministic, collision-resistant identifier for a chunk.
        """
        seed = f"{repository_id}:{file_path}:{start_line}:{end_line}"
        digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16]
        return f"chunk_{digest}"

    def chunk_text(
        self,
        content: str,
        file_path: str,
        language: str = "text",
        repository_id: str = "default",
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[CodeChunk]:
        """
        Split a source code string into a list of CodeChunk objects.
        """
        if not content.strip():
            return []

        lines = content.splitlines(keepends=True)
        total_lines = len(lines)
        if total_lines == 0:
            return []

        chunks: List[CodeChunk] = []
        step = max(1, self.chunk_size_lines - self.chunk_overlap_lines)

        start_idx = 0
        while start_idx < total_lines:
            end_idx = min(start_idx + self.chunk_size_lines, total_lines)
            chunk_lines = lines[start_idx:end_idx]
            chunk_content = "".join(chunk_lines)

            # Skip empty or whitespace-only chunks
            if chunk_content.strip():
                start_line_1 = start_idx + 1
                end_line_1 = end_idx

                chunk_id = self._generate_chunk_id(
                    repository_id=repository_id,
                    file_path=file_path,
                    start_line=start_line_1,
                    end_line=end_line_1,
                )

                meta = {
                    "total_file_lines": total_lines,
                    **(extra_metadata or {}),
                }

                chunks.append(
                    CodeChunk(
                        chunk_id=chunk_id,
                        repository_id=repository_id,
                        file_path=file_path,
                        language=language,
                        start_line=start_line_1,
                        end_line=end_line_1,
                        content=chunk_content,
                        metadata=meta,
                    )
                )

            # If we reached the end of the file, break
            if end_idx >= total_lines:
                break

            start_idx += step

        return chunks

    def chunk_file(
        self,
        file: DiscoveredFile,
        repository_id: str = "default",
        branch: str = "main",
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[CodeChunk]:
        """
        Convenience method to chunk a DiscoveredFile object with branch metadata.
        """
        meta = {
            "branch": branch,
            "size_bytes": file.size_bytes,
            "line_count": file.line_count,
            **(extra_metadata or {}),
        }
        return self.chunk_text(
            content=file.content,
            file_path=file.path,
            language=file.language,
            repository_id=repository_id,
            extra_metadata=meta,
        )

