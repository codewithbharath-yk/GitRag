"""
Feedback & Retrieval Improvement Schemas (Phase 9).
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field


class FeedbackType(str, Enum):
    THUMBS_UP = "thumbs_up"
    THUMBS_DOWN = "thumbs_down"
    FLAG_CITATION = "flag_citation"
    FLAG_INCOMPLETE = "flag_incomplete"
    FLAG_IRRELEVANT = "flag_irrelevant"


class FeedbackCreateRequest(BaseModel):
    repository_id: str = Field(..., description="Repository slug or ID")
    question: str = Field(..., description="The user's question")
    retrieved_chunks: List[str] = Field(default_factory=list, description="IDs or paths of retrieved context chunks")
    model_name: Optional[str] = Field(default="gemini-flash-lite-latest", description="Model configuration ID")
    retrieval_config: Dict[str, Any] = Field(
        default_factory=dict,
        description="Retrieval parameters (e.g., candidate_count, chunk_size, min_score)",
    )
    feedback_type: FeedbackType = Field(..., description="Type of feedback submitted")
    comment: Optional[str] = Field(default=None, max_length=1000, description="Optional user explanation")
    is_positive: bool = Field(default=True, description="True for positive rating, False for negative")


class FeedbackItem(BaseModel):
    id: str
    user_id: str
    repository_id: str
    question: str
    retrieved_chunks: List[str]
    model_name: str
    retrieval_config: Dict[str, Any]
    feedback_type: FeedbackType
    comment: Optional[str]
    is_positive: bool
    created_at: datetime


class RetrievalTuningRecommendation(BaseModel):
    recommended_candidate_count: int
    recommended_min_similarity: float
    recommended_chunk_size: int
    confidence: float
    notes: List[str]


class FeedbackStatsResponse(BaseModel):
    repository_id: str
    total_feedback: int
    positive_count: int
    negative_count: int
    flag_breakdown: Dict[str, int]
    tuning: RetrievalTuningRecommendation
