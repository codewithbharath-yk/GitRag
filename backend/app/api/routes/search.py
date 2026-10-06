"""
Semantic Code Search API Route.

Exposes endpoint for querying indexed code chunks using dense vector embeddings in Qdrant.
"""

import time
from fastapi import APIRouter, HTTPException, Depends, status

from app.auth.models import User
from app.auth.dependencies import get_optional_user
from app.schemas.search import SearchRequest, SearchResponse, SearchHit
from app.services.repository_service import get_repository_service
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/search", tags=["Code Search"])


@router.post(
    "",
    response_model=SearchResponse,
    status_code=status.HTTP_200_OK,
    summary="Semantic Code Search",
    description="Searches indexed code chunks in Qdrant by natural-language description using dense vector similarity.",
)
async def semantic_code_search(
    request: SearchRequest,
    current_user: User = Depends(get_optional_user),
) -> SearchResponse:
    start_time = time.perf_counter()
    if not request.query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query cannot be empty.",
        )

    repo_service = get_repository_service()
    try:
        # Generate query embedding using configured embedding provider (OpenRouter Nemotron 2048-dim)
        query_embedding = repo_service.rag_pipeline.embedding_provider.embed_text(request.query)

        # Execute vector search in Qdrant scoped to user and optional repo
        results = repo_service.rag_pipeline.vector_store.search(
            query_embedding=query_embedding,
            repository_id=request.repository_id,
            user_id=current_user.id,
            branch=request.branch,
            top_k=request.top_k,
            score_threshold=request.score_threshold,
        )

        hits = [
            SearchHit(
                chunk_id=r.get("chunk_id", ""),
                repository_id=r.get("repository_id", ""),
                file_path=r.get("file_path", ""),
                language=r.get("language", "text"),
                start_line=r.get("start_line", 1),
                end_line=r.get("end_line", 1),
                content=r.get("content", ""),
                score=round(float(r.get("score", 0.0)), 4),
                metadata=r.get("metadata", {}),
            )
            for r in results
        ]

        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return SearchResponse(
            query=request.query,
            repository_id=request.repository_id,
            total_hits=len(hits),
            hits=hits,
            latency_ms=latency_ms,
        )
    except Exception as e:
        logger.error(f"Semantic search failed for query '{request.query}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Semantic code search failed: {str(e)}",
        )
