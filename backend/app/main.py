"""
Main FastAPI Application Entry Point for CodeRAG.

Configures application lifecycle, CORS, routing, and centralized error handling.
"""

import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import (
    health_router,
    repositories_router,
    chat_router,
    intelligence_router,
    auth_router,
    search_router,
)
from app.config.settings import get_settings
from app.utils.logger import get_logger, setup_logging

settings = get_settings()
setup_logging(settings.log_level)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle manager for startup and shutdown hooks.
    """
    logger.info(f"Starting {settings.app_name} v{settings.app_version} in [{settings.app_env}] mode...")
    logger.info(f"Gemini LLM model configured: {settings.gemini_model}")
    logger.info(f"Gemini API key configured: {settings.is_gemini_configured}")
    logger.info(f"Qdrant configured at: {settings.qdrant_url}")
    logger.info(f"Authentication enabled: {settings.auth_enabled}")
    if not settings.is_gemini_configured:
        logger.warning(
            "GEMINI_API_KEY is not set or using placeholder value. "
            "LLM generation features will require a valid key in .env"
        )
    yield
    logger.info(f"Shutting down {settings.app_name} backend...")


def create_app() -> FastAPI:
    """
    FastAPI Application Factory with Production Hardening.
    """
    app = FastAPI(
        title="CodeRAG API",
        description=(
            "AI GitHub Codebase Assistant backend powered by FastAPI, "
            "Retrieval-Augmented Generation (RAG), and Google Gemini."
        ),
        version=settings.app_version,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # 1. CORS Middleware
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    if settings.app_env != "production":
        allowed_origins.append("*")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 2. Request ID & Security Headers Middleware
    @app.middleware("http")
    async def security_and_tracing_middleware(request: Request, call_next):
        req_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:12]}"
        request.state.request_id = req_id
        start_time = time.perf_counter()

        response = await call_next(request)

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        response.headers["X-Request-ID"] = req_id
        response.headers["X-Response-Time"] = f"{duration_ms}ms"

        # Production Security Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Log request summary
        logger.info(
            f"[{req_id}] {request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)"
        )
        return response

    # 3. Mount routes at root, /api, and /api/v1 prefix
    for prefix in ["", "/api", "/api/v1"]:
        app.include_router(auth_router, prefix=prefix)
        app.include_router(health_router, prefix=prefix)
        app.include_router(repositories_router, prefix=prefix)
        app.include_router(chat_router, prefix=prefix)
        app.include_router(intelligence_router, prefix=prefix)
        app.include_router(search_router, prefix=prefix)

    # Friendly root endpoint
    @app.get("/", tags=["Root"])
    async def root():
        return {
            "message": "Welcome to CodeRAG API",
            "version": settings.app_version,
            "docs": "/docs",
            "health": "/health",
            "auth_enabled": settings.auth_enabled,
        }

    # Global exception handler for uncaught server errors
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        req_id = getattr(request.state, "request_id", "unknown")
        logger.error(f"[{req_id}] Unhandled error processing {request.url.path}: {exc}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal Server Error",
                "message": "An unexpected error occurred. Please contact support with the request ID.",
                "request_id": req_id,
            },
        )

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=(settings.app_env == "development"),
    )
