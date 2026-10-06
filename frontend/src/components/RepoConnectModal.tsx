import React, { useState } from 'react';
import {
  X,
  GitBranch,
  Star,
  GitFork,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Database,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { api, ApiError } from '../api/client';

const GithubIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);
import type {
  RepoValidateResponse,
  RepoStatusResponse,
  StoredRepository,
} from '../types/api';

interface RepoConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRepositoryIndexed: (repo: StoredRepository) => void;
}

export const RepoConnectModal: React.FC<RepoConnectModalProps> = ({
  isOpen,
  onClose,
  onRepositoryIndexed,
}) => {
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [cleanExisting, setCleanExisting] = useState(true);

  // Flow states: 'input' -> 'validating' -> 'validated' -> 'indexing' -> 'completed' | 'error'
  const [stage, setStage] = useState<'input' | 'validating' | 'validated' | 'indexing' | 'completed' | 'error'>('input');
  const [validationData, setValidationData] = useState<RepoValidateResponse | null>(null);
  const [indexingStatus, setIndexingStatus] = useState<RepoStatusResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClose = () => {
    setStage('input');
    setValidationData(null);
    setIndexingStatus(null);
    setErrorMessage(null);
    onClose();
  };

  if (!isOpen) return null;

  const handleValidate = async () => {
    if (!url.trim()) {
      setErrorMessage('Please enter a GitHub repository URL or slug.');
      return;
    }

    setStage('validating');
    setErrorMessage(null);

    try {
      const data = await api.validateRepository(url.trim(), branch.trim() || undefined);
      setValidationData(data);
      setBranch(data.selected_branch || data.default_branch);
      setStage('validated');
    } catch (err) {
      setStage('error');
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to validate repository access.');
      }
    }
  };

  const handleStartIndexing = async () => {
    if (!validationData) return;

    setStage('indexing');
    setErrorMessage(null);

    try {
      const startRes = await api.startIndexing(url.trim(), branch.trim() || undefined, cleanExisting);

      // Poll status until completion
      const repoId = startRes.repository_id;
      let attempts = 0;
      const maxAttempts = 60; // 60 * 1.5s = 90s max

      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const status = await api.getRepositoryStatus(repoId);
          setIndexingStatus(status);

          if (status.status === 'completed') {
            clearInterval(pollInterval);
            setStage('completed');

            const stored: StoredRepository = {
              id: repoId,
              fullName: validationData.full_name,
              owner: validationData.owner,
              name: validationData.name,
              branch: branch.trim() || validationData.default_branch,
              stars: validationData.stars_count,
              language: validationData.language,
              filesCount: status.files_indexed,
              chunksCount: status.chunks_indexed,
              lastIndexedAt: new Date().toISOString(),
            };

            setTimeout(() => {
              onRepositoryIndexed(stored);
              handleClose();
            }, 1200);
          } else if (status.status === 'failed') {
            clearInterval(pollInterval);
            setStage('error');
            setErrorMessage(status.error || 'Indexing encountered a fatal failure.');
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setStage('error');
            setErrorMessage('Indexing timed out while polling status.');
          }
        } catch {
          // recoverable polling error
        }
      }, 1500);
    } catch (err) {
      setStage('error');
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to start indexing job.');
      }
    }
  };

  const handleQuickSample = (sampleUrl: string) => {
    setUrl(sampleUrl);
    setBranch('');
    setErrorMessage(null);
    setStage('input');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <GithubIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Connect GitHub Repository</h2>
              <p className="text-xs text-slate-400">Validate access and index code into the RAG vector store</p>
            </div>
          </div>
          {stage !== 'indexing' && (
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Quick Presets */}
          {stage === 'input' && (
            <div className="space-y-2">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Quick test presets:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickSample('https://github.com/octocat/Spoon-Knife')}
                  className="px-2.5 py-1 text-xs rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center gap-1.5"
                >
                  <Star className="w-3 h-3 text-amber-400" />
                  <span>octocat/Spoon-Knife (Demo)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSample('https://github.com/fastapi/fastapi')}
                  className="px-2.5 py-1 text-xs rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                >
                  fastapi/fastapi
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSample('https://github.com/pallets/flask')}
                  className="px-2.5 py-1 text-xs rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                >
                  pallets/flask
                </button>
              </div>
            </div>
          )}

          {/* Repository URL Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 block">
              Repository URL or Slug
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="https://github.com/owner/repository or owner/repo"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (stage !== 'input') setStage('input');
                }}
                disabled={stage === 'validating' || stage === 'indexing'}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50 transition-colors"
              />
            </div>
          </div>

          {/* Validated Metadata Preview */}
          {validationData && stage !== 'input' && stage !== 'validating' && (
            <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100 text-sm font-mono">
                      {validationData.full_name}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {validationData.is_private ? 'Private' : 'Public'}
                    </span>
                  </div>
                  {validationData.description && (
                    <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                      {validationData.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 font-mono shrink-0">
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    {validationData.stars_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <GitFork className="w-3.5 h-3.5" />
                    {validationData.forks_count}
                  </span>
                </div>
              </div>

              {/* Branch Selector and Options */}
              <div className="pt-2 border-t border-blue-500/15 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    Branch to Index:
                  </label>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg">
                    <GitBranch className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      disabled={stage === 'indexing'}
                      className="bg-transparent text-slate-200 text-xs font-mono focus:outline-none w-full"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={cleanExisting}
                      onChange={(e) => setCleanExisting(e.target.checked)}
                      disabled={stage === 'indexing'}
                      className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0"
                    />
                    <span className="text-xs">Overwrite existing index</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Indexing Progress Indicator */}
          {stage === 'indexing' && (
            <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 space-y-3">
              <div className="flex items-center gap-3 text-indigo-300">
                <Loader2 className="w-5 h-5 animate-spin shrink-0 text-indigo-400" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">
                    Ingesting Repository & Generating Embeddings...
                  </h4>
                  <p className="text-xs text-indigo-200/80">
                    Traversing files, chunking code lines, and embedding into Qdrant.
                  </p>
                </div>
              </div>

              {indexingStatus && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-indigo-500/20 text-center font-mono text-xs">
                  <div className="p-2 rounded bg-slate-900/60">
                    <div className="text-slate-400 text-[10px]">Discovered</div>
                    <div className="font-semibold text-slate-200">{indexingStatus.files_discovered}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-900/60">
                    <div className="text-slate-400 text-[10px]">Files Indexed</div>
                    <div className="font-semibold text-blue-300">{indexingStatus.files_indexed}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-900/60">
                    <div className="text-slate-400 text-[10px]">Chunks Stored</div>
                    <div className="font-semibold text-indigo-300">{indexingStatus.chunks_indexed}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Success Stage */}
          {stage === 'completed' && (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3 text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-emerald-200">Repository Successfully Indexed!</h4>
                <p className="text-xs text-emerald-300/80">Switching to codebase chat workspace...</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-medium block text-red-200">Connection Error</span>
                <span className="break-words">{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Security & Safe Ingestion Notice */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Code is parsed statically. No repository scripts or binaries are ever executed.</span>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div>
            {stage === 'error' && (
              <button
                type="button"
                onClick={() => setStage('input')}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Try again</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={stage === 'indexing'}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>

            {stage === 'input' || stage === 'validating' || stage === 'error' ? (
              <button
                type="button"
                onClick={handleValidate}
                disabled={stage === 'validating' || !url.trim()}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {stage === 'validating' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Validating...</span>
                  </>
                ) : (
                  <>
                    <span>Validate URL</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            ) : stage === 'validated' ? (
              <button
                type="button"
                onClick={handleStartIndexing}
                className="px-5 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-colors"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Start Indexing</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
