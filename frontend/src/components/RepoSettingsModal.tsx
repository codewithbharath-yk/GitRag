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

      // Poll status for a few seconds
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-6 text-slate-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-800 text-slate-300">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Repository Settings</h3>
              <p className="text-xs text-slate-400 font-mono">{repository.fullName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metadata Details */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Target Branch</span>
            <span className="font-mono text-slate-200 flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5 text-slate-400" />
              {repository.branch}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Indexed Files</span>
            <span className="font-mono text-slate-200 flex items-center gap-1">
              <FileCode className="w-3.5 h-3.5 text-cyan-400" />
              {repository.filesCount} files
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Vector Chunks (Qdrant)</span>
            <span className="font-mono text-slate-200 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              {repository.chunksCount} chunks
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Last Indexed</span>
            <span className="font-mono text-slate-400">
              {new Date(repository.lastIndexedAt).toLocaleString()}
            </span>
          </div>
        </div>

        {/* System & Model Information */}
        <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/60 space-y-2 text-[11px] font-mono">
          <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Active Integrations</div>
          <div className="flex items-center justify-between text-slate-300">
            <span>Embedding Model:</span>
            <span className="text-cyan-400">nvidia/nemotron-3-embed-1b (2048d)</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>Answer Model:</span>
            <span className="text-blue-400">Google Gemini 2.5 Flash</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>Vector Engine:</span>
            <span className="text-purple-400">Qdrant Vector Database</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>Backend Status:</span>
            <span className="text-emerald-400">{health ? `${health.status} (${health.environment})` : 'Online'}</span>
          </div>
        </div>

        {/* Status / Error alerts */}
        {statusMessage && (
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          {/* Re-index section */}
          {showReindexConfirm ? (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
              <p className="text-xs text-amber-200">
                Are you sure you want to re-index <strong>{repository.fullName}</strong>? This will clear existing vectors and re-embed all source code.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowReindexConfirm(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReindex}
                  disabled={isReindexing}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs text-white font-medium flex items-center gap-1.5"
                >
                  {isReindexing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Re-index</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowReindexConfirm(true)}
              disabled={isReindexing || isDeleting}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-medium text-xs flex items-center justify-center gap-2 transition-all border border-slate-700/80"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReindexing ? 'animate-spin' : ''}`} />
              <span>Re-index Repository Vectors</span>
            </button>
          )}

          {/* Delete section */}
          {showDeleteConfirm ? (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2.5">
              <p className="text-xs text-red-200">
                Are you sure you want to remove <strong>{repository.fullName}</strong>? All associated vectors in Qdrant will be permanently deleted.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs text-white font-medium flex items-center gap-1.5"
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Delete</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isReindexing || isDeleting}
              className="w-full py-2.5 px-4 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-300 border border-red-500/30 font-medium text-xs flex items-center justify-center gap-2 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Repository from CodeRAG</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
