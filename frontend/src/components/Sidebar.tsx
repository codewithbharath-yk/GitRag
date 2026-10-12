import React, { useState } from 'react';
import {
  FolderGit2,
  Plus,
  GitBranch,
  Star,
  Layers,
  CheckCircle2,
  XCircle,
  MessageSquare,
  GitCommit,
  Code2,
  Search,
  LayoutDashboard,
  Home,
  FolderTree,
  Settings,
  ChevronDown,
  ChevronUp,
  X,
  Compass,
  Sparkles,
} from 'lucide-react';
import type { StoredRepository, HealthResponse, UserProfile } from '../types/api';
import { Magnetic, TextEffect } from './motion';
import { ThemeToggle } from './ThemeToggle';
import type { ExplorerSubTab } from './CodebaseExplorer';

export type WorkspaceTab =
  | 'dashboard'
  | 'repositories'
  | 'explorer'
  | 'settings';

interface SidebarProps {
  repositories: StoredRepository[];
  activeRepoId: string | null;
  activeTab: WorkspaceTab;
  explorerSubTab?: ExplorerSubTab;
  onSelectRepo: (id: string) => void;
  onSelectTab: (tab: WorkspaceTab, explorerSubTab?: ExplorerSubTab) => void;
  onOpenConnectModal: () => void;
  onOpenSettingsModal: (repoId: string) => void;
  onOpenLogoSplash?: () => void;
  health: HealthResponse | null;
  backendError: string | null;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  userProfile?: UserProfile;
}

export const Sidebar: React.FC<SidebarProps> = ({
  repositories,
  activeRepoId,
  activeTab,
  explorerSubTab = 'chat',
  onSelectRepo,
  onSelectTab,
  onOpenConnectModal,
  onOpenSettingsModal: _onOpenSettingsModal,
  onOpenLogoSplash: _onOpenLogoSplash,
  health: _health,
  backendError: _backendError,
  isOpenMobile = false,
  onCloseMobile,
  userProfile,
}) => {
  const [isExplorerExpanded, setIsExplorerExpanded] = useState(true);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-[#111318]/70 z-40 md:hidden backdrop-blur-xs"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-[#181B22] border-r border-white/10 flex flex-col h-screen shrink-0 select-none text-[#EDECE6] transition-transform duration-300 md:translate-x-0 font-sans ${
          isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#111318]">
          <div className="flex items-center gap-2.5 text-left">
            <div className="w-9 h-9 rounded-xl bg-[#181B22] border border-white/15 flex items-center justify-center p-1.5 shadow-md">
              <img
                src="/coderag_logo.svg"
                alt="CodeRAG"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="font-extrabold text-sm text-[#EDECE6] tracking-tight flex items-center gap-1.5">
                <TextEffect as="span" variant="word">CodeRAG</TextEffect>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F9B318]/20 text-[#F9B318] border border-[#F9B318]/30">
                  AI
                </span>
              </h1>
              <p className="text-[11px] text-[#A8AFBD]">GitHub Code Assistant</p>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-[#A8AFBD] hover:text-[#EDECE6] hover:bg-[#262B37]"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Primary Navigation: Dashboard, Repositories, Codebase Explorer, Settings */}
        <div className="px-3 pt-3 pb-2 space-y-1">
          {/* 1. Dashboard */}
          <button
            onClick={() => {
              onSelectTab('dashboard');
              onCloseMobile?.();
            }}
            className={`w-full py-2 px-3 nav-tab-btn gap-2.5 ${
              activeTab === 'dashboard' ? 'active' : ''
            }`}
          >
            <LayoutDashboard className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-white' : 'text-[#F9B318]'}`} />
            <span>Dashboard</span>
          </button>

          {/* 2. Repositories */}
          <button
            onClick={() => {
              onSelectTab('repositories');
              onCloseMobile?.();
            }}
            className={`w-full py-2 px-3 nav-tab-btn gap-2.5 ${
              activeTab === 'repositories' ? 'active' : ''
            }`}
          >
            <FolderGit2 className={`w-4 h-4 ${activeTab === 'repositories' ? 'text-white' : 'text-[#F9B318]'}`} />
            <span>Repositories</span>
          </button>

          {/* 3. Codebase Explorer (The Unified Hub) */}
          <div className="space-y-0.5">
            <button
              onClick={() => {
                onSelectTab('explorer');
                setIsExplorerExpanded(true);
                onCloseMobile?.();
              }}
              className={`w-full py-2 px-3 nav-tab-btn justify-between ${
                activeTab === 'explorer' ? 'active' : ''
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Compass className={`w-4 h-4 ${activeTab === 'explorer' ? 'text-white' : 'text-[#F9B318]'}`} />
                <span>Codebase Explorer</span>
              </div>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExplorerExpanded((prev) => !prev);
                }}
                className="p-0.5 hover:text-white"
              >
                {isExplorerExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            </button>

            {/* Sub-tools of Codebase Explorer */}
            {isExplorerExpanded && (
              <div className="pl-6 pr-1 py-1 space-y-0.5 border-l border-white/10 ml-4">
                <button
                  onClick={() => {
                    onSelectTab('explorer', 'chat');
                    onCloseMobile?.();
                  }}
                  className={`w-full py-1.5 px-2.5 subnav-tab-btn gap-2 ${
                    activeTab === 'explorer' && explorerSubTab === 'chat' ? 'active' : ''
                  }`}
                >
                  <MessageSquare className={`w-3 h-3 ${activeTab === 'explorer' && explorerSubTab === 'chat' ? 'text-white' : 'text-[#F9B318]'}`} />
                  <span>Chat & Search</span>
                </button>

                <button
                  onClick={() => {
                    onSelectTab('explorer', 'diffs');
                    onCloseMobile?.();
                  }}
                  className={`w-full py-1.5 px-2.5 subnav-tab-btn gap-2 ${
                    activeTab === 'explorer' && explorerSubTab === 'diffs' ? 'active' : ''
                  }`}
                >
                  <GitCommit className={`w-3 h-3 ${activeTab === 'explorer' && explorerSubTab === 'diffs' ? 'text-white' : 'text-[#F9B318]'}`} />
                  <span>Git History & Diffs</span>
                </button>

                <button
                  onClick={() => {
                    onSelectTab('explorer', 'ast');
                    onCloseMobile?.();
                  }}
                  className={`w-full py-1.5 px-2.5 subnav-tab-btn gap-2 ${
                    activeTab === 'explorer' && explorerSubTab === 'ast' ? 'active' : ''
                  }`}
                >
                  <Code2 className={`w-3 h-3 ${activeTab === 'explorer' && explorerSubTab === 'ast' ? 'text-white' : 'text-[#F9B318]'}`} />
                  <span>AST Explorer</span>
                </button>

                <button
                  onClick={() => {
                    onSelectTab('explorer', 'files');
                    onCloseMobile?.();
                  }}
                  className={`w-full py-1.5 px-2.5 subnav-tab-btn gap-2 ${
                    activeTab === 'explorer' && explorerSubTab === 'files' ? 'active' : ''
                  }`}
                >
                  <FolderTree className={`w-3 h-3 ${activeTab === 'explorer' && explorerSubTab === 'files' ? 'text-white' : 'text-[#F9B318]'}`} />
                  <span>Files & Architecture</span>
                </button>
              </div>
            )}
          </div>

          {/* 4. Settings */}
          <button
            onClick={() => {
              onSelectTab('settings');
              onCloseMobile?.();
            }}
            className={`w-full py-2 px-3 nav-tab-btn gap-2.5 ${
              activeTab === 'settings' ? 'active' : ''
            }`}
          >
            <Settings className={`w-4 h-4 ${activeTab === 'settings' ? 'text-white' : 'text-[#F9B318]'}`} />
            <span>Settings</span>
          </button>
        </div>

        {/* Connect Repository Action Button in Cobalt Blue */}
        <div className="px-3 pb-2 pt-1">
          <Magnetic className="w-full">
            <button
              onClick={() => {
                onOpenConnectModal();
                onCloseMobile?.();
              }}
              className="w-full py-2 px-3 rounded-xl bg-[#1546D9] hover:bg-[#2255EB] text-white font-semibold text-xs flex items-center justify-center gap-2 border border-[#1546D9]/40 shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Connect Repository</span>
            </button>
          </Magnetic>
        </div>

        {/* Recent Repositories Section */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="px-2 py-1 text-[10px] font-semibold text-[#767E90] uppercase tracking-wider flex items-center justify-between">
            <span>Recent Repositories</span>
            <span className="font-mono text-[9px] text-[#A8AFBD]">{repositories.length}</span>
          </div>

          <div className="space-y-1">
            {repositories.map((repo) => {
              const isSelected = repo.id === activeRepoId;
              return (
                <div
                  key={repo.id}
                  onClick={() => {
                    onSelectRepo(repo.id);
                    onSelectTab('explorer');
                    onCloseMobile?.();
                  }}
                  className={`sidebar-repo-card ${isSelected ? 'active' : ''}`}
                >
                  <div className="min-w-0 flex items-center gap-2 truncate">
                    <FolderGit2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#F9B318]' : 'text-[#767E90]'}`} />
                    <span className="font-mono font-medium truncate">{repo.fullName}</span>
                  </div>

                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-[#F9B318] shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer with Theme Mode & User Session */}
        <div className="p-3 border-t border-white/10 bg-[#111318] space-y-2">
          {/* User Session */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-[#181B22] border border-white/10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <img
                  src="/user_avatar.svg"
                  alt="Bharath Kumar"
                  className="w-7 h-7 rounded-xl border border-white/15 bg-[#1F2430] p-0.5"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#F9B318]" />
              </div>
              <div className="min-w-0 truncate">
                <span className="text-xs font-bold text-[#EDECE6] block truncate">
                  {userProfile?.name || 'Bharath Kumar'}
                </span>
                <span className="text-[10px] text-[#F9B318] font-mono block truncate">
                  {userProfile?.role || 'Full-Stack Developer'}
                </span>
              </div>
            </div>

            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  );
};
