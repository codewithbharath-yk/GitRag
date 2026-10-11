"""
Repository Service Module.

Coordinates GitHub repository validation, source file ingestion, asynchronous
indexing job management, and chat querying across repositories.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
import time
import uuid

from app.github.client import (
    GitHubClient,
    GitHubError,
    EmptyRepositoryError,
    BranchNotFoundError,
    NoSupportedSourceFilesError,
    RepositoryNotFoundError,
    RepositoryAccessDeniedError,
    GitHubAuthError,
    RateLimitExceededError,
    GitHubConflictError,
    GitHubInvalidRequestError,
    GitHubServerError,
    GitHubTimeoutError,
)
from app.github.url_parser import parse_github_url, InvalidGitHubURLError
from app.rag.pipeline import RAGPipeline
from app.rag.prompt_builder import HistoryPromptBuilder
from app.schemas.repository import (
    RepoValidateResponse,
    RepoIndexResponse,
    RepoStatusResponse,
    RepoFilesResponse,
    RepoFileItem,
)
from app.schemas.chat import ChatRequest, ChatResponse, SourceCitationSchema
from app.schemas.commit import (
    CommitItem,
    CommitListResponse,
    CommitDetail,
    CommitFileChange,
    CommitStats,
    CommitAuthor,
    CommitCompareResponse,
    CommitExplainResponse,
    HistoryChatRequest,
    HistoryChatResponse,
)
from app.services.diff_service import get_diff_service
from app.utils.logger import get_logger

logger = get_logger(__name__)


from app.db.repository_store import get_data_store


@dataclass
class JobRecord:
    """In-memory record tracking an indexing task."""
    job_id: str
    repository_id: str
    user_id: str = "default_user"
    branch: str = "main"
    status: str = "queued"  # "queued", "indexing", "completed", "failed"
    files_discovered: int = 0
    files_indexed: int = 0
    chunks_indexed: int = 0
    duration_ms: Optional[float] = None
    error: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class RepositoryService:
    """
    Manages GitHub repository lifecycle, background indexing, and RAG search with user isolation.
    """

    def __init__(
        self,
        github_client: Optional[GitHubClient] = None,
        rag_pipeline: Optional[RAGPipeline] = None,
    ):
        self.github_client = github_client or GitHubClient()
        self.rag_pipeline = rag_pipeline or RAGPipeline()
        self.data_store = get_data_store()
        self._jobs: Dict[str, JobRecord] = {}
        self._repo_latest_job: Dict[str, str] = {}
        self._repo_metadata: Dict[str, Dict[str, Any]] = {}

    def validate_repository(
        self,
        url: str,
        branch: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> RepoValidateResponse:
        """
        Validate repository URL syntax, verify existence on GitHub, check commits,
        and fetch lightweight manifest before initiating any indexing.
        """
        try:
            meta = self.github_client.validate_url(url, branch=branch)
            target_branch = meta["selected_branch"]

            # Fetch lightweight file manifest tree to verify commits and source files exist
            manifest = self.github_client.fetch_repository_manifest(
                owner=meta["owner"],
                repo=meta["name"],
                branch=target_branch,
            )
            meta["manifest"] = manifest
            meta["total_files"] = manifest.get("total_files", 0)

            self._repo_metadata[meta["repository_id"]] = meta
            resolved_user = user_id or "default_user"
            self.data_store.save_repository(resolved_user, meta["repository_id"], meta)

            return RepoValidateResponse(
                valid=True,
                repository_id=meta["repository_id"],
                owner=meta["owner"],
                name=meta["name"],
                full_name=meta["full_name"],
                default_branch=meta["default_branch"],
                selected_branch=meta["selected_branch"],
                is_private=meta["is_private"],
                description=meta["description"],
                size_kb=meta["size_kb"],
                stars_count=meta["stars_count"],
                forks_count=meta["forks_count"],
                language=meta["language"],
                total_files=meta["total_files"],
            )
        except InvalidGitHubURLError as e:
            logger.warning(f"URL validation error for '{url}': {e}")
            raise
        except GitHubError as e:
            logger.warning(f"GitHub validation error for '{url}' [{e.code}]: {e.message}")
            raise

    def execute_indexing(
        self,
        job_id: str,
        url: str,
        user_id: Optional[str] = None,
        branch: Optional[str] = None,
        clean_existing: bool = False,
    ) -> None:
        """
        Lightweight repository registration worker.
        Fetches repository file tree manifest and marks repository ready for AI question answering.
        Does NOT download or embed the whole repository up front.
        """
        start_time = time.perf_counter()
        job = self._jobs.get(job_id)
        if not job:
            return

        resolved_user = user_id or job.user_id
        job.status = "indexing"
        job.updated_at = datetime.now(timezone.utc)
        self.data_store.update_indexing_job(job_id, status="indexing")
        logger.info(f"Connecting repository manifest for job '{job_id}' (repo={job.repository_id}, user={resolved_user})...")

        try:
            identity = parse_github_url(url)
            meta = self.github_client.get_repository_metadata(identity.owner, identity.name)
            meta["repository_id"] = identity.repository_id
            target_branch = branch or meta["default_branch"]
            job.branch = target_branch

            # 1. Fetch lightweight repository manifest tree
            manifest = self.github_client.fetch_repository_manifest(
                owner=identity.owner,
                repo=identity.name,
                branch=target_branch,
            )

            meta["manifest"] = manifest
            meta["total_files"] = manifest.get("total_files", 0)
            self._repo_metadata[identity.repository_id] = meta

            if clean_existing:
                self.rag_pipeline.vector_store.delete_repository(identity.repository_id, user_id=resolved_user)
                meta["total_chunks"] = 0
            else:
                meta["total_chunks"] = self.rag_pipeline.vector_store.count_repository_chunks(identity.repository_id, user_id=resolved_user)

            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            job.status = "completed"
            job.files_discovered = manifest.get("total_files", 0)
            job.files_indexed = 0
            job.chunks_indexed = meta["total_chunks"]
            job.duration_ms = elapsed_ms
            job.updated_at = datetime.now(timezone.utc)

            self.data_store.update_indexing_job(
                job_id,
                status="completed",
                files_discovered=job.files_discovered,
                files_indexed=0,
                chunks_indexed=meta["total_chunks"],
                duration_ms=elapsed_ms,
            )

            meta["indexed_at"] = datetime.utcnow()
            self.data_store.save_repository(resolved_user, identity.repository_id, meta)

            logger.info(
                f"Repository '{identity.full_name}' connected and ready for AI search "
                f"({job.files_discovered} files in manifest, duration={elapsed_ms}ms)."
            )

        except GitHubError as e:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            job.status = "failed"
            job.error = e.message
            job.duration_ms = elapsed_ms
            job.updated_at = datetime.now(timezone.utc)
            self.data_store.update_indexing_job(job_id, status="failed", error=e.message, duration_ms=elapsed_ms)
            logger.warning(f"GitHub error during repository connection job '{job_id}' [{e.code}]: {e.message}")
        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            job.status = "failed"
            job.error = str(e)
            job.duration_ms = elapsed_ms
            job.updated_at = datetime.now(timezone.utc)
            self.data_store.update_indexing_job(job_id, status="failed", error=str(e), duration_ms=elapsed_ms)
            logger.error(f"Fatal error during repository connection job '{job_id}': {e}", exc_info=True)

    def start_indexing_job(
        self,
        url: str,
        user_id: Optional[str] = None,
        branch: Optional[str] = None,
        clean_existing: bool = True,
        background_tasks: Optional[Any] = None,
    ) -> RepoIndexResponse:
        """
        Initiate a repository indexing job (either background or synchronous).
        Protects against duplicate concurrent indexing jobs for the same repository.
        """
        identity = parse_github_url(url)
        target_branch = branch or "default"
        resolved_user = user_id or "default_user"

        # Check for active indexing job
        active_key = f"{resolved_user}:{identity.repository_id}"
        existing_job_id = self._repo_latest_job.get(active_key) or self._repo_latest_job.get(identity.repository_id)
        if existing_job_id and existing_job_id in self._jobs:
            existing_job = self._jobs[existing_job_id]
            if existing_job.status in ("queued", "indexing"):
                logger.info(f"Returning active indexing job '{existing_job_id}' for repo '{identity.full_name}'")
                return RepoIndexResponse(
                    job_id=existing_job_id,
                    repository_id=identity.repository_id,
                    branch=existing_job.branch,
                    status=existing_job.status,
                    message=f"Indexing job {existing_job_id} is already {existing_job.status} for repository '{identity.full_name}'.",
                )

        job_id = f"job_{uuid.uuid4().hex[:12]}"

        job = JobRecord(
            job_id=job_id,
            repository_id=identity.repository_id,
            user_id=resolved_user,
            branch=target_branch,
            status="queued",
        )
        self._jobs[job_id] = job
        self._repo_latest_job[active_key] = job_id
        self._repo_latest_job[identity.repository_id] = job_id
        self.data_store.create_indexing_job(resolved_user, identity.repository_id, target_branch)

        if background_tasks is not None:
            background_tasks.add_task(
                self.execute_indexing,
                job_id=job_id,
                url=url,
                user_id=resolved_user,
                branch=branch,
                clean_existing=clean_existing,
            )
            initial_status = "queued"
            message = f"Indexing job {job_id} queued for repository '{identity.full_name}'."
        else:
            # Synchronous execution
            self.execute_indexing(
                job_id=job_id,
                url=url,
                user_id=resolved_user,
                branch=branch,
                clean_existing=clean_existing,
            )
            initial_status = job.status
            message = (
                f"Indexing completed for repository '{identity.full_name}' ({job.chunks_indexed} chunks stored)."
                if job.status == "completed"
                else f"Indexing failed: {job.error}"
            )

        return RepoIndexResponse(
            job_id=job_id,
            repository_id=identity.repository_id,
            branch=job.branch,
            status=initial_status,
            message=message,
        )

    def get_job_status(self, job_id: str, user_id: Optional[str] = None) -> Optional[RepoStatusResponse]:
        """
        Return status for a specific indexing job.
        """
        job = self._jobs.get(job_id)
        if not job:
            stored_job = self.data_store.get_indexing_job(job_id, user_id=user_id)
            if not stored_job:
                return None
            return RepoStatusResponse(
                repository_id=stored_job.repository_id,
                branch=stored_job.branch,
                status=stored_job.status,
                files_discovered=stored_job.files_discovered,
                files_indexed=stored_job.files_indexed,
                chunks_indexed=stored_job.chunks_indexed,
                duration_ms=stored_job.duration_ms,
                error=stored_job.error,
            )

        return RepoStatusResponse(
            repository_id=job.repository_id,
            branch=job.branch,
            status=job.status,
            files_discovered=job.files_discovered,
            files_indexed=job.files_indexed,
            chunks_indexed=job.chunks_indexed,
            duration_ms=job.duration_ms,
            error=job.error,
        )

    def get_repository_status(
        self,
        repository_id: str,
        user_id: Optional[str] = None,
    ) -> RepoStatusResponse:
        """
        Return latest indexing status for a repository or inspect current vector count scoped to user.
        """
        resolved_user = user_id or "default_user"
        latest_job_id = self._repo_latest_job.get(f"{resolved_user}:{repository_id}") or self._repo_latest_job.get(repository_id)
        if latest_job_id and latest_job_id in self._jobs:
            job = self._jobs[latest_job_id]
            return RepoStatusResponse(
                repository_id=job.repository_id,
                branch=job.branch,
                status=job.status,
                files_discovered=job.files_discovered,
                files_indexed=job.files_indexed,
                chunks_indexed=job.chunks_indexed,
                duration_ms=job.duration_ms,
                error=job.error,
            )

        # Fallback to checking Qdrant vector store
        chunks_count = self.rag_pipeline.vector_store.count_repository_chunks(repository_id, user_id=resolved_user)
        if chunks_count == 0 and not user_id:
            chunks_count = self.rag_pipeline.vector_store.count_repository_chunks(repository_id)

        if chunks_count > 0:
            return RepoStatusResponse(
                repository_id=repository_id,
                branch="main",
                status="completed",
                files_discovered=0,
                files_indexed=0,
                chunks_indexed=chunks_count,
            )

        return RepoStatusResponse(
            repository_id=repository_id,
            branch="",
            status="not_found",
            error=f"No index found for repository '{repository_id}'.",
        )

    def list_repository_files(
        self,
        repository_id: str,
        user_id: Optional[str] = None,
    ) -> RepoFilesResponse:
        """
        Return list of source files for the repository from the lightweight manifest,
        enriched with any existing chunk counts from Qdrant.
        """
        resolved_user = user_id or "default_user"
        record = self.data_store.get_repository(resolved_user, repository_id)
        manifest = (record.manifest if record else None) or self._repo_metadata.get(repository_id, {}).get("manifest")

        # Get existing indexed chunks summary from Qdrant
        raw_indexed = self.rag_pipeline.vector_store.list_repository_files(repository_id, user_id=resolved_user)
        indexed_map = {f["path"]: f for f in raw_indexed}

        if manifest and manifest.get("files"):
            file_items = []
            for item in manifest["files"]:
                p = item["path"]
                idx_info = indexed_map.get(p)
                chunks_count = idx_info["chunks_count"] if idx_info else 0
                line_count = idx_info["line_count"] if idx_info else max(1, item.get("size_bytes", 100) // 40)
                file_items.append(
                    RepoFileItem(
                        path=p,
                        language=item.get("language", "text"),
                        chunks_count=chunks_count,
                        line_count=line_count,
                    )
                )
            return RepoFilesResponse(
                repository_id=repository_id,
                total_files=len(file_items),
                files=file_items,
            )

        # Fallback to vectors present in Qdrant
        file_items = [
            RepoFileItem(
                path=f["path"],
                language=f["language"],
                chunks_count=f["chunks_count"],
                line_count=f["line_count"],
            )
            for f in raw_indexed
        ]

        return RepoFilesResponse(
            repository_id=repository_id,
            total_files=len(file_items),
            files=file_items,
        )

    def delete_repository(
        self,
        repository_id: str,
        user_id: Optional[str] = None,
    ) -> bool:
        """
        Delete a repository's metadata, jobs, and Qdrant vectors.
        """
        resolved_user = user_id or "default_user"
        self.rag_pipeline.vector_store.delete_repository(repository_id, user_id=resolved_user)
        self.data_store.delete_repository(resolved_user, repository_id)
        if f"{resolved_user}:{repository_id}" in self._repo_latest_job:
            del self._repo_latest_job[f"{resolved_user}:{repository_id}"]
        if repository_id in self._repo_latest_job:
            del self._repo_latest_job[repository_id]
        if repository_id in self._repo_metadata:
            del self._repo_metadata[repository_id]
        logger.info(f"Deleted repository '{repository_id}' for user '{resolved_user}'.")
        return True

    def query_repository(
        self,
        request: ChatRequest,
        user_id: Optional[str] = None,
    ) -> ChatResponse:
        """
        Answer a question scoped to a specific repository using Question-Driven / Lazy RAG.
        Selectively fetches and embeds only files relevant to the query.
        """
        resolved_user = user_id or "default_user"
        record = self.data_store.get_repository(resolved_user, request.repository_id)
        manifest = (record.manifest if record else None) or self._repo_metadata.get(request.repository_id, {}).get("manifest")

        target_branch = request.branch or (record.selected_branch if record else "main") or "main"

        # If manifest is not cached yet, try to load it from GitHub
        owner = record.owner if record else None
        name = record.name if record else None
        if not owner or not name:
            try:
                owner, name = self._resolve_owner_name(request.repository_id)
            except Exception:
                owner, name = None, None

        if (not manifest or not manifest.get("files")) and owner and name:
            try:
                manifest = self.github_client.fetch_repository_manifest(
                    owner=owner,
                    repo=name,
                    branch=target_branch,
                )
                if record:
                    record.manifest = manifest
            except Exception as m_err:
                logger.warning(f"Could not load GitHub manifest for lazy retrieval: {m_err}")
                manifest = None

        # Create candidate content fetch callback
        def fetch_candidate_contents(paths: List[str]):
            if not owner or not name:
                return []
            return self.github_client.fetch_files_by_paths(
                owner=owner,
                repo=name,
                file_paths=paths,
                ref=target_branch,
            )

        rag_res = self.rag_pipeline.answer_question(
            question=request.question,
            repository_id=request.repository_id,
            user_id=resolved_user,
            branch=target_branch,
            top_k=request.top_k or 5,
            manifest_files=manifest.get("files") if manifest else None,
            fetch_file_content_fn=fetch_candidate_contents,
        )

        sources = [
            SourceCitationSchema(
                path=s.path,
                start_line=s.start_line,
                end_line=s.end_line,
                chunk_id=s.chunk_id,
                score=s.score,
            )
            for s in rag_res.sources
        ]

        return ChatResponse(
            question=rag_res.question,
            repository_id=rag_res.repository_id,
            answer=rag_res.answer,
            sources=sources,
            files_analyzed=rag_res.files_analyzed,
            insufficient_context=rag_res.insufficient_context,
            retrieved_chunks_count=rag_res.retrieved_chunks_count,
            latency_ms=rag_res.latency_ms,
        )

    def _resolve_owner_name(self, repository_id: str) -> tuple[str, str]:
        """
        Resolve the GitHub owner and repository name for a given repository_id slug.
        """
        if repository_id in self._repo_metadata:
            meta = self._repo_metadata[repository_id]
            return meta["owner"], meta["name"]

        # Check persistent data store
        rec = self.data_store.get_repository("default_user", repository_id)
        if rec and rec.owner and rec.name:
            return rec.owner, rec.name

        # Check across any user in data store
        for (u, r_id), r in getattr(self.data_store, "_repositories", {}).items():
            if r_id == repository_id and r.owner and r.name:
                return r.owner, r.name

        # Parse double underscore slug (e.g. 'octocat__spoon-knife')
        if "__" in repository_id:
            parts = repository_id.split("__", 1)
            return parts[0], parts[1]

        raise RepositoryNotFoundError(f"Unknown repository identifier '{repository_id}'.")

    def list_repository_commits(
        self,
        repository_id: str,
        branch: Optional[str] = None,
        path: Optional[str] = None,
        page: int = 1,
        per_page: int = 30,
    ) -> CommitListResponse:
        """
        Retrieve paginated list of commits for a repository.
        """
        owner, name = self._resolve_owner_name(repository_id)
        raw_commits = self.github_client.list_commits(
            owner=owner,
            repo=name,
            branch=branch,
            path=path,
            page=page,
            per_page=per_page,
        )

        commit_items = [
            CommitItem(
                sha=c["sha"],
                short_sha=c["short_sha"],
                message=c["message"],
                author=CommitAuthor(**c["author"]),
                parents=c["parents"],
                html_url=c["html_url"],
            )
            for c in raw_commits
        ]

        return CommitListResponse(
            repository_id=repository_id,
            branch=branch,
            path=path,
            page=page,
            per_page=per_page,
            total_returned=len(commit_items),
            commits=commit_items,
        )

    def get_commit_detail(self, repository_id: str, commit_sha: str) -> CommitDetail:
        """
        Retrieve full details for a commit, including changed files and patch diffs.
        """
        owner, name = self._resolve_owner_name(repository_id)
        raw_detail = self.github_client.get_commit_detail(
            owner=owner,
            repo=name,
            commit_sha=commit_sha,
        )

        files = [
            CommitFileChange(
                filename=f["filename"],
                status=f["status"],
                additions=f["additions"],
                deletions=f["deletions"],
                changes=f["changes"],
                patch=f["patch"],
                patch_truncated=f["patch_truncated"],
                previous_filename=f.get("previous_filename"),
            )
            for f in raw_detail.get("files", [])
        ]

        return CommitDetail(
            repository_id=repository_id,
            sha=raw_detail["sha"],
            short_sha=raw_detail["short_sha"],
            message=raw_detail["message"],
            author=CommitAuthor(**raw_detail["author"]),
            parents=raw_detail["parents"],
            html_url=raw_detail["html_url"],
            stats=CommitStats(**raw_detail["stats"]),
            files=files,
        )

    def compare_repository_commits(
        self,
        repository_id: str,
        base: str,
        head: str,
    ) -> CommitCompareResponse:
        """
        Compare two revisions or commits on GitHub.
        """
        owner, name = self._resolve_owner_name(repository_id)
        raw_comp = self.github_client.compare_commits(
            owner=owner,
            repo=name,
            base=base,
            head=head,
        )

        files = [
            CommitFileChange(
                filename=f["filename"],
                status=f["status"],
                additions=f["additions"],
                deletions=f["deletions"],
                changes=f["changes"],
                patch=f["patch"],
                patch_truncated=f["patch_truncated"],
                previous_filename=f.get("previous_filename"),
            )
            for f in raw_comp.get("files", [])
        ]

        return CommitCompareResponse(
            repository_id=repository_id,
            base_commit=base,
            head_commit=head,
            status=raw_comp.get("status", "unknown"),
            ahead_by=raw_comp.get("ahead_by", 0),
            behind_by=raw_comp.get("behind_by", 0),
            total_commits=raw_comp.get("total_commits", 0),
            files=files,
        )

    def explain_commit(
        self,
        repository_id: str,
        commit_sha: str,
        detail_level: str = "standard",
    ) -> CommitExplainResponse:
        """
        Synthesize an evidence-backed AI explanation for a single commit using Gemini.
        """
        start_time = time.perf_counter()
        commit_detail = self.get_commit_detail(repository_id, commit_sha)
        diff_service = get_diff_service()
        evidence = diff_service.format_commit_evidence_for_prompt(commit_detail)

        sys_inst, user_prompt = HistoryPromptBuilder.build_commit_explain_prompt(
            commit_evidence=evidence,
            detail_level=detail_level,
        )

        explanation = self.rag_pipeline.llm_provider.generate_text(
            prompt=user_prompt,
            system_instruction=sys_inst,
            temperature=0.2,
        )
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        summary_data = diff_service.summarize_commit_diff(commit_detail)
        observed = [
            f"{f.status.upper()} {f.filename} (+{f.additions}/-{f.deletions})"
            for f in summary_data["files"]
        ]

        return CommitExplainResponse(
            repository_id=repository_id,
            commit_sha=commit_detail.sha,
            short_sha=commit_detail.short_sha,
            message=commit_detail.message,
            explanation=explanation,
            observed_changes=observed,
            inferred_intent=commit_detail.message.splitlines()[0] if commit_detail.message else None,
            files_analyzed=[f.filename for f in commit_detail.files],
            latency_ms=elapsed_ms,
        )

    def answer_history_query(
        self,
        repository_id: str,
        request: HistoryChatRequest,
    ) -> HistoryChatResponse:
        """
        Answer natural language questions about repository history and commit diffs.
        """
        start_time = time.perf_counter()
        diff_service = get_diff_service()

        referenced_commits: List[str] = []
        referenced_files: List[str] = []
        diff_evidence: Optional[str] = None

        if request.commit_sha:
            commit_detail = self.get_commit_detail(repository_id, request.commit_sha)
            referenced_commits.append(commit_detail.sha)
            referenced_files.extend([f.filename for f in commit_detail.files])
            diff_evidence = diff_service.format_commit_evidence_for_prompt(commit_detail)
            summaries_text = (
                f"Focal Commit: {commit_detail.short_sha} - {commit_detail.message}\n"
                f"Author: {commit_detail.author.name} on {commit_detail.author.date}"
            )
        else:
            commits_resp = self.list_repository_commits(
                repository_id=repository_id,
                branch=request.branch,
                path=request.path,
                page=1,
                per_page=10,
            )
            referenced_commits = [c.sha for c in commits_resp.commits]
            lines = [
                f"- Commit {c.short_sha} by {c.author.name} on {c.author.date}: {c.message}"
                for c in commits_resp.commits
            ]
            summaries_text = (
                "\n".join(lines)
                if lines
                else "No commit logs found for the queried branch or path."
            )

            # If a specific file path was supplied, grab diff evidence from the latest modifying commit
            if request.path and commits_resp.commits:
                latest_sha = commits_resp.commits[0].sha
                latest_detail = self.get_commit_detail(repository_id, latest_sha)
                diff_evidence = diff_service.format_commit_evidence_for_prompt(latest_detail)
                referenced_files.append(request.path)

        sys_inst, user_prompt = HistoryPromptBuilder.build_history_query_prompt(
            question=request.question,
            commit_summaries=summaries_text,
            diff_evidence=diff_evidence,
        )

        answer = self.rag_pipeline.llm_provider.generate_text(
            prompt=user_prompt,
            system_instruction=sys_inst,
            temperature=0.2,
        )
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        insufficient = (
            "cannot be determined" in answer.lower()
            or "not found" in answer.lower()
            or "insufficient" in answer.lower()
            or "no evidence" in answer.lower()
        )

        return HistoryChatResponse(
            question=request.question,
            repository_id=repository_id,
            commit_sha=request.commit_sha,
            answer=answer,
            referenced_commits=referenced_commits[:5],
            referenced_files=referenced_files,
            insufficient_evidence=insufficient,
            latency_ms=elapsed_ms,
        )


# Global singleton instance for application routes
_repository_service: Optional[RepositoryService] = None


def get_repository_service() -> RepositoryService:
    """
    Factory function returning the singleton RepositoryService.
    """
    global _repository_service
    if _repository_service is None:
        _repository_service = RepositoryService()
    return _repository_service
