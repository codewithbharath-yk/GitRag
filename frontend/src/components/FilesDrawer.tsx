import React, { useState } from 'react';
import { X, Search, FileCode, ExternalLink, HardDrive } from 'lucide-react';
import type { RepoFileItem } from '../types/api';

interface FilesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  repositoryId: string;
  files: RepoFileItem[];
  repositoryOwner?: string;
  repositoryName?: string;
  branch?: string;
}

export const FilesDrawer: React.FC<FilesDrawerProps> = ({
  isOpen,
  onClose,
  repositoryId,
  files,
  repositoryOwner,
  repositoryName,
  branch = 'main',
}) => {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredFiles = files.filter(
    (f) =>
      f.path.toLowerCase().includes(search.toLowerCase()) ||
      f.language.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Indexed Source Files</h2>
              <p className="text-xs text-slate-400 font-mono">{repositoryId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-800 bg-slate-950/50">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Filter by filename or language (e.g. .py, auth)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors font-mono"
            />
          </div>
          <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-400">
            <span>
              Showing {filteredFiles.length} of {files.length} files
            </span>
            <span>Vector index ready</span>
          </div>
        </div>

        {/* Files List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No indexed files match your filter.
            </div>
          ) : (
            filteredFiles.map((file, idx) => {
              const githubUrl =
                repositoryOwner && repositoryName
                  ? `https://github.com/${repositoryOwner}/${repositoryName}/blob/${branch}/${file.path}`
                  : null;

              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-850/60 transition-all flex items-start justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="font-mono text-slate-200 font-medium truncate block">
                        {file.path}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {file.language}
                      </span>
                      <span>•</span>
                      <span>{file.line_count} lines</span>
                      <span>•</span>
                      <span className="text-indigo-400">{file.chunks_count} chunk(s)</span>
                    </div>
                  </div>

                  {githubUrl && (
                    <a
                      href={githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View file on GitHub"
                      className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/70 text-center text-[11px] text-slate-500">
          Source code chunks are indexed with 1-indexed line numbers
        </div>
      </div>
    </div>
  );
};
