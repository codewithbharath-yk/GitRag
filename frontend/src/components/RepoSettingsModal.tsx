import React, { useState } from 'react';
import {
  X,
  Settings,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Layers,
  FileCode,
  Loader2,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { StoredRepository, HealthResponse } from '../types/api';
import { Magnetic, Spotlight, Tilt, TextEffect } from './motion';

interface RepoSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  repository: StoredRepository | null;
  onRepositoryDeleted: (repoId: string) => void;
  onRepositoryReindexed: (repo: StoredRepository) => void;
  health: HealthResponse | null;
}

export const RepoSettingsModal: React.FC<RepoSettingsModalProps> = ({
  isOpen,
  onClose,
  repository,
  onRepositoryDeleted,
  onRepositoryReindexed,
  health,
}) => {
  const [isReindexing, setIsReindexing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReindexConfirm, setShowReindexConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !repository) return null;

  const handleReindex = async () => {
    setIsReindexing(true);
    setStatusMessage('Initiating background re-indexing job...');
    setErrorMessage(null);
    setShowReindexConfirm(false);

    try {
      const res = await api.reindexRepository(repository.id, repository.branch);
      setStatusMessage(`Re-indexing job queued (${res.job_id}). Monitoring progress...`);

      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const status = await api.getRepositoryStatus(repository.id);
          if (status.status === 'completed') {
            clearInterval(interval);
            setIsReindexing(false);
            setStatusMessage(`Re-indexing completed: ${status.chunks_indexed} chunks stored.`);
            onRepositoryReindexed({
              ...repository,
              chunksCount: status.chunks_indexed,
              filesCount: status.files_indexed,
              lastIndexedAt: new Date().toISOString(),
            });
          } else if (status.status === 'failed') {
            clearInterval(interval);
            setIsReindexing(false);
            setErrorMessage(`Re-indexing failed: ${status.error || 'Unknown error'}`);
          } else if (attempts >= 40) {
            clearInterval(interval);
            setIsReindexing(false);
            setStatusMessage('Re-indexing is running in background.');
          }
        } catch {
          // keep polling
        }
      }, 1500);
    } catch (err) {
      setIsReindexing(false);
      setErrorMessage(err instanceof ApiError ? err.message : 'Failed to trigger re-indexing.');
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage(null);
    setShowDeleteConfirm(false);

    try {
      await api.deleteRepository(repository.id);
      onRepositoryDeleted(repository.id);
      onClose();
    } catch (err) {
      setIsDeleting(false);
      setErrorMessage(err instanceof ApiError ? err.message : 'Failed to delete repository.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200 font-sans">
      <Spotlight variant="teal" className="w-full max-w-lg rounded-xl">
        <div className="relative w-full max-w-lg rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-2xl p-6 space-y-6 text-[var(--text-primary)]">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-[var(--bg-well)] text-[var(--color-cobalt-blue)] border border-[var(--border-subtle)]">
                <Settings className="w-5 h-5 text-[var(--color-cobalt-blue)]" />
              </div>
              <div>
                <TextEffect as="h3" className="font-bold text-base text-[var(--text-primary)]">Repository Settings</TextEffect>
                <p className="text-xs text-[var(--text-muted)] font-mono">{repository.fullName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Metadata Details with Tilt & Spotlight */}
          <Tilt maxAngle={2}>
            <Spotlight variant="subtle" className="rounded-xl">
              <div className="p-4 rounded-xl bg-[var(--bg-well)] border border-[var(--border-subtle)] space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Target Branch</span>
                  <span className="font-mono text-[var(--text-primary)] flex items-center gap-1">
                    <GitBranch className="w-3.5 h-3.5 text-[var(--color-cobalt-blue)]" />
                    {repository.branch}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Indexed Files</span>
                  <span className="font-mono text-[var(--text-primary)] flex items-center gap-1">
                    <FileCode className="w-3.5 h-3.5 text-[var(--color-cobalt-blue)]" />
                    {repository.filesCount} files
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Vector Chunks (Qdrant)</span>
                  <span className="font-mono text-[var(--text-primary)] flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-[var(--color-cobalt-blue)]" />
                    {repository.chunksCount} chunks
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Last Indexed</span>
                  <span className="font-mono text-[var(--text-secondary)]">
                    {new Date(repository.lastIndexedAt).toLocaleString()}
                  </span>
                </div>

                {health && (
                  <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2">
                    <span className="text-[var(--text-muted)]">Engine</span>
                    <span className="font-mono text-[var(--text-primary)]">
                      {health.embedding_provider} / {health.llm_provider}
                    </span>
                  </div>
                )}
              </div>
            </Spotlight>
          </Tilt>

        {/* Status / Error alerts */}
        {statusMessage && (
          <div className="p-3 rounded-lg bg-[#D4A373]/15 border border-[#D4A373]/40 text-[#D4A373] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#D4A373] shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/40 text-[#EF4444] text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          {/* Re-index section */}
          {showReindexConfirm ? (
            <div className="p-3.5 rounded-xl bg-[#D4A373]/15 border border-[#D4A373]/40 space-y-2.5">
              <p className="text-xs text-[var(--text-primary)]">
                Are you sure you want to re-index <strong>{repository.fullName}</strong>? This will clear existing vectors and re-embed all source code using the local BGE model.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowReindexConfirm(false)}
                  className="px-3 py-1.5 rounded-md bg-[var(--bg-well)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <Magnetic>
                  <button
                    onClick={handleReindex}
                    disabled={isReindexing}
                    className="px-3.5 py-1.5 rounded-md bg-[#D4A373] hover:bg-[#c29263] text-xs text-[#1F3B2C] font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    {isReindexing && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1F3B2C]" />}
                    <span>Confirm Re-index</span>
                  </button>
                </Magnetic>
              </div>
            </div>
          ) : (
            <Magnetic pullStrength={0.12}>
              <button
                onClick={() => setShowReindexConfirm(true)}
                disabled={isReindexing || isDeleting}
                className="w-full py-2.5 px-4 rounded-lg bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] font-medium text-xs flex items-center justify-center gap-2 transition-all border border-[var(--border-subtle)] cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[var(--color-cobalt-blue)] ${isReindexing ? 'animate-spin' : ''}`} />
                <span>Re-index Repository Vectors</span>
              </button>
            </Magnetic>
          )}

          {/* Delete section */}
          {showDeleteConfirm ? (
            <div className="p-3.5 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/40 space-y-2.5">
              <p className="text-xs text-[var(--text-primary)]">
                Are you sure you want to remove <strong>{repository.fullName}</strong>? All associated vectors in Qdrant will be permanently deleted.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 rounded-md bg-[var(--bg-well)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <Magnetic>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-3.5 py-1.5 rounded-md bg-[#EF4444] hover:bg-[#DC2626] text-xs text-white font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Delete</span>
                  </button>
                </Magnetic>
              </div>
            </div>
          ) : (
            <Magnetic pullStrength={0.12}>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isReindexing || isDeleting}
                className="w-full py-2.5 px-4 rounded-lg bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30 font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Repository from CodeRAG</span>
              </button>
            </Magnetic>
          )}
        </div>
      </div>
      </Spotlight>
    </div>
  );
};
