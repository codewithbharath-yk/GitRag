"""
Application Settings & Centralized Configuration Module.

Reads configuration from environment variables or a local .env file using Pydantic Settings.
Never hardcodes secrets. Provides safe accessors for all services.
"""

from functools import lru_cache
from pathlib import Path
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


# Determine project root directory (where .env typically resides)
# settings.py -> config -> app -> backend -> project_root
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables and .env file.
    """

    # --- Application Configuration ---
    app_name: str = Field(default="CodeRAG", description="Name of the application")
    app_version: str = Field(default="0.1.0", description="Semantic version of the application")
    app_env: str = Field(default="development", description="Environment: development, production, test")
    app_host: str = Field(default="0.0.0.0", description="Host address for the server")
    app_port: int = Field(default=8000, description="Port number for the server")
    log_level: str = Field(default="INFO", description="Logging level: DEBUG, INFO, WARNING, ERROR")

    # --- Google Gemini Configuration ---
    gemini_api_key: str = Field(default="", description="Google Gemini API key for LLM and embeddings")
    gemini_model: str = Field(default="gemini-2.5-flash", description="Gemini model name for chat and explanations")
    gemini_embedding_model: str = Field(default="gemini-embedding-001", description="Gemini model name for generating embeddings")

    # --- OpenRouter API Configuration ---
    openrouter_api_key: Optional[str] = Field(default=None, description="OpenRouter API key for LLMs and embeddings")
    openrouter_base_url: str = Field(default="https://openrouter.ai/api/v1", description="OpenRouter API base URL")
    openrouter_embedding_model: str = Field(default="nvidia/nemotron-3-embed-1b:free", description="OpenRouter embedding model")
    openrouter_model: str = Field(default="nvidia/nemotron-3.5-lightning:free", description="OpenRouter LLM model for chat and code analysis")
    embedding_model: str = Field(default="nvidia/nemotron-3-embed-1b:free", description="Configured embedding model (OpenRouter Nemotron 3 Embed 1B)")

    # --- Provider Selection ---
    embedding_provider: str = Field(default="openrouter", description="Selected embedding provider: 'openrouter' or 'gemini'")
    llm_provider: str = Field(default="gemini", description="Selected LLM provider: 'gemini' or 'openrouter'")

    # --- Vector Database Configuration (Future Phases) ---
    qdrant_url: str = Field(default="http://localhost:6333", description="Qdrant vector database URL")
    qdrant_api_key: Optional[str] = Field(default=None, description="Optional Qdrant API key")

    # --- GitHub Configuration (Future Phases) ---
    github_token: Optional[str] = Field(default=None, description="Optional GitHub Personal Access Token")

    # --- Authentication & JWT Configuration ---
    auth_enabled: bool = Field(default=True, description="Enforce authentication on protected endpoints")
    enable_auth: bool = Field(default=True, description="Enforce authentication on protected endpoints (alias)")
    jwt_secret: str = Field(default="coderag-default-development-jwt-signing-secret-key-32bytes", description="Secret key for signing and verifying JWT tokens")
    jwt_algorithm: str = Field(default="HS256", description="JWT signing algorithm")
    jwt_expiration_minutes: int = Field(default=1440, description="JWT token validity in minutes (default: 24h)")

    # --- Supabase Configuration (Optional Managed DB & Auth) ---
    supabase_url: Optional[str] = Field(default=None, description="Supabase project URL")
    supabase_anon_key: Optional[str] = Field(default=None, description="Supabase public anon key (safe for client)")
    supabase_service_role_key: Optional[str] = Field(default=None, description="Supabase backend service role key (NEVER expose to client)")
    supabase_jwt_secret: Optional[str] = Field(default=None, description="Supabase JWT secret for validating user tokens")

    # --- Indexing & Resource Limits ---
    max_repo_size_mb: int = Field(default=100, description="Maximum allowable repository size in megabytes")
    max_files_per_repo: int = Field(default=500, description="Maximum number of source files indexed per repository")
    max_file_size_bytes: int = Field(default=1048576, description="Maximum individual file size in bytes (1MB)")
    max_chunks_per_repo: int = Field(default=5000, description="Maximum number of vector chunks stored per repository")
    max_query_retrieval_count: int = Field(default=20, description="Maximum top-k chunks retrieved per query")
    max_context_tokens: int = Field(default=16000, description="Maximum token limit for LLM context")
    max_concurrent_indexing_jobs: int = Field(default=3, description="Maximum concurrent background indexing jobs")
    rate_limit_requests_per_minute: int = Field(default=60, description="API rate limit per client IP / user")

    # Pydantic Settings configuration: search for .env in current working dir, backend dir, and root dir
    model_config = SettingsConfigDict(
        env_file=(
            ROOT_DIR / ".env",
            BACKEND_DIR / ".env",
            ".env",
        ),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def is_gemini_configured(self) -> bool:
        """
        Check if a non-placeholder Gemini API key is provided.
        """
        key = self.gemini_api_key.strip()
        return bool(key and key != "your_gemini_api_key_here")

    @property
    def is_openrouter_configured(self) -> bool:
        """
        Check if a valid OpenRouter API key is provided.
        """
        key = (self.openrouter_api_key or "").strip()
        return bool(key and key != "your_openrouter_api_key_here")

    @property
    def is_supabase_configured(self) -> bool:
        """
        Check if Supabase connection credentials are provided.
        """
        return bool(self.supabase_url and (self.supabase_anon_key or self.supabase_service_role_key))

    def safe_summary(self) -> dict:
        """
        Return configuration metadata without exposing secret keys.
        """
        return {
            "app_name": self.app_name,
            "app_version": self.app_version,
            "app_env": self.app_env,
            "app_host": self.app_host,
            "app_port": self.app_port,
            "log_level": self.log_level,
            "embedding_provider": self.embedding_provider,
            "embedding_model": self.embedding_model,
            "llm_provider": self.llm_provider,
            "openrouter_configured": self.is_openrouter_configured,
            "openrouter_model": self.openrouter_model,
            "openrouter_embedding_model": self.openrouter_embedding_model,
            "gemini_model": self.gemini_model,
            "gemini_embedding_model": self.gemini_embedding_model,
            "gemini_configured": self.is_gemini_configured,
            "qdrant_url": self.qdrant_url,
            "enable_auth": self.enable_auth,
            "supabase_configured": self.is_supabase_configured,
            "max_repo_size_mb": self.max_repo_size_mb,
            "max_files_per_repo": self.max_files_per_repo,
        }


@lru_cache()
def get_settings() -> Settings:
    """
    Returns a cached singleton instance of application settings.
    """
    return Settings()
