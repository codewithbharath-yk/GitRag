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
  onOpenSettingsModal,
  onOpenLogoSplash,
  health,
  backendError,
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
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-[#162623] border-r border-[#577877]/25 flex flex-col h-screen shrink-0 select-none text-[#F0F5F7] transition-transform duration-300 md:translate-x-0 font-sans ${
          isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-[#577877]/25 flex items-center justify-between bg-[#1B2D2A]">
          <div className="flex items-center gap-2.5 text-left">
            <div className="w-9 h-9 rounded-xl bg-[#111E1C] border border-white/30 flex items-center justify-center p-1.5 shadow-md">
              <img
                src="/coderag_logo.svg"
                alt="CodeRAG"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="font-extrabold text-sm text-white tracking-tight flex items-center gap-1.5">
                <TextEffect as="span" variant="word">CodeRAG</TextEffect>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-[#6DBE9B] border border-white/20">
                  AI
                </span>
              </h1>
              <p className="text-[11px] text-[#B9CECC]">GitHub Code Assistant</p>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-[#B9CECC] hover:text-[#F0F5F7] hover:bg-[#1E3430]"
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
            <LayoutDashboard className="w-4 h-4 text-[#6DBE9B]" />
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
            <FolderGit2 className="w-4 h-4 text-[#6DBE9B]" />
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
                <Compass className="w-4 h-4 text-[#6DBE9B]" />
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
              <div className="pl-6 pr-1 py-1 space-y-0.5 border-l border-[#577877]/25 ml-4">
                <button
                  onClick={() => {
                    onSelectTab('explorer', 'chat');
                    onCloseMobile?.();
                  }}
                  className={`w-full py-1.5 px-2.5 subnav-tab-btn gap-2 ${
                    activeTab === 'explorer' && explorerSubTab === 'chat' ? 'active' : ''
                  }`}
                >
                  <MessageSquare className="w-3 h-3 text-[#6DBE9B]" />
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
                  <GitCommit className="w-3 h-3 text-[#6DBE9B]" />
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
                  <Code2 className="w-3 h-3 text-[#6DBE9B]" />
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
                  <FolderTree className="w-3 h-3 text-[#6DBE9B]" />
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
            <Settings className="w-4 h-4 text-[#6DBE9B]" />
            <span>Settings</span>
          </button>
        </div>

        {/* Connect Repository Action Button */}
        <div className="px-3 pb-2 pt-1">
          <Magnetic className="w-full">
            <button
              onClick={() => {
                onOpenConnectModal();
                onCloseMobile?.();
              }}
              className="w-full py-2 px-3 rounded-xl bg-[#295255] hover:bg-[#34686C] text-white font-semibold text-xs flex items-center justify-center gap-2 border border-[#577877]/50 shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Connect Repository</span>
            </button>
          </Magnetic>
        </div>

        {/* Recent Repositories Section Matching Mockup Panel 3 & 4 */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="px-2 py-1 text-[10px] font-semibold text-[#577877] uppercase tracking-wider flex items-center justify-between">
            <span>Recent Repositories</span>
            <span className="font-mono text-[9px] text-[#B9CECC]">{repositories.length}</span>
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
                    <FolderGit2 className="w-3.5 h-3.5 text-[#6DBE9B] shrink-0" />
                    <span className="font-mono font-medium truncate">{repo.fullName}</span>
                  </div>

                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-[#6DBE9B] shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer with Theme Mode & User Session */}
        <div className="p-3 border-t border-[#577877]/25 bg-[#1B2D2A] space-y-2">
          {/* User Session */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-[#162623] border border-[#577877]/25">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <img
                  src="/user_avatar.svg"
                  alt="Bharath Kumar"
                  className="w-7 h-7 rounded-lg border border-[#577877]/40 bg-[#1B2D2A] p-0.5"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#6DBE9B]" />
              </div>
              <div className="min-w-0 truncate">
                <span className="text-xs font-bold text-white block truncate">
                  {userProfile?.name || 'Bharath Kumar'}
                </span>
                <span className="text-[10px] text-[#6DBE9B] font-mono block truncate">
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
