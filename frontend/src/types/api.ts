/**
 * Type definitions matching the CodeRAG FastAPI Backend Models.
 */

export interface HealthResponse {
  status: string;
  app_name: string;
  version: string;
  environment: string;
  gemini_configured: boolean;
  qdrant_configured?: boolean;
  supabase_configured?: boolean;
}

export interface RepoValidateRequest {
  url: string;
  branch?: string;
}

export interface RepoValidateResponse {
  valid: boolean;
  repository_id: string;
  owner: string;
  name: string;
  full_name: string;
  default_branch: string;
  selected_branch: string;
  is_private: boolean;
  description?: string | null;
  size_kb: number;
  stars_count: number;
  forks_count: number;
  language?: string | null;
  error?: string | null;
}

export interface RepoIndexRequest {
  url: string;
  branch?: string;
  clean_existing?: boolean;
}

export interface RepoIndexResponse {
  job_id: string;
  repository_id: string;
  branch: string;
  status: 'queued' | 'indexing' | 'completed' | 'failed';
  message: string;
}

export interface RepoStatusResponse {
  repository_id: string;
  branch: string;
  status: 'queued' | 'indexing' | 'completed' | 'failed' | 'not_found';
  files_discovered: number;
  files_indexed: number;
  chunks_indexed: number;
  duration_ms?: number | null;
  error?: string | null;
}

export interface RepoFileItem {
  path: string;
  language: string;
  chunks_count: number;
  line_count: number;
}

export interface RepoFilesResponse {
  repository_id: string;
  total_files: number;
  files: RepoFileItem[];
}

export interface SourceCitation {
  path: string;
  start_line: number;
  end_line: number;
  chunk_id: string;
  score: number;
}

export interface ChatRequest {
  repository_id: string;
  question: string;
  branch?: string;
  top_k?: number;
}

export interface ChatResponse {
  question: string;
  repository_id: string;
  answer: string;
  sources: SourceCitation[];
  insufficient_context: boolean;
  retrieved_chunks_count: number;
  latency_ms: number;
}

export interface StoredRepository {
  id: string;
  fullName: string;
  owner: string;
  name: string;
  branch: string;
  stars: number;
  language?: string | null;
  filesCount: number;
  chunksCount: number;
  lastIndexedAt: string;
}

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: SourceCitation[];
  insufficientContext?: boolean;
  retrievedChunksCount?: number;
  latencyMs?: number;
  error?: string;
}

export interface CommitAuthor {
  name: string;
  email: string;
  date: string;
}

export interface CommitItem {
  sha: string;
  short_sha: string;
  message: string;
  author: CommitAuthor;
  parents: string[];
  html_url: string;
}

export interface CommitListResponse {
  repository_id: string;
  branch?: string | null;
  path?: string | null;
  page: number;
  per_page: number;
  total_returned: number;
  commits: CommitItem[];
}

export interface CommitStats {
  total: number;
  additions: number;
  deletions: number;
}

export interface CommitFileChange {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string | null;
  patch_truncated: boolean;
  previous_filename?: string | null;
}

export interface CommitDetail {
  repository_id: string;
  sha: string;
  short_sha: string;
  message: string;
  author: CommitAuthor;
  parents: string[];
  html_url: string;
  stats: CommitStats;
  files: CommitFileChange[];
}

export interface CommitCompareResponse {
  repository_id: string;
  base_commit: string;
  head_commit: string;
  status: string;
  ahead_by: number;
  behind_by: number;
  total_commits: number;
  files: CommitFileChange[];
}

export interface CommitExplainResponse {
  repository_id: string;
  commit_sha: string;
  short_sha: string;
  message: string;
  explanation: string;
  observed_changes: string[];
  inferred_intent?: string | null;
  files_analyzed: string[];
  latency_ms: number;
}

export interface HistoryChatRequest {
  question: string;
  branch?: string;
  commit_sha?: string;
  path?: string;
}

export interface HistoryChatResponse {
  question: string;
  repository_id: string;
  commit_sha?: string | null;
  answer: string;
  referenced_commits: string[];
  referenced_files: string[];
  insufficient_evidence: boolean;
  latency_ms: number;
}

export type SymbolType = 'function' | 'method' | 'class' | 'interface' | 'import' | 'export' | 'variable' | 'constant';

export interface CodeSymbol {
  name: string;
  symbol_type: SymbolType;
  file_path: string;
  start_line: number;
  end_line: number;
  parent_symbol?: string | null;
  language: string;
  parameters: string[];
  return_type?: string | null;
  docstring?: string | null;
  source_snippet?: string | null;
}

export interface CodeImport {
  file_path: string;
  source_module: string;
  imported_symbols: string[];
  alias?: string | null;
  is_relative: boolean;
  line_number: number;
}

export interface CodeExport {
  file_path: string;
  symbol_name: string;
  is_default: boolean;
  line_number: number;
}

export interface CodeRelationship {
  source: string;
  target: string;
  relationship_type: string;
  file_path: string;
  line_number?: number | null;
  metadata?: Record<string, any>;
}

export interface ParsedFileIntelligence {
  file_path: string;
  language: string;
  line_count: number;
  symbols: CodeSymbol[];
  imports: CodeImport[];
  exports: CodeExport[];
  relationships: CodeRelationship[];
}

export interface RepositoryRelationshipsResponse {
  repository_id: string;
  branch: string;
  total_files: number;
  total_symbols: number;
  file_dependencies: Record<string, string[]>;
  file_dependents: Record<string, string[]>;
}

export interface FileDependenciesResponse {
  repository_id: string;
  branch: string;
  file_path: string;
  imports: string[];
  imported_by: string[];
}

export interface User {
  id: string;
  email: string;
  full_name?: string | null;
  role: 'user' | 'admin';
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in_seconds: number;
  user: User;
}

export interface StoredRepoMetadata {
  id: string;
  repository_id: string;
  owner: string;
  name: string;
  full_name: string;
  default_branch: string;
  selected_branch: string;
  is_private: boolean;
  description?: string | null;
  stars_count: number;
  forks_count: number;
  language?: string | null;
  total_files: number;
  total_chunks: number;
  indexed_at?: string | null;
  created_at: string;
}

export interface SearchRequest {
  query: string;
  repository_id?: string;
  branch?: string;
  top_k?: number;
  score_threshold?: number;
}

export interface SearchHit {
  chunk_id: string;
  repository_id: string;
  file_path: string;
  language: string;
  start_line: number;
  end_line: number;
  content: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface SearchResponse {
  query: string;
  repository_id?: string | null;
  total_hits: number;
  hits: SearchHit[];
  latency_ms: number;
}



