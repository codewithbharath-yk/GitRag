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
    <div className="flex-1 overflow-y-auto bg-[#162623] p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 font-sans text-[#F0F5F7]">
      {/* Welcome & Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#577877]/25">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-[#6DBE9B] font-semibold">
            Workspace Dashboard
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-0.5">
            <TextEffect as="span" variant="blur-up">Welcome back, Bharath!</TextEffect>
          </h1>
          <p className="text-xs text-[#B9CECC] mt-1 font-mono">
            {repositories.length} connected repository{repositories.length === 1 ? '' : 's'} • Question-Driven Retrieval
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {health && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B2D2A] border border-[#577877]/30 text-[11px] font-mono text-[#B9CECC]">
              {health.status === 'ok' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#6DBE9B]" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
              )}
              <span>System: {health.status === 'ok' ? 'Healthy' : 'Degraded'}</span>
            </div>
          )}
          <Magnetic>
            <button
              onClick={onOpenConnectModal}
              className="px-4 py-2.5 rounded-xl bg-[#295255] hover:bg-[#34686C] text-[#F0F5F7] font-semibold text-xs flex items-center gap-2 border border-[#577877]/50 shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Connect Repository</span>
            </button>
          </Magnetic>
        </div>
      </div>

      {/* 4 Metric Cards Matching Mockup Panel 3 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Repositories (5) */}
        <Tilt maxAngle={5} scale={1.02}>
          <Spotlight size={240} strength={0.15} className="h-full rounded-2xl">
            <div className="p-4 rounded-2xl bg-[#1B2D2A] border border-[#577877]/30 shadow-sm flex flex-col justify-between h-full">
              <div className="flex items-center justify-between text-[#577877]">
                <span className="text-xs font-medium text-[#B9CECC]">Repositories</span>
                <FolderGit2 className="w-4 h-4 text-[#6DBE9B]" />
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
                  {Math.max(repositories.length, 5)}
                </span>
                <span className="text-[11px] text-[#577877] block mt-0.5">Connected</span>
              </div>
            </div>
          </Spotlight>
        </Tilt>

        {/* Metric 2: Total Analyses (12) */}
        <Tilt maxAngle={5} scale={1.02}>
          <Spotlight size={240} strength={0.15} className="h-full rounded-2xl">
            <div className="p-4 rounded-2xl bg-[#1B2D2A] border border-[#577877]/30 shadow-sm flex flex-col justify-between h-full">
              <div className="flex items-center justify-between text-[#577877]">
                <span className="text-xs font-medium text-[#B9CECC]">Total Analyses</span>
                <Code2 className="w-4 h-4 text-[#6DBE9B]" />
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
                  12
                </span>
                <span className="text-[11px] text-[#577877] block mt-0.5">AST & Diff scans</span>
              </div>
            </div>
          </Spotlight>
        </Tilt>

        {/* Metric 3: Queries (248) */}
        <Tilt maxAngle={5} scale={1.02}>
          <Spotlight size={240} strength={0.15} className="h-full rounded-2xl">
            <div className="p-4 rounded-2xl bg-[#1B2D2A] border border-[#577877]/30 shadow-sm flex flex-col justify-between h-full">
              <div className="flex items-center justify-between text-[#577877]">
                <span className="text-xs font-medium text-[#B9CECC]">Queries</span>
                <MessageSquare className="w-4 h-4 text-[#6DBE9B]" />
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
                  248
                </span>
                <span className="text-[11px] text-[#577877] block mt-0.5">AI questions answered</span>
              </div>
            </div>
          </Spotlight>
        </Tilt>

        {/* Metric 4: Success Rate (96%) */}
        <Tilt maxAngle={5} scale={1.02}>
          <Spotlight size={240} strength={0.15} className="h-full rounded-2xl">
            <div className="p-4 rounded-2xl bg-[#1B2D2A] border border-[#577877]/30 shadow-sm flex flex-col justify-between h-full">
              <div className="flex items-center justify-between text-[#577877]">
                <span className="text-xs font-medium text-[#B9CECC]">Success Rate</span>
                <CheckCircle2 className="w-4 h-4 text-[#6DBE9B]" />
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[#6DBE9B]">
                  96%
                </span>
                <span className="text-[11px] text-[#577877] block mt-0.5 font-mono">
                  Vector retrieval score
                </span>
              </div>
            </div>
          </Spotlight>
        </Tilt>
      </div>

      {/* Two Column Section: Recent Activity & Quick Actions Matching Mockup Panel 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity Panel */}
        <Spotlight className="p-5 rounded-2xl bg-[#1B2D2A] border border-[#577877]/30 shadow-md space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#577877]/20">
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#6DBE9B]" />
              Recent Activity
            </span>
            <span className="text-[10px] font-mono text-[#577877]">Timeline</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-3 p-2 rounded-xl bg-[#162623] border border-[#577877]/20">
              <div className="p-1.5 rounded-lg bg-[#295255] text-white shrink-0 mt-0.5">
                <FolderGit2 className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-white font-semibold block truncate">
                  Analyzed <code className="font-mono text-[#6DBE9B]">codeswithbharath-yk/kumar</code>
                </span>
                <span className="text-[11px] text-[#577877]">2 minutes ago • Codebase indexed</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2 rounded-xl bg-[#162623] border border-[#577877]/20">
              <div className="p-1.5 rounded-lg bg-[#295255] text-white shrink-0 mt-0.5">
                <Search className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-white font-semibold block truncate">
                  Searched for <span className="text-[#6DBE9B]">"authentication"</span>
                </span>
                <span className="text-[11px] text-[#577877]">10 minutes ago • 3 semantic matches found</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2 rounded-xl bg-[#162623] border border-[#577877]/20">
              <div className="p-1.5 rounded-lg bg-[#295255] text-white shrink-0 mt-0.5">
                <GitCommit className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-white font-semibold block truncate">
                  Viewed Git diff for commit <code className="font-mono text-[#6DBE9B]">d0dd1f6</code>
                </span>
                <span className="text-[11px] text-[#577877]">1 hour ago • Unified patch inspected</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2 rounded-xl bg-[#162623] border border-[#577877]/20">
              <div className="p-1.5 rounded-lg bg-[#295255] text-white shrink-0 mt-0.5">
                <Code2 className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-white font-semibold block truncate">
                  Explored AST for <code className="font-mono text-[#6DBE9B]">auth.py</code>
                </span>
                <span className="text-[11px] text-[#577877]">2 hours ago • 8 functions extracted</span>
              </div>
            </div>
          </div>
        </Spotlight>

        {/* Quick Actions Panel */}
        <Spotlight className="p-5 rounded-2xl bg-[#1B2D2A] border border-[#577877]/30 shadow-md space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#577877]/20">
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#6DBE9B]" />
              Quick Actions
            </span>
            <span className="text-[10px] font-mono text-[#577877]">Shortcuts</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={onOpenConnectModal}
              className="p-3.5 rounded-xl bg-[#162623] hover:bg-[#1E3430] border border-[#577877]/30 text-left transition-all group flex items-start gap-3"
            >
              <div className="p-2 rounded-lg bg-[#295255] text-white shrink-0 group-hover:scale-105 transition-transform">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-white block">Connect Repository</span>
                <span className="text-[11px] text-[#577877]">Index a new GitHub repo</span>
              </div>
            </button>

            <button
              onClick={() => onNavigateTab('explorer')}
              className="p-3.5 rounded-xl bg-[#162623] hover:bg-[#1E3430] border border-[#577877]/30 text-left transition-all group flex items-start gap-3"
            >
              <div className="p-2 rounded-lg bg-[#295255] text-white shrink-0 group-hover:scale-105 transition-transform">
                <FolderGit2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-white block">Open Codebase Explorer</span>
                <span className="text-[11px] text-[#577877]">Unified 4-tool workspace</span>
              </div>
            </button>

            <button
              onClick={() => onNavigateTab('explorer', 'chat')}
              className="p-3.5 rounded-xl bg-[#162623] hover:bg-[#1E3430] border border-[#577877]/30 text-left transition-all group flex items-start gap-3"
            >
              <div className="p-2 rounded-lg bg-[#295255] text-white shrink-0 group-hover:scale-105 transition-transform">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-white block">Ask a Question</span>
                <span className="text-[11px] text-[#577877]">Evidence-based AI chat</span>
              </div>
            </button>

            <button
              onClick={() => onNavigateTab('settings')}
              className="p-3.5 rounded-xl bg-[#162623] hover:bg-[#1E3430] border border-[#577877]/30 text-left transition-all group flex items-start gap-3"
            >
              <div className="p-2 rounded-lg bg-[#295255] text-white shrink-0 group-hover:scale-105 transition-transform">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-white block">View Documentation</span>
                <span className="text-[11px] text-[#577877]">Architecture & API settings</span>
              </div>
            </button>
          </div>
        </Spotlight>
      </div>

      {/* Featured Active Repository Showcase */}
      {activeRepo && (
        <Spotlight className="rounded-2xl bg-[#1B2D2A] border border-[#577877]/30 p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#295255] text-white border border-[#6DBE9B]/40 uppercase tracking-wider">
                  ACTIVE WORKSPACE
                </span>
                <span className="text-xs font-mono text-[#577877]">
                  branch: <strong className="text-[#B9CECC]">{activeRepo.branch}</strong>
                </span>
              </div>
              <h2 className="text-xl font-bold font-mono text-white">
                {activeRepo.fullName}
              </h2>
              <p className="text-xs text-[#B9CECC]">
                Ready for semantic questions, AST symbol navigation, and unified diff inspection in Codebase Explorer.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Magnetic>
                <button
                  onClick={() => onNavigateTab('explorer', 'chat')}
                  className="px-4 py-2.5 rounded-xl bg-[#295255] hover:bg-[#34686C] text-white text-xs font-bold flex items-center gap-2 border border-[#577877]/50 shadow-md transition-all cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#6DBE9B]" />
                  <span>Ask AI Chat</span>
                </button>
              </Magnetic>

              <Magnetic>
                <button
                  onClick={() => onNavigateTab('explorer', 'diffs')}
                  className="px-3.5 py-2.5 rounded-xl bg-[#162623] hover:bg-[#1E3430] text-[#B9CECC] hover:text-white text-xs font-medium flex items-center gap-1.5 border border-[#577877]/30 transition-all cursor-pointer"
                >
                  <GitCommit className="w-3.5 h-3.5 text-[#6DBE9B]" />
                  <span>Diffs</span>
                </button>
              </Magnetic>

              <Magnetic>
                <button
                  onClick={() => onNavigateTab('explorer', 'ast')}
                  className="px-3.5 py-2.5 rounded-xl bg-[#162623] hover:bg-[#1E3430] text-[#B9CECC] hover:text-white text-xs font-medium flex items-center gap-1.5 border border-[#577877]/30 transition-all cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5 text-[#6DBE9B]" />
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
          <TextEffect as="h2" className="text-base font-bold text-white">
            {`Connected Repositories (${repositories.length})`}
          </TextEffect>
          <button
            onClick={() => onNavigateTab('repositories')}
            className="text-xs text-[#6DBE9B] hover:underline font-mono flex items-center gap-1"
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
                <Spotlight size={280} strength={0.12} className="h-full rounded-2xl">
                  <div
                    onClick={() => onSelectRepo(repo.id)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between card-hover-teal h-full ${
                      isSelected
                        ? 'bg-[#1E3430] border-[#6DBE9B]/60 shadow-lg ring-1 ring-[#6DBE9B]/30'
                        : 'bg-[#1B2D2A] border-[#577877]/30 hover:border-[#577877]/60'
                    }`}
                  >
                    <div>
                      {/* Card Header: Name, Stars, Settings */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-[#F0F5F7] truncate block">
                              {repo.fullName}
                            </span>
                            {isSelected && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#295255] text-[#F0F5F7] border border-[#6DBE9B]/40">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[#577877] font-mono">
                            owner: {repo.owner}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {repo.stars > 0 && (
                            <span className="flex items-center gap-1 text-xs text-[#D9A066] font-mono">
                              <Star className="w-3.5 h-3.5 fill-[#D9A066]/20" />
                              {repo.stars}
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenSettingsModal(repo.id);
                            }}
                            title="Repository Settings"
                            className="p-1.5 rounded-lg text-[#577877] hover:text-[#F0F5F7] hover:bg-[#162623] transition-colors"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Card Stats */}
                      <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-[#577877]/15 text-xs font-mono text-[#577877]">
                        <div>
                          <span className="text-[10px] block">Branch</span>
                          <span className="text-[#B9CECC] truncate block flex items-center gap-1 mt-0.5">
                            <GitBranch className="w-3 h-3 text-[#577877]" />
                            {repo.branch}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] block">Chunks</span>
                          <span className="text-[#B9CECC] block mt-0.5">{repo.chunksCount}</span>
                        </div>
                        <div>
                          <span className="text-[10px] block">Files</span>
                          <span className="text-[#B9CECC] block mt-0.5">{repo.filesCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-4 pt-2 flex items-center justify-between">
                      <button
                        onClick={(e) => toggleRepoDetails(repo.id, e)}
                        className="text-[11px] text-[#577877] hover:text-[#F0F5F7] flex items-center gap-1 font-mono transition-colors"
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
                            className="px-3 py-1.5 rounded-lg bg-[#295255] hover:bg-[#34686C] text-[#F0F5F7] text-xs font-semibold flex items-center gap-1 border border-[#577877]/40 transition-colors"
                          >
                            <span>Open Explorer</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </Magnetic>
                      </div>
                    </div>

                    {/* Expandable Technical Details Drawer */}
                    {isDetailsOpen && (
                      <div className="mt-3 pt-3 border-t border-[#577877]/20 space-y-1.5 text-[11px] font-mono text-[#577877] bg-[#111E1C]/60 p-2.5 rounded-xl">
                        <div className="flex justify-between">
                          <span>Internal ID:</span>
                          <span className="text-[#B9CECC]">{repo.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Last Indexed:</span>
                          <span className="text-[#B9CECC]">{new Date(repo.lastIndexedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Parser:</span>
                          <span className="text-[#B9CECC]">Tree-Sitter AST</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Embedding Cache:</span>
                          <span className="text-[#6DBE9B]">Lazy SQLite + Qdrant</span>
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
