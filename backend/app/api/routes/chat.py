"""
Chat and Codebase Question-Answering API Routes.

Exposes endpoint for querying indexed repositories with natural language questions.
"""

from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status

from app.auth.models import User
from app.auth.dependencies import get_optional_user
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.feedback import FeedbackCreateRequest, FeedbackStatsResponse
from app.services.llm_provider import MissingAPIKeyError, LLMProviderError
from app.services.repository_service import get_repository_service

router = APIRouter(prefix="/chat", tags=["Chat & Q&A"])


@router.post(
    "",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Ask Question About Repository",
    description="Performs semantic vector search across indexed code chunks and returns an evidence-grounded answer from Gemini with user isolation.",
)
async def chat_with_repository(
    request: ChatRequest,
    current_user: User = Depends(get_optional_user),
) -> ChatResponse:
    repo_service = get_repository_service()

    if not request.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty.",
        )

    try:
        return repo_service.query_repository(request, user_id=current_user.id)
    except MissingAPIKeyError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"LLM generation unavailable: {str(e)}",
        )
    except LLMProviderError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM generation failed: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during chat processing: {str(e)}",
        )


@router.post(
    "/feedback",
    response_model=Dict[str, Any],
    status_code=status.HTTP_201_CREATED,
    summary="Submit Answer Feedback",
    description="Record user thumbs-up/down or citation flags for retrieval quality improvement.",
)
async def submit_chat_feedback(
    request: FeedbackCreateRequest,
    current_user: User = Depends(get_optional_user),
) -> Dict[str, Any]:
    from app.db.feedback_store import get_feedback_store
    store = get_feedback_store()
    item = store.record_feedback(request, user_id=current_user.id)
    return {
        "status": "success",
        "feedback_id": item.id,
        "message": "Feedback recorded for retrieval optimization.",
    }


@router.get(
    "/feedback/stats",
    response_model=FeedbackStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Retrieval Feedback & Tuning Stats",
    description="Retrieve aggregated ratings and data-driven retrieval parameter tuning recommendations.",
)
async def get_feedback_stats(
    repository_id: str,
    current_user: User = Depends(get_optional_user),
) -> FeedbackStatsResponse:
    from app.db.feedback_store import get_feedback_store
    store = get_feedback_store()
    return store.get_stats(repository_id, user_id=current_user.id)

