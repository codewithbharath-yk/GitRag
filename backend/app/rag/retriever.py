"""
Code Retriever Module.

Embeds incoming user questions and performs similarity searches against Qdrant
to retrieve the most relevant code chunks with associated metadata.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

from app.rag.embeddings import BaseEmbeddingProvider, get_embedding_provider
from app.rag.vector_store import QdrantVectorStore
from app.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class RetrievedChunk:
    """
    Represents a code chunk retrieved from vector search.
    """
    chunk_id: str
    repository_id: str
    file_path: str
    language: str
    start_line: int
    end_line: int
    content: str
    score: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RetrievalResult:
    """
    Container for search results and diagnostics.
    """
    query: str
    repository_id: str
    chunks: List[RetrievedChunk]
    total_found: int


class CodeRetriever:
    """
    Orchestrates query embedding and vector search.
    """

    def __init__(
        self,
        vector_store: QdrantVectorStore,
        embedding_provider: Optional[BaseEmbeddingProvider] = None,
    ):
        self.vector_store = vector_store
        self.embedding_provider = embedding_provider or get_embedding_provider()

    def retrieve(
        self,
        query: str,
        repository_id: str = "default",
        user_id: Optional[str] = None,
        branch: Optional[str] = None,
        top_k: int = 5,
        score_threshold: Optional[float] = None,
    ) -> RetrievalResult:
        """
        Retrieve the top-k most relevant code chunks for a given query, optionally filtering by user_id and branch.
        """
        trimmed_query = query.strip()
        if not trimmed_query:
            return RetrievalResult(
                query=query,
                repository_id=repository_id,
                chunks=[],
                total_found=0,
            )

        logger.info(f"Retrieving top {top_k} code chunks for query: '{trimmed_query}' (repo={repository_id}, user={user_id}, branch={branch})")

        # 1. Generate embedding for query using the same embedding model used for indexing
        query_vector = self.embedding_provider.embed_text(trimmed_query)

        # 2. Search Qdrant with repository_id and user_id scoping
        raw_hits = self.vector_store.search(
            query_embedding=query_vector,
            repository_id=repository_id,
            user_id=user_id,
            branch=branch,
            top_k=top_k,
            score_threshold=score_threshold,
        )

        # 3. Format into structured RetrievedChunk objects
        chunks: List[RetrievedChunk] = []
        for hit in raw_hits:
            chunks.append(
                RetrievedChunk(
                    chunk_id=hit["chunk_id"],
                    repository_id=hit["repository_id"],
                    file_path=hit["file_path"],
                    language=hit["language"],
                    start_line=hit["start_line"],
                    end_line=hit["end_line"],
                    content=hit["content"],
                    score=hit["score"],
                    metadata=hit.get("metadata", {}),
                )
            )

        logger.info(f"Retrieved {len(chunks)} matching chunks for query '{trimmed_query}'.")

        return RetrievalResult(
            query=trimmed_query,
            repository_id=repository_id,
            chunks=chunks,
            total_found=len(chunks),
        )
