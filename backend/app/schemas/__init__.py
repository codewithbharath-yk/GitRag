"""
Pydantic Schemas and Data Models for CodeRAG API.
"""

from app.schemas.health import HealthResponse
from app.schemas.repository import (
    RepoValidateRequest,
    RepoValidateResponse,
    RepoIndexRequest,
    RepoIndexResponse,
    RepoStatusResponse,
    RepoFileItem,
    RepoFilesResponse,
)
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    SourceCitationSchema,
)
from app.schemas.commit import (
    CommitAuthor,
    CommitStats,
    CommitFileChange,
    CommitItem,
    CommitListResponse,
    CommitDetail,
    CommitCompareResponse,
    CommitExplainRequest,
    CommitExplainResponse,
    HistoryChatRequest,
    HistoryChatResponse,
)

from app.schemas.search import (
    SearchRequest,
    SearchResponse,
    SearchHit,
)

__all__ = [
    "HealthResponse",
    "RepoValidateRequest",
    "RepoValidateResponse",
    "RepoIndexRequest",
    "RepoIndexResponse",
    "RepoStatusResponse",
    "RepoFileItem",
    "RepoFilesResponse",
    "ChatRequest",
    "ChatResponse",
    "SourceCitationSchema",
    "CommitAuthor",
    "CommitStats",
    "CommitFileChange",
    "CommitItem",
    "CommitListResponse",
    "CommitDetail",
    "CommitCompareResponse",
    "CommitExplainRequest",
    "CommitExplainResponse",
    "HistoryChatRequest",
    "HistoryChatResponse",
    "SearchRequest",
    "SearchResponse",
    "SearchHit",
]
