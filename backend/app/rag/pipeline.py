"""
End-to-End RAG Pipeline Module with Question-Driven / Lazy Retrieval Architecture.

Coordinates lightweight repository ingestion, question analysis, multi-signal candidate file
selection, progressive lazy code fetching, local BGE embedding with chunk caching,
Qdrant vector similarity search, and grounded LLM answer generation with verified citations.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Any, Optional, Union, Callable
import time

from app.rag.file_scanner import FileScanner, DiscoveredFile
from app.rag.chunker import LineChunker, CodeChunk
from app.rag.embeddings import BaseEmbeddingProvider, get_embedding_provider
from app.rag.embedding_cache import EmbeddingCache, get_embedding_cache
from app.rag.vector_store import QdrantVectorStore
from app.rag.retriever import CodeRetriever, RetrievedChunk
from app.rag.prompt_builder import PromptBuilder
from app.rag.question_analyzer import QuestionAnalyzer, QuestionAnalysis
from app.rag.candidate_selector import CandidateSelector, CandidateFile
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
    Structured answer response containing LLM text, citations, analyzed files, and metadata.
    """
    question: str
    repository_id: str
    answer: str
    sources: List[SourceCitation]
    files_analyzed: List[str] = field(default_factory=list)
    insufficient_context: bool = False
    retrieved_chunks_count: int = 0
    latency_ms: float = 0.0


class RAGPipeline:
    """
    Orchestrates Question-Driven Lazy RAG: analyzes queries, selectively fetches only
    relevant candidate files, embeds with local BGE model, queries Qdrant, and generates
    grounded LLM answers with verified citations.
    """

    def __init__(
        self,
        file_scanner: Optional[FileScanner] = None,
        chunker: Optional[LineChunker] = None,
        embedding_provider: Optional[BaseEmbeddingProvider] = None,
        embedding_cache: Optional[EmbeddingCache] = None,
        vector_store: Optional[QdrantVectorStore] = None,
        llm_provider: Optional[BaseLLMProvider] = None,
    ):
        self.file_scanner = file_scanner or FileScanner()
        self.chunker = chunker or LineChunker()
        self.embedding_provider = embedding_provider or get_embedding_provider()
        self.embedding_cache = embedding_cache or get_embedding_cache()
        self.vector_store = vector_store or QdrantVectorStore(vector_size=self.embedding_provider.dimension)
        self.llm_provider = llm_provider or get_llm_provider()
        self.retriever = CodeRetriever(
            vector_store=self.vector_store,
            embedding_provider=self.embedding_provider,
        )

    def _embed_and_upsert_chunks(
        self,
        chunks: List[CodeChunk],
        repository_id: str,
        user_id: str,
        branch: str,
    ) -> int:
        """
        Embed a list of CodeChunks utilizing the EmbeddingCache to avoid redundant calculations,
        then upsert to Qdrant.
        """
        if not chunks:
            return 0

        # Build chunk cache keys
        cache_keys = [
            self.embedding_cache.generate_chunk_key(
                repository_id=repository_id,
                branch=branch,
                file_path=c.file_path,
                start_line=c.start_line,
                end_line=c.end_line,
                content=c.content,
            )
            for c in chunks
        ]

        cached_vectors_map, missing_indices = self.embedding_cache.get_batch(cache_keys)

        # Generate embeddings only for cache misses
        if missing_indices:
            texts_to_embed = [chunks[i].content for i in missing_indices]
            model_lbl = getattr(self.embedding_provider, "model_name", "local-embedding-model")
            logger.info(
                f"Embedding {len(texts_to_embed)} new chunks with local {model_lbl} "
                f"({len(cached_vectors_map)} chunks served from cache)."
            )
            new_embeddings = self.embedding_provider.embed_batch(texts_to_embed)

            # Store new embeddings in cache
            new_keys = [cache_keys[i] for i in missing_indices]
            self.embedding_cache.put_batch(new_keys, new_embeddings)

            # Reconstruct full embeddings list
            for idx_pos, orig_idx in enumerate(missing_indices):
                cached_vectors_map[orig_idx] = new_embeddings[idx_pos]
        else:
            logger.info(f"Reused all {len(chunks)} chunk embeddings from local cache.")

        all_embeddings = [cached_vectors_map[i] for i in range(len(chunks))]

        # Upsert into Qdrant
        return self.vector_store.upsert_chunks(
            chunks=chunks,
            embeddings=all_embeddings,
            user_id=user_id,
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
        Ingest a list of DiscoveredFiles (used for local workspaces or explicit on-demand indexing).
        """
        start_time = time.perf_counter()
        target_label = target_name or repository_id
        resolved_user = user_id or "default_user"
        files_count = len(files)

        from app.config.settings import get_settings
        settings = get_settings()

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
            # Code Intelligence Structural Analysis
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

            all_chunks: List[CodeChunk] = []
            for file in files:
                if file.size_bytes > settings.max_file_size_bytes:
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

            if len(all_chunks) > settings.max_chunks_per_repo:
                all_chunks = all_chunks[: settings.max_chunks_per_repo]

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

            indexed_count = self._embed_and_upsert_chunks(
                chunks=all_chunks,
                repository_id=repository_id,
                user_id=resolved_user,
                branch=branch,
            )

            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
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
        Ingest a local directory directly into CodeRAG.
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
        manifest_files: Optional[List[Dict[str, Any]]] = None,
        fetch_file_content_fn: Optional[Callable[[List[str]], List[DiscoveredFile]]] = None,
    ) -> RAGResponse:
        """
        Execute Question-Driven / Lazy RAG:
        1. Analyze question intent and concepts
        2. Identify candidate files from manifest
        3. Lazily fetch and embed only candidate files (progressively if needed)
        4. Query Qdrant for top relevant code chunks
        5. Assemble focused context and generate grounded answer with citations
        """
        start_time = time.perf_counter()
        target_branch = branch or "main"
        resolved_user = user_id or "default_user"
        analyzed_files_set: set = set()

        trimmed_question = question.strip()
        if not trimmed_question:
            return RAGResponse(
                question=question,
                repository_id=repository_id,
                answer="Please provide a valid question about the codebase.",
                sources=[],
                files_analyzed=[],
                insufficient_context=True,
                retrieved_chunks_count=0,
                latency_ms=0.0,
            )

        # Step 1: Question Analysis
        t_stage_start = time.perf_counter()
        analysis = QuestionAnalyzer.analyze(trimmed_question)
        t_analysis = time.perf_counter() - t_stage_start
        logger.info(
            f"[1] Question received & analyzed: {t_analysis:.3f}s | "
            f"category={analysis.category.value}, broad={analysis.is_broad_architecture}, "
            f"keywords={analysis.keywords[:5]}, symbols={analysis.extracted_symbols}"
        )

        # Step 2: Initial candidate selection from manifest
        t_stage_start = time.perf_counter()
        manifest = manifest_files or []
        candidate_files: List[CandidateFile] = []
        if manifest:
            # Check existing Qdrant hits to inform candidate ranking
            existing_scores: Dict[str, float] = {}
            try:
                initial_hits = self.retriever.retrieve(
                    query=trimmed_question,
                    repository_id=repository_id,
                    user_id=resolved_user,
                    branch=target_branch,
                    top_k=5,
                )
                for h in initial_hits.chunks:
                    existing_scores[h.file_path] = max(existing_scores.get(h.file_path, 0.0), h.score)
            except Exception as e:
                logger.debug(f"Initial Qdrant hint retrieval non-fatal error: {e}")

            candidate_files = CandidateSelector.select_candidates(
                manifest_files=manifest,
                analysis=analysis,
                existing_qdrant_scores=existing_scores,
                top_k=10,
            )
        t_cand = time.perf_counter() - t_stage_start
        logger.info(f"[2] Candidate files selected ({len(candidate_files)} candidates): {t_cand:.3f}s")

        # Step 3: Progressive Lazy Fetching & Embedding
        t_fetch_total = 0.0
        t_chunk_total = 0.0
        t_embed_total = 0.0
        t_search_total = 0.0
        retrieved_chunks: List[RetrievedChunk] = []

        if candidate_files and fetch_file_content_fn:
            # Stage 1: Top 5 candidate files
            stage_1_candidates = candidate_files[:5]
            paths_to_fetch = [c.path for c in stage_1_candidates]

            t_f_start = time.perf_counter()
            fetched_files_1 = fetch_file_content_fn(paths_to_fetch)
            t_fetch_total += (time.perf_counter() - t_f_start)
            logger.info(f"[3] GitHub fetch (Stage 1: {len(fetched_files_1)} files): {t_fetch_total:.3f}s")

            if fetched_files_1:
                t_c_start = time.perf_counter()
                all_new_chunks: List[CodeChunk] = []
                for f in fetched_files_1:
                    analyzed_files_set.add(f.path)
                    chunks = self.chunker.chunk_text(
                        content=f.content,
                        file_path=f.path,
                        language=f.language,
                        repository_id=repository_id,
                        extra_metadata={
                            "branch": target_branch,
                            "user_id": resolved_user,
                            "size_bytes": f.size_bytes,
                            "line_count": f.line_count,
                        },
                    )
                    # Hard retrieval budget: max 10 chunks per candidate file, max 30 chunks total
                    all_new_chunks.extend(chunks[:10])
                    if len(all_new_chunks) >= 30:
                        all_new_chunks = all_new_chunks[:30]
                        break
                t_chunk_total += (time.perf_counter() - t_c_start)
                logger.info(f"[4] Chunking (Stage 1: {len(all_new_chunks)} chunks): {t_chunk_total:.3f}s")

                if all_new_chunks:
                    t_e_start = time.perf_counter()
                    self._embed_and_upsert_chunks(
                        chunks=all_new_chunks,
                        repository_id=repository_id,
                        user_id=resolved_user,
                        branch=target_branch,
                    )
                    t_embed_total += (time.perf_counter() - t_e_start)
                    logger.info(f"[5] Embedding & upsert (Stage 1: {len(all_new_chunks)} chunks): {t_embed_total:.3f}s")

            # Query Qdrant for Stage 1
            t_s_start = time.perf_counter()
            retrieval_res = self.retriever.retrieve(
                query=trimmed_question,
                repository_id=repository_id,
                user_id=resolved_user,
                branch=target_branch,
                top_k=min(top_k, 8),
                score_threshold=score_threshold,
            )
            t_search_total += (time.perf_counter() - t_s_start)
            retrieved_chunks = retrieval_res.chunks
            logger.info(f"[6] Qdrant search (Stage 1: {len(retrieved_chunks)} hits): {t_search_total:.3f}s")

            # Adaptive Stage 2: If retrieved chunks are weak (< 2 chunks or low similarity) and more candidates exist
            needs_stage_2 = (
                len(candidate_files) > 5
                and (len(retrieved_chunks) < 2 or (retrieved_chunks and retrieved_chunks[0].score < 0.65))
            )
            if needs_stage_2:
                stage_2_candidates = candidate_files[5:10]
                stage_2_paths = [c.path for c in stage_2_candidates]
                logger.info(f"Triggering adaptive Stage-2 retrieval for {len(stage_2_paths)} candidate files...")

                t_f2_start = time.perf_counter()
                fetched_files_2 = fetch_file_content_fn(stage_2_paths)
                t_fetch_total += (time.perf_counter() - t_f2_start)

                if fetched_files_2:
                    t_c2_start = time.perf_counter()
                    stage_2_chunks: List[CodeChunk] = []
                    for f in fetched_files_2:
                        analyzed_files_set.add(f.path)
                        chunks = self.chunker.chunk_text(
                            content=f.content,
                            file_path=f.path,
                            language=f.language,
                            repository_id=repository_id,
                            extra_metadata={
                                "branch": target_branch,
                                "user_id": resolved_user,
                                "size_bytes": f.size_bytes,
                                "line_count": f.line_count,
                            },
                        )
                        stage_2_chunks.extend(chunks[:10])
                        if len(stage_2_chunks) >= 20:
                            stage_2_chunks = stage_2_chunks[:20]
                            break
                    t_chunk_total += (time.perf_counter() - t_c2_start)

                    if stage_2_chunks:
                        t_e2_start = time.perf_counter()
                        self._embed_and_upsert_chunks(
                            chunks=stage_2_chunks,
                            repository_id=repository_id,
                            user_id=resolved_user,
                            branch=target_branch,
                        )
                        t_embed_total += (time.perf_counter() - t_e2_start)

                    # Re-query Qdrant with expanded candidate pool
                    t_s2_start = time.perf_counter()
                    retrieval_res = self.retriever.retrieve(
                        query=trimmed_question,
                        repository_id=repository_id,
                        user_id=resolved_user,
                        branch=target_branch,
                        top_k=min(top_k, 8),
                        score_threshold=score_threshold,
                    )
                    t_search_total += (time.perf_counter() - t_s2_start)
                    retrieved_chunks = retrieval_res.chunks
        else:
            # Direct Qdrant search (e.g. for local workspaces or pre-indexed repositories)
            t_s_start = time.perf_counter()
            retrieval_res = self.retriever.retrieve(
                query=trimmed_question,
                repository_id=repository_id,
                user_id=resolved_user,
                branch=target_branch,
                top_k=min(top_k, 8),
                score_threshold=score_threshold,
            )
            t_search_total += (time.perf_counter() - t_s_start)
            retrieved_chunks = retrieval_res.chunks
            logger.info(f"[6] Qdrant search ({len(retrieved_chunks)} hits): {t_search_total:.3f}s")

        # Format citations
        sources = [
            SourceCitation(
                path=c.file_path,
                start_line=c.start_line,
                end_line=c.end_line,
                chunk_id=c.chunk_id,
                score=c.score,
            )
            for c in retrieved_chunks
        ]

        for s in sources:
            analyzed_files_set.add(s.path)

        files_analyzed_list = sorted(list(analyzed_files_set))

        # Handle empty context gracefully
        if not retrieved_chunks:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            searched_scope = f"Searched files: {', '.join(files_analyzed_list[:5])}" if files_analyzed_list else "No relevant repository files found."
            logger.info(f"[8] Response sent (insufficient evidence): {elapsed_ms/1000:.3f}s")
            return RAGResponse(
                question=trimmed_question,
                repository_id=repository_id,
                answer=(
                    f"I couldn't find enough evidence in the repository to answer confidently.\n\n"
                    f"{searched_scope}\n\n"
                    f"Please verify the relevant module or symbol name."
                ),
                sources=[],
                files_analyzed=files_analyzed_list,
                insufficient_context=True,
                retrieved_chunks_count=0,
                latency_ms=elapsed_ms,
            )

        # Step 4: Extract structural intelligence if available
        from app.intelligence.service import get_intelligence_service
        intel_service = get_intelligence_service()
        structural_context = None
        try:
            structural_context = intel_service.detect_structural_context(
                repository_id=repository_id,
                query=trimmed_question,
                branch=target_branch,
            )
        except Exception as e:
            logger.debug(f"Structural context extraction non-fatal error: {e}")

        # Step 5: Build grounded prompt
        t_prompt_start = time.perf_counter()
        system_instruction, user_prompt = PromptBuilder.build_prompt(
            question=trimmed_question,
            chunks=retrieved_chunks,
            structural_context=structural_context,
        )
        t_prompt = time.perf_counter() - t_prompt_start

        # Context safety logging (Section 5 requirement)
        prompt_chars = len(system_instruction) + len(user_prompt)
        approx_tokens = prompt_chars // 4
        logger.info(
            f"[7] LLM Context Assembly: {t_prompt:.3f}s | "
            f"Files: {len(files_analyzed_list)} | "
            f"Chunks: {len(retrieved_chunks)} | "
            f"Context size: {prompt_chars} chars (~{approx_tokens} tokens)"
        )

        # Step 6: Call LLM provider
        t_llm_start = time.perf_counter()
        try:
            answer_text = self.llm_provider.generate_text(
                prompt=user_prompt,
                system_instruction=system_instruction,
                temperature=0.2,
            )
            insufficient = (
                "insufficient" in answer_text.lower()
                or "do not have enough information" in answer_text.lower()
                or "cannot be determined" in answer_text.lower()
            )
        except Exception as e:
            logger.error(f"Error generating answer with LLM: {e}")
            answer_text = f"Error communicating with LLM model: {str(e)}"
            insufficient = True
        t_llm = time.perf_counter() - t_llm_start
        logger.info(f"[8] LLM generation: {t_llm:.3f}s (status={'OK' if not insufficient else 'Insufficient Context'})")

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.info(f"[9] Response sent: {elapsed_ms/1000:.3f}s total pipeline latency")

        return RAGResponse(
            question=trimmed_question,
            repository_id=repository_id,
            answer=answer_text,
            sources=sources,
            files_analyzed=files_analyzed_list,
            insufficient_context=insufficient,
            retrieved_chunks_count=len(retrieved_chunks),
            latency_ms=elapsed_ms,
        )
