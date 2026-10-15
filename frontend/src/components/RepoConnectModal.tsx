import React, { useState } from 'react';
import {
  X,
  GitBranch,
  Star,
  GitFork,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Database,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import type {
  RepoValidateResponse,
  RepoStatusResponse,
  StoredRepository,
} from '../types/api';
import { Magnetic, Spotlight, Tilt, TextEffect } from './motion';

const GithubIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

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
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<Record<string, unknown> | null>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);

  const handleClose = () => {
    setStage('input');
    setValidationData(null);
    setIndexingStatus(null);
    setErrorMessage(null);
    setErrorCode(null);
    setErrorDetails(null);
    setShowTechDetails(false);
    onClose();
  };

  if (!isOpen) return null;

  const handleValidateWithBranch = async (targetBranch?: string) => {
    if (!url.trim()) {
      setErrorMessage('Please enter a GitHub repository URL or slug.');
      setErrorCode('VALIDATION_ERROR');
      return;
    }

    setStage('validating');
    setErrorMessage(null);
    setErrorCode(null);
    setErrorDetails(null);

    const branchToValidate = targetBranch !== undefined ? targetBranch.trim() : branch.trim();

    try {
      const data = await api.validateRepository(url.trim(), branchToValidate || undefined);
      setValidationData(data);
      setBranch(data.selected_branch || data.default_branch || 'main');
      setStage('validated');
    } catch (err) {
      setStage('error');
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
        setErrorCode(err.code || null);
        setErrorDetails(err.details || null);
      } else {
        setErrorMessage('Failed to validate repository access.');
        setErrorCode('UNKNOWN_ERROR');
      }
    }
  };

  const handleValidate = () => handleValidateWithBranch();

  const handleStartIndexing = async () => {
    if (!validationData) return;

    setStage('indexing');
    setErrorMessage(null);
    setErrorCode(null);
    setErrorDetails(null);

    try {
      const startRes = await api.startIndexing(url.trim(), branch.trim() || undefined, cleanExisting);

      const repoId = startRes.repository_id;
      let attempts = 0;
      const maxAttempts = 20;

      const checkStatus = async () => {
        attempts++;
        try {
          const status = await api.getRepositoryStatus(repoId);
          setIndexingStatus(status);

          if (status.status === 'completed') {
            setStage('completed');

            const stored: StoredRepository = {
              id: repoId,
              fullName: validationData.full_name || `${validationData.owner}/${validationData.name}`,
              owner: validationData.owner,
              name: validationData.name,
              branch: branch.trim() || validationData.selected_branch || validationData.default_branch || 'main',
              stars: validationData.stars_count || 0,
              language: validationData.language || 'Code',
              filesCount: status.files_discovered ?? status.files_indexed ?? 0,
              chunksCount: status.chunks_indexed ?? 0,
              lastIndexedAt: new Date().toISOString(),
            };

            setTimeout(() => {
              onRepositoryIndexed(stored);
              handleClose();
            }, 800);
            return true;
          } else if (status.status === 'failed') {
            setStage('error');
            setErrorMessage(status.error || 'Repository connection failed.');
            setErrorCode(status.error_code || 'CONNECTION_FAILED');
            return true;
          } else if (attempts >= maxAttempts) {
            setStage('error');
            setErrorMessage('Repository connection timed out.');
            setErrorCode('TIMEOUT');
            return true;
          }
        } catch {
          // recoverable polling error
        }
        return false;
      };

      const doneImmediately = await checkStatus();
      if (!doneImmediately) {
        const pollInterval = setInterval(async () => {
          const done = await checkStatus();
          if (done) clearInterval(pollInterval);
        }, 1000);
      }
    } catch (err) {
      setStage('error');
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
        setErrorCode(err.code || null);
        setErrorDetails(err.details || null);
      } else {
        setErrorMessage('Failed to connect repository.');
        setErrorCode('UNKNOWN_ERROR');
      }
    }
  };

  const handleQuickSample = (sampleUrl: string) => {
    setUrl(sampleUrl);
    setBranch('');
    setErrorMessage(null);
    setErrorCode(null);
    setErrorDetails(null);
    setStage('input');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
      <Spotlight color="#D4A373" className="w-full max-w-xl rounded-xl">
        <div className="w-full max-w-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[var(--text-primary)]">
          {/* Header */}
          <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface)]">
            <div className="flex items-center gap-2.5">
              {stage === 'validated' ? (
                <button
                  type="button"
                  onClick={() => setStage('input')}
                  className="p-2 rounded-lg bg-[var(--bg-well)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
                  title="Back to URL input"
                  aria-label="Back to URL input"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </button>
              ) : (
                <div className="p-2 rounded-lg bg-[var(--bg-well)] text-[var(--text-primary)] border border-[var(--border-subtle)]">
                  <GithubIcon className="w-5 h-5 text-[var(--text-primary)]" />
                </div>
              )}
              <div>
                <TextEffect as="h2" className="text-base font-semibold text-[var(--text-primary)]">Connect a GitHub Repository</TextEffect>
                <p className="text-xs text-[var(--text-muted)]">Fast lightweight connection with Question-Driven Lazy RAG</p>
              </div>
            </div>
          {stage !== 'indexing' && (
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)] transition-colors cursor-pointer"
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
              <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                Quick test presets:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickSample('https://github.com/octocat/Spoon-Knife')}
                  className="px-2.5 py-1 text-xs rounded-md bg-[var(--bg-well)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Star className="w-3 h-3 text-[#D4A373]" />
                  <span>octocat/Spoon-Knife (Demo)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSample('https://github.com/fastapi/fastapi')}
                  className="px-2.5 py-1 text-xs rounded-md bg-[var(--bg-well)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
                >
                  fastapi/fastapi
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSample('https://github.com/pallets/flask')}
                  className="px-2.5 py-1 text-xs rounded-md bg-[var(--bg-well)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
                >
                  pallets/flask
                </button>
              </div>
            </div>
          )}

          {/* Repository URL Input Card */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)] block">
              Paste repository URL or slug
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="https://github.com/username/project"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (stage !== 'input') {
                    setStage('input');
                    setErrorMessage(null);
                    setErrorCode(null);
                  }
                }}
                disabled={stage === 'validating' || stage === 'indexing'}
                className="w-full px-3.5 py-2.5 bg-[var(--bg-well)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#D4A373] focus:ring-2 focus:ring-[#D4A373]/30 disabled:opacity-50 transition-colors"
              />
            </div>
          </div>

          {/* Validated Metadata Preview */}
          {validationData && stage !== 'input' && stage !== 'validating' && stage !== 'error' && (
            <Tilt maxAngle={2}>
              <Spotlight color="#D4A373" className="rounded-xl">
                <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--text-primary)] text-sm font-mono">
                          {validationData.full_name}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-[var(--bg-well)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                          {validationData.is_private ? 'Private' : 'Public'}
                        </span>
                      </div>
                      {validationData.description && (
                        <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                          {validationData.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] font-mono shrink-0">
                      <span className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-[#D4A373]" />
                        {validationData.stars_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitFork className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        {validationData.forks_count}
                      </span>
                    </div>
                  </div>

                  {/* Branch Selector */}
                  <div className="pt-2 border-t border-[var(--border-subtle)] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[11px] font-medium text-[var(--text-muted)] block mb-1">
                        Branch to Index:
                      </label>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-well)] border border-[var(--border-subtle)] rounded-md">
                        <GitBranch className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <input
                          type="text"
                          value={branch}
                          placeholder={validationData.default_branch || 'main'}
                          onChange={(e) => setBranch(e.target.value)}
                          disabled={stage === 'indexing'}
                          className="bg-transparent text-[var(--text-primary)] text-xs font-mono focus:outline-none w-full"
                        />
                      </div>
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-[var(--text-secondary)] cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={cleanExisting}
                          onChange={(e) => setCleanExisting(e.target.checked)}
                          disabled={stage === 'indexing'}
                          className="rounded border-[var(--border-subtle)] bg-[var(--bg-well)] text-[#D4A373] focus:ring-0"
                        />
                        <span className="text-xs">Reset previous vector cache</span>
                      </label>
                    </div>
                  </div>
                </div>
              </Spotlight>
            </Tilt>
          )}

          {/* Indexing Pipeline Progress Visualization */}
          {stage === 'indexing' && (
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-4">
              <div className="flex items-center gap-3 text-[var(--text-primary)]">
                <Loader2 className="w-5 h-5 animate-spin shrink-0 text-[#D4A373]" />
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                    Connecting Repository...
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Fetching file manifest & tree structure for lazy AI retrieval.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[var(--bg-well)] border border-[var(--border-subtle)] space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-[#10B981]">
                  <span>✓ Validating repository</span>
                  <span>Complete</span>
                </div>
                <div className="flex items-center justify-between text-[#10B981]">
                  <span>✓ Building file manifest</span>
                  <span>{indexingStatus ? `${indexingStatus.files_discovered} files` : 'In progress'}</span>
                </div>
                <div className="flex items-center justify-between text-[#10B981]">
                  <span>✓ Ready for AI analysis</span>
                  <span>Instant</span>
                </div>
              </div>
            </div>
          )}

          {/* Success Stage */}
          {stage === 'completed' && (
            <div className="p-4 rounded-xl border border-[#10B981]/40 bg-[#10B981]/10 flex items-center gap-3 text-[#10B981]">
              <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">Repository Connected!</h4>
                <p className="text-xs text-[var(--text-secondary)]">Ready for AI analysis. Opening workspace...</p>
              </div>
            </div>
          )}

          {/* Structured Error UI Handling */}
          {stage === 'error' && errorMessage && (
            <>
              {errorCode === 'EMPTY_REPOSITORY' ? (
                <div className="p-4 rounded-xl border border-[#D4A373]/40 bg-[#D4A373]/10 text-xs space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-[#D4A373] shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm text-[var(--text-primary)]">⚠️ Repository is empty</h4>
                      <p className="text-[var(--text-secondary)]">
                        This GitHub repository does not contain any committed files yet.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-[var(--bg-well)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] space-y-2 font-sans">
                    <span className="font-semibold text-[var(--text-primary)] block">To use CodeRAG:</span>
                    <ol className="list-decimal list-inside space-y-1 pl-1 text-[var(--text-secondary)]">
                      <li>Add your source code to the repository.</li>
                      <li>Commit the files.</li>
                      <li>Push them to GitHub.</li>
                      <li>Return here and try again.</li>
                    </ol>
                  </div>
                </div>
              ) : errorCode === 'BRANCH_NOT_FOUND' ? (
                <div className="p-4 rounded-xl border border-[#D4A373]/40 bg-[#D4A373]/10 text-xs space-y-3">
                  <div className="flex items-start gap-2.5">
                    <GitBranch className="w-5 h-5 text-[#D4A373] shrink-0 mt-0.5" />
                    <div className="space-y-1 flex-1">
                      <h4 className="font-semibold text-sm text-[var(--text-primary)]">Branch Not Found</h4>
                      <p className="text-[var(--text-secondary)]">{errorMessage}</p>
                    </div>
                  </div>

                  {typeof errorDetails?.default_branch === 'string' && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const defBranch = String(errorDetails.default_branch);
                          setBranch(defBranch);
                          handleValidateWithBranch(defBranch);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#D4A373] hover:bg-[#C5915F] text-[#1F3B2C] font-bold text-xs font-medium border border-[#D4A373] transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <GitBranch className="w-3.5 h-3.5" />
                        <span>Switch to default branch "{String(errorDetails.default_branch)}"</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-500/10 flex items-start gap-2.5 text-xs text-rose-400">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium block text-[var(--text-primary)]">
                      {errorCode ? `Error (${errorCode})` : 'Unable to Connect Repository'}
                    </span>
                    <span className="break-words text-[var(--text-secondary)]">{errorMessage}</span>

                    {errorDetails && Object.keys(errorDetails).length > 0 && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setShowTechDetails((prev) => !prev)}
                          className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <ChevronDown className={`w-3 h-3 transition-transform ${showTechDetails ? 'rotate-180' : ''}`} />
                          <span>{showTechDetails ? 'Hide Technical Details' : 'View Technical Details'}</span>
                        </button>
                        {showTechDetails && (
                          <pre className="mt-1.5 p-2 bg-[var(--bg-well)] rounded border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-secondary)] overflow-x-auto max-h-32">
                            {JSON.stringify(errorDetails, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Security & Safe Ingestion Notice */}
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#D4A373] shrink-0" />
            <span>Code is parsed statically. No repository scripts or binaries are ever executed.</span>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between">
          <div>
            {stage === 'validated' ? (
              <button
                type="button"
                onClick={() => setStage('input')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)] border border-[var(--border-subtle)] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>← Previous</span>
              </button>
            ) : stage === 'error' ? (
              <button
                type="button"
                onClick={() => {
                  setStage('input');
                  setErrorMessage(null);
                  setErrorCode(null);
                }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Try again</span>
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={stage === 'indexing'}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)] disabled:opacity-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {stage === 'input' || stage === 'validating' || stage === 'error' ? (
              <Magnetic>
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={stage === 'validating' || !url.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-[#D4A373] hover:bg-[#C5915F] text-[#1F3B2C] font-bold border border-[#D4A373] shadow-sm disabled:opacity-50 flex items-center gap-2 transition-colors active:scale-[0.98] cursor-pointer"
                >
                  {stage === 'validating' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Validating...</span>
                    </>
                  ) : (
                    <>
                      <span>{stage === 'error' ? 'Try Again' : 'Analyze Repository'}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#D4A373]" />
                    </>
                  )}
                </button>
              </Magnetic>
            ) : stage === 'validated' ? (
              <Magnetic>
                <button
                  type="button"
                  onClick={handleStartIndexing}
                  className="px-5 py-2 rounded-lg text-xs font-medium bg-[#D4A373] hover:bg-[#C5915F] text-[#1F3B2C] font-bold border border-[#D4A373] shadow-sm flex items-center gap-2 transition-colors active:scale-[0.98] cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5 text-[#D4A373]" />
                  <span>Start Indexing</span>
                </button>
              </Magnetic>
            ) : null}
          </div>
        </div>
      </div>
      </Spotlight>
    </div>
  );
};
