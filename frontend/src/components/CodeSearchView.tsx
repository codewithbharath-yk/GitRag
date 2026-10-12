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
import { Magnetic, Spotlight, Tilt, TextEffect } from './motion';
import { BackButton } from './BackButton';

interface CodeSearchViewProps {
  repository: StoredRepository | null;
  onAskQuestionInChat: (question: string) => void;
}

const PRESET_QUERIES = [
  'Where is authentication handled?',
  'Vector database connection and setup',
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
    <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] p-6 sm:p-8 space-y-6 font-sans text-[var(--text-primary)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <BackButton fallback={{ tab: 'dashboard' }} label="Back to Dashboard" />
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2.5">
              <Search className="w-5 h-5 text-[var(--color-cobalt-blue)]" />
              <TextEffect as="span">Semantic Code Search</TextEffect>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[var(--bg-card)] text-[var(--color-cobalt-blue)] border border-[var(--border-subtle)] font-semibold">
                Local BGE + Qdrant
              </span>
            </h1>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Natural language code search grounded in vector similarity.
            {repository && (
              <span className="ml-2 font-mono text-[var(--text-secondary)]">
                Scope: {repository.fullName} ({repository.branch})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="space-y-3 max-w-4xl">
        <Spotlight variant="subtle" className="rounded-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex items-center gap-2 p-1.5 rounded-xl bg-[var(--bg-well)] border border-[var(--border-subtle)] focus-within:border-[#1546D9] focus-within:ring-2 focus-within:ring-[#1546D9]/40 shadow-inner transition-all"
          >
            <Search className="w-4 h-4 text-[var(--text-muted)] ml-3 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your codebase... e.g. 'Where is authentication handled?'"
              className="flex-1 bg-transparent border-none text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none px-2 py-2"
            />
            <Magnetic>
              <button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="px-4 py-2 rounded-lg bg-[#1546D9] hover:bg-[#2255EB] disabled:opacity-50 text-white font-medium text-xs flex items-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>Search</span>
              </button>
            </Magnetic>
          </form>
        </Spotlight>

        {/* Quick Query Suggestions & Threshold Filter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-[var(--text-muted)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-[var(--text-muted)] font-mono font-semibold">Suggestions:</span>
            {PRESET_QUERIES.map((preset, idx) => (
              <Magnetic key={idx} pullStrength={0.12}>
                <button
                  type="button"
                  onClick={() => {
                    setQuery(preset);
                    handleSearch(preset);
                  }}
                  className="px-2.5 py-1 rounded-md bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[11px] font-mono transition-all cursor-pointer"
                >
                  {preset}
                </button>
              </Magnetic>
            ))}
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-secondary)]">
            <span>Min score:</span>
            <select
              value={minScore}
              onChange={(e) => setMinScore(parseFloat(e.target.value))}
              className="px-2 py-0.5 rounded bg-[var(--bg-well)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none"
            >
              <option value={0.1}>10%</option>
              <option value={0.3}>30%</option>
              <option value={0.5}>50%</option>
              <option value={0.7}>70%</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message with Recovery Guidance */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/40 text-[#EF4444] text-xs flex items-center gap-2.5 max-w-4xl">
          <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search Stats Bar */}
      {hasSearched && !isSearching && (
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] max-w-4xl pt-2 font-mono">
          <span>
            Found <strong className="text-[var(--text-primary)]">{hits.length}</strong> semantic match{hits.length === 1 ? '' : 'es'}
            {latencyMs !== null && <span className="text-[var(--text-muted)] ml-2">({latencyMs}ms)</span>}
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">
            Model: BAAI/bge-small-en-v1.5
          </span>
        </div>
      )}

      {/* Results List */}
      <div className="space-y-4 max-w-4xl">
        {isSearching ? (
          <div className="p-16 text-center rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-3">
            <Loader2 className="w-8 h-8 text-[var(--color-cobalt-blue)] animate-spin mx-auto" />
            <p className="text-xs text-[var(--text-secondary)] font-medium">Embedding query and searching Qdrant vector space...</p>
          </div>
        ) : hits.length > 0 ? (
          hits.map((hit) => {
            const scorePercent = Math.min(100, Math.max(0, Math.round(hit.score * 100)));
            const githubUrl = repository
              ? `https://github.com/${repository.owner}/${repository.name}/blob/${repository.branch}/${hit.file_path}#L${hit.start_line}-L${hit.end_line}`
              : null;

            return (
              <Tilt key={hit.chunk_id} maxAngle={2} className="h-full">
                <Spotlight variant="teal" className="rounded-xl">
                  <div className="p-5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--color-cobalt-blue)]/50 transition-all space-y-3">
                    {/* File Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--border-subtle)]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-md bg-[var(--bg-well)] border border-[var(--border-subtle)] text-[var(--color-cobalt-blue)] shrink-0">
                          <FileCode className="w-4 h-4 text-[var(--color-cobalt-blue)]" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-mono text-xs font-bold text-[var(--text-primary)] block truncate">
                            {hit.file_path}
                          </span>
                          <span className="text-[11px] font-mono text-[var(--text-muted)]">
                            Lines {hit.start_line}–{hit.end_line} ({hit.end_line - hit.start_line + 1} lines) • {hit.language}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        {/* Relevance Match Score Badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium ${
                            scorePercent >= 70
                              ? 'bg-[#1546D9] text-white border border-[#1546D9]'
                              : scorePercent >= 45
                              ? 'bg-[#F9B318]/20 text-[#F9B318] border border-[#F9B318]/40'
                              : 'bg-[var(--bg-well)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
                          }`}
                          title={`Cosine similarity: ${hit.score.toFixed(4)}`}
                        >
                          {scorePercent}% match
                        </span>

                        {/* Copy Code */}
                        <button
                          onClick={() => handleCopySnippet(hit.chunk_id, hit.content)}
                          title="Copy code snippet"
                          className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)] transition-colors cursor-pointer"
                        >
                          {copiedId === hit.chunk_id ? (
                            <Check className="w-3.5 h-3.5 text-[#1546D9]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Open Source / GitHub Link */}
                        {githubUrl && (
                          <Magnetic pullStrength={0.15}>
                            <a
                              href={githubUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-xs font-sans cursor-pointer"
                            >
                              <span>Open source</span>
                              <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
                            </a>
                          </Magnetic>
                        )}

                        {/* Ask AI in Chat */}
                        <Magnetic>
                          <button
                            onClick={() => onAskQuestionInChat(`Explain the code in ${hit.file_path} lines ${hit.start_line}-${hit.end_line}:\n\n${hit.content}`)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#1546D9] hover:bg-[#2255EB] text-white transition-colors text-xs font-sans shadow-sm cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 text-white" />
                            <span>Ask AI</span>
                          </button>
                        </Magnetic>
                      </div>
                    </div>

                    {/* Code Snippet Box */}
                    <div className="rounded-lg overflow-hidden bg-[var(--bg-well)] border border-[var(--border-subtle)] font-mono-code text-xs">
                      <pre className="p-4 overflow-x-auto text-[var(--text-primary)] leading-relaxed max-h-72">
                        <code>{hit.content}</code>
                      </pre>
                    </div>
                  </div>
                </Spotlight>
              </Tilt>
            );
          })
        ) : hasSearched ? (
          <Spotlight variant="subtle" className="rounded-xl">
            <div className="p-12 text-center rounded-xl bg-[var(--bg-card)] border border-dashed border-[var(--border-subtle)] space-y-2">
              <TextEffect as="p" className="text-sm font-semibold text-[var(--text-primary)]">No semantic matches found</TextEffect>
              <p className="text-xs text-[var(--text-muted)]">
                Try rephrasing your search query or adjusting the similarity score threshold.
              </p>
            </div>
          </Spotlight>
        ) : (
          <Spotlight variant="subtle" className="rounded-xl">
            <div className="p-12 text-center rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-2">
              <Code2 className="w-8 h-8 text-[var(--color-cobalt-blue)] mx-auto" />
              <TextEffect as="p" className="text-xs text-[var(--text-secondary)] font-medium">
                Enter a natural language query above to discover relevant code snippets across the repository.
              </TextEffect>
            </div>
          </Spotlight>
        )}
      </div>
    </div>
  );
};
