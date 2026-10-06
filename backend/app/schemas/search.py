"""
Semantic Code Search Schemas.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    """Request payload for semantic code search."""
    query: str = Field(..., description="Natural language search query or code snippet description", min_length=1)
    repository_id: Optional[str] = Field(default=None, description="Optional target repository ID to filter")
    branch: Optional[str] = Field(default=None, description="Optional branch filter")
    top_k: int = Field(default=10, ge=1, le=50, description="Maximum number of code chunks to return")
    score_threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Minimum cosine similarity score")


class SearchHit(BaseModel):
    """Individual code chunk search hit."""
    chunk_id: str = Field(..., description="Unique chunk identifier")
    repository_id: str = Field(..., description="Repository identifier")
    file_path: str = Field(..., description="Relative file path in repository")
    language: str = Field(default="text", description="Detected programming language")
    start_line: int = Field(default=1, description="Starting line number")
    end_line: int = Field(default=1, description="Ending line number")
    content: str = Field(..., description="Code snippet content")
    score: float = Field(..., description="Cosine similarity score (0.0 - 1.0)")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional chunk metadata")


class SearchResponse(BaseModel):
    """Response payload for semantic code search."""
    query: str = Field(..., description="Original search query")
    repository_id: Optional[str] = Field(default=None, description="Queried repository ID")
    total_hits: int = Field(..., description="Total matching chunks found")
    hits: List[SearchHit] = Field(default_factory=list, description="Ranked list of search results")
    latency_ms: float = Field(..., description="Search latency in milliseconds")
