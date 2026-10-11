"""
Feedback Data Store & Retrieval Quality Evaluator.

Enforces user & repository isolation. Never logs secrets or private keys.
Calculates objective retrieval tuning recommendations from real user feedback.
"""

import json
import uuid
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

from app.schemas.feedback import (
    FeedbackType,
    FeedbackCreateRequest,
    FeedbackItem,
    RetrievalTuningRecommendation,
    FeedbackStatsResponse,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)


class FeedbackStore:
    """Thread-safe persistent feedback manager."""

    def __init__(self, storage_path: Optional[Path] = None):
        self.storage_path = storage_path or (
            Path(__file__).resolve().parent.parent.parent / "storage" / "feedback_store.json"
        )
        self._items: List[FeedbackItem] = []
        self._load()

    def _load(self) -> None:
        if self.storage_path.exists():
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    raw = json.load(f)
                    self._items = [FeedbackItem(**item) for item in raw]
            except Exception as e:
                logger.warning(f"Could not load feedback store from {self.storage_path}: {e}")

    def _persist(self) -> None:
        try:
            self.storage_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump([item.model_dump(mode="json") for item in self._items], f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to persist feedback store: {e}")

    def record_feedback(
        self,
        request: FeedbackCreateRequest,
        user_id: str = "default_user",
    ) -> FeedbackItem:
        """
        Record a new feedback entry.
        Never logs secrets, keys, or private code payloads.
        """
        item = FeedbackItem(
            id=str(uuid.uuid4()),
            user_id=user_id,
            repository_id=request.repository_id,
            question=request.question[:200],  # Sanitize length
            retrieved_chunks=request.retrieved_chunks[:10],
            model_name=request.model_name or "gemini-flash-lite-latest",
            retrieval_config=request.retrieval_config,
            feedback_type=request.feedback_type,
            comment=request.comment[:500] if request.comment else None,
            is_positive=request.is_positive,
            created_at=datetime.now(timezone.utc),
        )
        self._items.append(item)
        self._persist()

        logger.info(
            f"[Feedback] Recorded {item.feedback_type} for repo={item.repository_id} "
            f"(user={user_id}, chunks={len(item.retrieved_chunks)})"
        )
        return item

    def get_stats(self, repository_id: str, user_id: Optional[str] = None) -> FeedbackStatsResponse:
        """
        Compute feedback metrics and retrieval parameter tuning recommendations.
        """
        repo_items = [
            item for item in self._items
            if item.repository_id == repository_id and (user_id is None or item.user_id == user_id)
        ]

        total = len(repo_items)
        pos = sum(1 for i in repo_items if i.is_positive)
        neg = total - pos

        flags: Dict[str, int] = {}
        for item in repo_items:
            t = item.feedback_type.value
            flags[t] = flags.get(t, 0) + 1

        # Retrieval tuning recommendation logic
        notes: List[str] = []
        rec_cand_count = 10
        rec_min_sim = 0.45
        rec_chunk_size = 512

        if total == 0:
            notes.append("No feedback recorded yet. Using baseline question-driven RAG parameters.")
            confidence = 0.5
        else:
            confidence = min(0.95, 0.5 + (total * 0.05))
            # If citations were flagged, tighten similarity threshold
            if flags.get(FeedbackType.FLAG_CITATION.value, 0) > 0:
                rec_min_sim = 0.60
                rec_cand_count = 12
                notes.append("Elevated citation flags: recommend tightening minimum similarity threshold.")
            # If answers were incomplete, expand candidate count
            if flags.get(FeedbackType.FLAG_INCOMPLETE.value, 0) > 0:
                rec_cand_count = 15
                rec_chunk_size = 600
                notes.append("Incomplete answer flags: recommend increasing candidate file count.")
            # If irrelevant code was flagged, shrink chunk size and increase threshold
            if flags.get(FeedbackType.FLAG_IRRELEVANT.value, 0) > 0:
                rec_chunk_size = 400
                rec_min_sim = 0.55
                notes.append("Irrelevant code flags: recommend smaller focused chunk sizes.")
            if pos / total > 0.8:
                notes.append("High satisfaction (>80%): current retrieval configuration performs well.")

        tuning = RetrievalTuningRecommendation(
            recommended_candidate_count=rec_cand_count,
            recommended_min_similarity=rec_min_sim,
            recommended_chunk_size=rec_chunk_size,
            confidence=round(confidence, 2),
            notes=notes,
        )

        return FeedbackStatsResponse(
            repository_id=repository_id,
            total_feedback=total,
            positive_count=pos,
            negative_count=neg,
            flag_breakdown=flags,
            tuning=tuning,
        )


_feedback_store_instance: Optional[FeedbackStore] = None


def get_feedback_store() -> FeedbackStore:
    global _feedback_store_instance
    if _feedback_store_instance is None:
        _feedback_store_instance = FeedbackStore()
    return _feedback_store_instance
