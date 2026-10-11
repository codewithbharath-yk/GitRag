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
        <div className="relative w-full max-w-lg rounded-xl bg-[#162623] border border-[#577877]/35 shadow-2xl p-6 space-y-6 text-[#F0F5F7]">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#577877]/25">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-[#1B2D2A] text-[#577877] border border-[#577877]/30">
                <Settings className="w-5 h-5 text-[#577877]" />
              </div>
              <div>
                <TextEffect as="h3" className="font-bold text-base text-[#F0F5F7]">Repository Settings</TextEffect>
                <p className="text-xs text-[#577877] font-mono">{repository.fullName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#577877] hover:text-[#F0F5F7] hover:bg-[#1E3430] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Metadata Details with Tilt & Spotlight */}
          <Tilt maxAngle={2}>
            <Spotlight variant="subtle" className="rounded-xl">
              <div className="p-4 rounded-xl bg-[#111E1C] border border-[#577877]/25 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#577877]">Target Branch</span>
                  <span className="font-mono text-[#F0F5F7] flex items-center gap-1">
                    <GitBranch className="w-3.5 h-3.5 text-[#577877]" />
                    {repository.branch}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#577877]">Indexed Files</span>
                  <span className="font-mono text-[#F0F5F7] flex items-center gap-1">
                    <FileCode className="w-3.5 h-3.5 text-[#577877]" />
                    {repository.filesCount} files
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#577877]">Vector Chunks (Qdrant)</span>
                  <span className="font-mono text-[#F0F5F7] flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-[#577877]" />
                    {repository.chunksCount} chunks
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#577877]">Last Indexed</span>
                  <span className="font-mono text-[#B9CECC]">
                    {new Date(repository.lastIndexedAt).toLocaleString()}
                  </span>
                </div>

                {health && (
                  <div className="flex items-center justify-between border-t border-[#577877]/15 pt-2">
                    <span className="text-[#577877]">Engine</span>
                    <span className="font-mono text-[#F0F5F7]">
                      {health.embedding_provider} / {health.llm_provider}
                    </span>
                  </div>
                )}
              </div>
            </Spotlight>
          </Tilt>

        {/* Status / Error alerts */}
        {statusMessage && (
          <div className="p-3 rounded-lg bg-[#6DBE9B]/10 border border-[#6DBE9B]/30 text-[#6DBE9B] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#6DBE9B] shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-lg bg-[#D96B6B]/10 border border-[#D96B6B]/30 text-[#D96B6B] text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#D96B6B] shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          {/* Re-index section */}
          {showReindexConfirm ? (
            <div className="p-3.5 rounded-xl bg-[#D9A066]/10 border border-[#D9A066]/30 space-y-2.5">
              <p className="text-xs text-[#D9A066]">
                Are you sure you want to re-index <strong>{repository.fullName}</strong>? This will clear existing vectors and re-embed all source code using the local BGE model.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowReindexConfirm(false)}
                  className="px-3 py-1.5 rounded-md bg-[#162623] text-xs text-[#B9CECC] hover:bg-[#1E3430]"
                >
                  Cancel
                </button>
                <Magnetic>
                  <button
                    onClick={handleReindex}
                    disabled={isReindexing}
                    className="px-3.5 py-1.5 rounded-md bg-[#295255] hover:bg-[#34686C] text-xs text-[#F0F5F7] font-medium flex items-center gap-1.5 border border-[#577877]/40"
                  >
                    {isReindexing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
                className="w-full py-2.5 px-4 rounded-lg bg-[#1B2D2A] hover:bg-[#213834] text-[#F0F5F7] font-medium text-xs flex items-center justify-center gap-2 transition-all border border-[#577877]/30"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReindexing ? 'animate-spin' : ''}`} />
                <span>Re-index Repository Vectors</span>
              </button>
            </Magnetic>
          )}

          {/* Delete section */}
          {showDeleteConfirm ? (
            <div className="p-3.5 rounded-xl bg-[#D96B6B]/10 border border-[#D96B6B]/30 space-y-2.5">
              <p className="text-xs text-[#D96B6B]">
                Are you sure you want to remove <strong>{repository.fullName}</strong>? All associated vectors in Qdrant will be permanently deleted.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 rounded-md bg-[#162623] text-xs text-[#B9CECC] hover:bg-[#1E3430]"
                >
                  Cancel
                </button>
                <Magnetic>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-3.5 py-1.5 rounded-md bg-[#D96B6B] hover:bg-[#E57A7A] text-xs text-white font-medium flex items-center gap-1.5"
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
                className="w-full py-2.5 px-4 rounded-lg bg-[#D96B6B]/10 hover:bg-[#D96B6B]/20 text-[#D96B6B] border border-[#D96B6B]/30 font-medium text-xs flex items-center justify-center gap-2 transition-all"
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
