"""
Pydantic Schemas for Git History, Commits, Diffs, and History Intelligence.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class CommitAuthor(BaseModel):
    """Metadata describing the author of a commit."""
    name: str = Field(..., description="Author display name")
    email: Optional[str] = Field(default=None, description="Author email address")
    date: str = Field(..., description="Commit authoring timestamp in ISO format")
    login: Optional[str] = Field(default=None, description="GitHub username if linked")
    avatar_url: Optional[str] = Field(default=None, description="Author GitHub avatar URL")


class CommitStats(BaseModel):
    """Aggregate line additions and deletions for a commit."""
    total: int = Field(default=0, description="Total changed lines")
    additions: int = Field(default=0, description="Total added lines")
    deletions: int = Field(default=0, description="Total deleted lines")


class CommitFileChange(BaseModel):
    """Represents a single changed file within a commit."""
    filename: str = Field(..., description="Relative file path in repository")
    status: str = Field(
        ...,
        description="Change status: 'added', 'modified', 'removed', or 'renamed'",
        examples=["modified"],
    )
    additions: int = Field(default=0, description="Number of lines added")
    deletions: int = Field(default=0, description="Number of lines deleted")
    changes: int = Field(default=0, description="Total changes for this file")
    patch: Optional[str] = Field(default=None, description="Unified diff patch snippet")
    patch_truncated: bool = Field(default=False, description="True if diff patch was capped to prevent excessive token usage")
    previous_filename: Optional[str] = Field(default=None, description="Original filename if renamed")


class CommitItem(BaseModel):
    """Summary representation of a commit for paginated listings."""
    sha: str = Field(..., description="Full 40-character commit SHA")
    short_sha: str = Field(..., description="7-character truncated SHA")
    message: str = Field(..., description="Full commit log message")
    author: CommitAuthor = Field(..., description="Commit author details")
    parents: List[str] = Field(default_factory=list, description="List of parent commit SHAs")
    html_url: str = Field(..., description="Web link to view commit on GitHub")
    stats: Optional[CommitStats] = Field(default=None, description="Optional line stats if included")


class CommitListResponse(BaseModel):
    """Response schema for GET /repositories/{id}/commits."""
    repository_id: str = Field(..., description="Repository identifier")
    branch: Optional[str] = Field(default=None, description="Queried branch or revision")
    path: Optional[str] = Field(default=None, description="Optional path filter applied")
    page: int = Field(default=1, description="Current page number")
    per_page: int = Field(default=30, description="Page size limit")
    total_returned: int = Field(..., description="Count of commits in this page")
    commits: List[CommitItem] = Field(default_factory=list, description="List of commit summaries")


class CommitDetail(BaseModel):
    """Detailed representation of a commit with files and patch diffs."""
    repository_id: str = Field(..., description="Repository identifier")
    sha: str = Field(..., description="Full 40-character commit SHA")
    short_sha: str = Field(..., description="7-character truncated SHA")
    message: str = Field(..., description="Full commit log message")
    author: CommitAuthor = Field(..., description="Commit author details")
    parents: List[str] = Field(default_factory=list, description="List of parent commit SHAs")
    html_url: str = Field(..., description="Web link to view commit on GitHub")
    stats: CommitStats = Field(..., description="Line addition and deletion counts")
    files: List[CommitFileChange] = Field(default_factory=list, description="List of changed files with diff patches")


class CommitCompareResponse(BaseModel):
    """Response schema for comparing two commits or revisions."""
    repository_id: str = Field(..., description="Repository identifier")
    base_commit: str = Field(..., description="Base revision SHA or branch")
    head_commit: str = Field(..., description="Head revision SHA or branch")
    status: str = Field(..., description="Relationship: 'ahead', 'behind', 'diverged', or 'identical'")
    ahead_by: int = Field(default=0, description="Number of commits ahead")
    behind_by: int = Field(default=0, description="Number of commits behind")
    total_commits: int = Field(default=0, description="Total commits between base and head")
    files: List[CommitFileChange] = Field(default_factory=list, description="List of changed files in comparison")


class CommitExplainRequest(BaseModel):
    """Request schema to explain a specific commit using Gemini."""
    detail_level: Optional[str] = Field(
        default="standard",
        description="Depth of explanation: 'concise', 'standard', or 'deep'",
    )


class CommitExplainResponse(BaseModel):
    """Response schema providing an AI-synthesized explanation of a commit."""
    repository_id: str = Field(..., description="Repository identifier")
    commit_sha: str = Field(..., description="Full commit SHA")
    short_sha: str = Field(..., description="7-character truncated SHA")
    message: str = Field(..., description="Original commit message")
    explanation: str = Field(..., description="Evidence-backed explanation of the commit")
    observed_changes: List[str] = Field(default_factory=list, description="Directly observed code modifications")
    inferred_intent: Optional[str] = Field(default=None, description="Cautious inference of author motivation or architectural impact")
    files_analyzed: List[str] = Field(default_factory=list, description="List of file paths inspected in the diff")
    latency_ms: float = Field(..., description="Round-trip latency in milliseconds")


class HistoryChatRequest(BaseModel):
    """Request schema for asking history-aware questions."""
    question: str = Field(..., description="Natural language question about Git history or changes")
    commit_sha: Optional[str] = Field(default=None, description="Optional specific commit SHA to inspect")
    path: Optional[str] = Field(default=None, description="Optional file path to focus history on")
    branch: Optional[str] = Field(default=None, description="Optional branch context")


class HistoryChatResponse(BaseModel):
    """Response schema for history-aware queries."""
    question: str = Field(..., description="Original user question")
    repository_id: str = Field(..., description="Repository queried")
    commit_sha: Optional[str] = Field(default=None, description="Focal commit SHA if provided")
    answer: str = Field(..., description="Evidence-based explanation of the historical changes")
    referenced_commits: List[str] = Field(default_factory=list, description="List of commit SHAs cited in the answer")
    referenced_files: List[str] = Field(default_factory=list, description="List of file paths cited in the answer")
    insufficient_evidence: bool = Field(default=False, description="True if available history was insufficient to answer")
    latency_ms: float = Field(..., description="Round-trip latency in milliseconds")
