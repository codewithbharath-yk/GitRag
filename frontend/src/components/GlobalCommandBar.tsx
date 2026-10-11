import React, { useState, useEffect } from 'react';
import {
  Search,
  MessageSquare,
  FolderGit2,
  GitCommit,
  Code2,
  FolderTree,
  LayoutDashboard,
  Settings,
  X,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import type { StoredRepository } from '../types/api';
import { Spotlight } from './motion/Spotlight';

interface GlobalCommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  repositories: StoredRepository[];
  activeRepo: StoredRepository | null;
  onSelectRepo: (id: string) => void;
  onNavigateTab: (tab: any, explorerSubTab?: string) => void;
  onAskQuestion: (question: string) => void;
}

export const GlobalCommandBar: React.FC<GlobalCommandBarProps> = ({
  isOpen,
  onClose,
  repositories,
  activeRepo,
  onSelectRepo,
  onNavigateTab,
  onAskQuestion,
}) => {
  const [query, setQuery] = useState('');

  // Close on Escape, toggle on Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Trigger open via parent
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAsk = () => {
    if (!query.trim()) return;
    onAskQuestion(query.trim());
    onNavigateTab('explorer', 'chat');
    onClose();
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAsk();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150 font-sans">
      <Spotlight
        color="teal"
        className="w-full max-w-2xl bg-[#162623] border border-[#577877]/40 rounded-2xl shadow-2xl overflow-hidden text-[#F0F5F7]"
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-[#577877]/25 flex items-center gap-3 bg-[#1B2D2A]">
          <Search className="w-5 h-5 text-[#6DBE9B] shrink-0" />
          <input
            type="text"
            placeholder={
              activeRepo
                ? `Ask anything about ${activeRepo.fullName} or jump to tool...`
                : 'Ask a question or jump to any codebase tool...'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-full bg-transparent border-none text-sm text-[#F0F5F7] placeholder-[#577877] focus:outline-none focus:ring-0"
          />
          {query.trim() && (
            <button
              onClick={handleAsk}
              className="px-2.5 py-1 rounded-md bg-[#295255] hover:bg-[#34686C] text-xs text-white font-medium flex items-center gap-1 shrink-0 transition-colors"
            >
              <span>Ask AI</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#577877] hover:text-[#F0F5F7] hover:bg-[#1E3430] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Actions & Navigation Suggestions */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-3 text-xs">
          {/* Quick Questions */}
          {query.trim() && (
            <div>
              <div className="px-2 py-1 text-[10px] font-semibold text-[#577877] uppercase tracking-wider">
                Ask AI Assistant
              </div>
              <button
                onClick={handleAsk}
                className="w-full text-left p-2.5 rounded-lg bg-[#1B2D2A] hover:bg-[#1E3430] border border-[#577877]/20 flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#6DBE9B]" />
                  <span className="text-[#F0F5F7]">"{query}"</span>
                </div>
                <span className="text-[11px] text-[#577877] group-hover:text-[#F0F5F7] flex items-center gap-1 font-mono">
                  Press Enter <ArrowRight className="w-3 h-3" />
                </span>
              </button>
            </div>
          )}

          {/* Codebase Explorer Tools */}
          <div>
            <div className="px-2 py-1 text-[10px] font-semibold text-[#577877] uppercase tracking-wider">
              Codebase Explorer Tools
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              <button
                onClick={() => {
                  onNavigateTab('explorer', 'chat');
                  onClose();
                }}
                className="p-2.5 rounded-lg bg-[#1B2D2A] hover:bg-[#1E3430] border border-[#577877]/20 flex items-center gap-2.5 text-left transition-colors"
              >
                <MessageSquare className="w-4 h-4 text-[#6DBE9B]" />
                <div>
                  <span className="font-medium text-[#F0F5F7] block">Chat & Search</span>
                  <span className="text-[10px] text-[#577877]">Ask questions & semantic search</span>
                </div>
              </button>

              <button
                onClick={() => {
                  onNavigateTab('explorer', 'diffs');
                  onClose();
                }}
                className="p-2.5 rounded-lg bg-[#1B2D2A] hover:bg-[#1E3430] border border-[#577877]/20 flex items-center gap-2.5 text-left transition-colors"
              >
                <GitCommit className="w-4 h-4 text-[#6DBE9B]" />
                <div>
                  <span className="font-medium text-[#F0F5F7] block">Git History & Diffs</span>
                  <span className="text-[10px] text-[#577877]">View commits & code diffs</span>
                </div>
              </button>

              <button
                onClick={() => {
                  onNavigateTab('explorer', 'ast');
                  onClose();
                }}
                className="p-2.5 rounded-lg bg-[#1B2D2A] hover:bg-[#1E3430] border border-[#577877]/20 flex items-center gap-2.5 text-left transition-colors"
              >
                <Code2 className="w-4 h-4 text-[#6DBE9B]" />
                <div>
                  <span className="font-medium text-[#F0F5F7] block">AST Explorer</span>
                  <span className="text-[10px] text-[#577877]">Syntax trees & symbol relations</span>
                </div>
              </button>

              <button
                onClick={() => {
                  onNavigateTab('explorer', 'files');
                  onClose();
                }}
                className="p-2.5 rounded-lg bg-[#1B2D2A] hover:bg-[#1E3430] border border-[#577877]/20 flex items-center gap-2.5 text-left transition-colors"
              >
                <FolderTree className="w-4 h-4 text-[#6DBE9B]" />
                <div>
                  <span className="font-medium text-[#F0F5F7] block">Files & Architecture</span>
                  <span className="text-[10px] text-[#577877]">Explore repository files & viewer</span>
                </div>
              </button>
            </div>
          </div>

          {/* Repositories */}
          <div>
            <div className="px-2 py-1 text-[10px] font-semibold text-[#577877] uppercase tracking-wider">
              Connected Repositories
            </div>
            <div className="space-y-1 mt-1">
              {repositories.slice(0, 4).map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => {
                    onSelectRepo(repo.id);
                    onNavigateTab('explorer');
                    onClose();
                  }}
                  className={`w-full p-2 rounded-lg text-left flex items-center justify-between transition-colors ${
                    activeRepo?.id === repo.id
                      ? 'bg-[#295255] text-white border border-[#577877]/50'
                      : 'bg-[#1B2D2A] text-[#B9CECC] hover:bg-[#1E3430] hover:text-[#F0F5F7] border border-[#577877]/20'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FolderGit2 className="w-3.5 h-3.5 text-[#6DBE9B] shrink-0" />
                    <span className="font-mono text-xs font-medium truncate">{repo.fullName}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#B9CECC] shrink-0">
                    {repo.branch}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Primary Pages */}
          <div className="pt-1 flex items-center gap-2 border-t border-[#577877]/20">
            <button
              onClick={() => {
                onNavigateTab('dashboard');
                onClose();
              }}
              className="flex-1 p-2 rounded-lg bg-[#1B2D2A] hover:bg-[#1E3430] text-[#B9CECC] hover:text-[#F0F5F7] flex items-center justify-center gap-1.5 transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => {
                onNavigateTab('repositories');
                onClose();
              }}
              className="flex-1 p-2 rounded-lg bg-[#1B2D2A] hover:bg-[#1E3430] text-[#B9CECC] hover:text-[#F0F5F7] flex items-center justify-center gap-1.5 transition-colors"
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              <span>Repositories</span>
            </button>
            <button
              onClick={() => {
                onNavigateTab('settings');
                onClose();
              }}
              className="flex-1 p-2 rounded-lg bg-[#1B2D2A] hover:bg-[#1E3430] text-[#B9CECC] hover:text-[#F0F5F7] flex items-center justify-center gap-1.5 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </div>
        </div>

        {/* Footer Shortcut Tip */}
        <div className="p-2.5 border-t border-[#577877]/25 bg-[#111E1C] flex items-center justify-between text-[11px] text-[#577877] font-mono">
          <span>Navigate with mouse or Enter</span>
          <span className="px-1.5 py-0.5 rounded bg-[#162623] border border-[#577877]/30">ESC to close</span>
        </div>
      </Spotlight>
    </div>
  );
};
