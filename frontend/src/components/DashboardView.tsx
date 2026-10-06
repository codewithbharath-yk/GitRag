import React, { useState } from 'react';
import {
  FolderGit2,
  Plus,
  GitBranch,
  Star,
  Layers,
  FileCode,
  Search,
  MessageSquare,
  GitCommit,
  Code2,
  Clock,
  Settings,
  Server,
} from 'lucide-react';
import type { StoredRepository, HealthResponse } from '../types/api';

interface DashboardViewProps {
  repositories: StoredRepository[];
  activeRepoId: string | null;
  onSelectRepo: (id: string) => void;
  onNavigateTab: (tab: 'chat' | 'search' | 'history' | 'intelligence') => void;
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
  const [filterQuery, setFilterQuery] = useState('');

  // Calculate statistics across all registered repositories
  const totalFiles = repositories.reduce((acc, r) => acc + (r.filesCount || 0), 0);
  const totalChunks = repositories.reduce((acc, r) => acc + (r.chunksCount || 0), 0);

  const filteredRepositories = repositories.filter((r) => {
    const q = filterQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      r.fullName.toLowerCase().includes(q) ||
      (r.language && r.language.toLowerCase().includes(q)) ||
      r.branch.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-6 sm:p-8 space-y-8 font-sans">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>Repository Dashboard</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
              Overview
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Monitor indexed repositories, vector metrics, and AI service health.
          </p>
        </div>

        <button
          onClick={onOpenConnectModal}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Connect New Repository</span>
        </button>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-bold text-white block">{repositories.length}</span>
            <span className="text-xs text-slate-400 font-medium">Connected Repositories</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-bold text-white block">{totalChunks}</span>
            <span className="text-xs text-slate-400 font-medium">Vector Chunks in Qdrant</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
            <FileCode className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-bold text-white block">{totalFiles}</span>
            <span className="text-xs text-slate-400 font-medium">Source Files Indexed</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <span className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {health ? 'Healthy' : 'Online'}
            </span>
            <span className="text-xs text-slate-400 block mt-0.5">Qdrant & Gemini Active</span>
          </div>
        </div>
      </div>

      {/* Repository Filter & List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>Indexed Codebases</span>
            <span className="text-xs text-slate-500 font-normal">({filteredRepositories.length})</span>
          </h2>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter repositories..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 transition-all font-mono"
            />
          </div>
        </div>

        {filteredRepositories.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-slate-800/60 flex items-center justify-center text-slate-500">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-300">
                {filterQuery ? 'No matching repositories found' : 'No repositories indexed yet'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {filterQuery
                  ? 'Try adjusting your search filter term.'
                  : 'Connect a public or private GitHub repository to start asking questions.'}
              </p>
            </div>
            {!filterQuery && (
              <button
                onClick={onOpenConnectModal}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs inline-flex items-center gap-1.5 shadow-md shadow-blue-600/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Connect Repository</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRepositories.map((repo) => {
              const isActive = repo.id === activeRepoId;
              return (
                <div
                  key={repo.id}
                  className={`p-5 rounded-2xl bg-slate-900/70 border transition-all flex flex-col justify-between gap-4 ${
                    isActive
                      ? 'border-blue-500/60 shadow-lg shadow-blue-500/10'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-xs font-mono text-slate-400 block truncate">{repo.owner}</span>
                        <h3 className="text-sm font-bold text-white font-mono truncate">{repo.name}</h3>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {repo.stars > 0 && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-mono">
                            <Star className="w-3 h-3 fill-amber-400/20" />
                            {repo.stars}
                          </span>
                        )}
                        <button
                          onClick={() => onOpenSettingsModal(repo.id)}
                          title="Repository Settings"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400">
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 text-slate-300">
                        <GitBranch className="w-3 h-3 text-slate-500" />
                        {repo.branch}
                      </span>
                      {repo.language && (
                        <span className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300">
                          {repo.language}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-indigo-400">
                        <Layers className="w-3 h-3" />
                        {repo.chunksCount} chunks
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
                      <Clock className="w-3 h-3" />
                      <span>Indexed: {new Date(repo.lastIndexedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div className="pt-3 border-t border-slate-800/80 grid grid-cols-4 gap-1.5">
                    <button
                      onClick={() => {
                        onSelectRepo(repo.id);
                        onNavigateTab('chat');
                      }}
                      className="py-1.5 px-2 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-300 font-medium text-[11px] flex items-center justify-center gap-1 transition-all"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Chat</span>
                    </button>
                    <button
                      onClick={() => {
                        onSelectRepo(repo.id);
                        onNavigateTab('search');
                      }}
                      className="py-1.5 px-2 rounded-lg bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/30 text-purple-300 font-medium text-[11px] flex items-center justify-center gap-1 transition-all"
                    >
                      <Search className="w-3 h-3" />
                      <span>Search</span>
                    </button>
                    <button
                      onClick={() => {
                        onSelectRepo(repo.id);
                        onNavigateTab('intelligence');
                      }}
                      className="py-1.5 px-2 rounded-lg bg-cyan-600/15 hover:bg-cyan-600/25 border border-cyan-500/30 text-cyan-300 font-medium text-[11px] flex items-center justify-center gap-1 transition-all"
                    >
                      <Code2 className="w-3 h-3" />
                      <span>AST</span>
                    </button>
                    <button
                      onClick={() => {
                        onSelectRepo(repo.id);
                        onNavigateTab('history');
                      }}
                      className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 font-medium text-[11px] flex items-center justify-center gap-1 transition-all"
                    >
                      <GitCommit className="w-3 h-3" />
                      <span>Diffs</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
