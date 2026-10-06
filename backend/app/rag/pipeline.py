"""
End-to-End RAG Pipeline Module.

Coordinates the complete Indexing Workflow and Question-Answering Workflow.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Any, Optional, Union
import time

from app.rag.file_scanner import FileScanner, DiscoveredFile
from app.rag.chunker import LineChunker, CodeChunk
from app.rag.embeddings import BaseEmbeddingProvider, get_embedding_provider
from app.rag.vector_store import QdrantVectorStore
from app.rag.retriever import CodeRetriever, RetrievedChunk
from app.rag.prompt_builder import PromptBuilder
from app.services.llm_provider import BaseLLMProvider, get_llm_provider
from app.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class IndexingResult:
    """
    Statistics and summary of an indexing run.
    """
    repository_id: str
    target_directory: str
    files_discovered: int
    files_indexed: int
    files_skipped: int
    chunks_created: int
    chunks_indexed: int
    duration_ms: float
    error: Optional[str] = None


@dataclass
class SourceCitation:
    """
    Source citation reference accompanying a generated answer.
    """
    path: str
    start_line: int
    end_line: int
    chunk_id: str
    score: float


@dataclass
class RAGResponse:
    """
    Structured answer response containing LLM text, citations, and metadata.
    """
    question: str
    repository_id: str
    answer: str
    sources: List[SourceCitation]
    insufficient_context: bool
    retrieved_chunks_count: int
    latency_ms: float


class RAGPipeline:
    """
    Orchestrates the full RAG lifecycle: file discovery, chunking, embedding,
    vector storage, similarity retrieval, and grounded LLM answering.
    """

    def __init__(
        self,
        file_scanner: Optional[FileScanner] = None,
        chunker: Optional[LineChunker] = None,
        embedding_provider: Optional[BaseEmbeddingProvider] = None,
        vector_store: Optional[QdrantVectorStore] = None,
        llm_provider: Optional[BaseLLMProvider] = None,
    ):
        self.file_scanner = file_scanner or FileScanner()
        self.chunker = chunker or LineChunker()
        self.embedding_provider = embedding_provider or get_embedding_provider()
        self.vector_store = vector_store or QdrantVectorStore(vector_size=self.embedding_provider.dimension)
        self.llm_provider = llm_provider or get_llm_provider()
        self.retriever = CodeRetriever(
            vector_store=self.vector_store,
            embedding_provider=self.embedding_provider,
        )

    def index_files(
        self,
        files: List[DiscoveredFile],
        repository_id: str = "default",
        user_id: Optional[str] = None,
        branch: str = "main",
        target_name: Optional[str] = None,
        clean_existing: bool = True,
    ) -> IndexingResult:
        """
        Execute the complete indexing workflow for a provided list of DiscoveredFile objects.
        Enforces user ownership, multi-tenant Qdrant isolation, and resource limits.
        """
        start_time = time.perf_counter()
        target_label = target_name or repository_id
        resolved_user = user_id or "default_user"
        files_count = len(files)

        from app.config.settings import get_settings
        settings = get_settings()

        # Enforce max files limit
        if files_count > settings.max_files_per_repo:
            error_msg = f"Repository exceeds file limit: {files_count} files found (limit is {settings.max_files_per_repo})."
            logger.warning(error_msg)
            return IndexingResult(
                repository_id=repository_id,
                target_directory=target_label,
                files_discovered=files_count,
                files_indexed=0,
                files_skipped=files_count,
                chunks_created=0,
                chunks_indexed=0,
                duration_ms=round((time.perf_counter() - start_time) * 1000, 2),
                error=error_msg,
            )

        if clean_existing:
            self.vector_store.delete_repository(repository_id, user_id=resolved_user)

        try:
            # 0. Code Intelligence Structural Analysis
            from app.intelligence.service import get_intelligence_service
            intel_service = get_intelligence_service()
            try:
                repo_intel = intel_service.analyze_repository_files(
                    repository_id=repository_id,
                    branch=branch,
                    files=files,
                )
            except Exception as e:
                logger.warning(f"Code intelligence analysis failed non-fatally: {e}")
                repo_intel = None

            # 1. Chunk each discovered file
            all_chunks: List[CodeChunk] = []
            for file in files:
                # Enforce individual file size limit
                if file.size_bytes > settings.max_file_size_bytes:
                    logger.warning(f"Skipping oversized file '{file.path}' ({file.size_bytes} bytes > {settings.max_file_size_bytes} limit).")
                    continue

                file_symbols = repo_intel.files[file.path].symbols if (repo_intel and file.path in repo_intel.files) else []
                chunks = self.chunker.chunk_text(
                    content=file.content,
                    file_path=file.path,
                    language=file.language,
                    repository_id=repository_id,
                    extra_metadata={
                        "branch": branch,
                        "user_id": resolved_user,
                        "size_bytes": file.size_bytes,
                        "line_count": file.line_count,
                    },
                )
                # Enrich chunk metadata with overlapping symbols
                for chk in chunks:
                    chk_symbols = [
                        s.name for s in file_symbols
                        if (chk.start_line <= s.start_line <= chk.end_line or chk.start_line <= s.end_line <= chk.end_line)
                    ]
                    chk_types = [
                        s.symbol_type.value for s in file_symbols
                        if (chk.start_line <= s.start_line <= chk.end_line or chk.start_line <= s.end_line <= chk.end_line)
                    ]
                    chk.metadata["symbols_defined"] = chk_symbols
                    chk.metadata["symbol_types"] = chk_types
                    chk.metadata["has_symbols"] = len(chk_symbols) > 0

                all_chunks.extend(chunks)

            # Enforce max chunks limit
            if len(all_chunks) > settings.max_chunks_per_repo:
                all_chunks = all_chunks[: settings.max_chunks_per_repo]
                logger.warning(f"Capped total chunks to configured maximum of {settings.max_chunks_per_repo}.")

            chunks_count = len(all_chunks)
            if chunks_count == 0:
                elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
                return IndexingResult(
                    repository_id=repository_id,
                    target_directory=target_label,
                    files_discovered=files_count,
                    files_indexed=0,
                    files_skipped=files_count,
                    chunks_created=0,
                    chunks_indexed=0,
                    duration_ms=elapsed_ms,
                )

            # 2. Generate embeddings in batches for all chunk contents
            chunk_texts = [chunk.content for chunk in all_chunks]
            embeddings = self.embedding_provider.embed_batch(chunk_texts)

            # 3. Upsert vectors and metadata into Qdrant with user_id scoping
            indexed_count = self.vector_store.upsert_chunks(
                chunks=all_chunks,
                embeddings=embeddings,
                user_id=resolved_user,
            )

            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.info(f"Indexing completed: {files_count} files, {indexed_count} chunks in {elapsed_ms}ms (user={resolved_user}, repo={repository_id}).")
            return IndexingResult(
                repository_id=repository_id,
                target_directory=target_label,
                files_discovered=files_count,
                files_indexed=files_count,
                files_skipped=0,
                chunks_created=chunks_count,
                chunks_indexed=indexed_count,
                duration_ms=elapsed_ms,
            )

        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error(f"Error during indexing workflow: {e}", exc_info=True)
            return IndexingResult(
                repository_id=repository_id,
                target_directory=target_label,
                files_discovered=files_count,
                files_indexed=0,
                files_skipped=files_count,
                chunks_created=0,
                chunks_indexed=0,
                duration_ms=elapsed_ms,
                error=str(e),
            )

    def index_directory(
        self,
        directory_path: Union[str, Path],
        repository_id: str = "default",
        user_id: Optional[str] = None,
        branch: str = "main",
        clean_existing: bool = True,
    ) -> IndexingResult:
        """
        Execute the complete indexing workflow for a local directory.
        """
        dir_path = Path(directory_path).resolve()
        discovered_files = self.file_scanner.scan_directory(dir_path)
        return self.index_files(
            files=discovered_files,
            repository_id=repository_id,
            user_id=user_id,
            branch=branch,
            target_name=str(dir_path),
            clean_existing=clean_existing,
        )

    def answer_question(
        self,
        question: str,
        repository_id: str = "default",
        user_id: Optional[str] = None,
        branch: Optional[str] = None,
        top_k: int = 5,
        score_threshold: Optional[float] = None,
    ) -> RAGResponse:
        """
        Execute the complete Question-Answering workflow with user and repo isolation.
        """
        start_time = time.perf_counter()

        retrieval_result = self.retriever.retrieve(
            query=question,
            repository_id=repository_id,
            user_id=user_id,
            branch=branch,
            top_k=top_k,
            score_threshold=score_threshold,
        )

        chunks = retrieval_result.chunks

        # Format citations
        sources = [
            SourceCitation(
                path=c.file_path,
                start_line=c.start_line,
                end_line=c.end_line,
                chunk_id=c.chunk_id,
                score=c.score,
            )
            for c in chunks
        ]

        # Handle empty context early
        if not chunks:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return RAGResponse(
                question=question,
                repository_id=repository_id,
                answer=(
                    "Based on the repository index, no relevant source code files or functions "
                    "were found matching your question."
                ),
                sources=[],
                insufficient_context=True,
                retrieved_chunks_count=0,
                latency_ms=elapsed_ms,
            )

        # 2. Extract structural intelligence context
        from app.intelligence.service import get_intelligence_service
        intel_service = get_intelligence_service()
        structural_context = None
        try:
            structural_context = intel_service.detect_structural_context(
                repository_id=repository_id,
                query=question,
                branch=branch or "main",
            )
        except Exception as e:
            logger.warning(f"Error extracting structural context: {e}")

        # 3. Build grounded prompt
        system_instruction, user_prompt = PromptBuilder.build_prompt(
            question=question,
            chunks=chunks,
            structural_context=structural_context,
        )

        # 3. Call LLM provider
        try:
            answer_text = self.llm_provider.generate_text(
                prompt=user_prompt,
                system_instruction=system_instruction,
                temperature=0.2,
            )
            insufficient = (
                "insufficient" in answer_text.lower()
                or "do not have enough information" in answer_text.lower()
            )
        except Exception as e:
            logger.error(f"Error generating answer with LLM: {e}")
            answer_text = f"Error communicating with LLM model: {str(e)}"
            insufficient = True

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return RAGResponse(
            question=question,
            repository_id=repository_id,
            answer=answer_text,
            sources=sources,
            insufficient_context=insufficient,
            retrieved_chunks_count=len(chunks),
            latency_ms=elapsed_ms,
        )
