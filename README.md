# CodeRAG — AI GitHub Codebase Assistant

**CodeRAG** is an intelligent developer assistant that connects to real GitHub repositories and lets you ask natural-language questions about actual source code.

Instead of answering with generic programming advice, CodeRAG retrieves the exact code snippets and files from the repository using **Retrieval-Augmented Generation (RAG)** and presents evidence-backed answers with exact file paths and line ranges.

---

## 📖 How It Works: The GitHub Ingestion & RAG Architecture

CodeRAG operates through two distinct pipelines:

```
1. GITHUB INGESTION & INDEXING PIPELINE:
   GitHub Repository URL ➔ Safe URL Parser ➔ GitHub API / Tree Discovery
   ➔ File Whitelist & Ignore Filters (no .git, no node_modules, no binaries)
   ➔ LineChunker (1-indexed line numbers) ➔ Gemini gemini-embedding-001 (768-dim)
   ➔ Qdrant Vector Database (Scoped with repository_id & branch payloads)

2. GROUNDED QUESTION-ANSWERING PIPELINE:
   User Question + repo_id ➔ Query Embedding ➔ Filtered Vector Similarity Search
   ➔ Grounded PromptBuilder (Code isolation & citation instructions)
   ➔ Google Gemini LLM ➔ Evidence-Backed Answer with Source Citations
```

---

## 🏗️ Project Architecture & Status

| Phase | Description | Status |
|---|---|---|
| **Phase 0** | **Foundation, Configuration, FastAPI Skeleton & Gemini Verification** | ✅ Completed |
| **Phase 1** | **Core RAG Pipeline (Scanner, Line Chunker, Embeddings, Qdrant, QA)** | ✅ Completed |
| **Phase 2 & GitHub** | **GitHub Ingestion, URL Validation, FastAPI REST Endpoints & Status Polling** | ✅ Completed |
| **Phase 4** | **React Frontend UI (Chat interface, repository explorer, source viewer, Tailwind CSS)** | ✅ Completed |
| **Phase 5** | **Git History & Commit Intelligence (Commit logs, unified diff parser, Gemini diff analysis & history chat)** | ✅ Completed |
| **Phase 6** | Tree-sitter Code Intelligence & Symbol Graphs | ⏳ Upcoming |
| **Phase 7** | Production Hardening & Deployment | ⏳ Upcoming |

---

## 📁 Repository Structure

```
GitRag/
├── .env.example                # Sanitized template for environment variables (copy to .env)
├── .gitignore                  # Prevents committing virtualenv, cache, and secrets
├── README.md                   # Complete project documentation and guide
│
├── frontend/                   # Modern React + Vite + Tailwind CSS Web Application
│   ├── package.json            # React 19, Vite 8, Tailwind CSS v4, Lucide icons
│   ├── vite.config.ts          # Vite configuration with Tailwind plugin & dev proxy
│   ├── index.html              # HTML5 entry with dark mode theme
│   └── src/
│       ├── api/client.ts       # Typed API client for FastAPI endpoints
│       ├── types/api.ts        # TypeScript schemas matching backend Pydantic models
│       ├── components/
│       │   ├── Sidebar.tsx         # Repositories list, connect CTA, and backend health
│       │   ├── ChatWorkspace.tsx   # Evidence-grounded chat and suggested prompt cards
│       │   ├── ChatMessage.tsx     # Message bubbles, code highlighting, and citations
│       │   ├── CitationCard.tsx    # Source file references with direct GitHub line anchors
│       │   ├── FilesDrawer.tsx     # Searchable modal listing indexed source files
│       │   └── RepoConnectModal.tsx # URL validation, branch selection & indexing flow
│       ├── App.tsx             # Root state management & persistence
│       └── index.css           # Tailwind CSS directives & developer typography
│
├── backend/                    # Backend application source code
│   ├── requirements.txt        # Python dependencies (FastAPI, Qdrant, Google GenAI, httpx)
│   ├── app/
│   │   ├── __init__.py         # Package identifier & version
│   │   ├── main.py             # FastAPI entry point, CORS, lifespan & route registration
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── health.py       # GET /health and GET /api/v1/health
│   │   │       ├── repositories.py # POST /repositories/validate, POST /repositories/index,
│   │   │       │                   # GET /repositories/{id}/status, GET /repositories/{id}/files
│   │   │       └── chat.py         # POST /chat (Natural language Q&A)
│   │   ├── config/
│   │   │   └── settings.py     # Centralized Pydantic Settings & .env loader
│   │   ├── github/             # GitHub Integration Service
│   │   │   ├── url_parser.py   # Safe URL parser, slug generation, path traversal defense
│   │   │   └── client.py       # HTTP client for GitHub API, tree traversal & file fetching
│   │   ├── rag/                # Core RAG Engine
│   │   │   ├── file_scanner.py # Discovers source files, ignores binaries & secrets
│   │   │   ├── chunker.py      # Line-based chunking with precise line bounds
│   │   │   ├── embeddings.py   # Gemini text-embedding-001 adapter with batching
│   │   │   ├── vector_store.py # Qdrant adapter with collection, payload & memory fallback
│   │   │   ├── retriever.py    # Vector similarity search & metadata mapper
│   │   │   ├── prompt_builder.py # Grounded prompt with untrusted data isolation
│   │   │   └── pipeline.py     # End-to-end Indexing & QA workflow orchestration
│   │   ├── schemas/            # Pydantic Request & Response Data Models
│   │   │   ├── health.py       # Health check response models
│   │   │   ├── repository.py   # Validation, indexing, status & file list models
│   │   │   └── chat.py         # Chat query and grounded citation models
│   │   ├── services/
│   │   │   ├── llm_provider.py       # Google Gemini LLM adapter
│   │   │   └── repository_service.py # Repository workflow orchestrator & background worker
│   │   └── utils/
│   │       └── logger.py       # Structured logging setup
│   ├── scripts/
│   │   ├── gemini_smoke_test.py # Verifies Gemini API connectivity
│   │   └── rag_demo.py          # Interactive CLI for testing local code RAG
│   └── tests/
│       ├── test_config.py             # Configuration unit tests
│       ├── test_health.py             # Health endpoint unit tests
│       ├── test_llm_provider.py       # Gemini adapter and error handling tests
│       ├── test_file_scanner.py       # File discovery and ignore list tests
│       ├── test_chunker.py            # Line chunking and boundary tests
│       ├── test_embeddings.py         # Embedding provider tests
│       ├── test_vector_store.py       # In-memory Qdrant upsert and search tests
│       ├── test_retriever.py          # Retriever mapping and empty query tests
│       ├── test_prompt_builder.py     # Grounded prompt construction tests
│       ├── test_pipeline.py           # Full RAG pipeline orchestration tests
│       ├── test_github_url_parser.py  # URL validation, parsing, and security tests
│       ├── test_github_client.py      # GitHub API client and file filtering tests
│       └── test_repository_routes.py  # FastAPI repository & chat endpoint tests
│
└── sample_code/                 # Controlled synthetic repository for testing
    └── sample_repo/
        ├── auth.py              # Password hashing & JWT validation
        ├── database.py          # Simulated database pool & query engine
        ├── user_service.py      # User management operations
        └── main.py              # Application server routes
```

---

## 🚀 Quick Start Guide (Windows PowerShell)

### 1. Create and Activate the Virtual Environment

```powershell
# Create a Python virtual environment named .venv
python -m venv .venv

# Activate the virtual environment
.venv\Scripts\Activate.ps1
```

> **Note for PowerShell execution policy:** If script execution is disabled, run:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

---

### 2. Install Dependencies

```powershell
pip install -r backend\requirements.txt
```

---

### 3. Configure Environment Variables

Create your `.env` file from the `.env.example` template:

```powershell
copy .env.example .env
```

Edit `.env` and set your credentials:
```ini
# Google Gemini API Key (Required for embeddings and LLM answers)
GEMINI_API_KEY=AIzaSyYourActualKeyHere

# Optional: GitHub Personal Access Token for private repos and higher rate limits
# (Leave empty for public repository indexing)
GITHUB_TOKEN=ghp_YourOptionalGitHubPersonalAccessToken

# Vector Database (Defaults to in-memory mode if local Qdrant is not running)
QDRANT_URL=http://localhost:6333
```

> **Security Rule:** Never commit your `.env` file or paste personal access tokens into source code. `.env` is ignored by `.gitignore`.

---

### 4. Run the Automated Test Suite (51 Tests)

All 51 automated tests use in-memory vector storage and mocked API adapters, running offline without consuming live API credits:

```powershell
python -m pytest -v backend\tests
```

---

### 5. Start the FastAPI Development Server

```powershell
uvicorn app.main:app --reload --app-dir backend --host 127.0.0.1 --port 8000
```

- **Interactive Swagger UI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **Health Check:** [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

---

### 6. Start the React Frontend Development Server

Open a new PowerShell terminal:

```powershell
cd frontend
npm install
npm run dev
```

- **Web Application URL:** [http://127.0.0.1:5173](http://127.0.0.1:5173)
- Features: Connect repository modal, status polling, grounded AI code chat, and clickable source citations.

---

## 🌐 API Endpoint Reference & Examples

### 1. Validate a GitHub Repository URL
**`POST /api/v1/repositories/validate`**

Checks if a GitHub repository URL is syntactically valid and accessible before indexing.

**Request:**
```bash
curl -X POST "http://127.0.0.1:8000/api/v1/repositories/validate" \
     -H "Content-Type: application/json" \
     -d '{"repository_url": "https://github.com/octocat/Spoon-Knife"}'
```

**Response (`200 OK`):**
```json
{
  "valid": true,
  "repository_id": "octocat__spoon-knife",
  "owner": "octocat",
  "name": "Spoon-Knife",
  "full_name": "octocat/Spoon-Knife",
  "default_branch": "main",
  "selected_branch": "main",
  "is_private": false,
  "description": "This repo is for spoon-knife training",
  "size_kb": 12,
  "stars_count": 14069,
  "forks_count": 150000,
  "language": "HTML",
  "error": null
}
```

---

### 2. Index a GitHub Repository
**`POST /api/v1/repositories/index`**

Discovers source files, extracts line-bounded chunks, generates 768-dim embeddings via Google Gemini, and upserts them into Qdrant.

**Request:**
```bash
curl -X POST "http://127.0.0.1:8000/api/v1/repositories/index" \
     -H "Content-Type: application/json" \
     -d '{
       "repository_url": "https://github.com/octocat/Spoon-Knife",
       "branch": "main",
       "clean_existing": true
     }'
```

**Response (`202 Accepted`):**
```json
{
  "job_id": "job_a1b2c3d4e5f6",
  "repository_id": "octocat__spoon-knife",
  "branch": "main",
  "status": "queued",
  "message": "Indexing job job_a1b2c3d4e5f6 queued for repository 'octocat/Spoon-Knife'."
}
```

---

### 3. Check Indexing Status
**`GET /api/v1/repositories/{repository_id}/status`**

Polls the progress of an indexing job or checks existing index statistics.

**Request:**
```bash
curl -X GET "http://127.0.0.1:8000/api/v1/repositories/octocat__spoon-knife/status"
```

**Response (`200 OK`):**
```json
{
  "repository_id": "octocat__spoon-knife",
  "branch": "main",
  "status": "completed",
  "files_discovered": 3,
  "files_indexed": 3,
  "chunks_indexed": 3,
  "duration_ms": 1250,
  "error": null
}
```

---

### 4. List Indexed Repository Files
**`GET /api/v1/repositories/{repository_id}/files`**

Lists all source code files stored in the vector database for a given repository.

**Request:**
```bash
curl -X GET "http://127.0.0.1:8000/api/v1/repositories/octocat__spoon-knife/files"
```

**Response (`200 OK`):**
```json
{
  "repository_id": "octocat__spoon-knife",
  "total_files": 3,
  "files": [
    {
      "path": "README.md",
      "language": "markdown",
      "chunks_count": 1,
      "line_count": 9
    },
    {
      "path": "index.html",
      "language": "html",
      "chunks_count": 1,
      "line_count": 20
    },
    {
      "path": "styles.css",
      "language": "css",
      "chunks_count": 1,
      "line_count": 17
    }
  ]
}
```

---

### 5. Ask Questions About the Codebase (RAG Chat)
**`POST /api/v1/chat`**

Performs vector similarity search against the repository's chunks and synthesizes an evidence-backed answer using Google Gemini.

**Request:**
```bash
curl -X POST "http://127.0.0.1:8000/api/v1/chat" \
     -H "Content-Type: application/json" \
     -d '{
       "repository_id": "octocat__spoon-knife",
       "question": "What is the purpose of this project and what HTML/CSS elements are defined?",
       "top_k": 5
     }'
```

**Response (`200 OK`):**
```json
{
  "question": "What is the purpose of this project and what HTML/CSS elements are defined?",
  "repository_id": "octocat__spoon-knife",
  "answer": "The project serves as an example for practicing forking and submitting pull requests on GitHub (`README.md: lines 3-9`). It defines an HTML page with an image (`#octocat`) and a centered paragraph (`styles.css: lines 6-17`).",
  "sources": [
    {
      "path": "index.html",
      "start_line": 1,
      "end_line": 20,
      "chunk_id": "octocat__spoon-knife:main:index.html:1:20",
      "score": 0.618
    },
    {
      "path": "README.md",
      "start_line": 1,
      "end_line": 9,
      "chunk_id": "octocat__spoon-knife:main:README.md:1:9",
      "score": 0.602
    },
    {
      "path": "styles.css",
      "start_line": 1,
      "end_line": 17,
      "chunk_id": "octocat__spoon-knife:main:styles.css:1:17",
      "score": 0.589
    }
  ],
  "insufficient_context": false,
  "retrieved_chunks_count": 3,
  "latency_ms": 1120
}
```

---

### 6. List Repository Commits
**`GET /api/v1/repositories/{id}/commits`**

Retrieves paginated commit logs with branch and file-path filtering.

**Query Parameters:**
- `branch` (string, optional): Branch name or commit ref (e.g. `main`)
- `path` (string, optional): Filter commits touching a specific file (e.g. `src/auth.py`)
- `page` (int, default: 1): Page number
- `per_page` (int, default: 30, max: 100): Items per page

---

### 7. Get Commit Details & Unified Diffs
**`GET /api/v1/repositories/{id}/commits/{commit_sha}`**

Retrieves complete commit details, including addition/deletion statistics, changed files (`added`, `modified`, `removed`, `renamed`), and safe unified diff patches (capped at 300 lines / 30 KB per file).

---

### 8. Explain Commit with Gemini AI
**`POST /api/v1/repositories/{id}/commits/{commit_sha}/explain`**

Synthesizes an evidence-backed AI explanation for a commit's modifications using Google Gemini. Strictly separates directly observed diffs from architectural inferences and acknowledges unstated intent.

---

### 9. Natural Language Git History Chat
**`POST /api/v1/repositories/{id}/commits/chat`**

Answers natural language questions about commit logs and diffs (e.g., *"What changed in commit d0dd1f6?"*, *"Which commits modified styles.css?"*).

---

### 10. Compare Revisions
**`GET /api/v1/repositories/{id}/compare/{base}...{head}`**

Compares two revisions or branches on GitHub, showing status, ahead/behind counts, and file-level diffs.

---

## 🔒 Security & Safe Ingestion Architecture

1. **Untrusted Code & Commit Isolation:** Repository source code, comments, commit messages, and diff patches are strictly treated as untrusted data. Grounded prompts isolate evidence within `<untrusted_commit_metadata>` and `<untrusted_diff_evidence>` XML tags and forbid prompt injection execution.
2. **Safe URL Parsing & Input Sanitization:** Rejects non-GitHub hosts, unexpected schemes (`ftp://`, `file://`), path traversal sequences (`../`), and invalid identifier characters.
3. **Patch Capping & DoS Safeguards:** Large unified diff patches are capped at 300 lines or 30 KB per file to avoid token context overflow and high model latency.
4. **Token Protection:** Tokens are read exclusively from environment configuration (`.env`). Tokens are never logged, echoed in API responses, or exposed to the frontend.
5. **No Code Execution:** Repository code and diffs are retrieved strictly as static text strings. No user or repository code is ever executed or evaluated.

---

## 📋 Current Limitations & Next Roadmap

- **Single Branch Indexing for RAG Chunks:** Source code indexing currently indexes one branch at a time.
- **Diff Patch Limits:** Individual file patches exceeding 300 lines or 30 KB are safely truncated with an explicit warning note.
- **Completed in Phase 4:** Modern React + Vite + Tailwind CSS frontend interface.
- **Completed in Phase 5:** Git commit history, unified diff parsing, Gemini explanation & history chat.
- **Upcoming in Phase 6:** Tree-sitter AST parsing for granular function and class symbol indexing.

