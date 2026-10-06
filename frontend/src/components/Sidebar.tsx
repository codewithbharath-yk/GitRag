import React from 'react';
import {
  FolderGit2,
  Plus,
  GitBranch,
  Star,
  Layers,
  Sparkles,
  Server,
  CheckCircle2,
  XCircle,
  MessageSquare,
  GitCommit,
  Code2,
  Search,
  LayoutDashboard,
  Home,
  Settings,
} from 'lucide-react';
import type { StoredRepository, HealthResponse } from '../types/api';

export type WorkspaceTab = 'landing' | 'dashboard' | 'chat' | 'search' | 'history' | 'intelligence';

interface SidebarProps {
  repositories: StoredRepository[];
  activeRepoId: string | null;
  activeTab: WorkspaceTab;
  onSelectRepo: (id: string) => void;
  onSelectTab: (tab: WorkspaceTab) => void;
  onOpenConnectModal: () => void;
  onOpenSettingsModal: (repoId: string) => void;
  health: HealthResponse | null;
  backendError: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  repositories,
  activeRepoId,
  activeTab,
  onSelectRepo,
  onSelectTab,
  onOpenConnectModal,
  onOpenSettingsModal,
  health,
  backendError,
}) => {
  return (
    <aside className="w-72 bg-slate-950 border-r border-slate-800/80 flex flex-col h-screen shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div
          onClick={() => onSelectTab('landing')}
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-slate-100 tracking-tight flex items-center gap-1.5">
              CodeRAG
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                v1.0
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">AI GitHub Code Assistant</p>
          </div>
        </div>
      </div>

      {/* Main Pages: Landing & Dashboard */}
      <div className="px-3 pt-3 pb-2 space-y-1">
        <button
          onClick={() => onSelectTab('landing')}
          className={`w-full py-1.5 px-3 rounded-xl text-xs font-medium flex items-center gap-2 transition-all ${
            activeTab === 'landing'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Home & Overview</span>
        </button>

        <button
          onClick={() => onSelectTab('dashboard')}
          className={`w-full py-1.5 px-3 rounded-xl text-xs font-medium flex items-center gap-2 transition-all ${
            activeTab === 'dashboard'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </button>
      </div>

      {/* Connect New Repository Action */}
      <div className="px-3 pb-2">
        <button
          onClick={onOpenConnectModal}
          className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-[0.99]"
        >
          <Plus className="w-4 h-4" />
          <span>Connect Repository</span>
        </button>
      </div>

      {/* Repository Workspace Navigation Tabs */}
      <div className="px-3 pb-2">
        <div className="px-1 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          Repository Tools
        </div>
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
          <button
            onClick={() => onSelectTab('chat')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'chat'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>

          <button
            onClick={() => onSelectTab('search')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'search'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>

          <button
            onClick={() => onSelectTab('history')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <GitCommit className="w-3.5 h-3.5" />
            <span>Diffs</span>
          </button>

          <button
            onClick={() => onSelectTab('intelligence')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'intelligence'
                ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>AST</span>
          </button>
        </div>
      </div>

      {/* Repositories Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>Repositories ({repositories.length})</span>
        </div>

        {repositories.length === 0 ? (
          <div className="p-4 text-center rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
            <FolderGit2 className="w-6 h-6 mx-auto mb-2 text-slate-600" />
            <p className="font-medium text-slate-400">No repositories yet</p>
            <p className="text-[11px] mt-1 text-slate-500">
              Click &quot;Connect Repository&quot; to index source code.
            </p>
          </div>
        ) : (
          repositories.map((repo) => {
            const isActive = repo.id === activeRepoId;
            return (
              <div
                key={repo.id}
                onClick={() => {
                  onSelectRepo(repo.id);
                  if (activeTab === 'landing' || activeTab === 'dashboard') {
                    onSelectTab('chat');
                  }
                }}
                className={`group relative w-full text-left p-2.5 rounded-xl transition-all border cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 border-blue-500/50 shadow-sm shadow-blue-500/10'
                    : 'bg-transparent border-transparent hover:bg-slate-900/60 hover:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span
                    className={`font-mono text-xs font-semibold truncate ${
                      isActive ? 'text-blue-300' : 'text-slate-200'
                    }`}
                  >
                    {repo.fullName}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {repo.stars > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-amber-400/80">
                        <Star className="w-3 h-3 fill-amber-400/20" />
                        {repo.stars}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSettingsModal(repo.id);
                      }}
                      title="Repository Settings"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-opacity"
                    >
                      <Settings className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1 truncate">
                    <GitBranch className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                    {repo.branch}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-indigo-400 shrink-0">
                    <Layers className="w-2.5 h-2.5" />
                    {repo.chunksCount} chunks
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Backend & Model Health Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/80 space-y-2 text-[11px]">
        <div className="flex items-center justify-between px-1">
          <span className="text-slate-400 flex items-center gap-1.5 font-medium">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            Backend API
          </span>
          {health ? (
            <span className="flex items-center gap-1 text-emerald-400 font-mono text-[10px]">
              <CheckCircle2 className="w-3 h-3" />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-400 font-mono text-[10px]">
              <XCircle className="w-3 h-3" />
              Offline
            </span>
          )}
        </div>

        <div className="flex items-center justify-between px-1 text-slate-400 font-mono text-[10px]">
          <span>LLM Provider</span>
          <span className="text-slate-300">Gemini 2.5 Flash</span>
        </div>

        <div className="flex items-center justify-between px-1 text-slate-400 font-mono text-[10px]">
          <span>Vector Store</span>
          <span className="text-slate-300">Qdrant</span>
        </div>

        {backendError && (
          <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] truncate">
            {backendError}
          </div>
        )}
      </div>
    </aside>
  );
};
