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
        className="w-full max-w-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden text-[var(--text-primary)]"
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center gap-3 bg-[var(--bg-surface)]">
          <Search className="w-5 h-5 text-[var(--color-cobalt-blue)] shrink-0" />
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
            className="w-full bg-transparent border-none text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-0 font-sans"
          />
          {query.trim() && (
            <button
              onClick={handleAsk}
              className="px-2.5 py-1 rounded-md bg-[#D4A373] hover:bg-[#c29263] text-xs text-[#1F3B2C] font-bold flex items-center gap-1 shrink-0 transition-colors shadow-sm cursor-pointer"
            >
              <span>Ask AI</span>
              <ArrowRight className="w-3 h-3 text-[#1F3B2C]" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Actions & Navigation Suggestions */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-3 text-xs">
          {/* Quick Questions */}
          {query.trim() && (
            <div>
              <div className="px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono">
                Ask AI Assistant
              </div>
              <button
                onClick={handleAsk}
                className="w-full text-left p-2.5 rounded-lg bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] flex items-center justify-between group transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#D4A373]" />
                  <span className="text-[var(--text-primary)]">"{query}"</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] group-hover:text-[var(--text-primary)] flex items-center gap-1 font-mono">
                  Press Enter <ArrowRight className="w-3 h-3 text-[#D4A373]" />
                </span>
              </button>
            </div>
          )}

          {/* Codebase Explorer Tools */}
          <div>
            <div className="px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono">
              Codebase Explorer Tools
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              <button
                onClick={() => {
                  onNavigateTab('explorer', 'chat');
                  onClose();
                }}
                className="p-2.5 rounded-lg bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] flex items-center gap-2.5 text-left transition-colors cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 text-[#D4A373]" />
                <div>
                  <span className="font-medium text-[var(--text-primary)] block">Chat & Search</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Ask questions & semantic search</span>
                </div>
              </button>

              <button
                onClick={() => {
                  onNavigateTab('explorer', 'diffs');
                  onClose();
                }}
                className="p-2.5 rounded-lg bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] flex items-center gap-2.5 text-left transition-colors cursor-pointer"
              >
                <GitCommit className="w-4 h-4 text-[#D4A373]" />
                <div>
                  <span className="font-medium text-[var(--text-primary)] block">Git History & Diffs</span>
                  <span className="text-[10px] text-[var(--text-muted)]">View commits & code diffs</span>
                </div>
              </button>

              <button
                onClick={() => {
                  onNavigateTab('explorer', 'ast');
                  onClose();
                }}
                className="p-2.5 rounded-lg bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] flex items-center gap-2.5 text-left transition-colors cursor-pointer"
              >
                <Code2 className="w-4 h-4 text-[#D4A373]" />
                <div>
                  <span className="font-medium text-[var(--text-primary)] block">AST Explorer</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Syntax trees & symbol relations</span>
                </div>
              </button>

              <button
                onClick={() => {
                  onNavigateTab('explorer', 'files');
                  onClose();
                }}
                className="p-2.5 rounded-lg bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] flex items-center gap-2.5 text-left transition-colors cursor-pointer"
              >
                <FolderTree className="w-4 h-4 text-[#D4A373]" />
                <div>
                  <span className="font-medium text-[var(--text-primary)] block">Files & Architecture</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Explore repository files & viewer</span>
                </div>
              </button>
            </div>
          </div>

          {/* Repositories */}
          <div>
            <div className="px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono">
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
                  className={`w-full p-2 rounded-lg text-left flex items-center justify-between transition-colors cursor-pointer ${
                    activeRepo?.id === repo.id
                      ? 'bg-[#D4A373] text-[#1F3B2C] font-semibold border border-[#D4A373]'
                      : 'bg-[var(--bg-well)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FolderGit2 className={`w-3.5 h-3.5 shrink-0 ${activeRepo?.id === repo.id ? 'text-[#1F3B2C]' : 'text-[#D4A373]'}`} />
                    <span className="font-mono text-xs font-medium truncate">{repo.fullName}</span>
                  </div>
                  <span className={`text-[10px] font-mono shrink-0 ${activeRepo?.id === repo.id ? 'text-[#1F3B2C]/80' : 'text-[var(--text-muted)]'}`}>
                    {repo.branch}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Primary Pages */}
          <div className="pt-1 flex items-center gap-2 border-t border-[var(--border-subtle)]">
            <button
              onClick={() => {
                onNavigateTab('dashboard');
                onClose();
              }}
              className="flex-1 p-2 rounded-lg bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-[#D4A373]" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => {
                onNavigateTab('repositories');
                onClose();
              }}
              className="flex-1 p-2 rounded-lg bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-[#D4A373]" />
              <span>Repositories</span>
            </button>
            <button
              onClick={() => {
                onNavigateTab('settings');
                onClose();
              }}
              className="flex-1 p-2 rounded-lg bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-[#D4A373]" />
              <span>Settings</span>
            </button>
          </div>
        </div>

        {/* Footer Shortcut Tip */}
        <div className="p-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono">
          <span>Navigate with mouse or Enter</span>
          <span className="px-1.5 py-0.5 rounded bg-[var(--bg-well)] border border-[var(--border-subtle)]">ESC to close</span>
        </div>
      </Spotlight>
    </div>
  );
};
