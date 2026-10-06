"""
RAG (Retrieval-Augmented Generation) Core Module for CodeRAG.
"""

from app.rag.file_scanner import FileScanner, DiscoveredFile
from app.rag.chunker import LineChunker, CodeChunk
from app.rag.embeddings import (
    BaseEmbeddingProvider,
    GeminiEmbeddingProvider,
    OpenRouterEmbeddingProvider,
    get_embedding_provider,
)
from app.rag.vector_store import QdrantVectorStore
from app.rag.retriever import CodeRetriever, RetrievedChunk, RetrievalResult
from app.rag.prompt_builder import PromptBuilder
from app.rag.pipeline import RAGPipeline, IndexingResult, RAGResponse, SourceCitation

__all__ = [
    "FileScanner",
    "DiscoveredFile",
    "LineChunker",
    "CodeChunk",
    "BaseEmbeddingProvider",
    "GeminiEmbeddingProvider",
    "OpenRouterEmbeddingProvider",
    "get_embedding_provider",
    "QdrantVectorStore",
    "CodeRetriever",
    "RetrievedChunk",
    "RetrievalResult",
    "PromptBuilder",
    "RAGPipeline",
    "IndexingResult",
    "RAGResponse",
    "SourceCitation",
]
