"""
Application Data Store & Ownership Manager.

Manages repository ownership, metadata records, indexing jobs, and user workspaces.
Enforces strict (user_id, repository_id) isolation across all storage operations.
"""

import uuid
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from pydantic import BaseModel, Field

from app.utils.logger import get_logger

logger = get_logger(__name__)


class StoredRepositoryRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    repository_id: str
    owner: str
    name: str
    full_name: str
    default_branch: str = "main"
    selected_branch: str = "main"
    is_private: bool = False
    description: Optional[str] = None
    stars_count: int = 0
    forks_count: int = 0
    language: Optional[str] = None
    total_files: int = 0
    total_chunks: int = 0
    manifest: Optional[Dict[str, Any]] = None
    latest_commit_sha: Optional[str] = None
    indexed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class StoredIndexingJob(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    repository_id: str
    branch: str
    status: str = "queued"  # queued, indexing, completed, failed
    files_discovered: int = 0
    files_indexed: int = 0
    chunks_indexed: int = 0
    duration_ms: Optional[float] = None
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RepositoryDataStore:
    """
    In-memory and persistent repository data store enforcing user isolation.
    """

    def __init__(self):
        # Key: (user_id, repository_id) -> StoredRepositoryRecord
        self._repositories: Dict[Tuple[str, str], StoredRepositoryRecord] = {}
        # Key: job_id -> StoredIndexingJob
        self._jobs: Dict[str, StoredIndexingJob] = {}

    def save_repository(
        self,
        user_id: str,
        repository_id: str,
        data: Dict[str, Any],
    ) -> StoredRepositoryRecord:
        """
        Create or update a repository record owned by user_id.
        """
        key = (user_id, repository_id)
        now = datetime.utcnow()
        if key in self._repositories:
            record = self._repositories[key]
            for k, v in data.items():
                if hasattr(record, k):
                    setattr(record, k, v)
            record.updated_at = now
        else:
            record = StoredRepositoryRecord(
                user_id=user_id,
                repository_id=repository_id,
                owner=data.get("owner", ""),
                name=data.get("name", ""),
                full_name=data.get("full_name", f"{data.get('owner', '')}/{data.get('name', '')}"),
                default_branch=data.get("default_branch", "main"),
                selected_branch=data.get("selected_branch", "main"),
                is_private=data.get("is_private", False),
                description=data.get("description"),
                stars_count=data.get("stars_count", 0),
                forks_count=data.get("forks_count", 0),
                language=data.get("language"),
                total_files=data.get("total_files", 0),
                total_chunks=data.get("total_chunks", 0),
                manifest=data.get("manifest"),
                latest_commit_sha=data.get("latest_commit_sha"),
                indexed_at=data.get("indexed_at", now),
                created_at=now,
                updated_at=now,
            )
            self._repositories[key] = record

        return record

    def get_repository(
        self,
        user_id: str,
        repository_id: str,
    ) -> Optional[StoredRepositoryRecord]:
        """
        Retrieve a repository record strictly if owned by user_id.
        """
        return self._repositories.get((user_id, repository_id))

    def list_repositories(self, user_id: str) -> List[StoredRepositoryRecord]:
        """
        List all repository records owned by user_id.
        """
        return [
            rec for (u_id, _), rec in self._repositories.items()
            if u_id == user_id
        ]

    def delete_repository(self, user_id: str, repository_id: str) -> bool:
        """
        Delete a repository record owned by user_id.
        """
        key = (user_id, repository_id)
        if key in self._repositories:
            del self._repositories[key]
            return True
        return False

    def create_indexing_job(
        self,
        user_id: str,
        repository_id: str,
        branch: str,
    ) -> StoredIndexingJob:
        """
        Create a new tracked indexing job.
        """
        job = StoredIndexingJob(
            user_id=user_id,
            repository_id=repository_id,
            branch=branch,
            status="queued",
        )
        self._jobs[job.id] = job
        return job

    def update_indexing_job(
        self,
        job_id: str,
        status: Optional[str] = None,
        files_discovered: Optional[int] = None,
        files_indexed: Optional[int] = None,
        chunks_indexed: Optional[int] = None,
        duration_ms: Optional[float] = None,
        error: Optional[str] = None,
    ) -> Optional[StoredIndexingJob]:
        """
        Update the progress and state of an indexing job.
        """
        job = self._jobs.get(job_id)
        if not job:
            return None

        if status:
            job.status = status
        if files_discovered is not None:
            job.files_discovered = files_discovered
        if files_indexed is not None:
            job.files_indexed = files_indexed
        if chunks_indexed is not None:
            job.chunks_indexed = chunks_indexed
        if duration_ms is not None:
            job.duration_ms = duration_ms
        if error is not None:
            job.error = error
        job.updated_at = datetime.utcnow()
        return job

    def get_indexing_job(self, job_id: str, user_id: Optional[str] = None) -> Optional[StoredIndexingJob]:
        """
        Get indexing job by ID, optionally verifying user_id ownership.
        """
        job = self._jobs.get(job_id)
        if not job:
            return None
        if user_id and job.user_id != user_id:
            return None
        return job

    def get_latest_job_for_repo(
        self,
        user_id: str,
        repository_id: str,
    ) -> Optional[StoredIndexingJob]:
        """
        Get the most recent indexing job for a user's repository.
        """
        matching = [
            j for j in self._jobs.values()
            if j.user_id == user_id and j.repository_id == repository_id
        ]
        if not matching:
            return None
        return sorted(matching, key=lambda j: j.created_at, reverse=True)[0]


# Global singleton instance
_data_store_instance: Optional[RepositoryDataStore] = None


def get_data_store() -> RepositoryDataStore:
    global _data_store_instance
    if _data_store_instance is None:
        _data_store_instance = RepositoryDataStore()
    return _data_store_instance
