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
import { Magnetic, Spotlight, Tilt, TextEffect } from './motion';

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
    <div className="flex-1 flex flex-col h-full bg-[#162623] overflow-hidden text-[#F0F5F7] font-sans">
      {/* Top Header / History Controls */}
      <header className="p-4 px-6 border-b border-[#577877]/25 bg-[#1B2D2A] shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#295255] border border-[#577877]/40 flex items-center justify-center text-[#F0F5F7] shadow-sm">
              <GitCommit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#F0F5F7]">
                  <TextEffect as="span">Git History & Diff Intelligence</TextEffect>
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#162623] text-[#B9CECC] border border-[#577877]/40 font-mono">
                  Git Logs
                </span>
              </div>
              <p className="text-xs text-[#577877] mt-0.5">
                Commit logs, unified diff patches, and evidence-grounded AI history analysis for{' '}
                <span className="font-mono text-[#F0F5F7] font-semibold">{repository.fullName}</span>
              </p>
            </div>
          </div>

          {/* Quick Filter Toolbar */}
          <div className="flex items-center gap-2">
            {/* Branch selector/input */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111E1C] border border-[#577877]/30 text-xs">
              <GitBranch className="w-3.5 h-3.5 text-[#577877]" />
              <input
                type="text"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                placeholder="branch (e.g. main)"
                className="bg-transparent text-[#F0F5F7] outline-none w-24 font-mono text-xs placeholder:text-[#577877]"
              />
            </div>

            {/* Path filter input */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111E1C] border border-[#577877]/30 text-xs">
              <Filter className="w-3.5 h-3.5 text-[#577877]" />
              <input
                type="text"
                value={pathFilter}
                onChange={(e) => setPathFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setAppliedPath(pathFilter.trim());
                }}
                placeholder="path filter (e.g. src/auth.py)"
                className="bg-transparent text-[#F0F5F7] outline-none w-44 font-mono text-xs placeholder:text-[#577877]"
              />
              {pathFilter !== appliedPath && (
                <button
                  onClick={() => setAppliedPath(pathFilter.trim())}
                  className="text-[11px] text-[#F0F5F7] hover:text-[#B9CECC] font-semibold underline ml-1"
                >
                  Apply
                </button>
              )}
            </div>

            {/* Refresh */}
            <Magnetic pullStrength={0.15}>
              <button
                onClick={() => fetchCommits(page, branchFilter, appliedPath)}
                disabled={isLoadingCommits}
                title="Refresh commit history"
                className="p-2 rounded-lg bg-[#111E1C] hover:bg-[#1E3430] border border-[#577877]/30 text-[#B9CECC] transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCommits ? 'animate-spin' : ''}`} />
              </button>
            </Magnetic>
          </div>
        </div>

        {/* History Natural Language Query Input */}
        <div className="mt-3.5">
          <form onSubmit={handleAskHistory} className="relative flex items-center">
            <div className="absolute left-3.5 flex items-center gap-2 pointer-events-none text-[#577877]">
              <Sparkles className="w-4 h-4 text-[#577877]" />
              <span className="text-xs text-[#B9CECC] font-medium hidden sm:inline">Ask Git History:</span>
            </div>
            <input
              type="text"
              value={historyQuestion}
              onChange={(e) => setHistoryQuestion(e.target.value)}
              placeholder="e.g. 'What changed in the latest commit?', 'Which commits touched auth.py?'"
              className="w-full pl-9 sm:pl-36 pr-24 py-2 rounded-xl bg-[#111E1C] border border-[#577877]/30 hover:border-[#295255] focus:border-[#295255] text-xs text-[#F0F5F7] placeholder-[#577877] outline-none transition-all shadow-inner"
            />
            <Magnetic>
              <button
                type="submit"
                disabled={!historyQuestion.trim() || isAskingHistory}
                className="absolute right-1.5 px-3 py-1 rounded-lg bg-[#295255] hover:bg-[#34686C] disabled:bg-[#1E3430] text-[#F0F5F7] font-medium text-xs flex items-center gap-1.5 border border-[#577877]/40 transition-all disabled:opacity-50"
              >
                {isAskingHistory ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Query</span>
              </button>
            </Magnetic>
          </form>
        </div>
      </header>

      {/* History Query Answer Card (if active) */}
      {(historyAnswer || historyChatError || isAskingHistory) && (
        <div className="p-4 px-6 border-b border-[#577877]/25 bg-[#111E1C] shrink-0">
          <Spotlight variant="emerald" className="rounded-xl">
            <div className="max-w-5xl mx-auto rounded-xl p-4 bg-[#1B2D2A] border border-[#577877]/40 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#F0F5F7] text-xs font-semibold">
                <Sparkles className="w-4 h-4 text-[#577877]" />
                <span>Git History Intelligence Answer</span>
              </div>
              <button
                onClick={() => {
                  setHistoryAnswer(null);
                  setHistoryChatError(null);
                }}
                className="text-xs text-[#577877] hover:text-[#F0F5F7]"
              >
                Dismiss
              </button>
            </div>

            {isAskingHistory && (
              <div className="flex items-center gap-3 py-4 text-xs text-[#B9CECC]">
                <Loader2 className="w-4 h-4 animate-spin text-[#577877]" />
                <span>Searching commit logs and diff patches with Gemini...</span>
              </div>
            )}

            {historyChatError && (
              <div className="flex items-start gap-2 text-xs text-[#D96B6B] bg-[#D96B6B]/10 p-3 rounded-lg border border-[#D96B6B]/30">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#D96B6B]" />
                <span>{historyChatError}</span>
              </div>
            )}

            {historyAnswer && (
              <div className="space-y-3">
                <p className="text-xs text-[#F0F5F7] whitespace-pre-wrap leading-relaxed font-sans">
                  {historyAnswer.answer}
                </p>

                {/* Referenced Commits and Files Chips */}
                <div className="pt-2 border-t border-[#577877]/20 flex flex-wrap items-center gap-2 text-[11px]">
                  {historyAnswer.referenced_commits.length > 0 && (
                    <div className="flex items-center gap-1 text-[#577877]">
                      <span>Referenced Commits:</span>
                      {historyAnswer.referenced_commits.map((sha) => (
                        <button
                          key={sha}
                          onClick={() => handleSelectCommit(sha)}
                          className="px-2 py-0.5 rounded bg-[#162623] border border-[#577877]/40 font-mono text-[#F0F5F7] hover:bg-[#1E3430] transition-colors"
                        >
                          {sha.slice(0, 7)}
                        </button>
                      ))}
                    </div>
                  )}

                  {historyAnswer.referenced_files.length > 0 && (
                    <div className="flex items-center gap-1 text-[#577877] ml-auto">
                      <span>Files:</span>
                      {historyAnswer.referenced_files.map((f) => (
                        <span key={f} className="px-1.5 py-0.5 rounded bg-[#111E1C] text-[#B9CECC] font-mono border border-[#577877]/30">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}

                  <span className="text-[10px] text-[#577877] font-mono ml-auto">
                    {historyAnswer.latency_ms}ms
                  </span>
                </div>
              </div>
            )}
          </div>
        </Spotlight>
      </div>
    )}

      {/* Main Split Body: Commits List on Left, Diff Inspector on Right */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Commit Log Table */}
        <div className="lg:w-5/12 flex flex-col border-r border-[#577877]/25 bg-[#1B2D2A] overflow-hidden">
          <div className="p-3 px-4 bg-[#111E1C] border-b border-[#577877]/25 flex items-center justify-between text-xs text-[#577877]">
            <span className="font-semibold text-[#F0F5F7]">
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
                className="px-2 py-0.5 rounded bg-[#162623] hover:bg-[#1E3430] disabled:opacity-40 text-[#B9CECC] border border-[#577877]/30"
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
                className="px-2 py-0.5 rounded bg-[#162623] hover:bg-[#1E3430] disabled:opacity-40 text-[#B9CECC] border border-[#577877]/30"
              >
                Next
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#577877]/15">
            {isLoadingCommits && commits.length === 0 && (
              <div className="p-8 text-center text-xs text-[#577877] flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#B9CECC]" />
                <span>Retrieving commits from GitHub...</span>
              </div>
            )}

            {listError && (
              <div className="m-4 p-3 rounded-lg bg-[#D96B6B]/10 border border-[#D96B6B]/30 text-xs text-[#D96B6B] space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="w-4 h-4 text-[#D96B6B]" />
                  <span>Unable to load commit log</span>
                </div>
                <p className="text-[11px] text-[#B9CECC]">{listError}</p>
              </div>
            )}

            {!isLoadingCommits && commits.length === 0 && !listError && (
              <div className="p-8 text-center text-xs text-[#577877]">
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
                      ? 'bg-[#213834] border-l-4 border-[#295255]'
                      : 'hover:bg-[#1E3430] border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-[#F0F5F7] line-clamp-1 group-hover:text-[#F0F5F7] transition-colors">
                      {titleLine}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopySha(commit.sha);
                      }}
                      title="Copy full SHA"
                      className="px-1.5 py-0.5 rounded bg-[#111E1C] border border-[#577877]/30 font-mono text-[10px] text-[#577877] hover:text-[#F0F5F7] shrink-0 flex items-center gap-1"
                    >
                      {copiedSha === commit.sha ? (
                        <Check className="w-2.5 h-2.5 text-[#6DBE9B]" />
                      ) : (
                        <Copy className="w-2.5 h-2.5" />
                      )}
                      <span>{commit.short_sha}</span>
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-[#577877]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-[#295255] text-[#F0F5F7] font-bold flex items-center justify-center text-[9px]">
                        {commit.author.name[0] || 'U'}
                      </div>
                      <span className="truncate max-w-[120px] text-[#B9CECC]">{commit.author.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[10px] text-[#577877]">
                        <Clock className="w-3 h-3" />
                        {formatDate(commit.author.date)}
                      </span>
                      <a
                        href={commit.html_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="View commit on GitHub"
                        className="text-[#577877] hover:text-[#F0F5F7]"
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
        <div className="lg:w-7/12 flex-1 flex flex-col bg-[#162623] overflow-y-auto">
          {!selectedCommitSha ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#577877] space-y-2">
              <FileDiff className="w-10 h-10 text-[#295255] mb-2" />
              <p className="text-sm font-medium text-[#F0F5F7]">Select a commit to inspect diffs</p>
              <p className="text-xs text-[#B9CECC] max-w-sm">
                Choose any commit on the left to see modified files, addition/deletion metrics, unified diff patches, and AI-grounded explanations.
              </p>
            </div>
          ) : isLoadingDetail ? (
            <div className="flex-1 flex items-center justify-center p-8 text-xs text-[#B9CECC] gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#577877]" />
              <span>Fetching commit diff and changed files...</span>
            </div>
          ) : detailError ? (
            <div className="p-6">
              <div className="p-4 rounded-xl bg-[#D96B6B]/10 border border-[#D96B6B]/30 text-xs text-[#D96B6B] space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 text-[#D96B6B]" />
                  <span>Failed to load commit details</span>
                </div>
                <p className="text-[11px] text-[#B9CECC]">{detailError}</p>
              </div>
            </div>
          ) : commitDetail ? (
            <div className="p-6 space-y-5">
              {/* Commit Header Card with Tilt & Spotlight */}
              <Tilt maxAngle={2}>
                <Spotlight variant="teal" className="rounded-xl">
                  <div className="rounded-xl p-4 bg-[#1B2D2A] border border-[#577877]/30 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-sm font-bold text-[#F0F5F7] whitespace-pre-wrap font-mono">
                          {commitDetail.message}
                        </h2>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#577877]">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-[#577877]" />
                            <strong className="text-[#B9CECC]">{commitDetail.author.name}</strong>
                            {commitDetail.author.email && (
                              <span className="text-[#577877] font-mono text-[10px]">
                                &lt;{commitDetail.author.email}&gt;
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-[#577877]">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDate(commitDetail.author.date)}
                          </span>
                        </div>
                      </div>

                      {/* Explain with Gemini Button */}
                      <Magnetic>
                        <button
                          onClick={() => handleExplainCommit(commitDetail.sha)}
                          disabled={isExplaining}
                          className="px-3.5 py-2 rounded-xl bg-[#295255] hover:bg-[#34686C] text-[#F0F5F7] font-medium text-xs flex items-center gap-2 border border-[#577877]/50 shadow-sm transition-all shrink-0 disabled:opacity-50 active:scale-[0.98]"
                        >
                          {isExplaining ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          <span>Explain with Gemini</span>
                        </button>
                      </Magnetic>
                    </div>

                    {/* Metrics bar */}
                    <div className="pt-3 border-t border-[#577877]/20 flex flex-wrap items-center gap-4 text-xs font-mono">
                      <div className="flex items-center gap-1 text-[#6DBE9B]">
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>+{commitDetail.stats.additions} additions</span>
                      </div>
                      <div className="flex items-center gap-1 text-[#D96B6B]">
                        <MinusCircle className="w-3.5 h-3.5" />
                        <span>-{commitDetail.stats.deletions} deletions</span>
                      </div>
                      <div className="flex items-center gap-1 text-[#B9CECC]">
                        <FileCode className="w-3.5 h-3.5 text-[#577877]" />
                        <span>{commitDetail.files.length} changed file{commitDetail.files.length === 1 ? '' : 's'}</span>
                      </div>
                      <a
                        href={commitDetail.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto flex items-center gap-1 text-[#B9CECC] hover:text-[#F0F5F7] text-[11px]"
                      >
                        <span>View on GitHub</span>
                        <ExternalLink className="w-3 h-3 text-[#577877]" />
                      </a>
                    </div>
                  </div>
                </Spotlight>
              </Tilt>

              {/* AI Explanation Card (when generated) */}
              {isExplaining && (
                <div className="p-4 rounded-xl bg-[#1B2D2A] border border-[#577877]/30 flex items-center gap-3 text-xs text-[#B9CECC]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#577877]" />
                  <span>Synthesizing evidence-grounded code analysis with Gemini...</span>
                </div>
              )}

              {explainError && (
                <div className="p-4 rounded-xl bg-[#D96B6B]/10 border border-[#D96B6B]/30 text-xs text-[#D96B6B]">
                  Failed to synthesize explanation: {explainError}
                </div>
              )}

              {aiExplanation && (
                <Spotlight variant="emerald" className="rounded-xl">
                  <div className="p-4 rounded-xl bg-[#1B2D2A] border border-[#577877]/40 shadow-md space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#F0F5F7]">
                        <Sparkles className="w-4 h-4 text-[#577877]" />
                        <span>Gemini Code Analysis</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#577877]">
                        Analyzed in {aiExplanation.latency_ms}ms
                      </span>
                    </div>

                    <p className="text-xs text-[#F0F5F7] whitespace-pre-wrap leading-relaxed font-sans">
                      {aiExplanation.explanation}
                    </p>

                    {/* Observed Changes & Inferred Intent */}
                    {aiExplanation.observed_changes.length > 0 && (
                      <div className="pt-2 border-t border-[#577877]/20 space-y-1">
                        <span className="text-[11px] font-semibold text-[#577877]">Directly Observed Modifications:</span>
                        <ul className="text-[11px] text-[#B9CECC] space-y-0.5 list-disc list-inside font-mono">
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
                <h3 className="text-xs font-bold text-[#577877] uppercase tracking-wider">
                  Changed Files ({commitDetail.files.length})
                </h3>

                <div className="space-y-2">
                  {commitDetail.files.map((file) => {
                    const isExpanded = !!expandedFiles[file.filename];

                    // Status badge color
                    const statusColor =
                      file.status === 'added'
                        ? 'bg-[#1E3430] text-[#6DBE9B] border-[#6DBE9B]/30'
                        : file.status === 'removed'
                        ? 'bg-[#1E3430] text-[#D96B6B] border-[#D96B6B]/30'
                        : 'bg-[#111E1C] text-[#B9CECC] border-[#577877]/30';

                    return (
                      <div
                        key={file.filename}
                        className="rounded-xl border border-[#577877]/30 bg-[#1B2D2A] overflow-hidden"
                      >
                        {/* File header bar */}
                        <div
                          onClick={() => toggleFileExpanded(file.filename)}
                          className="p-3 px-4 flex items-center justify-between cursor-pointer hover:bg-[#1E3430] transition-colors select-none"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-[#577877] shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-[#577877] shrink-0" />
                            )}
                            <span className="font-mono text-xs font-semibold text-[#F0F5F7] truncate">
                              {file.filename}
                            </span>
                            {file.previous_filename && (
                              <span className="text-[11px] text-[#577877] font-mono">
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
                            <span className="text-xs font-mono text-[#6DBE9B]">+{file.additions}</span>
                            <span className="text-xs font-mono text-[#D96B6B]">-{file.deletions}</span>
                          </div>
                        </div>

                        {/* Collapsible Unified Diff Patch */}
                        {isExpanded && (
                          <div className="border-t border-[#577877]/25 bg-[#111E1C] p-3 font-mono text-[11px] overflow-x-auto">
                            {file.patch_truncated && (
                              <div className="mb-2 p-2 rounded bg-[#D9A066]/10 border border-[#D9A066]/30 text-[10px] text-[#D9A066]">
                                ⚠️ Patch truncated: exceeded lines limit to protect context.
                              </div>
                            )}

                            {file.patch ? (
                              <pre className="text-[#B9CECC] whitespace-pre">
                                {file.patch.split('\n').map((line, idx) => {
                                  let lineStyle = 'text-[#B9CECC]';
                                  let bgStyle = '';

                                  if (line.startsWith('@@')) {
                                    lineStyle = 'text-[#F0F5F7] font-bold';
                                    bgStyle = 'bg-[#295255]/40';
                                  } else if (line.startsWith('+') && !line.startsWith('+++')) {
                                    lineStyle = 'text-[#6DBE9B]';
                                    bgStyle = 'bg-[#6DBE9B]/10';
                                  } else if (line.startsWith('-') && !line.startsWith('---')) {
                                    lineStyle = 'text-[#D96B6B]';
                                    bgStyle = 'bg-[#D96B6B]/10';
                                  }

                                  return (
                                    <div key={idx} className={`${lineStyle} ${bgStyle} px-1.5 py-0.5 rounded-xs`}>
                                      {line || ' '}
                                    </div>
                                  );
                                })}
                              </pre>
                            ) : (
                              <p className="text-[#577877] italic py-2">
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
