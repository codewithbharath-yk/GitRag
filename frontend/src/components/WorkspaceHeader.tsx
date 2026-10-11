import React, { useState, useRef, useEffect } from 'react';
import {
  FolderGit2,
  GitBranch,
  Search,
  ChevronDown,
  Plus,
  Menu,
  Check,
  ExternalLink,
} from 'lucide-react';
import type { StoredRepository, UserProfile } from '../types/api';
import { ThemeToggle } from './ThemeToggle';
import { Magnetic } from './motion/Magnetic';

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
    <header className="sticky top-0 z-30 h-14 bg-[#162623] border-b border-[#577877]/25 px-4 flex items-center justify-between text-[#F0F5F7] select-none font-sans">
      {/* Left Area: Mobile hamburger + Repo & Branch selectors */}
      <div className="flex items-center gap-2.5">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 rounded-lg text-[#577877] hover:text-[#F0F5F7] hover:bg-[#1E3430] transition-colors"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Repository Selector Dropdown */}
        <div className="relative" ref={repoRef}>
          <button
            onClick={() => setIsRepoDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1B2D2A] hover:bg-[#1E3430] border border-[#577877]/30 text-xs font-mono transition-all cursor-pointer shadow-xs"
            title="Switch repository"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-[#6DBE9B] shrink-0" />
            <span className="font-semibold text-white max-w-[150px] sm:max-w-[200px] truncate">
              {activeRepo ? activeRepo.fullName : 'Select Repository'}
            </span>
            <ChevronDown className="w-3 h-3 text-[#577877] shrink-0" />
          </button>

          {isRepoDropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-64 bg-[#162623] border border-[#577877]/40 rounded-xl shadow-2xl p-1.5 z-50 text-xs space-y-1 animate-in fade-in duration-100">
              <div className="px-2 py-1 text-[10px] font-semibold text-[#577877] uppercase tracking-wider">
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
                    className={`w-full text-left p-2 rounded-lg flex items-center justify-between font-mono transition-colors ${
                      activeRepo?.id === repo.id
                        ? 'bg-[#295255] text-white'
                        : 'text-[#B9CECC] hover:bg-[#1E3430] hover:text-[#F0F5F7]'
                    }`}
                  >
                    <span className="truncate pr-2">{repo.fullName}</span>
                    {activeRepo?.id === repo.id && <Check className="w-3.5 h-3.5 text-[#6DBE9B] shrink-0" />}
                  </button>
                ))}
              </div>
              <div className="pt-1 border-t border-[#577877]/20">
                <button
                  onClick={() => {
                    setIsRepoDropdownOpen(false);
                    onOpenConnectModal();
                  }}
                  className="w-full p-1.5 rounded-lg bg-[#1E3430] hover:bg-[#295255] text-[#F0F5F7] flex items-center justify-center gap-1.5 text-[11px] font-medium transition-colors"
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
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#111E1C] hover:bg-[#1B2D2A] border border-[#577877]/20 text-xs font-mono text-[#B9CECC] transition-colors cursor-pointer"
            title="Branch selection"
          >
            <GitBranch className="w-3.5 h-3.5 text-[#577877]" />
            <span>{activeRepo?.branch || 'main'}</span>
            <ChevronDown className="w-3 h-3 text-[#577877]" />
          </button>

          {isBranchDropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-44 bg-[#162623] border border-[#577877]/40 rounded-xl shadow-xl p-1.5 z-50 text-xs space-y-0.5 animate-in fade-in duration-100">
              <div className="px-2 py-1 text-[10px] font-semibold text-[#577877] uppercase tracking-wider">
                Branches
              </div>
              {['main', 'master', 'develop'].map((branchName) => (
                <button
                  key={branchName}
                  onClick={() => setIsBranchDropdownOpen(false)}
                  className={`w-full text-left p-1.5 rounded-lg font-mono flex items-center justify-between transition-colors ${
                    (activeRepo?.branch || 'main') === branchName
                      ? 'bg-[#295255] text-white'
                      : 'text-[#B9CECC] hover:bg-[#1E3430] hover:text-[#F0F5F7]'
                  }`}
                >
                  <span>{branchName}</span>
                  {(activeRepo?.branch || 'main') === branchName && (
                    <Check className="w-3.5 h-3.5 text-[#6DBE9B]" />
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
          className="w-full py-1.5 px-3 rounded-lg bg-[#111E1C] hover:bg-[#1B2D2A] border border-[#577877]/30 text-xs text-[#577877] hover:text-[#B9CECC] flex items-center justify-between transition-all group cursor-pointer shadow-inner"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-[#577877] group-hover:text-[#6DBE9B] transition-colors shrink-0" />
            <span className="truncate">Ask anything about your codebase...</span>
          </div>
          <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#162623] border border-[#577877]/30 text-[10px] font-mono text-[#B9CECC]">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right Area: Mobile Search button + Theme toggle + User Profile */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenCommandBar}
          className="md:hidden p-1.5 rounded-lg text-[#577877] hover:text-[#F0F5F7] hover:bg-[#1E3430] transition-colors"
          title="Search / Command Palette"
        >
          <Search className="w-4 h-4" />
        </button>

        <ThemeToggle />

        {/* User Profile Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#577877]/25">
          <div className="flex items-center gap-2 p-1 rounded-lg">
            <div className="relative shrink-0">
              <img
                src="/user_avatar.svg"
                alt={userProfile?.name || 'Developer'}
                className="w-7 h-7 rounded-lg border border-[#577877]/40 bg-[#1B2D2A] p-0.5"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#6DBE9B] ring-1 ring-[#162623]" />
            </div>
            <div className="hidden xl:block text-left">
              <span className="text-xs font-semibold text-[#F0F5F7] block leading-none">
                {userProfile?.name || 'Bharath Kumar'}
              </span>
              <span className="text-[10px] text-[#6DBE9B] font-mono leading-none mt-0.5">
                {userProfile?.email || userProfile?.role || 'Online'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
