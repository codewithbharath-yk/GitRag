# Multi-stage Dockerfile for CodeRAG FastAPI Backend
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Final runtime image
FROM python:3.11-slim AS runtime

WORKDIR /app

# Install runtime dependencies (git, curl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed python dependencies from builder
COPY --from=builder /install /usr/local

# Create non-root system user for security
RUN groupadd -r appgroup && useradd -r -g appgroup -u 1001 appuser

# Pre-cache local BGE embedding model into system cache for instant startup
ENV HF_HOME=/app/.cache/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/app/.cache/huggingface
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-small-en-v1.5', cache_folder='/app/.cache/huggingface')"

# Copy application source code
COPY . /app

# Ensure proper permissions
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_ENV=production \
    APP_HOST=0.0.0.0 \
    APP_PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Start uvicorn binding dynamically to $PORT or default 8000
CMD sh -c "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2"
