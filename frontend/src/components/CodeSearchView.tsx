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
    <div className="flex-1 overflow-y-auto bg-[#162623] p-6 sm:p-8 space-y-6 font-sans text-[#F0F5F7]">
      {/* Header */}
      <div className="space-y-1 pb-4 border-b border-[#577877]/25">
        <h1 className="text-2xl font-bold text-[#F0F5F7] tracking-tight flex items-center gap-2.5">
          <Search className="w-5 h-5 text-[#577877]" />
          <TextEffect as="span">Semantic Code Search</TextEffect>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#1B2D2A] text-[#B9CECC] border border-[#577877]/40">
            Local BGE + Qdrant
          </span>
        </h1>
        <p className="text-xs text-[#577877]">
          Natural language code search grounded in vector similarity.
          {repository && (
            <span className="ml-2 font-mono text-[#B9CECC]">
              Scope: {repository.fullName} ({repository.branch})
            </span>
          )}
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="space-y-3 max-w-4xl">
        <Spotlight variant="subtle" className="rounded-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex items-center gap-2 p-1.5 rounded-xl bg-[#111E1C] border border-[#577877]/35 focus-within:border-[#295255] focus-within:ring-2 focus-within:ring-[#295255]/40 shadow-inner transition-all"
          >
            <Search className="w-4 h-4 text-[#577877] ml-3 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your codebase... e.g. 'Where is authentication handled?'"
              className="flex-1 bg-transparent border-none text-xs text-[#F0F5F7] placeholder-[#577877] focus:outline-none px-2 py-2"
            />
            <Magnetic>
              <button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="px-4 py-2 rounded-lg bg-[#295255] hover:bg-[#34686C] disabled:bg-[#1E3430] text-[#F0F5F7] font-medium text-xs flex items-center gap-2 border border-[#577877]/40 shadow-sm transition-all active:scale-[0.98]"
              >
                {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>Search</span>
              </button>
            </Magnetic>
          </form>
        </Spotlight>

        {/* Quick Query Suggestions & Threshold Filter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-[#577877]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-[#577877] font-mono">Suggestions:</span>
            {PRESET_QUERIES.map((preset, idx) => (
              <Magnetic key={idx} pullStrength={0.12}>
                <button
                  type="button"
                  onClick={() => {
                    setQuery(preset);
                    handleSearch(preset);
                  }}
                  className="px-2.5 py-1 rounded-md bg-[#1B2D2A] hover:bg-[#213834] border border-[#577877]/30 text-[#B9CECC] hover:text-[#F0F5F7] text-[11px] font-mono transition-all"
                >
                  {preset}
                </button>
              </Magnetic>
            ))}
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#B9CECC]">
            <span>Min score:</span>
            <select
              value={minScore}
              onChange={(e) => setMinScore(parseFloat(e.target.value))}
              className="px-2 py-0.5 rounded bg-[#111E1C] border border-[#577877]/30 text-[#B9CECC] text-xs focus:outline-none"
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
        <div className="p-4 rounded-xl bg-[#D96B6B]/10 border border-[#D96B6B]/30 text-[#D96B6B] text-xs flex items-center gap-2.5 max-w-4xl">
          <AlertCircle className="w-4 h-4 text-[#D96B6B] shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search Stats Bar */}
      {hasSearched && !isSearching && (
        <div className="flex items-center justify-between text-xs text-[#577877] max-w-4xl pt-2 font-mono">
          <span>
            Found <strong className="text-[#F0F5F7]">{hits.length}</strong> semantic match{hits.length === 1 ? '' : 'es'}
            {latencyMs !== null && <span className="text-[#577877] ml-2">({latencyMs}ms)</span>}
          </span>
          <span className="text-[11px] text-[#577877]">
            Model: BAAI/bge-small-en-v1.5
          </span>
        </div>
      )}

      {/* Results List (Smart Info Hiding: Internal vector arrays hidden, showing file and clean snippet) */}
      <div className="space-y-4 max-w-4xl">
        {isSearching ? (
          <div className="p-16 text-center rounded-xl bg-[#1B2D2A] border border-[#577877]/30 space-y-3">
            <Loader2 className="w-8 h-8 text-[#577877] animate-spin mx-auto" />
            <p className="text-xs text-[#B9CECC] font-medium">Embedding query and searching Qdrant vector space...</p>
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
                  <div className="p-5 rounded-xl bg-[#1B2D2A] border border-[#577877]/30 hover:border-[#577877]/60 transition-all space-y-3 card-hover-teal">
                    {/* File Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#577877]/20">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-md bg-[#162623] border border-[#577877]/30 text-[#577877] shrink-0">
                          <FileCode className="w-4 h-4 text-[#577877]" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-mono text-xs font-bold text-[#F0F5F7] block truncate">
                            {hit.file_path}
                          </span>
                          <span className="text-[11px] font-mono text-[#577877]">
                            Lines {hit.start_line}–{hit.end_line} ({hit.end_line - hit.start_line + 1} lines) • {hit.language}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        {/* Relevance Match Score Badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium ${
                            scorePercent >= 70
                              ? 'bg-[#1E3430] text-[#6DBE9B] border border-[#6DBE9B]/30'
                              : scorePercent >= 45
                              ? 'bg-[#1E3430] text-[#D9A066] border border-[#D9A066]/30'
                              : 'bg-[#162623] text-[#B9CECC] border border-[#577877]/30'
                          }`}
                          title={`Cosine similarity: ${hit.score.toFixed(4)}`}
                        >
                          {scorePercent}% match
                        </span>

                        {/* Copy Code */}
                        <button
                          onClick={() => handleCopySnippet(hit.chunk_id, hit.content)}
                          title="Copy code snippet"
                          className="p-1.5 rounded-md text-[#577877] hover:text-[#F0F5F7] hover:bg-[#162623] transition-colors"
                        >
                          {copiedId === hit.chunk_id ? (
                            <Check className="w-3.5 h-3.5 text-[#6DBE9B]" />
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
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#162623] hover:bg-[#1E3430] border border-[#577877]/30 text-[#B9CECC] hover:text-[#F0F5F7] transition-colors text-xs font-sans"
                            >
                              <span>Open source</span>
                              <ExternalLink className="w-3 h-3 text-[#577877]" />
                            </a>
                          </Magnetic>
                        )}

                        {/* Ask AI in Chat */}
                        <Magnetic>
                          <button
                            onClick={() => onAskQuestionInChat(`Explain the code in ${hit.file_path} lines ${hit.start_line}-${hit.end_line}:\n\n${hit.content}`)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#295255] hover:bg-[#34686C] text-[#F0F5F7] border border-[#577877]/40 transition-colors text-xs font-sans shadow-sm"
                          >
                            <Sparkles className="w-3 h-3 text-[#F0F5F7]" />
                            <span>Ask AI</span>
                          </button>
                        </Magnetic>
                      </div>
                    </div>

                    {/* Code Snippet Box */}
                    <div className="rounded-lg overflow-hidden bg-[#111E1C] border border-[#577877]/25 font-mono-code text-xs">
                      <pre className="p-4 overflow-x-auto text-[#F0F5F7] leading-relaxed max-h-72">
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
            <div className="p-12 text-center rounded-xl bg-[#1B2D2A] border border-dashed border-[#577877]/30 space-y-2">
              <TextEffect as="p" className="text-sm font-semibold text-[#F0F5F7]">No semantic matches found</TextEffect>
              <p className="text-xs text-[#577877]">
                Try rephrasing your search query or adjusting the similarity score threshold.
              </p>
            </div>
          </Spotlight>
        ) : (
          <Spotlight variant="subtle" className="rounded-xl">
            <div className="p-12 text-center rounded-xl bg-[#1B2D2A] border border-[#577877]/25 space-y-2">
              <Code2 className="w-8 h-8 text-[#577877] mx-auto" />
              <TextEffect as="p" className="text-xs text-[#B9CECC] font-medium">
                Enter a natural language query above to discover relevant code snippets across the repository.
              </TextEffect>
            </div>
          </Spotlight>
        )}
      </div>
    </div>
  );
};
