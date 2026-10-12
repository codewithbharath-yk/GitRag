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
  ArrowLeft,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import type {
  StoredRepository,
  CommitItem,
  CommitDetail,
  CommitExplainResponse,
  HistoryChatResponse,
} from '../types/api';
import { Magnetic, Spotlight, Tilt, TextEffect } from './motion';
import { useNavigation } from '../context/NavigationContext';

interface GitHistoryViewProps {
  repository: StoredRepository;
  onOpenSourceFile?: (path: string) => void;
}

export const GitHistoryView: React.FC<GitHistoryViewProps> = ({
  repository,
}) => {
  const { commitSha, setCommitSha } = useNavigation();

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
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(commitSha);
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

  // Load commit detail
  const loadCommitDetail = useCallback(
    async (sha: string) => {
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
    },
    [repository.id]
  );

  // Sync external navigation changes (browser back/forward or deep links)
  useEffect(() => {
    if (commitSha && commitSha !== selectedCommitSha) {
      loadCommitDetail(commitSha);
    } else if (!commitSha && selectedCommitSha) {
      setSelectedCommitSha(null);
      setCommitDetail(null);
    }
  }, [commitSha, selectedCommitSha, loadCommitDetail]);

  const handleSelectCommit = (sha: string) => {
    setCommitSha(sha);
    loadCommitDetail(sha);
  };

  const handleDeselectCommit = () => {
    setCommitSha(null);
    setSelectedCommitSha(null);
    setCommitDetail(null);
    setDetailError(null);
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
      const res = await api.askHistoryQuestion({
        repository_id: repository.id,
        question: historyQuestion.trim(),
        branch: branchFilter || undefined,
        limit_commits: 20,
      });
      setHistoryAnswer(res);
    } catch (err) {
      setHistoryChatError(
        err instanceof ApiError ? err.message : 'Failed to analyze commit history.'
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
    <div className="flex-1 flex flex-col h-full bg-[#111318] overflow-hidden text-[#EDECE6] font-sans">
      {/* Top Header / History Controls */}
      <header className="p-4 px-6 border-b border-white/10 bg-[#181B22] shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1546D9] border border-white/15 flex items-center justify-center text-white shadow-sm shrink-0">
              <GitCommit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#EDECE6]">
                  <TextEffect as="span">Git History & Diff Intelligence</TextEffect>
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#111318] text-[#A8AFBD] border border-white/10 font-mono">
                  Git Logs
                </span>
              </div>
              <p className="text-xs text-[#767E90] mt-0.5">
                Commit logs, unified diff patches, and evidence-grounded AI history analysis for{' '}
                <span className="font-mono text-[#EDECE6] font-semibold">{repository.fullName}</span>
              </p>
            </div>
          </div>

          {/* Quick Filter Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Branch selector/input */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0B0D11] border border-white/10 text-xs">
              <GitBranch className="w-3.5 h-3.5 text-[#F9B318]" />
              <input
                type="text"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                placeholder="branch (e.g. main)"
                className="bg-transparent text-[#EDECE6] outline-none w-24 font-mono text-xs placeholder:text-[#767E90]"
              />
            </div>

            {/* Path filter input */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0B0D11] border border-white/10 text-xs">
              <Filter className="w-3.5 h-3.5 text-[#767E90]" />
              <input
                type="text"
                value={pathFilter}
                onChange={(e) => setPathFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setAppliedPath(pathFilter.trim());
                }}
                placeholder="path filter (e.g. src/auth.py)"
                className="bg-transparent text-[#EDECE6] outline-none w-36 font-mono text-xs placeholder:text-[#767E90]"
              />
              {pathFilter && (
                <button
                  onClick={() => {
                    setPathFilter('');
                    setAppliedPath('');
                  }}
                  className="text-[#767E90] hover:text-[#EDECE6] text-[10px]"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={() => fetchCommits(1, branchFilter, appliedPath)}
              disabled={isLoadingCommits}
              title="Refresh commits"
              className="p-2 rounded-xl bg-[#0B0D11] hover:bg-[#1F2430] border border-white/10 text-[#A8AFBD] hover:text-[#EDECE6] transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCommits ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* History QA Query Assistant Panel */}
      <div className="p-4 px-6 border-b border-white/10 bg-[#181B22]/60 shrink-0">
        <Spotlight variant="cobalt" className="rounded-2xl">
          <div className="p-4 rounded-2xl bg-[#1D212B] border border-white/10 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#EDECE6]">
                <Sparkles className="w-3.5 h-3.5 text-[#F9B318]" />
                <span>Ask Repository History (e.g., &ldquo;When was authentication added?&rdquo;)</span>
              </div>
            </div>

            <form onSubmit={handleAskHistory} className="flex gap-2">
              <input
                type="text"
                value={historyQuestion}
                onChange={(e) => setHistoryQuestion(e.target.value)}
                placeholder="Ask about historical commits, architecture changes, author contributions..."
                className="flex-1 px-3.5 py-2 bg-[#0B0D11] border border-white/10 rounded-xl text-xs text-[#EDECE6] placeholder-[#767E90] focus:outline-none focus:border-[#1546D9] focus:ring-1 focus:ring-[#1546D9]"
              />
              <button
                type="submit"
                disabled={isAskingHistory || !historyQuestion.trim()}
                className="px-4 py-2 rounded-xl bg-[#1546D9] hover:bg-[#2255EB] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-colors"
              >
                {isAskingHistory ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Analyze</span>
              </button>
            </form>

            {historyChatError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{historyChatError}</span>
              </div>
            )}

            {historyAnswer && (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-[#EDECE6] whitespace-pre-wrap leading-relaxed font-sans">
                  {historyAnswer.answer}
                </p>

                {/* Referenced Commits and Files Chips */}
                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-2 text-[11px]">
                  {historyAnswer.referenced_commits.length > 0 && (
                    <div className="flex items-center gap-1 text-[#767E90]">
                      <span>Referenced Commits:</span>
                      {historyAnswer.referenced_commits.map((sha) => (
                        <button
                          key={sha}
                          onClick={() => handleSelectCommit(sha)}
                          className="px-2 py-0.5 rounded-lg bg-[#0B0D11] border border-white/10 font-mono text-[#EDECE6] hover:bg-[#1546D9] hover:text-white transition-colors"
                        >
                          {sha.slice(0, 7)}
                        </button>
                      ))}
                    </div>
                  )}

                  {historyAnswer.referenced_files.length > 0 && (
                    <div className="flex items-center gap-1 text-[#767E90] ml-auto">
                      <span>Files:</span>
                      {historyAnswer.referenced_files.map((f) => (
                        <span key={f} className="px-1.5 py-0.5 rounded-md bg-[#0B0D11] text-[#A8AFBD] font-mono border border-white/10">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}

                  <span className="text-[10px] text-[#767E90] font-mono ml-auto">
                    {historyAnswer.latency_ms}ms
                  </span>
                </div>
              </div>
            )}
          </div>
        </Spotlight>
      </div>

      {/* Main Split Body: Commits List on Left, Diff Inspector on Right */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Commit Log Table */}
        <div className={`lg:w-5/12 flex flex-col border-r border-white/10 bg-[#181B22] overflow-hidden ${selectedCommitSha ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-3 px-4 bg-[#111318] border-b border-white/10 flex items-center justify-between text-xs text-[#767E90]">
            <span className="font-semibold text-[#EDECE6]">
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
                className="px-2.5 py-1 rounded-lg bg-[#0B0D11] hover:bg-[#1F2430] disabled:opacity-40 text-[#A8AFBD] border border-white/10"
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
                className="px-2.5 py-1 rounded-lg bg-[#0B0D11] hover:bg-[#1F2430] disabled:opacity-40 text-[#A8AFBD] border border-white/10"
              >
                Next
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {isLoadingCommits && commits.length === 0 && (
              <div className="p-8 text-center text-xs text-[#767E90] flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#A8AFBD]" />
                <span>Retrieving commits from GitHub...</span>
              </div>
            )}

            {listError && (
              <div className="m-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span>Unable to load commit log</span>
                </div>
                <p className="text-[11px] text-[#A8AFBD]">{listError}</p>
              </div>
            )}

            {!isLoadingCommits && commits.length === 0 && !listError && (
              <div className="p-8 text-center text-xs text-[#767E90]">
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
                      ? 'bg-[#1546D9]/15 border-l-4 border-[#1546D9]'
                      : 'hover:bg-[#1D212B] border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-[#EDECE6] line-clamp-1 group-hover:text-white transition-colors">
                      {titleLine}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopySha(commit.sha);
                      }}
                      title="Copy full SHA"
                      className="px-1.5 py-0.5 rounded-md bg-[#0B0D11] border border-white/10 font-mono text-[10px] text-[#767E90] hover:text-[#EDECE6] shrink-0 flex items-center gap-1"
                    >
                      {copiedSha === commit.sha ? (
                        <Check className="w-2.5 h-2.5 text-[#10B981]" />
                      ) : (
                        <Copy className="w-2.5 h-2.5" />
                      )}
                      <span>{commit.short_sha}</span>
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-[#767E90]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-[#1546D9] text-white font-bold flex items-center justify-center text-[9px]">
                        {commit.author.name[0] || 'U'}
                      </div>
                      <span className="truncate max-w-[120px] text-[#A8AFBD]">{commit.author.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[10px] text-[#767E90]">
                        <Clock className="w-3 h-3" />
                        {formatDate(commit.author.date)}
                      </span>
                      <a
                        href={commit.html_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="View commit on GitHub"
                        className="text-[#767E90] hover:text-[#EDECE6]"
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
        <div className={`lg:w-7/12 flex-1 flex flex-col bg-[#111318] overflow-y-auto ${!selectedCommitSha ? 'hidden lg:flex' : 'flex'}`}>
          {!selectedCommitSha ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#767E90] space-y-2">
              <FileDiff className="w-10 h-10 text-[#1546D9] mb-2" />
              <p className="text-sm font-medium text-[#EDECE6]">Select a commit to inspect diffs</p>
              <p className="text-xs text-[#A8AFBD] max-w-sm">
                Choose any commit on the left to see modified files, addition/deletion metrics, unified diff patches, and AI-grounded explanations.
              </p>
            </div>
          ) : isLoadingDetail ? (
            <div className="flex-1 flex items-center justify-center p-8 text-xs text-[#A8AFBD] gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#1546D9]" />
              <span>Fetching commit diff and changed files...</span>
            </div>
          ) : detailError ? (
            <div className="p-6 space-y-4">
              <button
                onClick={handleDeselectCommit}
                className="lg:hidden inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to commits</span>
              </button>
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span>Failed to load commit details</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">{detailError}</p>
              </div>
            </div>
          ) : commitDetail ? (
            <div className="p-6 space-y-5">
              {/* Commit Detail Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDeselectCommit}
                    className="lg:hidden p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
                    title="Back to commit list"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
                    Commit {commitDetail.sha.slice(0, 7)}
                  </span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-well)] text-[#1546D9] dark:text-[#F9B318] border border-[var(--border-subtle)] font-semibold">
                  {commitDetail.files?.length || 0} modified files
                </span>
              </div>

              {/* Commit Header Card */}
              <Tilt maxAngle={2}>
                <Spotlight variant="cobalt" className="rounded-2xl">
                  <div className="rounded-2xl p-4 bg-[#181B22] border border-white/10 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-sm font-bold text-[#EDECE6] whitespace-pre-wrap font-mono">
                          {commitDetail.message}
                        </h2>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#767E90]">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-[#767E90]" />
                            <strong className="text-[#A8AFBD]">{commitDetail.author.name}</strong>
                            {commitDetail.author.email && (
                              <span className="text-[#767E90] font-mono text-[10px]">
                                &lt;{commitDetail.author.email}&gt;
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-[#767E90]">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDate(commitDetail.author.date)}
                          </span>
                        </div>
                      </div>

                      {/* Explain with Gemini Button in Cobalt Blue */}
                      <Magnetic>
                        <button
                          onClick={() => handleExplainCommit(commitDetail.sha)}
                          disabled={isExplaining}
                          className="px-3.5 py-2 rounded-xl bg-[#1546D9] hover:bg-[#2255EB] text-white font-medium text-xs flex items-center gap-2 border border-[#1546D9]/40 shadow-sm transition-all shrink-0 disabled:opacity-50 active:scale-[0.98] cursor-pointer"
                        >
                          {isExplaining ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-[#F9B318]" />
                          )}
                          <span>Explain with Gemini</span>
                        </button>
                      </Magnetic>
                    </div>

                    {/* Metrics bar */}
                    <div className="pt-3 border-t border-white/10 flex flex-wrap items-center gap-4 text-xs font-mono">
                      <div className="flex items-center gap-1 text-[#10B981]">
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>+{commitDetail.stats.additions} additions</span>
                      </div>
                      <div className="flex items-center gap-1 text-[#EF4444]">
                        <MinusCircle className="w-3.5 h-3.5" />
                        <span>-{commitDetail.stats.deletions} deletions</span>
                      </div>
                      <div className="flex items-center gap-1 text-[#A8AFBD]">
                        <FileCode className="w-3.5 h-3.5 text-[#767E90]" />
                        <span>{commitDetail.files.length} changed file{commitDetail.files.length === 1 ? '' : 's'}</span>
                      </div>
                      <a
                        href={commitDetail.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto flex items-center gap-1 text-[#A8AFBD] hover:text-[#EDECE6] text-[11px]"
                      >
                        <span>View on GitHub</span>
                        <ExternalLink className="w-3 h-3 text-[#767E90]" />
                      </a>
                    </div>
                  </div>
                </Spotlight>
              </Tilt>

              {/* AI Explanation Card */}
              {isExplaining && (
                <div className="p-4 rounded-xl bg-[#181B22] border border-white/10 flex items-center gap-3 text-xs text-[#A8AFBD]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#1546D9]" />
                  <span>Synthesizing evidence-grounded code analysis with Gemini...</span>
                </div>
              )}

              {explainError && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                  Failed to synthesize explanation: {explainError}
                </div>
              )}

              {aiExplanation && (
                <Spotlight variant="yellow" className="rounded-2xl">
                  <div className="p-4 rounded-2xl bg-[#181B22] border border-[#F9B318]/30 shadow-md space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#EDECE6]">
                        <Sparkles className="w-4 h-4 text-[#F9B318]" />
                        <span>Gemini Code Analysis</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#767E90]">
                        Analyzed in {aiExplanation.latency_ms}ms
                      </span>
                    </div>

                    <p className="text-xs text-[#EDECE6] whitespace-pre-wrap leading-relaxed font-sans">
                      {aiExplanation.explanation}
                    </p>

                    {/* Observed Changes */}
                    {aiExplanation.observed_changes.length > 0 && (
                      <div className="pt-2 border-t border-white/10 space-y-1">
                        <span className="text-[11px] font-semibold text-[#767E90]">Directly Observed Modifications:</span>
                        <ul className="text-[11px] text-[#A8AFBD] space-y-0.5 list-disc list-inside font-mono">
                          {aiExplanation.observed_changes.map((obs, idx) => (
                            <li key={idx}>{obs}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Spotlight>
              )}

              {/* Changed Files List & Diffs */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#767E90] uppercase tracking-wider">
                  Changed Files ({commitDetail.files.length})
                </h3>

                <div className="space-y-2">
                  {commitDetail.files.map((file) => {
                    const isExpanded = !!expandedFiles[file.filename];

                    // Status badge color
                    const statusColor =
                      file.status === 'added'
                        ? 'bg-emerald-500/10 text-[#10B981] border-emerald-500/30'
                        : file.status === 'removed'
                        ? 'bg-rose-500/10 text-[#EF4444] border-rose-500/30'
                        : 'bg-[#0B0D11] text-[#A8AFBD] border-white/10';

                    return (
                      <div
                        key={file.filename}
                        className="rounded-2xl border border-white/10 bg-[#181B22] overflow-hidden shadow-xs"
                      >
                        {/* File header bar */}
                        <div
                          onClick={() => toggleFileExpanded(file.filename)}
                          className="p-3 px-4 flex items-center justify-between cursor-pointer hover:bg-[#1D212B] transition-colors select-none"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-[#767E90] shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-[#767E90] shrink-0" />
                            )}
                            <span className="font-mono text-xs font-semibold text-[#EDECE6] truncate">
                              {file.filename}
                            </span>
                            {file.previous_filename && (
                              <span className="text-[11px] text-[#767E90] font-mono">
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
                            <span className="text-xs font-mono text-[#10B981]">+{file.additions}</span>
                            <span className="text-xs font-mono text-[#EF4444]">-{file.deletions}</span>
                          </div>
                        </div>

                        {/* Collapsible Unified Diff Patch */}
                        {isExpanded && (
                          <div className="border-t border-white/10 bg-[#0B0D11] p-3 font-mono text-[11px] overflow-x-auto">
                            {file.patch_truncated && (
                              <div className="mb-2 p-2 rounded-lg bg-[#F9B318]/10 border border-[#F9B318]/30 text-[10px] text-[#F9B318]">
                                ⚠️ Patch truncated: exceeded lines limit to protect context.
                              </div>
                            )}

                            {file.patch ? (
                              <pre className="text-[#A8AFBD] whitespace-pre">
                                {file.patch.split('\n').map((line, idx) => {
                                  let lineStyle = 'text-[#A8AFBD]';
                                  let bgStyle = '';

                                  if (line.startsWith('@@')) {
                                    lineStyle = 'text-white font-bold';
                                    bgStyle = 'bg-[#1546D9]/25';
                                  } else if (line.startsWith('+') && !line.startsWith('+++')) {
                                    lineStyle = 'text-[#10B981]';
                                    bgStyle = 'bg-emerald-500/10';
                                  } else if (line.startsWith('-') && !line.startsWith('---')) {
                                    lineStyle = 'text-[#EF4444]';
                                    bgStyle = 'bg-rose-500/10';
                                  }

                                  return (
                                    <div key={idx} className={`${lineStyle} ${bgStyle} px-1.5 py-0.5 rounded-xs`}>
                                      {line || ' '}
                                    </div>
                                  );
                                })}
                              </pre>
                            ) : (
                              <p className="text-[#767E90] italic py-2">
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
