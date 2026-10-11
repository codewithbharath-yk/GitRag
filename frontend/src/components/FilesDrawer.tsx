import React, { useState } from 'react';
import { X, Search, FileCode, ExternalLink, HardDrive } from 'lucide-react';
import type { RepoFileItem } from '../types/api';
import { TextEffect, Magnetic } from './motion';

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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity font-sans">
      <div className="w-full max-w-md bg-[#162623] border-l border-[#577877]/30 flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-200 text-[#F0F5F7]">
        {/* Drawer Header */}
        <div className="p-4 border-b border-[#577877]/25 bg-[#1B2D2A] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#162623] border border-[#577877]/30 text-[#F0F5F7]">
              <HardDrive className="w-4 h-4 text-[#577877]" />
            </div>
            <div>
              <TextEffect as="h2" variant="blur-up" className="text-sm font-semibold text-[#F0F5F7]">
                Indexed Source Files
              </TextEffect>
              <p className="text-xs text-[#577877] font-mono">{repositoryId}</p>
            </div>
          </div>
          <Magnetic>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#577877] hover:text-[#F0F5F7] hover:bg-[#1E3430] transition-colors"
              aria-label="Close files drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </Magnetic>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-[#577877]/25 bg-[#111E1C]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#577877]" />
            <input
              type="text"
              placeholder="Filter by filename or language (e.g. .py, auth)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#162623] border border-[#577877]/30 rounded-lg text-xs text-[#F0F5F7] placeholder-[#577877] focus:outline-none focus:border-[#295255] transition-colors font-mono"
            />
          </div>
          <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-[#577877]">
            <span>
              Showing {filteredFiles.length} of {files.length} files
            </span>
            <span className="font-mono text-[#B9CECC]">Vector index ready</span>
          </div>
        </div>

        {/* Files List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-12 text-[#577877] text-xs">
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
                  className="p-3 rounded-lg border border-[#577877]/25 bg-[#1B2D2A] hover:border-[#577877]/60 hover:bg-[#1E3430] transition-all flex items-start justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileCode className="w-3.5 h-3.5 text-[#577877] shrink-0" />
                      <span className="font-mono text-[#F0F5F7] font-medium truncate block">
                        {file.path}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#577877] font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-[#162623] text-[#B9CECC] border border-[#577877]/30">
                        {file.language}
                      </span>
                      <span>•</span>
                      <span>{file.line_count} lines</span>
                      <span>•</span>
                      <span className="text-[#B9CECC]">{file.chunks_count} chunk(s)</span>
                    </div>
                  </div>

                  {githubUrl && (
                    <Magnetic>
                      <a
                        href={githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View file on GitHub"
                        className="p-1.5 rounded text-[#577877] hover:text-[#F0F5F7] hover:bg-[#1E3430] transition-colors shrink-0 inline-flex items-center justify-center"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </Magnetic>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#577877]/25 bg-[#1B2D2A] text-center text-[11px] text-[#577877]">
          Source code chunks are indexed with 1-indexed line numbers
        </div>
      </div>
    </div>
  );
};
