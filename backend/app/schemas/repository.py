"""
Pydantic Schemas for Repository Validation, Ingestion, and Status Endpoints.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class RepoValidateRequest(BaseModel):
    """Request schema for POST /repositories/validate."""
    url: str = Field(..., description="GitHub repository URL or slug (e.g. 'https://github.com/owner/repo')", examples=["https://github.com/octocat/Hello-World"])
    branch: Optional[str] = Field(default=None, description="Optional target branch to validate", examples=["main"])


class RepoValidateResponse(BaseModel):
    """Response schema for POST /repositories/validate."""
    valid: bool = Field(..., description="Whether the repository URL is valid and accessible")
    repository_id: str = Field(..., description="Sanitized unique repository identifier", examples=["octocat__hello-world"])
    owner: str = Field(..., description="Repository owner/organization", examples=["octocat"])
    name: str = Field(..., description="Repository name", examples=["Hello-World"])
    full_name: str = Field(..., description="Full repository name 'owner/repo'", examples=["octocat/Hello-World"])
    default_branch: str = Field(..., description="Repository default branch", examples=["master"])
    selected_branch: str = Field(..., description="Selected branch for indexing", examples=["master"])
    is_private: bool = Field(..., description="Whether the repository is private")
    description: Optional[str] = Field(default=None, description="Repository description")
    size_kb: int = Field(default=0, description="Repository size in KB")
    stars_count: int = Field(default=0, description="GitHub stargazer count")
    forks_count: int = Field(default=0, description="GitHub fork count")
    language: Optional[str] = Field(default=None, description="Primary programming language")
    error: Optional[str] = Field(default=None, description="Error explanation if invalid")


class RepoIndexRequest(BaseModel):
    """Request schema for POST /repositories/index."""
    url: str = Field(..., description="GitHub repository URL (e.g. 'https://github.com/owner/repo')", examples=["https://github.com/octocat/Hello-World"])
    branch: Optional[str] = Field(default=None, description="Optional branch or ref to index", examples=["main"])
    clean_existing: bool = Field(default=True, description="Whether to clear existing vectors for this repo before indexing")


class RepoIndexResponse(BaseModel):
    """Response schema for POST /repositories/index."""
    job_id: str = Field(..., description="Unique job identifier for polling status")
    repository_id: str = Field(..., description="Sanitized unique repository identifier")
    branch: str = Field(..., description="Indexed branch")
    status: str = Field(..., description="Initial status: 'queued', 'indexing', or 'completed'")
    message: str = Field(..., description="Human-readable status summary")


class RepoStatusResponse(BaseModel):
    """Response schema for GET /repositories/{id}/status."""
    repository_id: str = Field(..., description="Repository identifier")
    branch: str = Field(..., description="Target branch")
    status: str = Field(..., description="Status: 'queued', 'indexing', 'completed', or 'failed'")
    files_discovered: int = Field(default=0, description="Total files discovered in repository tree")
    files_indexed: int = Field(default=0, description="Total source files indexed")
    chunks_indexed: int = Field(default=0, description="Total code chunks embedded and stored in Qdrant")
    duration_ms: Optional[float] = Field(default=None, description="Indexing time in milliseconds")
    error: Optional[str] = Field(default=None, description="Error message if indexing failed")


class RepoFileItem(BaseModel):
    """Represents a single indexed source file."""
    path: str = Field(..., description="Relative file path in repository")
    language: str = Field(..., description="Detected programming language")
    chunks_count: int = Field(..., description="Number of vector chunks generated for this file")
    line_count: int = Field(..., description="Total lines in file")


class RepoFilesResponse(BaseModel):
    """Response schema for GET /repositories/{id}/files."""
    repository_id: str = Field(..., description="Repository identifier")
    total_files: int = Field(..., description="Total indexed files")
    files: List[RepoFileItem] = Field(default_factory=list, description="List of indexed files")
