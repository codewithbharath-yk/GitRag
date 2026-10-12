import type {
  ChatRequest,
  ChatResponse,
  HealthResponse,
  RepoFilesResponse,
  RepoIndexRequest,
  RepoIndexResponse,
  RepoStatusResponse,
  RepoValidateRequest,
  RepoValidateResponse,
  CommitListResponse,
  CommitDetail,
  CommitCompareResponse,
  CommitExplainResponse,
  HistoryChatRequest,
  HistoryChatResponse,
  CodeSymbol,
  ParsedFileIntelligence,
  User,
  TokenResponse,
  StoredRepoMetadata,
  SearchRequest,
  SearchResponse,
  FeedbackCreateRequest,
  FeedbackStatsResponse,
} from '../types/api';

// Support VITE_API_BASE_URL or VITE_BACKEND_URL, defaulting to http://127.0.0.1:8000 in dev
const BACKEND_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '')
).replace(/\/$/, '');

let currentAuthToken: string | null = typeof localStorage !== 'undefined'
  ? localStorage.getItem('coderag_token')
  : null;

export function setAuthToken(token: string | null) {
  currentAuthToken = token;
  if (typeof localStorage !== 'undefined') {
    if (token) {
      localStorage.setItem('coderag_token', token);
    } else {
      localStorage.removeItem('coderag_token');
    }
  }
}

export function getAuthToken(): string | null {
  return currentAuthToken;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  recoverable?: boolean;
  data: unknown;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    data?: unknown,
    code?: string,
    recoverable?: boolean,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.code = code;
    this.recoverable = recoverable;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BACKEND_BASE_URL}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  if (currentAuthToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${currentAuthToken}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    throw new ApiError(
      `Unable to reach CodeRAG backend at ${BACKEND_BASE_URL}. Ensure the server is running. (${(err as Error).message})`,
      0,
      null,
      'NETWORK_ERROR',
      true
    );
  }

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status} ${response.statusText}`;
    let errorCode: string | undefined = undefined;
    let recoverable: boolean | undefined = undefined;
    let details: Record<string, unknown> | undefined = undefined;
    let bodyData: unknown = null;

    try {
      bodyData = await response.json();
      if (bodyData && typeof bodyData === 'object' && 'detail' in bodyData) {
        const d = (bodyData as { detail: unknown }).detail;
        if (typeof d === 'string') {
          errorDetail = d;
        } else if (d && typeof d === 'object') {
          const detailObj = d as Record<string, unknown>;
          if ('message' in detailObj && typeof detailObj.message === 'string') {
            errorDetail = detailObj.message;
          }
          if ('code' in detailObj && typeof detailObj.code === 'string') {
            errorCode = detailObj.code;
          }
          if ('recoverable' in detailObj && typeof detailObj.recoverable === 'boolean') {
            recoverable = detailObj.recoverable;
          }
          if ('details' in detailObj && typeof detailObj.details === 'object' && detailObj.details !== null) {
            details = detailObj.details as Record<string, unknown>;
          }
        }
      }
    } catch {
      // Non-JSON response
    }
    throw new ApiError(errorDetail, response.status, bodyData, errorCode, recoverable, details);
  }

  return response.json() as Promise<T>;
}

export const api = {
  /**
   * Health check for FastAPI and Gemini model availability.
   */
  async getHealth(): Promise<HealthResponse> {
    return request<HealthResponse>('/api/v1/health');
  },

  /**
   * Validate a GitHub repository URL and fetch public metadata.
   */
  async validateRepository(url: string, branch?: string): Promise<RepoValidateResponse> {
    const payload: RepoValidateRequest = { url, branch: branch || undefined };
    return request<RepoValidateResponse>('/api/v1/repositories/validate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Start ingesting and indexing a GitHub repository into Qdrant.
   */
  async startIndexing(
    url: string,
    branch?: string,
    cleanExisting: boolean = true
  ): Promise<RepoIndexResponse> {
    const payload: RepoIndexRequest = {
      url,
      branch: branch || undefined,
      clean_existing: cleanExisting,
    };
    return request<RepoIndexResponse>('/api/v1/repositories/index', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Poll indexing status for a repository.
   */
  async getRepositoryStatus(repositoryId: string): Promise<RepoStatusResponse> {
    return request<RepoStatusResponse>(`/api/v1/repositories/${encodeURIComponent(repositoryId)}/status`);
  },

  /**
   * List all source files indexed in Qdrant for a repository.
   */
  async getRepositoryFiles(repositoryId: string): Promise<RepoFilesResponse> {
    return request<RepoFilesResponse>(`/api/v1/repositories/${encodeURIComponent(repositoryId)}/files`);
  },

  /**
   * Ask natural-language questions grounded in the repository's source code.
   */
  async askQuestion(payload: ChatRequest): Promise<ChatResponse> {
    return request<ChatResponse>('/api/v1/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Submit answer feedback for retrieval optimization (Phase 9).
   */
  async submitChatFeedback(payload: FeedbackCreateRequest): Promise<{ status: string; feedback_id: string; message: string }> {
    return request<{ status: string; feedback_id: string; message: string }>('/api/v1/chat/feedback', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Retrieve feedback statistics and data-driven retrieval tuning metrics.
   */
  async getFeedbackStats(repositoryId: string): Promise<FeedbackStatsResponse> {
    return request<FeedbackStatsResponse>(`/api/v1/chat/feedback/stats?repository_id=${encodeURIComponent(repositoryId)}`);
  },

  /**
   * Retrieve paginated commit history for a repository.
   */
  async listCommits(
    repositoryId: string,
    params?: { branch?: string; path?: string; page?: number; per_page?: number }
  ): Promise<CommitListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.branch) searchParams.set('branch', params.branch);
    if (params?.path) searchParams.set('path', params.path);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.per_page) searchParams.set('per_page', String(params.per_page));

    const qs = searchParams.toString();
    const endpoint = `/api/v1/repositories/${encodeURIComponent(repositoryId)}/commits${qs ? `?${qs}` : ''}`;
    return request<CommitListResponse>(endpoint);
  },

  /**
   * Retrieve full details, changed files, and diff patches for a commit.
   */
  async getCommitDetail(repositoryId: string, commitSha: string): Promise<CommitDetail> {
    return request<CommitDetail>(
      `/api/v1/repositories/${encodeURIComponent(repositoryId)}/commits/${encodeURIComponent(commitSha)}`
    );
  },

  /**
   * Compare two revisions or commits.
   */
  async compareCommits(
    repositoryId: string,
    base: string,
    head: string
  ): Promise<CommitCompareResponse> {
    return request<CommitCompareResponse>(
      `/api/v1/repositories/${encodeURIComponent(repositoryId)}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`
    );
  },

  /**
   * Generate an evidence-backed AI explanation for a commit's code diff using Gemini.
   */
  async explainCommit(
    repositoryId: string,
    commitSha: string,
    detailLevel: string = 'standard'
  ): Promise<CommitExplainResponse> {
    return request<CommitExplainResponse>(
      `/api/v1/repositories/${encodeURIComponent(repositoryId)}/commits/${encodeURIComponent(commitSha)}/explain`,
      {
        method: 'POST',
        body: JSON.stringify({ detail_level: detailLevel }),
      }
    );
  },

  /**
   * Ask natural-language questions about repository history and diffs.
   */
  async chatHistory(
    repositoryId: string,
    payload: HistoryChatRequest
  ): Promise<HistoryChatResponse> {
    return request<HistoryChatResponse>(
      `/api/v1/repositories/${encodeURIComponent(repositoryId)}/commits/chat`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  /**
   * Helper alias for asking questions about git commit history.
   */
  async askHistoryQuestion(params: {
    repository_id: string;
    question: string;
    branch?: string;
    commit_sha?: string;
    path?: string;
    limit_commits?: number;
  }): Promise<HistoryChatResponse> {
    return this.chatHistory(params.repository_id, {
      question: params.question,
      branch: params.branch,
      commit_sha: params.commit_sha,
      path: params.path,
    });
  },

  /**
   * Search repository symbols (functions, classes, methods).
   */
  async getRepositorySymbols(
    repositoryId: string,
    options?: { branch?: string; filePath?: string; query?: string; symbolType?: string }
  ): Promise<CodeSymbol[]> {
    const searchParams = new URLSearchParams();
    if (options?.branch) searchParams.set('branch', options.branch);
    if (options?.filePath) searchParams.set('file_path', options.filePath);
    if (options?.query) searchParams.set('query', options.query);
    if (options?.symbolType) searchParams.set('symbol_type', options.symbolType);

    const qs = searchParams.toString();
    return request<CodeSymbol[]>(
      `/api/v1/repositories/${encodeURIComponent(repositoryId)}/symbols${qs ? `?${qs}` : ''}`
    );
  },

  /**
   * Retrieve file structural intelligence (classes, methods, imports).
   */
  async getFileIntelligence(
    repositoryId: string,
    filePath: string,
    branch?: string
  ): Promise<ParsedFileIntelligence> {
    const searchParams = new URLSearchParams();
    searchParams.set('file_path', filePath);
    if (branch) searchParams.set('branch', branch);

    return request<ParsedFileIntelligence>(
      `/api/v1/repositories/${encodeURIComponent(repositoryId)}/file-intelligence?${searchParams.toString()}`
    );
  },

  /**
   * Retrieve code relationships and dependency graph.
   */
  async getRepositoryRelationships(
    repositoryId: string,
    options?: { branch?: string; filePath?: string }
  ): Promise<any> {
    const searchParams = new URLSearchParams();
    if (options?.branch) searchParams.set('branch', options.branch);
    if (options?.filePath) searchParams.set('file_path', options.filePath);

    const qs = searchParams.toString();
    return request<any>(
      `/api/v1/repositories/${encodeURIComponent(repositoryId)}/relationships${qs ? `?${qs}` : ''}`
    );
  },

  /**
   * Get repository hotspot analysis:
   * most imported files, most symbols, dependency hubs, most referenced symbols.
   */
  async getRepositoryHotspots(
    repositoryId: string,
    options?: { branch?: string; topK?: number }
  ): Promise<any> {
    const searchParams = new URLSearchParams();
    if (options?.branch) searchParams.set('branch', options.branch);
    if (options?.topK) searchParams.set('top_k', String(options.topK));

    const qs = searchParams.toString();
    return request<any>(
      `/api/v1/repositories/${encodeURIComponent(repositoryId)}/hotspots${qs ? `?${qs}` : ''}`
    );
  },

  /**
   * Fuzzy search symbols by approximate name match.
   * Returns [{symbol, score}] ordered by descending similarity score.
   */
  async fuzzySearchSymbols(
    repositoryId: string,
    query: string,
    options?: { branch?: string; topK?: number; minScore?: number }
  ): Promise<Array<{ symbol: any; score: number }>> {
    const searchParams = new URLSearchParams();
    searchParams.set('q', query);
    if (options?.branch) searchParams.set('branch', options.branch);
    if (options?.topK) searchParams.set('top_k', String(options.topK));
    if (options?.minScore !== undefined) searchParams.set('min_score', String(options.minScore));

    return request<Array<{ symbol: any; score: number }>>(
      `/api/v1/repositories/${encodeURIComponent(repositoryId)}/symbols/search?${searchParams.toString()}`
    );
  },

  /**
   * Get full class hierarchy: definition, methods, parameters, return types, docstrings.
   */
  async getClassHierarchy(
    repositoryId: string,
    className: string,
    branch?: string
  ): Promise<any> {
    const searchParams = new URLSearchParams();
    if (branch) searchParams.set('branch', branch);

    const qs = searchParams.toString();
    return request<any>(
      `/api/v1/repositories/${encodeURIComponent(repositoryId)}/classes/${encodeURIComponent(className)}/hierarchy${qs ? `?${qs}` : ''}`
    );
  },

  /**
   * Semantic code search powered by dense vector similarity in Qdrant.
   */
  async search(payload: SearchRequest): Promise<SearchResponse> {
    return request<SearchResponse>('/api/v1/search', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Semantic code search alias
   */
  async searchCode(payload: SearchRequest): Promise<SearchResponse> {
    return this.search(payload);
  },

  /**
   * Retrieve full repository metadata details.
   */
  async getRepositoryDetails(repositoryId: string): Promise<StoredRepoMetadata> {
    return request<StoredRepoMetadata>(`/api/v1/repositories/${encodeURIComponent(repositoryId)}`);
  },

  /**
   * Trigger background re-indexing for an existing repository.
   */
  async reindexRepository(repositoryId: string, branch?: string): Promise<RepoIndexResponse> {
    const qs = branch ? `?branch=${encodeURIComponent(branch)}` : '';
    return request<RepoIndexResponse>(
      `/api/v1/repositories/${encodeURIComponent(repositoryId)}/reindex${qs}`,
      { method: 'POST' }
    );
  },

  /**
   * List all repositories owned/indexed by the current user.
   */
  async listUserRepositories(): Promise<StoredRepoMetadata[]> {
    return request<StoredRepoMetadata[]>('/api/v1/repositories');
  },

  /**
   * Delete a repository and its indexed vectors.
   */
  async deleteRepository(repositoryId: string): Promise<{ status: string; message: string; repository_id: string }> {
    return request<{ status: string; message: string; repository_id: string }>(
      `/api/v1/repositories/${encodeURIComponent(repositoryId)}`,
      { method: 'DELETE' }
    );
  },

  /**
   * User Authentication & Session Management APIs.
   */
  auth: {
    async register(email: string, password: string, fullName?: string): Promise<TokenResponse> {
      const res = await request<TokenResponse>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name: fullName || undefined }),
      });
      setAuthToken(res.access_token);
      return res;
    },

    async login(email: string, password: string): Promise<TokenResponse> {
      const res = await request<TokenResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(res.access_token);
      return res;
    },

    async getMe(): Promise<User> {
      return request<User>('/api/v1/auth/me');
    },

    async refreshToken(): Promise<TokenResponse> {
      const res = await request<TokenResponse>('/api/v1/auth/refresh', {
        method: 'POST',
      });
      setAuthToken(res.access_token);
      return res;
    },

    async logout(): Promise<void> {
      try {
        await request('/api/v1/auth/logout', { method: 'POST' });
      } finally {
        setAuthToken(null);
      }
    },
  },
};


