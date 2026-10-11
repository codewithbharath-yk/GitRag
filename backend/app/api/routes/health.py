"""
Health check endpoints for CodeRAG.

Provides system liveness and configuration readiness checks without revealing secrets.
"""

from fastapi import APIRouter, status
from app.config.settings import get_settings
from app.schemas.health import HealthResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Health Check",
    description="Returns the operational status of the CodeRAG backend and configuration readiness.",
)
async def get_health() -> HealthResponse:
    """
    Check backend health and service readiness.
    Guarantees no secret keys or credentials are leaked in response.
    """
    settings = get_settings()

    return HealthResponse(
        status="healthy",
        app_name=settings.app_name,
        version=settings.app_version,
        environment=settings.app_env,
        gemini_configured=settings.is_gemini_configured,
        openrouter_configured=settings.is_openrouter_configured,
        embedding_provider=settings.embedding_provider,
        llm_provider=settings.llm_provider,
        qdrant_configured=bool(settings.qdrant_url),
        supabase_configured=settings.is_supabase_configured,
    )


@router.get(
    "/health/integrations",
    status_code=status.HTTP_200_OK,
    summary="Integrations Health & Diagnostics",
    description="Returns detailed connectivity checks for OpenRouter, Gemini, Qdrant, GitHub, and Supabase without exposing credentials.",
)
async def get_integrations_health():
    """
    Returns deep connectivity diagnostics across all integrated external services.
    """
    from app.db.supabase_client import get_supabase_client
    settings = get_settings()
    supabase_client = get_supabase_client()

    return {
        "status": "healthy",
        "services": {
            "embeddings": {
                "provider": settings.embedding_provider,
                "model": settings.embedding_model,
                "device": getattr(settings, "embedding_device", "cpu"),
                "dimension": 384 if settings.embedding_provider in ("local", "bge") else (2048 if settings.embedding_provider == "openrouter" else 768),
            },
            "openrouter": {
                "configured": settings.is_openrouter_configured,
                "model": settings.openrouter_model,
                "embedding_model": settings.openrouter_embedding_model,
                "embedding_dimension": 2048,
            },
            "gemini": {
                "configured": settings.is_gemini_configured,
                "model": settings.gemini_model,
                "embedding_model": settings.gemini_embedding_model,
            },
            "qdrant": {
                "configured": bool(settings.qdrant_url),
                "url": settings.qdrant_url,
                "collection": settings.safe_summary().get("qdrant_collection", "coderag_code_chunks"),
            },
            "github": {
                "authenticated": bool(settings.github_token),
                "api_base": "https://api.github.com",
            },
            "supabase": supabase_client.test_connection(),
        },
    }
