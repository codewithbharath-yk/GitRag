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
import { BackButton } from './BackButton';
import { useNavigation } from '../context/NavigationContext';

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
  const { canGoBack } = useNavigation();

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
    <header className="sticky top-0 z-30 h-14 bg-[#181B22] border-b border-white/10 px-4 flex items-center justify-between text-[#EDECE6] select-none font-sans">
      {/* Left Area: Mobile hamburger + Back Button + Repo & Branch selectors */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 rounded-xl text-[#A8AFBD] hover:text-[#EDECE6] hover:bg-[#262B37] transition-colors"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Dynamic Contextual Back Button */}
        {canGoBack && (
          <BackButton
            size="sm"
            variant="pill"
            className="shrink-0"
            title="Return to previous view"
          />
        )}

        {/* Repository Selector Dropdown */}
        <div className="relative" ref={repoRef}>
          <button
            onClick={() => setIsRepoDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1F2430] hover:bg-[#262B37] border border-white/10 text-xs font-mono transition-all cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1546D9]"
            title="Switch repository"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-[#F9B318] shrink-0" />
            <span className="font-semibold text-[#EDECE6] max-w-[130px] sm:max-w-[200px] truncate">
              {activeRepo ? activeRepo.fullName : 'Select Repository'}
            </span>
            <ChevronDown className="w-3 h-3 text-[#767E90] shrink-0" />
          </button>

          {isRepoDropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-64 bg-[#181B22] border border-white/15 rounded-2xl shadow-2xl p-1.5 z-50 text-xs space-y-1 animate-in fade-in duration-100">
              <div className="px-2 py-1 text-[10px] font-semibold text-[#767E90] uppercase tracking-wider">
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
                        : 'text-[#A8AFBD] hover:bg-[#262B37] hover:text-[#EDECE6]'
                    }`}
                  >
                    <span className="truncate pr-2">{repo.fullName}</span>
                    {activeRepo?.id === repo.id && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                  </button>
                ))}
              </div>
              <div className="pt-1 border-t border-white/10">
                <button
                  onClick={() => {
                    setIsRepoDropdownOpen(false);
                    onOpenConnectModal();
                  }}
                  className="w-full p-2 rounded-xl bg-[#1546D9]/15 hover:bg-[#1546D9] text-[#EDECE6] hover:text-white flex items-center justify-center gap-1.5 text-[11px] font-medium transition-colors"
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
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#0B0D11] hover:bg-[#1F2430] border border-white/10 text-xs font-mono text-[#A8AFBD] transition-colors cursor-pointer"
            title="Branch selection"
          >
            <GitBranch className="w-3.5 h-3.5 text-[#F9B318]" />
            <span>{activeRepo?.branch || 'main'}</span>
            <ChevronDown className="w-3 h-3 text-[#767E90]" />
          </button>

          {isBranchDropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-44 bg-[#181B22] border border-white/15 rounded-xl shadow-xl p-1.5 z-50 text-xs space-y-0.5 animate-in fade-in duration-100">
              <div className="px-2 py-1 text-[10px] font-semibold text-[#767E90] uppercase tracking-wider">
                Branches
              </div>
              {['main', 'master', 'develop'].map((branchName) => (
                <button
                  key={branchName}
                  onClick={() => setIsBranchDropdownOpen(false)}
                  className={`w-full text-left p-1.5 rounded-lg font-mono flex items-center justify-between transition-colors ${
                    (activeRepo?.branch || 'main') === branchName
                      ? 'bg-[#1546D9] text-white'
                      : 'text-[#A8AFBD] hover:bg-[#262B37] hover:text-[#EDECE6]'
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
          className="w-full py-1.5 px-3 rounded-xl bg-[#0B0D11] hover:bg-[#1F2430] border border-white/10 text-xs text-[#767E90] hover:text-[#EDECE6] flex items-center justify-between transition-all group cursor-pointer shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1546D9]"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-[#767E90] group-hover:text-[#F9B318] transition-colors shrink-0" />
            <span className="truncate">Ask anything about your codebase...</span>
          </div>
          <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#181B22] border border-white/15 text-[10px] font-mono text-[#A8AFBD]">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right Area: Mobile Search button + Theme toggle + User Profile */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenCommandBar}
          className="md:hidden p-1.5 rounded-xl text-[#767E90] hover:text-[#EDECE6] hover:bg-[#262B37] transition-colors"
          title="Search / Command Palette"
        >
          <Search className="w-4 h-4" />
        </button>

        <ThemeToggle />

        {/* User Profile Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/10">
          <div className="flex items-center gap-2 p-1 rounded-xl">
            <div className="relative shrink-0">
              <img
                src="/user_avatar.svg"
                alt={userProfile?.name || 'Developer'}
                className="w-7 h-7 rounded-xl border border-white/15 bg-[#1F2430] p-0.5"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#F9B318] ring-1 ring-[#111318]" />
            </div>
            <div className="hidden xl:block text-left">
              <span className="text-xs font-semibold text-[#EDECE6] block leading-none">
                {userProfile?.name || 'Bharath Kumar'}
              </span>
              <span className="text-[10px] text-[#F9B318] font-mono leading-none mt-0.5">
                {userProfile?.email || userProfile?.role || 'Online'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
