import React, { useState, useRef, useEffect } from 'react';
import {
  FolderGit2,
  GitBranch,
  Search,
  ChevronDown,
  Plus,
  Menu,
  Check,
} from 'lucide-react';
import type { StoredRepository, UserProfile } from '../types/api';
import { ThemeToggle } from './ThemeToggle';

interface WorkspaceHeaderProps {
  repositories: StoredRepository[];
  activeRepo: StoredRepository | null;
  onSelectRepo: (id: string) => void;
  onOpenConnectModal: () => void;
  onOpenCommandBar: () => void;
  onToggleMobileMenu?: () => void;
  userProfile?: UserProfile;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  repositories,
  activeRepo,
  onSelectRepo,
  onOpenConnectModal,
  onOpenCommandBar,
  onToggleMobileMenu,
  userProfile,
}) => {
  const [isRepoDropdownOpen, setIsRepoDropdownOpen] = useState(false);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const repoRef = useRef<HTMLDivElement>(null);
  const branchRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (repoRef.current && !repoRef.current.contains(e.target as Node)) {
        setIsRepoDropdownOpen(false);
      }
      if (branchRef.current && !branchRef.current.contains(e.target as Node)) {
        setIsBranchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <header className="sticky top-0 z-30 h-14 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-4 flex items-center justify-between text-[var(--text-primary)] select-none font-sans">
      {/* Left Area: Mobile hamburger + Repo & Branch selectors */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Repository Selector Dropdown */}
        <div className="relative" ref={repoRef}>
          <button
            onClick={() => setIsRepoDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-xs font-mono transition-all cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1546D9]"
            title="Switch repository"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-[#1546D9] dark:text-[#F9B318] shrink-0" />
            <span className="font-semibold text-[var(--text-primary)] max-w-[130px] sm:max-w-[200px] truncate">
              {activeRepo ? activeRepo.fullName : 'Select Repository'}
            </span>
            <ChevronDown className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
          </button>

          {isRepoDropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-64 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl shadow-xl p-1.5 z-50 text-xs space-y-1 animate-in fade-in duration-100">
              <div className="px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Select Active Repository
              </div>
              <div className="max-h-56 overflow-y-auto space-y-0.5">
                {repositories.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => {
                      onSelectRepo(repo.id);
                      setIsRepoDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-xl flex items-center justify-between font-mono transition-colors ${
                      activeRepo?.id === repo.id
                        ? 'bg-[#1546D9] text-white font-semibold'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span className="truncate pr-2">{repo.fullName}</span>
                    {activeRepo?.id === repo.id && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                  </button>
                ))}
              </div>
              <div className="pt-1 border-t border-[var(--border-subtle)]">
                <button
                  onClick={() => {
                    setIsRepoDropdownOpen(false);
                    onOpenConnectModal();
                  }}
                  className="w-full p-2 rounded-xl bg-[#1546D9]/10 hover:bg-[#1546D9] text-[#1546D9] hover:text-white flex items-center justify-center gap-1.5 text-[11px] font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Connect New Repository</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Branch Selector Dropdown */}
        <div className="relative" ref={branchRef}>
          <button
            onClick={() => setIsBranchDropdownOpen((prev) => !prev)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[var(--bg-well)] hover:bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-secondary)] transition-colors cursor-pointer"
            title="Branch selection"
          >
            <GitBranch className="w-3.5 h-3.5 text-[#1546D9] dark:text-[#F9B318]" />
            <span>{activeRepo?.branch || 'main'}</span>
            <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
          </button>

          {isBranchDropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-44 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl shadow-xl p-1.5 z-50 text-xs space-y-0.5 animate-in fade-in duration-100">
              <div className="px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Branches
              </div>
              {['main', 'master', 'develop'].map((branchName) => (
                <button
                  key={branchName}
                  onClick={() => setIsBranchDropdownOpen(false)}
                  className={`w-full text-left p-1.5 rounded-lg font-mono flex items-center justify-between transition-colors ${
                    (activeRepo?.branch || 'main') === branchName
                      ? 'bg-[#1546D9] text-white font-semibold'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span>{branchName}</span>
                  {(activeRepo?.branch || 'main') === branchName && (
                    <Check className="w-3.5 h-3.5 text-white" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Middle Area: Global Command/Search trigger bar */}
      <div className="hidden md:flex flex-1 max-w-md mx-4">
        <button
          onClick={onOpenCommandBar}
          className="w-full py-1.5 px-3 rounded-xl bg-[var(--bg-well)] hover:bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-between transition-all group cursor-pointer shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1546D9]"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[#1546D9] dark:group-hover:text-[#F9B318] transition-colors shrink-0" />
            <span className="truncate">Ask anything about your codebase...</span>
          </div>
          <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-muted)]">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right Area: Mobile Search button + Theme toggle + User Profile */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenCommandBar}
          className="md:hidden p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
          title="Search / Command Palette"
        >
          <Search className="w-4 h-4" />
        </button>

        <ThemeToggle />

        {/* User Profile Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 p-1 rounded-xl">
            <div className="relative shrink-0">
              <img
                src="/user_avatar.svg"
                alt={userProfile?.name || 'Developer'}
                className="w-7 h-7 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card-hover)] p-0.5"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#F9B318] ring-1 ring-[var(--bg-surface)]" />
            </div>
            <div className="hidden xl:block text-left">
              <span className="text-xs font-semibold text-[var(--text-primary)] block leading-none">
                {userProfile?.name || 'Bharath Kumar'}
              </span>
              <span className="text-[10px] text-[#1546D9] dark:text-[#F9B318] font-mono leading-none mt-0.5">
                {userProfile?.email || userProfile?.role || 'Online'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
