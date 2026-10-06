"""
Qdrant Vector Database Adapter Module.

Manages collection initialization, embedding upserts with rich code metadata payloads,
repository-scoped filtering, and similarity searches.
"""

from typing import List, Dict, Any, Optional
import uuid

from qdrant_client import QdrantClient
from qdrant_client.http import models

from app.config.settings import Settings, get_settings
from app.rag.chunker import CodeChunk
from app.utils.logger import get_logger

logger = get_logger(__name__)

DEFAULT_COLLECTION_NAME = "coderag_code_chunks"
DEFAULT_VECTOR_SIZE = 2048
# Deterministic namespace for generating stable UUIDs from chunk IDs
CHUNK_NAMESPACE_UUID = uuid.UUID("12345678-1234-5678-1234-567812345678")


class QdrantVectorStore:
    """
    Qdrant vector store adapter supporting in-memory, local file, or remote server modes.
    """

    def __init__(
        self,
        collection_name: str = DEFAULT_COLLECTION_NAME,
        vector_size: int = DEFAULT_VECTOR_SIZE,
        location: Optional[str] = None,
        url: Optional[str] = None,
        api_key: Optional[str] = None,
        client: Optional[QdrantClient] = None,
    ):
        settings = get_settings()
        self.collection_name = collection_name
        self.vector_size = vector_size

        if client is not None:
            self.client = client
        elif location:
            # e.g., location=":memory:" or local directory path
            self.client = QdrantClient(location=location)
        elif url:
            self.client = QdrantClient(url=url, api_key=api_key)
        else:
            # Check if remote Qdrant server is configured and reachable
            target_url = settings.qdrant_url
            target_api_key = settings.qdrant_api_key
            if target_url and target_url != ":memory:":
                try:
                    # Do not pass API key over unencrypted http://localhost unless required
                    is_local_http = target_url.startswith("http://localhost") or target_url.startswith("http://127.0.0.1")
                    effective_key = None if is_local_http else target_api_key
                    timeout_sec = getattr(settings, "qdrant_timeout_seconds", 5.0)
                    candidate = QdrantClient(
                        url=target_url,
                        api_key=effective_key,
                        timeout=timeout_sec,
                        check_compatibility=False,
                    )
                    # Test connection
                    candidate.get_collections()
                    self.client = candidate
                except Exception as conn_err:
                    logger.info(
                        f"Qdrant server at '{target_url}' is not reachable ({conn_err}). "
                        "Falling back to local in-memory vector store (:memory:)."
                    )
                    self.client = QdrantClient(location=":memory:")
            else:
                self.client = QdrantClient(location=":memory:")

        self._ensure_collection()

    def _ensure_collection(self) -> None:
        """
        Verify collection exists; create it with cosine distance if not.
        If collection exists with incompatible vector size, recreate it.
        """
        try:
            collections = self.client.get_collections().collections
            exists = any(c.name == self.collection_name for c in collections)

            if not exists:
                logger.info(
                    f"Creating Qdrant collection '{self.collection_name}' (vector_size={self.vector_size}, distance=COSINE)..."
                )
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=models.VectorParams(
                        size=self.vector_size,
                        distance=models.Distance.COSINE,
                    ),
                )
            else:
                try:
                    c_info = self.client.get_collection(self.collection_name)
                    params = getattr(c_info.config, "params", None)
                    v_cfg = getattr(params, "vectors", None) if params else None
                    curr_size = getattr(v_cfg, "size", None)
                    if curr_size and curr_size != self.vector_size:
                        logger.warning(
                            f"Qdrant collection '{self.collection_name}' has vector size {curr_size}, "
                            f"expected {self.vector_size}. Recreating collection for new embedding model..."
                        )
                        self.client.delete_collection(self.collection_name)
                        self.client.create_collection(
                            collection_name=self.collection_name,
                            vectors_config=models.VectorParams(
                                size=self.vector_size,
                                distance=models.Distance.COSINE,
                            ),
                        )
                except Exception as check_err:
                    logger.debug(f"Could not verify existing collection vector size: {check_err}")
                logger.debug(f"Qdrant collection '{self.collection_name}' is ready.")
        except Exception as e:
            logger.error(f"Error ensuring Qdrant collection: {e}")
            raise

    def _to_uuid(self, chunk_id: str, user_id: Optional[str] = None) -> str:
        """
        Convert a chunk identifier to a deterministic UUID string required by Qdrant.
        """
        key = f"{user_id}:{chunk_id}" if user_id else chunk_id
        return str(uuid.uuid5(CHUNK_NAMESPACE_UUID, key))

    def upsert_chunks(
        self,
        chunks: List[CodeChunk],
        embeddings: List[List[float]],
        user_id: Optional[str] = None,
    ) -> int:
        """
        Upsert a list of CodeChunks and their corresponding embeddings into Qdrant.
        Attaches user_id to point payload for multi-tenant isolation.
        """
        if not chunks:
            return 0

        if len(chunks) != len(embeddings):
            raise ValueError(
                f"Mismatch: received {len(chunks)} chunks but {len(embeddings)} embeddings."
            )

        points: List[models.PointStruct] = []

        for chunk, embedding in zip(chunks, embeddings):
            resolved_user_id = user_id or chunk.metadata.get("user_id") or "default_user"
            point_id = self._to_uuid(chunk.chunk_id, resolved_user_id)
            payload = {
                "chunk_id": chunk.chunk_id,
                "repository_id": chunk.repository_id,
                "user_id": resolved_user_id,
                "file_path": chunk.file_path,
                "language": chunk.language,
                "start_line": chunk.start_line,
                "end_line": chunk.end_line,
                "content": chunk.content,
                "metadata": chunk.metadata,
            }

            points.append(
                models.PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload=payload,
                )
            )

        # Batch upsert points
        self.client.upsert(
            collection_name=self.collection_name,
            points=points,
            wait=True,
        )

        logger.info(f"Successfully indexed {len(points)} chunks into Qdrant collection '{self.collection_name}'.")
        return len(points)

    def search(
        self,
        query_embedding: List[float],
        repository_id: Optional[str] = None,
        user_id: Optional[str] = None,
        branch: Optional[str] = None,
        top_k: int = 5,
        score_threshold: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """
        Perform vector similarity search, scoped by repository ID, user ID, and branch.
        """
        must_conditions = []
        if repository_id:
            must_conditions.append(
                models.FieldCondition(
                    key="repository_id",
                    match=models.MatchValue(value=repository_id),
                )
            )
        if user_id:
            must_conditions.append(
                models.FieldCondition(
                    key="user_id",
                    match=models.MatchValue(value=user_id),
                )
            )
        if branch:
            must_conditions.append(
                models.FieldCondition(
                    key="metadata.branch",
                    match=models.MatchValue(value=branch),
                )
            )

        query_filter = models.Filter(must=must_conditions) if must_conditions else None

        # Execute vector search (using modern query_points API or search)
        try:
            # Modern qdrant-client uses query_points
            response = self.client.query_points(
                collection_name=self.collection_name,
                query=query_embedding,
                query_filter=query_filter,
                limit=top_k,
                score_threshold=score_threshold,
                with_payload=True,
            )
            hits = response.points
        except (AttributeError, Exception):
            # Fallback to legacy search method if needed
            hits = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                query_filter=query_filter,
                limit=top_k,
                score_threshold=score_threshold,
                with_payload=True,
            )

        results: List[Dict[str, Any]] = []
        for hit in hits:
            payload = hit.payload or {}
            results.append({
                "score": float(hit.score),
                "chunk_id": payload.get("chunk_id", ""),
                "repository_id": payload.get("repository_id", ""),
                "user_id": payload.get("user_id", ""),
                "file_path": payload.get("file_path", ""),
                "language": payload.get("language", ""),
                "start_line": payload.get("start_line", 1),
                "end_line": payload.get("end_line", 1),
                "content": payload.get("content", ""),
                "metadata": payload.get("metadata", {}),
            })

        return results

    def list_repository_files(
        self,
        repository_id: str,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve a summary list of all distinct files indexed for a given repository and user.
        """
        must_conditions = [
            models.FieldCondition(
                key="repository_id",
                match=models.MatchValue(value=repository_id),
            )
        ]
        if user_id:
            must_conditions.append(
                models.FieldCondition(
                    key="user_id",
                    match=models.MatchValue(value=user_id),
                )
            )

        records, _ = self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=models.Filter(must=must_conditions),
            limit=500,
            with_payload=True,
            with_vectors=False,
        )

        files_map: Dict[str, Dict[str, Any]] = {}
        for record in records:
            payload = record.payload or {}
            path = payload.get("file_path", "")
            if not path:
                continue

            if path not in files_map:
                files_map[path] = {
                    "path": path,
                    "language": payload.get("language", "unknown"),
                    "chunks_count": 0,
                    "line_count": payload.get("end_line", 1),
                }

            files_map[path]["chunks_count"] += 1
            files_map[path]["line_count"] = max(files_map[path]["line_count"], payload.get("end_line", 1))

        return sorted(list(files_map.values()), key=lambda x: x["path"])

    def count_repository_chunks(
        self,
        repository_id: str,
        user_id: Optional[str] = None,
    ) -> int:
        """
        Return the total number of chunks indexed for a specific repository and user.
        """
        must_conditions = [
            models.FieldCondition(
                key="repository_id",
                match=models.MatchValue(value=repository_id),
            )
        ]
        if user_id:
            must_conditions.append(
                models.FieldCondition(
                    key="user_id",
                    match=models.MatchValue(value=user_id),
                )
            )

        count_res = self.client.count(
            collection_name=self.collection_name,
            count_filter=models.Filter(must=must_conditions),
        )
        return count_res.count

    def delete_repository(
        self,
        repository_id: str,
        user_id: Optional[str] = None,
    ) -> None:
        """
        Delete all indexed points belonging to a repository (and user if specified).
        """
        must_conditions = [
            models.FieldCondition(
                key="repository_id",
                match=models.MatchValue(value=repository_id),
            )
        ]
        if user_id:
            must_conditions.append(
                models.FieldCondition(
                    key="user_id",
                    match=models.MatchValue(value=user_id),
                )
            )

        self.client.delete(
            collection_name=self.collection_name,
            points_selector=models.FilterSelector(
                filter=models.Filter(must=must_conditions)
            ),
            wait=True,
        )
        logger.info(f"Deleted vector index for repository '{repository_id}' (user_id={user_id}).")
