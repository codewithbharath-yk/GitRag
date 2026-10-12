import React, { useState } from 'react';
import {
  FolderGit2,
  CheckCircle2,
  XCircle,
  Plus,
  ArrowRight,
  GitBranch,
  Star,
  Settings,
  Clock,
  Sparkles,
  Search,
  GitCommit,
  Code2,
  BookOpen,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { StoredRepository, HealthResponse } from '../types/api';
import { TextEffect } from './motion/TextEffect';
import { Spotlight } from './motion/Spotlight';
import { Tilt } from './motion/Tilt';
import { Magnetic } from './motion/Magnetic';

interface DashboardViewProps {
  repositories: StoredRepository[];
  activeRepoId: string | null;
  onSelectRepo: (id: string) => void;
  onNavigateTab: (tab: any, subTab?: string) => void;
  onOpenConnectModal: () => void;
  onOpenSettingsModal: (repoId: string) => void;
  health: HealthResponse | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  repositories,
  activeRepoId,
  onSelectRepo,
  onNavigateTab,
  onOpenConnectModal,
  onOpenSettingsModal,
  health,
}) => {
  const [expandedRepoDetails, setExpandedRepoDetails] = useState<Record<string, boolean>>({});

  const toggleRepoDetails = (repoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRepoDetails((prev) => ({
      ...prev,
      [repoId]: !prev[repoId],
    }));
  };

  const activeRepo = repositories.find((r) => r.id === activeRepoId) || repositories[0] || null;

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 font-sans text-[var(--text-primary)]">
      {/* Welcome & Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--border-subtle)]">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-[#F9B318] font-semibold">
            Workspace Dashboard
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)] mt-0.5">
            <TextEffect as="span" variant="blur-up">Welcome back, Bharath!</TextEffect>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1 font-mono">
            {repositories.length} connected repository{repositories.length === 1 ? '' : 's'} • Question-Driven Retrieval
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {health && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-secondary)]">
              {health.status === 'ok' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
              )}
              <span>System: {health.status === 'ok' ? 'Healthy' : 'Degraded'}</span>
            </div>
          )}
          <Magnetic>
            <button
              onClick={onOpenConnectModal}
              className="px-4 py-2.5 rounded-xl bg-[#1546D9] hover:bg-[#2255EB] text-white font-semibold text-xs flex items-center gap-2 border border-[#1546D9] shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Connect Repository</span>
            </button>
          </Magnetic>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Repositories */}
        <Tilt maxAngle={5} scale={1.02}>
          <Spotlight color="#1546D9" size={240} strength={0.15} className="h-full rounded-2xl">
            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-sm flex flex-col justify-between h-full">
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Repositories</span>
                <FolderGit2 className="w-4 h-4 text-[#1546D9]" />
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[var(--text-primary)]">
                  {Math.max(repositories.length, 5)}
                </span>
                <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">Connected</span>
              </div>
            </div>
          </Spotlight>
        </Tilt>

        {/* Metric 2: Total Analyses */}
        <Tilt maxAngle={5} scale={1.02}>
          <Spotlight color="#1546D9" size={240} strength={0.15} className="h-full rounded-2xl">
            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-sm flex flex-col justify-between h-full">
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Total Analyses</span>
                <Code2 className="w-4 h-4 text-[#1546D9]" />
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[var(--text-primary)]">
                  12
                </span>
                <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">AST & Diff scans</span>
              </div>
            </div>
          </Spotlight>
        </Tilt>

        {/* Metric 3: Queries */}
        <Tilt maxAngle={5} scale={1.02}>
          <Spotlight color="#1546D9" size={240} strength={0.15} className="h-full rounded-2xl">
            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-sm flex flex-col justify-between h-full">
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Queries</span>
                <MessageSquare className="w-4 h-4 text-[#F9B318]" />
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[var(--text-primary)]">
                  248
                </span>
                <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">AI questions answered</span>
              </div>
            </div>
          </Spotlight>
        </Tilt>

        {/* Metric 4: Success Rate */}
        <Tilt maxAngle={5} scale={1.02}>
          <Spotlight color="#1546D9" size={240} strength={0.15} className="h-full rounded-2xl">
            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-sm flex flex-col justify-between h-full">
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Success Rate</span>
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[#10B981]">
                  96%
                </span>
                <span className="text-[11px] text-[var(--text-muted)] block mt-0.5 font-mono">
                  Vector retrieval score
                </span>
              </div>
            </div>
          </Spotlight>
        </Tilt>
      </div>

      {/* Two Column Section: Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity Panel */}
        <Spotlight color="#1546D9" className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-md space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
            <span className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#F9B318]" />
              Recent Activity
            </span>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">Timeline</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-3 p-2 rounded-xl bg-[var(--bg-well)] border border-[var(--border-subtle)]">
              <div className="p-1.5 rounded-lg bg-[#1546D9] text-white shrink-0 mt-0.5">
                <FolderGit2 className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[var(--text-primary)] font-semibold block truncate">
                  Analyzed <code className="font-mono text-[#F9B318]">codeswithbharath-yk/kumar</code>
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">2 minutes ago • Codebase indexed</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2 rounded-xl bg-[var(--bg-well)] border border-[var(--border-subtle)]">
              <div className="p-1.5 rounded-lg bg-[#1546D9] text-white shrink-0 mt-0.5">
                <Search className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[var(--text-primary)] font-semibold block truncate">
                  Searched for <span className="text-[#F9B318]">"authentication"</span>
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">10 minutes ago • 3 semantic matches found</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2 rounded-xl bg-[var(--bg-well)] border border-[var(--border-subtle)]">
              <div className="p-1.5 rounded-lg bg-[#1546D9] text-white shrink-0 mt-0.5">
                <GitCommit className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[var(--text-primary)] font-semibold block truncate">
                  Viewed Git diff for commit <code className="font-mono text-[#F9B318]">d0dd1f6</code>
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">1 hour ago • Unified patch inspected</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2 rounded-xl bg-[var(--bg-well)] border border-[var(--border-subtle)]">
              <div className="p-1.5 rounded-lg bg-[#1546D9] text-white shrink-0 mt-0.5">
                <Code2 className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[var(--text-primary)] font-semibold block truncate">
                  Explored AST for <code className="font-mono text-[#F9B318]">auth.py</code>
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">2 hours ago • 8 functions extracted</span>
              </div>
            </div>
          </div>
        </Spotlight>

        {/* Quick Actions Panel */}
        <Spotlight color="#1546D9" className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-md space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
            <span className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#F9B318]" />
              Quick Actions
            </span>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">Shortcuts</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={onOpenConnectModal}
              className="p-3.5 rounded-xl bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-left transition-all group flex items-start gap-3 cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-[#1546D9] text-white shrink-0 group-hover:scale-105 transition-transform">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-[var(--text-primary)] block">Connect Repository</span>
                <span className="text-[11px] text-[var(--text-muted)]">Index a new GitHub repo</span>
              </div>
            </button>

            <button
              onClick={() => onNavigateTab('explorer')}
              className="p-3.5 rounded-xl bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-left transition-all group flex items-start gap-3 cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-[#1546D9] text-white shrink-0 group-hover:scale-105 transition-transform">
                <FolderGit2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-[var(--text-primary)] block">Open Codebase Explorer</span>
                <span className="text-[11px] text-[var(--text-muted)]">Unified 4-tool workspace</span>
              </div>
            </button>

            <button
              onClick={() => onNavigateTab('explorer', 'chat')}
              className="p-3.5 rounded-xl bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-left transition-all group flex items-start gap-3 cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-[#1546D9] text-white shrink-0 group-hover:scale-105 transition-transform">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-[var(--text-primary)] block">Ask a Question</span>
                <span className="text-[11px] text-[var(--text-muted)]">Evidence-based AI chat</span>
              </div>
            </button>

            <button
              onClick={() => onNavigateTab('settings')}
              className="p-3.5 rounded-xl bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-left transition-all group flex items-start gap-3 cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-[#1546D9] text-white shrink-0 group-hover:scale-105 transition-transform">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-[var(--text-primary)] block">View Documentation</span>
                <span className="text-[11px] text-[var(--text-muted)]">Architecture & API settings</span>
              </div>
            </button>
          </div>
        </Spotlight>
      </div>

      {/* Featured Active Repository Showcase */}
      {activeRepo && (
        <Spotlight color="#1546D9" className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1546D9] text-white border border-[#1546D9] uppercase tracking-wider font-semibold">
                  ACTIVE WORKSPACE
                </span>
                <span className="text-xs font-mono text-[var(--text-muted)]">
                  branch: <strong className="text-[var(--text-primary)]">{activeRepo.branch}</strong>
                </span>
              </div>
              <h2 className="text-xl font-bold font-mono text-[var(--text-primary)]">
                {activeRepo.fullName}
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Ready for semantic questions, AST symbol navigation, and unified diff inspection in Codebase Explorer.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Magnetic>
                <button
                  onClick={() => onNavigateTab('explorer', 'chat')}
                  className="px-4 py-2.5 rounded-xl bg-[#1546D9] hover:bg-[#2255EB] text-white text-xs font-bold flex items-center gap-2 border border-[#1546D9] shadow-md transition-all cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#F9B318]" />
                  <span>Ask AI Chat</span>
                </button>
              </Magnetic>

              <Magnetic>
                <button
                  onClick={() => onNavigateTab('explorer', 'diffs')}
                  className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium flex items-center gap-1.5 border border-[var(--border-subtle)] transition-all cursor-pointer"
                >
                  <GitCommit className="w-3.5 h-3.5 text-[#1546D9]" />
                  <span>Diffs</span>
                </button>
              </Magnetic>

              <Magnetic>
                <button
                  onClick={() => onNavigateTab('explorer', 'ast')}
                  className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium flex items-center gap-1.5 border border-[var(--border-subtle)] transition-all cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5 text-[#1546D9]" />
                  <span>AST</span>
                </button>
              </Magnetic>
            </div>
          </div>
        </Spotlight>
      )}

      {/* Connected Repositories Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <TextEffect as="h2" className="text-base font-bold text-[var(--text-primary)]">
            {`Connected Repositories (${repositories.length})`}
          </TextEffect>
          <button
            onClick={() => onNavigateTab('repositories')}
            className="text-xs text-[#1546D9] hover:underline font-mono flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {repositories.map((repo) => {
            const isSelected = repo.id === activeRepoId;
            const isDetailsOpen = !!expandedRepoDetails[repo.id];

            return (
              <Tilt key={repo.id} maxAngle={6} scale={1.01}>
                <Spotlight color="#1546D9" size={280} strength={0.12} className="h-full rounded-2xl">
                  <div
                    onClick={() => onSelectRepo(repo.id)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-full ${
                      isSelected
                        ? 'bg-[var(--bg-card)] border-[#1546D9] shadow-lg ring-1 ring-[#1546D9]/40'
                        : 'bg-[var(--bg-card)] border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                    }`}
                  >
                    <div>
                      {/* Card Header: Name, Stars, Settings */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-[var(--text-primary)] truncate block">
                              {repo.fullName}
                            </span>
                            {isSelected && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#1546D9] text-white border border-[#1546D9] font-bold">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[var(--text-muted)] font-mono">
                            owner: {repo.owner}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {repo.stars > 0 && (
                            <span className="flex items-center gap-1 text-xs text-[#F9B318] font-mono">
                              <Star className="w-3.5 h-3.5 fill-[#F9B318]/20" />
                              {repo.stars}
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenSettingsModal(repo.id);
                            }}
                            title="Repository Settings"
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)] transition-colors cursor-pointer"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Card Stats */}
                      <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-[var(--border-subtle)] text-xs font-mono text-[var(--text-muted)]">
                        <div>
                          <span className="text-[10px] block">Branch</span>
                          <span className="text-[var(--text-primary)] truncate block flex items-center gap-1 mt-0.5">
                            <GitBranch className="w-3 h-3 text-[var(--text-muted)]" />
                            {repo.branch}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] block">Chunks</span>
                          <span className="text-[var(--text-primary)] block mt-0.5">{repo.chunksCount}</span>
                        </div>
                        <div>
                          <span className="text-[10px] block">Files</span>
                          <span className="text-[var(--text-primary)] block mt-0.5">{repo.filesCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-4 pt-2 flex items-center justify-between">
                      <button
                        onClick={(e) => toggleRepoDetails(repo.id, e)}
                        className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 font-mono transition-colors cursor-pointer"
                      >
                        <span>{isDetailsOpen ? 'Hide technical info' : 'Technical info'}</span>
                        {isDetailsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      <div className="flex items-center gap-2">
                        <Magnetic>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectRepo(repo.id);
                              onNavigateTab('explorer', 'chat');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#1546D9] hover:bg-[#2255EB] text-white text-xs font-semibold flex items-center gap-1 border border-[#1546D9] transition-colors cursor-pointer"
                          >
                            <span>Open Explorer</span>
                            <ArrowRight className="w-3 h-3 text-[#F9B318]" />
                          </button>
                        </Magnetic>
                      </div>
                    </div>

                    {/* Expandable Technical Details Drawer */}
                    {isDetailsOpen && (
                      <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] space-y-1.5 text-[11px] font-mono text-[var(--text-muted)] bg-[var(--bg-well)] p-2.5 rounded-xl">
                        <div className="flex justify-between">
                          <span>Internal ID:</span>
                          <span className="text-[var(--text-primary)]">{repo.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Last Indexed:</span>
                          <span className="text-[var(--text-primary)]">{new Date(repo.lastIndexedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Parser:</span>
                          <span className="text-[var(--text-primary)]">Tree-Sitter AST</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Embedding Cache:</span>
                          <span className="text-[#F9B318]">Lazy SQLite + Qdrant</span>
                        </div>
                      </div>
                    )}
                  </div>
                </Spotlight>
              </Tilt>
            );
          })}
        </div>
      </div>
    </div>
  );
};
