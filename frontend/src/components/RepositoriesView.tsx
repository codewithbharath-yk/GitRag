import React, { useState } from 'react';
import {
  FolderGit2,
  Plus,
  GitBranch,
  Star,
  Search,
  ArrowRight,
  Settings,
  Lock,
  Globe,
} from 'lucide-react';
import type { StoredRepository } from '../types/api';
import { TextEffect } from './motion/TextEffect';
import { Spotlight } from './motion/Spotlight';
import { Tilt } from './motion/Tilt';
import { Magnetic } from './motion/Magnetic';

interface RepositoriesViewProps {
  repositories: StoredRepository[];
  activeRepoId: string | null;
  onSelectRepo: (id: string) => void;
  onNavigateToExplorer: (id?: string) => void;
  onOpenConnectModal: () => void;
  onOpenSettingsModal: (repoId: string) => void;
}

export const RepositoriesView: React.FC<RepositoriesViewProps> = ({
  repositories,
  activeRepoId,
  onSelectRepo,
  onNavigateToExplorer,
  onOpenConnectModal,
  onOpenSettingsModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'public' | 'private'>('all');

  // Realistic mock repos to enrich the explorer if list is small
  const defaultExtraRepos: Partial<StoredRepository>[] = [
    {
      id: 'codeswithbharath-yk__kumar',
      fullName: 'codeswithbharath-yk/kumar',
      owner: 'codeswithbharath-yk',
      name: 'kumar',
      branch: 'main',
      stars: 34,
      language: 'Python',
      filesCount: 18,
      chunksCount: 64,
      lastIndexedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'octocat__spoon-knife',
      fullName: 'octocat/Spoon-Knife',
      owner: 'octocat',
      name: 'Spoon-Knife',
      branch: 'main',
      stars: 14089,
      language: 'HTML',
      filesCount: 3,
      chunksCount: 3,
      lastIndexedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'vercel__next-js',
      fullName: 'vercel/next.js',
      owner: 'vercel',
      name: 'next.js',
      branch: 'canary',
      stars: 122400,
      language: 'TypeScript',
      filesCount: 240,
      chunksCount: 840,
      lastIndexedAt: new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'facebook__react',
      fullName: 'facebook/react',
      owner: 'facebook',
      name: 'react',
      branch: 'main',
      stars: 226000,
      language: 'JavaScript',
      filesCount: 310,
      chunksCount: 1120,
      lastIndexedAt: new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'microsoft__vscode',
      fullName: 'microsoft/vscode',
      owner: 'microsoft',
      name: 'vscode',
      branch: 'main',
      stars: 161000,
      language: 'TypeScript',
      filesCount: 850,
      chunksCount: 3200,
      lastIndexedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    },
  ];

  // Merge unique
  const combinedList = [...repositories];
  for (const extra of defaultExtraRepos) {
    if (!combinedList.some((r) => r.id === extra.id)) {
      combinedList.push(extra as StoredRepository);
    }
  }

  const filtered = combinedList.filter((repo) => {
    const matchesSearch =
      repo.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (repo.language && repo.language.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (filter === 'private') return (repo as any).isPrivate;
    if (filter === 'public') return !(repo as any).isPrivate;
    return true;
  });

  const privateCount = combinedList.filter((r) => (r as any).isPrivate).length;
  const publicCount = combinedList.length - privateCount;

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] p-4 sm:p-6 lg:p-8 text-[var(--text-primary)] font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--border-subtle)]">
          <div>
            <TextEffect as="h1" variant="blur-up" className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
              Repositories
            </TextEffect>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
              Connect and manage your GitHub repositories with AI vector indexing
            </p>
          </div>

          <Magnetic>
            <button
              onClick={onOpenConnectModal}
              className="py-2.5 px-4 rounded-xl bg-[#D4A373] hover:bg-[#C5915F] text-[#1F3B2C] text-xs font-bold flex items-center gap-2 border border-[#D4A373] shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#1F3B2C]" />
              <span>Connect GitHub</span>
            </button>
          </Magnetic>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--bg-well)] border border-[var(--border-subtle)] w-fit">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-[#D4A373] text-[#1F3B2C] shadow-xs font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              All ({combinedList.length})
            </button>
            <button
              onClick={() => setFilter('private')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                filter === 'private'
                  ? 'bg-[#D4A373] text-[#1F3B2C] shadow-xs font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Lock className="w-3 h-3 text-[#D4A373]" />
              <span>Private ({privateCount})</span>
            </button>
            <button
              onClick={() => setFilter('public')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                filter === 'public'
                  ? 'bg-[#D4A373] text-[#1F3B2C] shadow-xs font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Globe className="w-3 h-3 text-[var(--text-muted)]" />
              <span>Public ({publicCount})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#D4A373] font-mono transition-colors"
            />
          </div>
        </div>

        {/* Repositories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((repo) => {
            const isSelected = repo.id === activeRepoId;
            const isPrivate = (repo as any).isPrivate ?? false;
            const desc =
              (repo as any).description ||
              `${repo.language || 'Code'} repository with indexed semantic embeddings.`;

            return (
              <Tilt key={repo.id} maxAngle={6} scale={1.01}>
                <Spotlight
                  variant={isSelected ? 'gold' : 'subtle'}
                  size={280}
                  strength={0.15}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between h-full bg-[var(--bg-card)] ${
                    isSelected
                      ? 'border-[#D4A373] shadow-lg ring-2 ring-[#D4A373]/30'
                      : 'border-[var(--border-subtle)] hover:border-[#D4A373]/50'
                  }`}
                >
                  <div>
                    {/* Top line: Name + Badges + Settings */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm sm:text-base text-[var(--text-primary)] truncate block">
                            {repo.fullName}
                          </span>
                          {isSelected && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#D4A373] text-[#1F3B2C] font-bold border border-[#D4A373]">
                              ACTIVE
                            </span>
                          )}
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border bg-[var(--bg-well)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
                          >
                            {isPrivate ? <Lock className="w-2.5 h-2.5 text-[#D4A373]" /> : <Globe className="w-2.5 h-2.5" />}
                            <span>{isPrivate ? 'Private' : 'Public'}</span>
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-1">{desc}</p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {repo.stars > 0 && (
                          <span className="flex items-center gap-1 text-xs text-[#D4A373] font-mono font-bold">
                            <Star className="w-3.5 h-3.5 fill-current text-[#D4A373]" />
                            {repo.stars.toLocaleString()}
                          </span>
                        )}
                        <button
                          onClick={() => onOpenSettingsModal(repo.id)}
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
                          title="Repository Settings"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-2 py-3 border-y border-[var(--border-subtle)] text-xs font-mono text-[var(--text-muted)] my-3">
                      <div>
                        <span className="text-[10px] block">Branch</span>
                        <span className="text-[var(--text-primary)] truncate flex items-center gap-1 mt-0.5 font-semibold">
                          <GitBranch className="w-3 h-3 text-[#D4A373]" />
                          {repo.branch}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] block">Chunks</span>
                        <span className="text-[var(--text-primary)] block mt-0.5 font-semibold">{repo.chunksCount}</span>
                      </div>
                      <div>
                        <span className="text-[10px] block">Files</span>
                        <span className="text-[var(--text-primary)] block mt-0.5 font-semibold">{repo.filesCount}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">
                      Indexed {new Date(repo.lastIndexedAt).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-2">
                      <Magnetic>
                        <button
                          onClick={() => {
                            onSelectRepo(repo.id);
                            onNavigateToExplorer(repo.id);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#D4A373] hover:bg-[#C5915F] text-[#1F3B2C] text-xs font-bold flex items-center gap-1.5 border border-[#D4A373] shadow-xs transition-colors cursor-pointer"
                        >
                          <span>Open in Explorer</span>
                          <ArrowRight className="w-3 h-3 text-[#1F3B2C]" />
                        </button>
                      </Magnetic>
                    </div>
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
