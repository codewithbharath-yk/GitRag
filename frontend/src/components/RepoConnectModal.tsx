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
      <Spotlight variant="teal" className="w-full max-w-xl rounded-xl">
        <div className="w-full max-w-xl bg-[#162623] border border-[#577877]/35 rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#F0F5F7]">
          {/* Header */}
          <div className="p-5 border-b border-[#577877]/25 flex items-center justify-between bg-[#1B2D2A]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-[#162623] text-[#F0F5F7] border border-[#577877]/30">
                <GithubIcon className="w-5 h-5 text-[#F0F5F7]" />
              </div>
              <div>
                <TextEffect as="h2" className="text-base font-semibold text-[#F0F5F7]">Connect a GitHub Repository</TextEffect>
                <p className="text-xs text-[#577877]">Fast lightweight connection with Question-Driven Lazy RAG</p>
              </div>
            </div>
          {stage !== 'indexing' && (
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-[#577877] hover:text-[#F0F5F7] hover:bg-[#1E3430] transition-colors"
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
              <span className="text-[11px] font-medium text-[#577877] uppercase tracking-wider">
                Quick test presets:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickSample('https://github.com/octocat/Spoon-Knife')}
                  className="px-2.5 py-1 text-xs rounded-md bg-[#1B2D2A] hover:bg-[#213834] text-[#B9CECC] hover:text-[#F0F5F7] border border-[#577877]/30 transition-colors flex items-center gap-1.5"
                >
                  <Star className="w-3 h-3 text-[#D9A066]" />
                  <span>octocat/Spoon-Knife (Demo)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSample('https://github.com/fastapi/fastapi')}
                  className="px-2.5 py-1 text-xs rounded-md bg-[#1B2D2A] hover:bg-[#213834] text-[#B9CECC] hover:text-[#F0F5F7] border border-[#577877]/30 transition-colors"
                >
                  fastapi/fastapi
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSample('https://github.com/pallets/flask')}
                  className="px-2.5 py-1 text-xs rounded-md bg-[#1B2D2A] hover:bg-[#213834] text-[#B9CECC] hover:text-[#F0F5F7] border border-[#577877]/30 transition-colors"
                >
                  pallets/flask
                </button>
              </div>
            </div>
          )}

          {/* Repository URL Input Card */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#B9CECC] block">
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
                className="w-full px-3.5 py-2.5 bg-[#111E1C] border border-[#577877]/35 rounded-lg text-xs font-mono text-[#F0F5F7] placeholder-[#577877] focus:outline-none focus:border-[#295255] focus:ring-2 focus:ring-[#295255]/40 disabled:opacity-50 transition-colors"
              />
            </div>
          </div>

          {/* Validated Metadata Preview */}
          {validationData && stage !== 'input' && stage !== 'validating' && stage !== 'error' && (
            <Tilt maxAngle={2}>
              <Spotlight variant="teal" className="rounded-xl">
                <div className="p-4 rounded-xl border border-[#577877]/40 bg-[#1B2D2A] space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#F0F5F7] text-sm font-mono">
                          {validationData.full_name}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-[#111E1C] text-[#B9CECC] border border-[#577877]/30">
                          {validationData.is_private ? 'Private' : 'Public'}
                        </span>
                      </div>
                      {validationData.description && (
                        <p className="text-xs text-[#B9CECC] mt-1 line-clamp-2">
                          {validationData.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#577877] font-mono shrink-0">
                      <span className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-[#D9A066]" />
                        {validationData.stars_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitFork className="w-3.5 h-3.5 text-[#577877]" />
                        {validationData.forks_count}
                      </span>
                    </div>
                  </div>

                  {/* Branch Selector */}
                  <div className="pt-2 border-t border-[#577877]/20 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[11px] font-medium text-[#577877] block mb-1">
                        Branch to Index:
                      </label>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111E1C] border border-[#577877]/30 rounded-md">
                        <GitBranch className="w-3.5 h-3.5 text-[#577877]" />
                        <input
                          type="text"
                          value={branch}
                          placeholder={validationData.default_branch || 'main'}
                          onChange={(e) => setBranch(e.target.value)}
                          disabled={stage === 'indexing'}
                          className="bg-transparent text-[#F0F5F7] text-xs font-mono focus:outline-none w-full"
                        />
                      </div>
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-[#B9CECC] cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={cleanExisting}
                          onChange={(e) => setCleanExisting(e.target.checked)}
                          disabled={stage === 'indexing'}
                          className="rounded border-[#577877]/40 bg-[#111E1C] text-[#295255] focus:ring-0"
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
            <div className="p-4 rounded-xl border border-[#577877]/40 bg-[#1B2D2A] space-y-4">
              <div className="flex items-center gap-3 text-[#F0F5F7]">
                <Loader2 className="w-5 h-5 animate-spin shrink-0 text-[#577877]" />
                <div>
                  <h4 className="text-sm font-semibold text-[#F0F5F7]">
                    Connecting Repository...
                  </h4>
                  <p className="text-xs text-[#B9CECC]">
                    Fetching file manifest & tree structure for lazy AI retrieval.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#111E1C] border border-[#577877]/25 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-[#6DBE9B]">
                  <span>✓ Validating repository</span>
                  <span>Complete</span>
                </div>
                <div className="flex items-center justify-between text-[#6DBE9B]">
                  <span>✓ Building file manifest</span>
                  <span>{indexingStatus ? `${indexingStatus.files_discovered} files` : 'In progress'}</span>
                </div>
                <div className="flex items-center justify-between text-[#6DBE9B]">
                  <span>✓ Ready for AI analysis</span>
                  <span>Instant</span>
                </div>
              </div>
            </div>
          )}

          {/* Success Stage */}
          {stage === 'completed' && (
            <div className="p-4 rounded-xl border border-[#6DBE9B]/40 bg-[#6DBE9B]/10 flex items-center gap-3 text-[#6DBE9B]">
              <CheckCircle2 className="w-5 h-5 text-[#6DBE9B] shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-[#F0F5F7]">Repository Connected!</h4>
                <p className="text-xs text-[#B9CECC]">Ready for AI analysis. Opening workspace...</p>
              </div>
            </div>
          )}

          {/* Structured Error UI Handling */}
          {stage === 'error' && errorMessage && (
            <>
              {errorCode === 'EMPTY_REPOSITORY' ? (
                <div className="p-4 rounded-xl border border-[#D9A066]/40 bg-[#D9A066]/10 text-xs space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-[#D9A066] shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm text-[#F0F5F7]">⚠️ Repository is empty</h4>
                      <p className="text-[#B9CECC]">
                        This GitHub repository does not contain any committed files yet.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-[#111E1C] border border-[#577877]/30 text-xs text-[#B9CECC] space-y-2 font-sans">
                    <span className="font-semibold text-[#F0F5F7] block">To use CodeRAG:</span>
                    <ol className="list-decimal list-inside space-y-1 pl-1 text-[#B9CECC]">
                      <li>Add your source code to the repository.</li>
                      <li>Commit the files.</li>
                      <li>Push them to GitHub.</li>
                      <li>Return here and try again.</li>
                    </ol>
                  </div>
                </div>
              ) : errorCode === 'BRANCH_NOT_FOUND' ? (
                <div className="p-4 rounded-xl border border-[#D9A066]/40 bg-[#D9A066]/10 text-xs space-y-3">
                  <div className="flex items-start gap-2.5">
                    <GitBranch className="w-5 h-5 text-[#D9A066] shrink-0 mt-0.5" />
                    <div className="space-y-1 flex-1">
                      <h4 className="font-semibold text-sm text-[#F0F5F7]">Branch Not Found</h4>
                      <p className="text-[#B9CECC]">{errorMessage}</p>
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
                        className="px-3 py-1.5 rounded-lg bg-[#295255] hover:bg-[#34686C] text-[#F0F5F7] text-xs font-medium border border-[#577877]/40 transition-colors flex items-center gap-1.5"
                      >
                        <GitBranch className="w-3.5 h-3.5" />
                        <span>Switch to default branch "{String(errorDetails.default_branch)}"</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-[#D96B6B]/40 bg-[#D96B6B]/10 flex items-start gap-2.5 text-xs text-[#D96B6B]">
                  <AlertCircle className="w-4 h-4 text-[#D96B6B] shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium block text-[#F0F5F7]">
                      {errorCode ? `Error (${errorCode})` : 'Unable to Connect Repository'}
                    </span>
                    <span className="break-words text-[#B9CECC]">{errorMessage}</span>

                    {errorDetails && Object.keys(errorDetails).length > 0 && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setShowTechDetails((prev) => !prev)}
                          className="text-[11px] text-[#577877] hover:text-[#F0F5F7] flex items-center gap-1 transition-colors"
                        >
                          <ChevronDown className={`w-3 h-3 transition-transform ${showTechDetails ? 'rotate-180' : ''}`} />
                          <span>{showTechDetails ? 'Hide Technical Details' : 'View Technical Details'}</span>
                        </button>
                        {showTechDetails && (
                          <pre className="mt-1.5 p-2 bg-[#111E1C] rounded border border-[#577877]/25 text-[10px] font-mono text-[#B9CECC] overflow-x-auto max-h-32">
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
          <div className="flex items-center gap-2 text-[11px] text-[#577877]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#6DBE9B] shrink-0" />
            <span>Code is parsed statically. No repository scripts or binaries are ever executed.</span>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-[#577877]/25 bg-[#1B2D2A] flex items-center justify-between">
          <div>
            {stage === 'error' && (
              <button
                type="button"
                onClick={() => {
                  setStage('input');
                  setErrorMessage(null);
                  setErrorCode(null);
                }}
                className="text-xs text-[#577877] hover:text-[#F0F5F7] flex items-center gap-1 transition-colors"
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
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#B9CECC] hover:text-[#F0F5F7] hover:bg-[#162623] disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>

            {stage === 'input' || stage === 'validating' || stage === 'error' ? (
              <Magnetic>
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={stage === 'validating' || !url.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-[#295255] hover:bg-[#34686C] text-[#F0F5F7] border border-[#577877]/50 shadow-sm disabled:opacity-50 flex items-center gap-2 transition-colors active:scale-[0.98]"
                >
                  {stage === 'validating' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Validating...</span>
                    </>
                  ) : (
                    <>
                      <span>{stage === 'error' ? 'Try Again' : 'Analyze Repository'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </Magnetic>
            ) : stage === 'validated' ? (
              <Magnetic>
                <button
                  type="button"
                  onClick={handleStartIndexing}
                  className="px-5 py-2 rounded-lg text-xs font-medium bg-[#295255] hover:bg-[#34686C] text-[#F0F5F7] border border-[#577877]/50 shadow-sm flex items-center gap-2 transition-colors active:scale-[0.98]"
                >
                  <Database className="w-3.5 h-3.5" />
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
