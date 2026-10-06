"""
Diff Analysis and Commit Intelligence Service.

Parses unified diff patches, analyzes file-level code modifications,
enforces safety limits on large diffs, and prepares structured evidence
for history-aware LLM retrieval.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import re

from app.schemas.commit import CommitFileChange, CommitDetail
from app.utils.logger import get_logger

logger = get_logger(__name__)

MAX_DIFF_PATCH_LINES = 300
MAX_DIFF_PATCH_BYTES = 30 * 1024  # 30 KB per file patch


@dataclass
class DiffHunk:
    """Represents a single unified diff hunk (e.g. @@ -10,5 +10,8 @@)."""
    old_start: int
    old_lines: int
    new_start: int
    new_lines: int
    header: str
    added_lines: List[str] = field(default_factory=list)
    deleted_lines: List[str] = field(default_factory=list)
    context_lines: List[str] = field(default_factory=list)


@dataclass
class FileDiffSummary:
    """Summarizes code modifications for a single file in a commit."""
    filename: str
    status: str  # added, modified, removed, renamed
    additions: int
    deletions: int
    hunks_count: int
    key_modified_symbols: List[str] = field(default_factory=list)
    snippet: str = ""
    truncated: bool = False


class DiffAnalysisService:
    """
    Service responsible for parsing diff patches, extracting semantic
    change insights, and enforcing size constraints.
    """

    HUNK_HEADER_REGEX = re.compile(
        r"^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$"
    )
    # Detect function or class definitions in hunk headers or added lines
    SYMBOL_DEF_REGEX = re.compile(
        r"(?:def|class|function|async\s+def|interface|type|const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)"
    )

    def parse_patch(self, patch: Optional[str]) -> List[DiffHunk]:
        """
        Parse raw unified diff text into a list of structured DiffHunk objects.
        """
        if not patch:
            return []

        hunks: List[DiffHunk] = []
        current_hunk: Optional[DiffHunk] = None

        for line in patch.splitlines():
            if line.startswith("@@"):
                match = self.HUNK_HEADER_REGEX.match(line)
                if match:
                    old_start = int(match.group(1))
                    old_lines = int(match.group(2) or 1)
                    new_start = int(match.group(3))
                    new_lines = int(match.group(4) or 1)
                    header = match.group(5).strip()

                    current_hunk = DiffHunk(
                        old_start=old_start,
                        old_lines=old_lines,
                        new_start=new_start,
                        new_lines=new_lines,
                        header=header,
                    )
                    hunks.append(current_hunk)
                    continue

            if current_hunk is not None:
                if line.startswith("+") and not line.startswith("+++"):
                    current_hunk.added_lines.append(line[1:])
                elif line.startswith("-") and not line.startswith("---"):
                    current_hunk.deleted_lines.append(line[1:])
                else:
                    current_hunk.context_lines.append(line[1:] if line.startswith(" ") else line)

        return hunks

    def sanitize_and_cap_patch(self, patch: Optional[str]) -> tuple[Optional[str], bool]:
        """
        Enforce line and byte caps on a single file patch to prevent prompt overflow.
        Returns (capped_patch, is_truncated).
        """
        if not patch:
            return None, False

        patch_bytes = len(patch.encode("utf-8"))
        lines = patch.splitlines()

        if len(lines) <= MAX_DIFF_PATCH_LINES and patch_bytes <= MAX_DIFF_PATCH_BYTES:
            return patch, False

        # Cap lines
        capped_lines = lines[:MAX_DIFF_PATCH_LINES]
        capped_text = "\n".join(capped_lines)
        if len(capped_text.encode("utf-8")) > MAX_DIFF_PATCH_BYTES:
            capped_text = capped_text[:MAX_DIFF_PATCH_BYTES]

        capped_text += f"\n... [Diff truncated: {len(lines) - len(capped_lines)} lines omitted to respect model context limit]"
        return capped_text, True

    def summarize_commit_diff(self, commit: CommitDetail) -> Dict[str, Any]:
        """
        Produce a high-level semantic summary of all changed files in a commit.
        """
        files_summary: List[FileDiffSummary] = []
        all_symbols_seen = set()

        for f in commit.files:
            hunks = self.parse_patch(f.patch)
            symbols = []

            # Check hunk headers and added lines for symbol definitions
            for h in hunks:
                if h.header:
                    header_syms = self.SYMBOL_DEF_REGEX.findall(h.header)
                    symbols.extend(header_syms)
                for added in h.added_lines[:15]:
                    add_syms = self.SYMBOL_DEF_REGEX.findall(added)
                    symbols.extend(add_syms)

            # Deduplicate symbols
            dedup_symbols = list(dict.fromkeys(symbols))[:5]
            all_symbols_seen.update(dedup_symbols)

            snippet = ""
            if f.patch:
                snippet = "\n".join(f.patch.splitlines()[:10])

            files_summary.append(
                FileDiffSummary(
                    filename=f.filename,
                    status=f.status,
                    additions=f.additions,
                    deletions=f.deletions,
                    hunks_count=len(hunks),
                    key_modified_symbols=dedup_symbols,
                    snippet=snippet,
                    truncated=f.patch_truncated,
                )
            )

        return {
            "sha": commit.sha,
            "short_sha": commit.short_sha,
            "total_files": len(commit.files),
            "additions": commit.stats.additions,
            "deletions": commit.stats.deletions,
            "symbols_touched": list(all_symbols_seen),
            "files": files_summary,
        }

    def format_commit_evidence_for_prompt(self, commit: CommitDetail) -> str:
        """
        Build an XML-wrapped untrusted evidence block suitable for the LLM prompt.
        """
        lines = [
            "<untrusted_commit_metadata>",
            f"Commit SHA: {commit.sha} ({commit.short_sha})",
            f"Author: {commit.author.name} <{commit.author.email or 'no-email'}> on {commit.author.date}",
            f"Message: {commit.message.strip()}",
            f"Parents: {', '.join(commit.parents) if commit.parents else 'None (Root Commit)'}",
            f"Stats: +{commit.stats.additions} / -{commit.stats.deletions} across {len(commit.files)} file(s)",
            "</untrusted_commit_metadata>",
            "",
            "<untrusted_diff_evidence>",
        ]

        for f in commit.files:
            lines.append(f"--- File: {f.filename} [{f.status.upper()}] (+{f.additions}, -{f.deletions}) ---")
            if f.previous_filename:
                lines.append(f"    (Renamed from: {f.previous_filename})")
            if f.patch:
                lines.append(f.patch)
            else:
                lines.append("    (No unified diff patch available - file may be binary, large, or unchanged)")
            lines.append("")

        lines.append("</untrusted_diff_evidence>")
        return "\n".join(lines)


# Singleton factory
_diff_service: Optional[DiffAnalysisService] = None


def get_diff_service() -> DiffAnalysisService:
    global _diff_service
    if _diff_service is None:
        _diff_service = DiffAnalysisService()
    return _diff_service
