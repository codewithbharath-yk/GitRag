import React, { useState } from 'react';
import {
  Search,
  FileCode,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Loader2,
  AlertCircle,
  Code2,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { StoredRepository, SearchHit } from '../types/api';

interface CodeSearchViewProps {
  repository: StoredRepository | null;
  onAskQuestionInChat: (question: string) => void;
}

const PRESET_QUERIES = [
  'Authentication and session token verification',
  'Vector database connection and collection setup',
  'Error handling middleware and status codes',
  'GitHub repository URL parsing and validation',
  'Code chunking and line range splitting',
];

export const CodeSearchView: React.FC<CodeSearchViewProps> = ({
  repository,
  onAskQuestionInChat,
}) => {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [minScore, setMinScore] = useState<number>(0.3);

  const handleSearch = async (targetQuery?: string) => {
    const q = (targetQuery !== undefined ? targetQuery : query).trim();
    if (!q) return;

    setIsSearching(true);
    setErrorMessage(null);
    setHasSearched(true);

    try {
      const res = await api.search({
        query: q,
        repository_id: repository?.id,
        branch: repository?.branch,
        top_k: 15,
        score_threshold: minScore > 0 ? minScore : undefined,
      });

      setHits(res.hits);
      setLatencyMs(res.latency_ms);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to execute semantic code search.');
      }
      setHits([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCopySnippet = (chunkId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(chunkId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-6 sm:p-8 space-y-6 font-sans">
      {/* Header */}
      <div className="space-y-1 pb-4 border-b border-slate-800/80">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Search className="w-6 h-6 text-purple-400" />
          <span>Semantic Code Search</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
            Qdrant Powered
          </span>
        </h1>
        <p className="text-xs text-slate-400">
          Find code snippets matching your natural-language description using 2048-dim vector embeddings.
          {repository && (
            <span className="ml-2 font-mono text-purple-300">
              Scope: {repository.fullName} ({repository.branch})
            </span>
          )}
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="space-y-3 max-w-4xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 focus-within:border-purple-500/60 shadow-lg shadow-purple-950/20 transition-all"
        >
          <Search className="w-5 h-5 text-slate-400 ml-3 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe the logic or query code in natural English (e.g., 'JWT token expiration check')..."
            className="flex-1 bg-transparent border-none text-sm text-slate-100 placeholder-slate-500 focus:outline-none px-2 py-2"
          />
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-2 shadow-md shadow-purple-600/30 transition-all"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Search Code</span>
          </button>
        </form>

        {/* Quick Query Suggestions & Threshold Filter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500 font-mono">Suggestions:</span>
            {PRESET_QUERIES.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuery(preset);
                  handleSearch(preset);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 text-[11px] font-mono transition-all"
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
            <span>Min score:</span>
            <select
              value={minScore}
              onChange={(e) => setMinScore(parseFloat(e.target.value))}
              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 text-xs focus:outline-none"
            >
              <option value={0.1}>10%</option>
              <option value={0.3}>30%</option>
              <option value={0.5}>50%</option>
              <option value={0.7}>70%</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2.5 max-w-4xl">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search Stats Bar */}
      {hasSearched && !isSearching && (
        <div className="flex items-center justify-between text-xs text-slate-400 max-w-4xl pt-2">
          <span>
            Found <strong className="text-white">{hits.length}</strong> semantic match{hits.length === 1 ? '' : 'es'}
            {latencyMs !== null && <span className="text-slate-500 font-mono ml-2">({latencyMs}ms)</span>}
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            Model: OpenRouter Nemotron 3 Embed (2048 dims)
          </span>
        </div>
      )}

      {/* Results List */}
      <div className="space-y-4 max-w-4xl">
        {isSearching ? (
          <div className="p-16 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-medium">Embedding query and searching Qdrant vector space...</p>
          </div>
        ) : hits.length > 0 ? (
          hits.map((hit) => {
            const scorePercent = Math.min(100, Math.max(0, Math.round(hit.score * 100)));
            const githubUrl = repository
              ? `https://github.com/${repository.owner}/${repository.name}/blob/${repository.branch}/${hit.file_path}#L${hit.start_line}-L${hit.end_line}`
              : null;

            return (
              <div
                key={hit.chunk_id}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/40 transition-all space-y-3"
              >
                {/* File Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/60">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 shrink-0">
                      <FileCode className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-bold text-white block truncate">
                        {hit.file_path}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        Lines {hit.start_line}–{hit.end_line} ({hit.end_line - hit.start_line + 1} lines) • {hit.language}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {/* Cosine Similarity Match Badge */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium ${
                        scorePercent >= 75
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : scorePercent >= 50
                          ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}
                      title={`Cosine similarity: ${hit.score.toFixed(4)}`}
                    >
                      {scorePercent}% match
                    </span>

                    {/* Copy Code */}
                    <button
                      onClick={() => handleCopySnippet(hit.chunk_id, hit.content)}
                      title="Copy code snippet"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    >
                      {copiedId === hit.chunk_id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* GitHub Link */}
                    {githubUrl && (
                      <a
                        href={githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white transition-colors text-xs font-sans"
                      >
                        <span>GitHub</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    {/* Ask in Chat */}
                    <button
                      onClick={() => onAskQuestionInChat(`Explain the code in ${hit.file_path} lines ${hit.start_line}-${hit.end_line}:\n\n${hit.content}`)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition-colors text-xs font-sans"
                    >
                      <Sparkles className="w-3 h-3 text-blue-400" />
                      <span>Ask AI</span>
                    </button>
                  </div>
                </div>

                {/* Code Snippet Box */}
                <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800/80 font-mono text-xs">
                  <pre className="p-4 overflow-x-auto text-emerald-300/90 leading-relaxed max-h-72">
                    <code>{hit.content}</code>
                  </pre>
                </div>
              </div>
            );
          })
        ) : hasSearched ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 space-y-2">
            <p className="text-sm font-semibold text-slate-300">No semantic matches found</p>
            <p className="text-xs text-slate-500">
              Try rephrasing your search query or connecting a repository with relevant code.
            </p>
          </div>
        ) : (
          <div className="p-12 text-center rounded-2xl bg-slate-900/30 border border-slate-800/60 space-y-2">
            <Code2 className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400 font-medium">
              Enter a natural language query above to discover relevant code snippets across the repository.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
