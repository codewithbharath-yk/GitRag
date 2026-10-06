"""
API routes subpackage.
"""

from app.api.routes.health import router as health_router
from app.api.routes.repositories import router as repositories_router
from app.api.routes.chat import router as chat_router
from app.api.routes.intelligence import router as intelligence_router
from app.api.routes.auth import router as auth_router
from app.api.routes.search import router as search_router

__all__ = [
    "health_router",
    "repositories_router",
    "chat_router",
    "intelligence_router",
    "auth_router",
    "search_router",
]
