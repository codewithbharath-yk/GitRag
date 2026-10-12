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
      <div className="w-full max-w-md bg-[var(--bg-base)] border-l border-[var(--border-subtle)] flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-200 text-[var(--text-primary)]">
        {/* Drawer Header */}
        <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--color-cobalt-blue)]">
              <HardDrive className="w-4 h-4 text-[var(--color-cobalt-blue)]" />
            </div>
            <div>
              <TextEffect as="h2" variant="blur-up" className="text-sm font-semibold text-[var(--text-primary)]">
                Indexed Source Files
              </TextEffect>
              <p className="text-xs text-[var(--text-muted)] font-mono">{repositoryId}</p>
            </div>
          </div>
          <Magnetic>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
              aria-label="Close files drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </Magnetic>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Filter by filename or language (e.g. .py, auth)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[var(--bg-well)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#1546D9] focus:ring-1 focus:ring-[#1546D9] transition-colors font-mono"
            />
          </div>
          <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-[var(--text-muted)]">
            <span>
              Showing {filteredFiles.length} of {files.length} files
            </span>
            <span className="font-mono text-[#F9B318] font-semibold">Vector index ready</span>
          </div>
        </div>

        {/* Files List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)] text-xs">
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
                  className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--color-cobalt-blue)]/50 hover:bg-[var(--bg-card-hover)] transition-all flex items-start justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileCode className="w-3.5 h-3.5 text-[var(--color-cobalt-blue)] shrink-0" />
                      <span className="font-mono text-[var(--text-primary)] font-medium truncate block">
                        {file.path}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-[var(--bg-well)] text-[var(--color-cobalt-blue)] border border-[var(--border-subtle)] font-medium">
                        {file.language}
                      </span>
                      <span>•</span>
                      <span>{file.line_count} lines</span>
                      <span>•</span>
                      <span className="text-[var(--text-secondary)]">{file.chunks_count} chunk(s)</span>
                    </div>
                  </div>

                  {githubUrl && (
                    <Magnetic>
                      <a
                        href={githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View file on GitHub"
                        className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)] transition-colors shrink-0 inline-flex items-center justify-center cursor-pointer"
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
        <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center text-[11px] text-[var(--text-muted)]">
          Source code chunks are indexed with 1-indexed line numbers
        </div>
      </div>
    </div>
  );
};
