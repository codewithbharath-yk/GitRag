"""
Repository Management API Routes.

Exposes endpoints for validating GitHub repository URLs, triggering asynchronous
indexing jobs, checking indexing status, and listing indexed files.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, BackgroundTasks, status, Query, Depends

from app.auth.models import User
from app.auth.dependencies import get_current_user, get_optional_user
from app.github.client import (
    RepositoryNotFoundError,
    RepositoryAccessDeniedError,
    RateLimitExceededError,
    GitHubError,
)
from app.github.url_parser import InvalidGitHubURLError
from app.schemas.repository import (
    RepoValidateRequest,
    RepoValidateResponse,
    RepoIndexRequest,
    RepoIndexResponse,
    RepoStatusResponse,
    RepoFilesResponse,
)
from app.schemas.commit import (
    CommitListResponse,
    CommitDetail,
    CommitCompareResponse,
    CommitExplainRequest,
    CommitExplainResponse,
    HistoryChatRequest,
    HistoryChatResponse,
)
from app.services.repository_service import get_repository_service
from app.db.repository_store import get_data_store, StoredRepositoryRecord

router = APIRouter(prefix="/repositories", tags=["Repositories"])



@router.get(
    "",
    response_model=List[Dict[str, Any]],
    status_code=status.HTTP_200_OK,
    summary="List User Repositories",
    description="Returns all repositories registered and indexed by the authenticated user.",
)
async def list_user_repositories(
    current_user: User = Depends(get_optional_user),
) -> List[Dict[str, Any]]:
    data_store = get_data_store()
    repos = data_store.list_repositories(current_user.id)
    return [
        {
            "id": r.id,
            "repository_id": r.repository_id,
            "owner": r.owner,
            "name": r.name,
            "full_name": r.full_name,
            "default_branch": r.default_branch,
            "selected_branch": r.selected_branch,
            "is_private": r.is_private,
            "description": r.description,
            "stars_count": r.stars_count,
            "forks_count": r.forks_count,
            "language": r.language,
            "total_files": r.total_files,
            "total_chunks": r.total_chunks,
            "indexed_at": r.indexed_at.isoformat() if r.indexed_at else None,
            "created_at": r.created_at.isoformat(),
        }
        for r in repos
    ]


@router.delete(
    "/{repository_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Repository",
    description="Deletes repository metadata and associated Qdrant vectors for the authenticated user.",
)
async def delete_repository(
    repository_id: str,
    current_user: User = Depends(get_optional_user),
) -> Dict[str, Any]:
    repo_service = get_repository_service()
    repo_service.delete_repository(repository_id, user_id=current_user.id)
    return {
        "status": "success",
        "message": f"Repository '{repository_id}' and all its indexed vectors successfully deleted.",
        "repository_id": repository_id,
    }


@router.post(
    "/validate",
    response_model=RepoValidateResponse,
    status_code=status.HTTP_200_OK,
    summary="Validate GitHub Repository",
    description="Validates a GitHub repository URL or slug and returns public metadata.",
)
async def validate_repository(
    request: RepoValidateRequest,
    current_user: User = Depends(get_optional_user),
) -> RepoValidateResponse:
    repo_service = get_repository_service()
    try:
        return repo_service.validate_repository(url=request.url, branch=request.branch, user_id=current_user.id)
    except InvalidGitHubURLError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid repository URL: {str(e)}",
        )
    except RepositoryNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except RepositoryAccessDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
    except RateLimitExceededError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e),
        )
    except GitHubError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"GitHub integration error: {str(e)}",
        )


@router.post(
    "/index",
    response_model=RepoIndexResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start Repository Indexing",
    description="Queues a background job to download and index repository source files into Qdrant.",
)
async def index_repository(
    request: RepoIndexRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_optional_user),
) -> RepoIndexResponse:
    repo_service = get_repository_service()
    try:
        # Pre-validate URL syntax before queuing
        return repo_service.start_indexing_job(
            url=request.url,
            user_id=current_user.id,
            branch=request.branch,
            clean_existing=request.clean_existing,
            background_tasks=background_tasks,
        )
    except InvalidGitHubURLError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid repository URL: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate indexing job: {str(e)}",
        )


class LocalIndexRequest(BaseModel):
    directory_path: str = Field(default="sample_code/sample_repo", description="Local directory path")
    repository_id: str = Field(default="sample_repo", description="Target repository ID")
    branch: str = Field(default="main", description="Branch name")


@router.post(
    "/index-local",
    status_code=status.HTTP_200_OK,
    summary="Index Local Repository Workspace",
    description="Indexes a local sample directory directly into CodeRAG.",
)
async def index_local_repository(
    request: LocalIndexRequest,
    current_user: User = Depends(get_optional_user),
):
    repo_service = get_repository_service()
    try:
        from pathlib import Path
        path = Path(request.directory_path)
        if not path.is_absolute():
            root = Path(__file__).resolve().parent.parent.parent.parent
            path = (root / request.directory_path).resolve()

        res = repo_service.rag_pipeline.index_directory(
            directory_path=path,
            repository_id=request.repository_id,
            user_id=current_user.id,
            branch=request.branch,
            clean_existing=True,
        )
        return {
            "repository_id": request.repository_id,
            "branch": request.branch,
            "status": "completed",
            "files_discovered": res.files_discovered,
            "files_indexed": res.files_indexed,
            "chunks_indexed": res.chunks_indexed,
            "duration_ms": res.duration_ms,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to index local directory: {str(e)}",
        )


@router.get(
    "/{repository_id}/status",
    response_model=RepoStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Repository Indexing Status",
    description="Returns the progress, chunk count, and health of a repository's index.",
)
async def get_repository_status(
    repository_id: str,
    current_user: User = Depends(get_optional_user),
) -> RepoStatusResponse:
    repo_service = get_repository_service()
    status_res = repo_service.get_repository_status(repository_id, user_id=current_user.id)
    if status_res.status == "not_found":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No index found for repository '{repository_id}'.",
        )
    return status_res


@router.get(
    "/{repository_id}",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Get Repository Details",
    description="Returns detailed metadata and indexing status for a specific repository.",
)
async def get_repository_details(
    repository_id: str,
    current_user: User = Depends(get_optional_user),
) -> Dict[str, Any]:
    data_store = get_data_store()
    repo_service = get_repository_service()
    record = data_store.get_repository(current_user.id, repository_id)
    status_res = repo_service.get_repository_status(repository_id, user_id=current_user.id)

    if record:
        return {
            "id": record.id,
            "repository_id": record.repository_id,
            "owner": record.owner,
            "name": record.name,
            "full_name": record.full_name,
            "default_branch": record.default_branch,
            "selected_branch": record.selected_branch,
            "is_private": record.is_private,
            "description": record.description,
            "stars_count": record.stars_count,
            "forks_count": record.forks_count,
            "language": record.language,
            "total_files": status_res.files_indexed or record.total_files,
            "total_chunks": status_res.chunks_indexed or record.total_chunks,
            "status": status_res.status,
            "indexed_at": record.indexed_at.isoformat() if record.indexed_at else None,
            "created_at": record.created_at.isoformat(),
        }

    if status_res.status != "not_found":
        parts = repository_id.split("__", 1)
        owner = parts[0] if len(parts) > 0 else "unknown"
        name = parts[1] if len(parts) > 1 else repository_id
        return {
            "id": repository_id,
            "repository_id": repository_id,
            "owner": owner,
            "name": name,
            "full_name": f"{owner}/{name}",
            "default_branch": status_res.branch,
            "selected_branch": status_res.branch,
            "is_private": False,
            "description": None,
            "stars_count": 0,
            "forks_count": 0,
            "language": None,
            "total_files": status_res.files_indexed,
            "total_chunks": status_res.chunks_indexed,
            "status": status_res.status,
            "indexed_at": None,
            "created_at": datetime.utcnow().isoformat(),
        }

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Repository '{repository_id}' not found.",
    )


@router.post(
    "/{repository_id}/reindex",
    response_model=RepoIndexResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Re-index Repository",
    description="Clears existing vectors and triggers a full background reindexing of the repository.",
)
async def reindex_repository(
    repository_id: str,
    background_tasks: BackgroundTasks,
    branch: Optional[str] = Query(default=None, description="Optional branch override"),
    current_user: User = Depends(get_optional_user),
) -> RepoIndexResponse:
    data_store = get_data_store()
    repo_service = get_repository_service()
    record = data_store.get_repository(current_user.id, repository_id)

    target_url = None
    target_branch = branch

    if record:
        target_url = f"https://github.com/{record.owner}/{record.name}"
        if not target_branch:
            target_branch = record.selected_branch or record.default_branch
    elif "__" in repository_id:
        owner, name = repository_id.split("__", 1)
        target_url = f"https://github.com/{owner}/{name}"
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repository_id}' not found to reindex.",
        )

    try:
        return repo_service.start_indexing_job(
            url=target_url,
            user_id=current_user.id,
            branch=target_branch,
            clean_existing=True,
            background_tasks=background_tasks,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate reindexing: {str(e)}",
        )



@router.get(
    "/{repository_id}/files",
    response_model=RepoFilesResponse,
    status_code=status.HTTP_200_OK,
    summary="List Indexed Files",
    description="Returns the list of indexed files and line counts for a repository.",
)
async def list_repository_files(
    repository_id: str,
    current_user: User = Depends(get_optional_user),
) -> RepoFilesResponse:
    repo_service = get_repository_service()
    files_res = repo_service.list_repository_files(repository_id, user_id=current_user.id)
    if files_res.total_files == 0:
        # Verify if repository exists
        status_res = repo_service.get_repository_status(repository_id, user_id=current_user.id)
        if status_res.status == "not_found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No indexed files found for repository '{repository_id}'.",
            )
    return files_res


@router.get(
    "/{repository_id}/commits",
    response_model=CommitListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Repository Commits",
    description="Retrieve paginated commit log for a repository with optional branch and file path filtering.",
)
async def list_repository_commits(
    repository_id: str,
    branch: Optional[str] = Query(default=None, description="Branch name or commit ref"),
    path: Optional[str] = Query(default=None, description="Filter commits touching a specific file path"),
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    per_page: int = Query(default=30, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_optional_user),
) -> CommitListResponse:
    repo_service = get_repository_service()
    try:
        return repo_service.list_repository_commits(
            repository_id=repository_id,
            branch=branch,
            path=path,
            page=page,
            per_page=per_page,
        )
    except RepositoryNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except RepositoryAccessDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RateLimitExceededError as e:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))
    except GitHubError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"GitHub error: {str(e)}")


@router.get(
    "/{repository_id}/commits/{commit_sha}",
    response_model=CommitDetail,
    status_code=status.HTTP_200_OK,
    summary="Get Commit Detail and Diffs",
    description="Retrieve full details for a commit including changed files, stats, and unified diff patches.",
)
async def get_commit_detail(
    repository_id: str,
    commit_sha: str,
    current_user: User = Depends(get_optional_user),
) -> CommitDetail:
    repo_service = get_repository_service()
    try:
        return repo_service.get_commit_detail(
            repository_id=repository_id,
            commit_sha=commit_sha,
        )
    except RepositoryNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except RepositoryAccessDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RateLimitExceededError as e:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))
    except GitHubError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"GitHub error: {str(e)}")


@router.get(
    "/{repository_id}/compare/{base}...{head}",
    response_model=CommitCompareResponse,
    status_code=status.HTTP_200_OK,
    summary="Compare Commits or Revisions",
    description="Compare two revisions or commits on GitHub.",
)
async def compare_repository_commits(
    repository_id: str,
    base: str,
    head: str,
    current_user: User = Depends(get_optional_user),
) -> CommitCompareResponse:
    repo_service = get_repository_service()
    try:
        return repo_service.compare_repository_commits(
            repository_id=repository_id,
            base=base,
            head=head,
        )
    except RepositoryNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except RateLimitExceededError as e:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))
    except GitHubError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"GitHub error: {str(e)}")


@router.post(
    "/{repository_id}/commits/{commit_sha}/explain",
    response_model=CommitExplainResponse,
    status_code=status.HTTP_200_OK,
    summary="Explain Commit Diff with Gemini",
    description="Generate an evidence-backed explanation of code changes in a commit.",
)
async def explain_commit(
    repository_id: str,
    commit_sha: str,
    request: Optional[CommitExplainRequest] = None,
    current_user: User = Depends(get_optional_user),
) -> CommitExplainResponse:
    repo_service = get_repository_service()
    detail_level = request.detail_level if request else "standard"
    try:
        return repo_service.explain_commit(
            repository_id=repository_id,
            commit_sha=commit_sha,
            detail_level=detail_level,
        )
    except RepositoryNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except RateLimitExceededError as e:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))
    except GitHubError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"GitHub error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to explain commit: {str(e)}")


@router.post(
    "/{repository_id}/commits/chat",
    response_model=HistoryChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Ask Question About Git History",
    description="Ask natural language questions about commit history, diffs, and evolution of the repository.",
)
async def chat_history(
    repository_id: str,
    request: HistoryChatRequest,
    current_user: User = Depends(get_optional_user),
) -> HistoryChatResponse:
    repo_service = get_repository_service()
    try:
        return repo_service.answer_history_query(
            repository_id=repository_id,
            request=request,
        )
    except RepositoryNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except RateLimitExceededError as e:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))
    except GitHubError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"GitHub error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to query history: {str(e)}")

