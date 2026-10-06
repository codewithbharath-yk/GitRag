import React, { useState, useEffect, useCallback } from 'react';
import {
  GitCommit,
  GitBranch,
  FileCode,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Clock,
  User,
  Filter,
  RefreshCw,
  AlertCircle,
  Send,
  Loader2,
  Copy,
  Check,
  PlusCircle,
  MinusCircle,
  FileDiff,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import type {
  StoredRepository,
  CommitItem,
  CommitDetail,
  CommitExplainResponse,
  HistoryChatResponse,
} from '../types/api';

interface GitHistoryViewProps {
  repository: StoredRepository;
  onOpenSourceFile?: (path: string) => void;
}

export const GitHistoryView: React.FC<GitHistoryViewProps> = ({
  repository,
}) => {
  // Commit list state
  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [totalReturned, setTotalReturned] = useState(0);
  const [isLoadingCommits, setIsLoadingCommits] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Filters
  const [branchFilter, setBranchFilter] = useState(repository.branch || 'main');
  const [pathFilter, setPathFilter] = useState('');
  const [appliedPath, setAppliedPath] = useState('');

  // Selected commit for inspection
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null);
  const [commitDetail, setCommitDetail] = useState<CommitDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // AI Explanation state
  const [aiExplanation, setAiExplanation] = useState<CommitExplainResponse | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  // History Chat / Q&A state
  const [historyQuestion, setHistoryQuestion] = useState('');
  const [historyAnswer, setHistoryAnswer] = useState<HistoryChatResponse | null>(null);
  const [isAskingHistory, setIsAskingHistory] = useState(false);
  const [historyChatError, setHistoryChatError] = useState<string | null>(null);

  // Expanded file diffs in detail view
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  // Fetch commits
  const fetchCommits = useCallback(
    async (currentPage: number, branch: string, path: string) => {
      try {
        setIsLoadingCommits(true);
        setListError(null);
        const res = await api.listCommits(repository.id, {
          branch: branch.trim() || undefined,
          path: path.trim() || undefined,
          page: currentPage,
          per_page: perPage,
        });
        setCommits(res.commits);
        setTotalReturned(res.total_returned);
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : 'Failed to retrieve repository commit history.';
        setListError(msg);
        setCommits([]);
      } finally {
        setIsLoadingCommits(false);
      }
    },
    [repository.id, perPage]
  );

  // Initial load or branch/repo change
  useEffect(() => {
    let ignore = false;
    const run = async () => {
      if (ignore) return;
      await fetchCommits(1, branchFilter, appliedPath);
    };
    run();
    return () => {
      ignore = true;
    };
  }, [fetchCommits, branchFilter, appliedPath]);

  // Load commit detail when selected
  const handleSelectCommit = async (sha: string) => {
    setSelectedCommitSha(sha);
    setIsLoadingDetail(true);
    setDetailError(null);
    setCommitDetail(null);
    setAiExplanation(null);
    setExplainError(null);

    try {
      const detail = await api.getCommitDetail(repository.id, sha);
      setCommitDetail(detail);
      // Auto-expand first 3 files
      const initialExpanded: Record<string, boolean> = {};
      detail.files.slice(0, 3).forEach((f) => {
        initialExpanded[f.filename] = true;
      });
      setExpandedFiles(initialExpanded);
    } catch (err) {
      setDetailError(
        err instanceof ApiError ? err.message : 'Failed to retrieve commit details and diff.'
      );
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Trigger Gemini AI explanation for commit
  const handleExplainCommit = async (sha: string) => {
    setIsExplaining(true);
    setExplainError(null);
    try {
      const res = await api.explainCommit(repository.id, sha, 'detailed');
      setAiExplanation(res);
    } catch (err) {
      setExplainError(
        err instanceof ApiError ? err.message : 'Failed to synthesize commit explanation.'
      );
    } finally {
      setIsExplaining(false);
    }
  };

  // Submit history question
  const handleAskHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!historyQuestion.trim() || isAskingHistory) return;

    setIsAskingHistory(true);
    setHistoryChatError(null);
    try {
      const res = await api.chatHistory(repository.id, {
        question: historyQuestion.trim(),
        branch: branchFilter || undefined,
        commit_sha: selectedCommitSha || undefined,
        path: appliedPath || undefined,
      });
      setHistoryAnswer(res);
    } catch (err) {
      setHistoryChatError(
        err instanceof ApiError ? err.message : 'Failed to retrieve answer from Git history.'
      );
    } finally {
      setIsAskingHistory(false);
    }
  };

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  const toggleFileExpanded = (filename: string) => {
    setExpandedFiles((prev) => ({
      ...prev,
      [filename]: !prev[filename],
    }));
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden text-slate-100">
      {/* Top Header / History Controls */}
      <header className="p-4 px-6 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-sm shadow-purple-500/10">
              <GitCommit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-100">Git History & Diff Intelligence</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                  Phase 5
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect commit logs, unified diff patches, and evidence-grounded AI history analysis for{' '}
                <span className="font-mono text-purple-300 font-semibold">{repository.fullName}</span>
              </p>
            </div>
          </div>

          {/* Quick Filter Toolbar */}
          <div className="flex items-center gap-2">
            {/* Branch selector/input */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
              <GitBranch className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                placeholder="branch (e.g. main)"
                className="bg-transparent text-slate-200 outline-none w-24 font-mono text-xs placeholder:text-slate-500"
              />
            </div>

            {/* Path filter input */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={pathFilter}
                onChange={(e) => setPathFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setAppliedPath(pathFilter.trim());
                }}
                placeholder="path filter (e.g. src/auth.py)"
                className="bg-transparent text-slate-200 outline-none w-44 font-mono text-xs placeholder:text-slate-500"
              />
              {pathFilter !== appliedPath && (
                <button
                  onClick={() => setAppliedPath(pathFilter.trim())}
                  className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold underline ml-1"
                >
                  Apply
                </button>
              )}
            </div>

            {/* Refresh */}
            <button
              onClick={() => fetchCommits(page, branchFilter, appliedPath)}
              disabled={isLoadingCommits}
              title="Refresh commit history"
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCommits ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* History Natural Language Query Input */}
        <div className="mt-3.5">
          <form onSubmit={handleAskHistory} className="relative flex items-center">
            <div className="absolute left-3.5 flex items-center gap-2 pointer-events-none text-slate-400">
              <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
              <span className="text-xs text-purple-300 font-medium hidden sm:inline">Ask Git History:</span>
            </div>
            <input
              type="text"
              value={historyQuestion}
              onChange={(e) => setHistoryQuestion(e.target.value)}
              placeholder="e.g. 'What changed in the latest commit?', 'Which commits touched auth.py?', 'How did error handling evolve?'"
              className="w-full pl-9 sm:pl-36 pr-24 py-2 rounded-xl bg-slate-950/80 border border-purple-500/30 hover:border-purple-500/50 focus:border-purple-400 text-xs text-slate-200 placeholder:text-slate-500 outline-none transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={!historyQuestion.trim() || isAskingHistory}
              className="absolute right-1.5 px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white font-medium text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {isAskingHistory ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Query</span>
            </button>
          </form>
        </div>
      </header>

      {/* History Query Answer Card (if active) */}
      {(historyAnswer || historyChatError || isAskingHistory) && (
        <div className="p-4 px-6 border-b border-purple-500/20 bg-purple-950/20 shrink-0">
          <div className="max-w-5xl mx-auto rounded-xl p-4 bg-slate-900/90 border border-purple-500/30 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-300 text-xs font-semibold">
                <Sparkles className="w-4 h-4" />
                <span>Git History Intelligence Answer</span>
              </div>
              <button
                onClick={() => {
                  setHistoryAnswer(null);
                  setHistoryChatError(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Dismiss
              </button>
            </div>

            {isAskingHistory && (
              <div className="flex items-center gap-3 py-4 text-xs text-purple-300">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                <span>Searching commit logs and diff patches with Gemini...</span>
              </div>
            )}

            {historyChatError && (
              <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-950/40 p-3 rounded-lg border border-rose-800/40">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{historyChatError}</span>
              </div>
            )}

            {historyAnswer && (
              <div className="space-y-3">
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
                  {historyAnswer.answer}
                </p>

                {/* Referenced Commits and Files Chips */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-[11px]">
                  {historyAnswer.referenced_commits.length > 0 && (
                    <div className="flex items-center gap-1 text-slate-400">
                      <span>Referenced Commits:</span>
                      {historyAnswer.referenced_commits.map((sha) => (
                        <button
                          key={sha}
                          onClick={() => handleSelectCommit(sha)}
                          className="px-2 py-0.5 rounded bg-purple-900/40 border border-purple-500/40 font-mono text-purple-300 hover:bg-purple-800/50 transition-colors"
                        >
                          {sha.slice(0, 7)}
                        </button>
                      ))}
                    </div>
                  )}

                  {historyAnswer.referenced_files.length > 0 && (
                    <div className="flex items-center gap-1 text-slate-400 ml-auto">
                      <span>Files:</span>
                      {historyAnswer.referenced_files.map((f) => (
                        <span key={f} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}

                  <span className="text-[10px] text-slate-500 font-mono ml-auto">
                    {historyAnswer.latency_ms}ms
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Split Body: Commits List on Left, Diff Inspector on Right */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Commit Log Table */}
        <div className="lg:w-5/12 flex flex-col border-r border-slate-800 bg-slate-950/60 overflow-hidden">
          <div className="p-3 px-4 bg-slate-900/40 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300">
              Commit History {totalReturned > 0 ? `(${totalReturned})` : ''}
            </span>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <button
                disabled={page <= 1 || isLoadingCommits}
                onClick={() => {
                  const newPage = page - 1;
                  setPage(newPage);
                  fetchCommits(newPage, branchFilter, appliedPath);
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300"
              >
                Prev
              </button>
              <span>Page {page}</span>
              <button
                disabled={totalReturned < perPage || isLoadingCommits}
                onClick={() => {
                  const newPage = page + 1;
                  setPage(newPage);
                  fetchCommits(newPage, branchFilter, appliedPath);
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300"
              >
                Next
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {isLoadingCommits && commits.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                <span>Retrieving commits from GitHub...</span>
              </div>
            )}

            {listError && (
              <div className="m-4 p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 text-xs text-rose-300 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span>Unable to load commit log</span>
                </div>
                <p className="text-[11px] text-slate-400">{listError}</p>
              </div>
            )}

            {!isLoadingCommits && commits.length === 0 && !listError && (
              <div className="p-8 text-center text-xs text-slate-500">
                No commits found matching the selected branch or file path filter.
              </div>
            )}

            {commits.map((commit) => {
              const isSelected = selectedCommitSha === commit.sha;
              const titleLine = commit.message.split('\n')[0];

              return (
                <div
                  key={commit.sha}
                  onClick={() => handleSelectCommit(commit.sha)}
                  className={`p-3.5 px-4 cursor-pointer transition-colors relative group ${
                    isSelected
                      ? 'bg-purple-950/30 border-l-4 border-purple-500'
                      : 'hover:bg-slate-900/60 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-200 line-clamp-1 group-hover:text-purple-300 transition-colors">
                      {titleLine}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopySha(commit.sha);
                      }}
                      title="Copy full SHA"
                      className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-400 hover:text-slate-200 shrink-0 flex items-center gap-1"
                    >
                      {copiedSha === commit.sha ? (
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-2.5 h-2.5" />
                      )}
                      <span>{commit.short_sha}</span>
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-[9px]">
                        {commit.author.name[0] || 'U'}
                      </div>
                      <span className="truncate max-w-[120px]">{commit.author.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Clock className="w-3 h-3" />
                        {formatDate(commit.author.date)}
                      </span>
                      <a
                        href={commit.html_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="View commit on GitHub"
                        className="text-slate-500 hover:text-purple-300"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Diff & Commit Detail Inspector */}
        <div className="lg:w-7/12 flex-1 flex flex-col bg-slate-900/30 overflow-y-auto">
          {!selectedCommitSha ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2">
              <FileDiff className="w-10 h-10 text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-400">Select a commit to inspect diffs</p>
              <p className="text-xs text-slate-500 max-w-sm">
                Choose any commit on the left to see modified files, addition/deletion metrics, unified diff patches, and AI-grounded explanations.
              </p>
            </div>
          ) : isLoadingDetail ? (
            <div className="flex-1 flex items-center justify-center p-8 text-xs text-purple-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Fetching commit diff and changed files...</span>
            </div>
          ) : detailError ? (
            <div className="p-6">
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/40 text-xs text-rose-300 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span>Failed to load commit details</span>
                </div>
                <p className="text-[11px] text-slate-400">{detailError}</p>
              </div>
            </div>
          ) : commitDetail ? (
            <div className="p-6 space-y-5">
              {/* Commit Header Card */}
              <div className="rounded-xl p-4 bg-slate-900/80 border border-slate-800 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold text-slate-100 whitespace-pre-wrap font-mono">
                      {commitDetail.message}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-purple-400" />
                        <strong className="text-slate-300">{commitDetail.author.name}</strong>
                        {commitDetail.author.email && (
                          <span className="text-slate-500 font-mono text-[10px]">
                            &lt;{commitDetail.author.email}&gt;
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(commitDetail.author.date)}
                      </span>
                    </div>
                  </div>

                  {/* Explain with Gemini Button */}
                  <button
                    onClick={() => handleExplainCommit(commitDetail.sha)}
                    disabled={isExplaining}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs flex items-center gap-2 shadow-md shadow-purple-600/20 transition-all shrink-0 disabled:opacity-50"
                  >
                    {isExplaining ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>Explain with Gemini</span>
                  </button>
                </div>

                {/* Metrics bar */}
                <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center gap-1 font-mono text-emerald-400">
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>+{commitDetail.stats.additions} additions</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-rose-400">
                    <MinusCircle className="w-3.5 h-3.5" />
                    <span>-{commitDetail.stats.deletions} deletions</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-slate-400">
                    <FileCode className="w-3.5 h-3.5" />
                    <span>{commitDetail.files.length} changed files</span>
                  </div>
                  <a
                    href={commitDetail.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto flex items-center gap-1 text-purple-400 hover:text-purple-300 font-mono text-[11px]"
                  >
                    <span>View on GitHub</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* AI Explanation Card (when generated) */}
              {isExplaining && (
                <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-center gap-3 text-xs text-purple-300">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                  <span>Synthesizing evidence-grounded code analysis with Gemini...</span>
                </div>
              )}

              {explainError && (
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/40 text-xs text-rose-300">
                  Failed to synthesize explanation: {explainError}
                </div>
              )}

              {aiExplanation && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-purple-950/30 to-indigo-950/20 border border-purple-500/40 shadow-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span>Gemini Code Analysis</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      Analyzed in {aiExplanation.latency_ms}ms
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                    {aiExplanation.explanation}
                  </p>

                  {/* Observed Changes & Inferred Intent */}
                  {aiExplanation.observed_changes.length > 0 && (
                    <div className="pt-2 border-t border-purple-500/20 space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400">Directly Observed Modifications:</span>
                      <ul className="text-[11px] text-slate-300 space-y-0.5 list-disc list-inside font-mono">
                        {aiExplanation.observed_changes.map((obs, idx) => (
                          <li key={idx}>{obs}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Changed Files List & Diffs */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Changed Files ({commitDetail.files.length})
                </h3>

                <div className="space-y-2">
                  {commitDetail.files.map((file) => {
                    const isExpanded = !!expandedFiles[file.filename];

                    // Status badge color
                    const statusColor =
                      file.status === 'added'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : file.status === 'removed'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : file.status === 'renamed'
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30';

                    return (
                      <div
                        key={file.filename}
                        className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden"
                      >
                        {/* File header bar */}
                        <div
                          onClick={() => toggleFileExpanded(file.filename)}
                          className="p-3 px-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors select-none"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                              {file.filename}
                            </span>
                            {file.previous_filename && (
                              <span className="text-[11px] text-slate-400 font-mono">
                                (from {file.previous_filename})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase border ${statusColor}`}
                            >
                              {file.status}
                            </span>
                            <span className="text-xs font-mono text-emerald-400">+{file.additions}</span>
                            <span className="text-xs font-mono text-rose-400">-{file.deletions}</span>
                          </div>
                        </div>

                        {/* Collapsible Unified Diff Patch */}
                        {isExpanded && (
                          <div className="border-t border-slate-800/80 bg-slate-950 p-3 font-mono text-[11px] overflow-x-auto">
                            {file.patch_truncated && (
                              <div className="mb-2 p-2 rounded bg-amber-950/40 border border-amber-800/40 text-[10px] text-amber-300">
                                ⚠️ Patch truncated: exceeded 300 lines limit to protect model context.
                              </div>
                            )}

                            {file.patch ? (
                              <pre className="text-slate-300 whitespace-pre">
                                {file.patch.split('\n').map((line, idx) => {
                                  let lineStyle = 'text-slate-400';
                                  let bgStyle = '';

                                  if (line.startsWith('@@')) {
                                    lineStyle = 'text-purple-400 font-bold';
                                    bgStyle = 'bg-purple-950/20';
                                  } else if (line.startsWith('+') && !line.startsWith('+++')) {
                                    lineStyle = 'text-emerald-300';
                                    bgStyle = 'bg-emerald-950/30';
                                  } else if (line.startsWith('-') && !line.startsWith('---')) {
                                    lineStyle = 'text-rose-300';
                                    bgStyle = 'bg-rose-950/30';
                                  }

                                  return (
                                    <div key={idx} className={`${lineStyle} ${bgStyle} px-1.5 py-0.2 rounded-sm`}>
                                      {line || ' '}
                                    </div>
                                  );
                                })}
                              </pre>
                            ) : (
                              <p className="text-slate-500 italic py-2">
                                (No unified diff patch available - file may be binary, large, or removed without content)
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
