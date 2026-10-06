"""
Health check schema models.
"""

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """
    Response schema for the /health endpoint.
    Guarantees that no secret keys or credentials are leaked in the response.
    """

    status: str = Field(..., description="Service status, typically 'healthy' or 'ok'", examples=["healthy"])
    app_name: str = Field(..., description="Application name", examples=["CodeRAG"])
    version: str = Field(..., description="Semantic version", examples=["0.1.0"])
    environment: str = Field(..., description="Current running environment", examples=["development"])
    gemini_configured: bool = Field(default=False, description="Whether Gemini API key is configured", examples=[True])
    openrouter_configured: bool = Field(default=False, description="Whether OpenRouter API key is configured", examples=[True])
    embedding_provider: str = Field(default="openrouter", description="Current embedding provider", examples=["openrouter"])
    llm_provider: str = Field(default="gemini", description="Current LLM provider", examples=["gemini"])
    qdrant_configured: bool = Field(default=True, description="Whether Qdrant vector database is configured", examples=[True])
    supabase_configured: bool = Field(default=False, description="Whether Supabase backend is configured", examples=[False])
