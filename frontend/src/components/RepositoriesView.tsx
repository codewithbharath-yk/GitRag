import React, { useState } from 'react';
import {
  FolderGit2,
  Search,
  Plus,
  GitBranch,
  Star,
  Layers,
  FileCode,
  ArrowRight,
  Settings,
  Lock,
  Globe,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import type { StoredRepository } from '../types/api';
import { Spotlight } from './motion/Spotlight';
import { Tilt } from './motion/Tilt';
import { Magnetic } from './motion/Magnetic';
import { TextEffect } from './motion/TextEffect';

interface RepositoriesViewProps {
  repositories: StoredRepository[];
  activeRepoId: string | null;
  onSelectRepo: (id: string) => void;
  onNavigateToExplorer: (repoId?: string) => void;
  onOpenConnectModal: () => void;
  onOpenSettingsModal: (repoId: string) => void;
}

// Preset demonstration repos matching mockup panel 4
const PRESET_MOCKUP_REPOS = [
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
    isPrivate: true,
    description: 'Personal project • Full-stack auth & intelligence service',
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
    isPrivate: false,
    description: 'Forked repository • Classic GitHub test repo',
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
    isPrivate: false,
    description: 'Frontend framework • React server components & App Router',
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
    isPrivate: false,
    description: 'UI library • Declarative component model',
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
    isPrivate: false,
    description: 'Code editor • Developer ecosystem and workbench',
  },
];

export const RepositoriesView: React.FC<RepositoriesViewProps> = ({
  repositories,
  activeRepoId,
  onSelectRepo,
  onNavigateToExplorer,
  onOpenConnectModal,
  onOpenSettingsModal,
}) => {
  const [filter, setFilter] = useState<'all' | 'private' | 'public'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Combine real user repositories with the rich catalog items
  const combinedList = [...repositories];
  PRESET_MOCKUP_REPOS.forEach((preset) => {
    if (!combinedList.some((r) => r.fullName.toLowerCase() === preset.fullName.toLowerCase())) {
      combinedList.push(preset);
    }
  });

  const filtered = combinedList.filter((repo) => {
    const isPrivate = (repo as any).isPrivate ?? false;
    if (filter === 'private' && !isPrivate) return false;
    if (filter === 'public' && isPrivate) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        repo.fullName.toLowerCase().includes(q) ||
        (repo.language && repo.language.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const privateCount = combinedList.filter((r) => (r as any).isPrivate).length;
  const publicCount = combinedList.length - privateCount;

  return (
    <div className="flex-1 overflow-y-auto bg-[#162623] p-4 sm:p-6 lg:p-8 text-[#F0F5F7] font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#577877]/25">
          <div>
            <TextEffect as="h1" variant="blur-up" className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Repositories
            </TextEffect>
            <p className="text-xs sm:text-sm text-[#B9CECC] mt-0.5">
              Connect and manage your GitHub repositories with AI vector indexing
            </p>
          </div>

          <Magnetic>
            <button
              onClick={onOpenConnectModal}
              className="py-2.5 px-4 rounded-xl bg-[#295255] hover:bg-[#34686C] text-white text-xs font-bold flex items-center gap-2 border border-[#577877]/50 shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Connect GitHub</span>
            </button>
          </Magnetic>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#111E1C] border border-[#577877]/25 w-fit">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === 'all'
                  ? 'bg-[#295255] text-white shadow-xs'
                  : 'text-[#B9CECC] hover:text-white'
              }`}
            >
              All ({combinedList.length})
            </button>
            <button
              onClick={() => setFilter('private')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                filter === 'private'
                  ? 'bg-[#295255] text-white shadow-xs'
                  : 'text-[#B9CECC] hover:text-white'
              }`}
            >
              <Lock className="w-3 h-3" />
              <span>Private ({privateCount})</span>
            </button>
            <button
              onClick={() => setFilter('public')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                filter === 'public'
                  ? 'bg-[#295255] text-white shadow-xs'
                  : 'text-[#B9CECC] hover:text-white'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>Public ({publicCount})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#577877]" />
            <input
              type="text"
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#1B2D2A] border border-[#577877]/30 rounded-xl text-xs text-[#F0F5F7] placeholder-[#577877] focus:outline-none focus:border-[#6DBE9B] font-mono transition-colors"
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
                  color="teal"
                  size={280}
                  strength={0.15}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between h-full ${
                    isSelected
                      ? 'bg-[#1E3430] border-[#6DBE9B]/60 shadow-lg ring-1 ring-[#6DBE9B]/30'
                      : 'bg-[#1B2D2A] border-[#577877]/30 hover:border-[#577877]/60'
                  }`}
                >
                  <div>
                    {/* Top line: Name + Badges + Settings */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm sm:text-base text-white truncate block">
                            {repo.fullName}
                          </span>
                          {isSelected && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#295255] text-white border border-[#6DBE9B]/40">
                              ACTIVE
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-mono flex items-center gap-1 border ${
                              isPrivate
                                ? 'bg-amber-950/40 text-amber-300 border-amber-600/30'
                                : 'bg-[#162623] text-[#B9CECC] border-[#577877]/30'
                            }`}
                          >
                            {isPrivate ? <Lock className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
                            <span>{isPrivate ? 'Private' : 'Public'}</span>
                          </span>
                        </div>
                        <p className="text-xs text-[#B9CECC] mt-1 line-clamp-1">{desc}</p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {repo.stars > 0 && (
                          <span className="flex items-center gap-1 text-xs text-[#D9A066] font-mono">
                            <Star className="w-3.5 h-3.5 fill-[#D9A066]/20" />
                            {repo.stars.toLocaleString()}
                          </span>
                        )}
                        <button
                          onClick={() => onOpenSettingsModal(repo.id)}
                          className="p-1.5 rounded-lg text-[#577877] hover:text-white hover:bg-[#162623] transition-colors"
                          title="Repository Settings"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-2 py-3 border-y border-[#577877]/20 text-xs font-mono text-[#577877] my-3">
                      <div>
                        <span className="text-[10px] block">Branch</span>
                        <span className="text-[#B9CECC] truncate flex items-center gap-1 mt-0.5">
                          <GitBranch className="w-3 h-3 text-[#577877]" />
                          {repo.branch}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] block">Chunks</span>
                        <span className="text-[#B9CECC] block mt-0.5">{repo.chunksCount}</span>
                      </div>
                      <div>
                        <span className="text-[10px] block">Files</span>
                        <span className="text-[#B9CECC] block mt-0.5">{repo.filesCount}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-[#577877] font-mono">
                      Indexed {new Date(repo.lastIndexedAt).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-2">
                      <Magnetic>
                        <button
                          onClick={() => {
                            onSelectRepo(repo.id);
                            onNavigateToExplorer(repo.id);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#295255] hover:bg-[#34686C] text-white text-xs font-semibold flex items-center gap-1.5 border border-[#577877]/40 shadow-xs transition-colors"
                        >
                          <span>Open in Explorer</span>
                          <ArrowRight className="w-3 h-3" />
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
