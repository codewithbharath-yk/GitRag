import React, { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from './api/client';
import type {
  StoredRepository,
  ChatMessageItem,
  HealthResponse,
  RepoFileItem,
} from './types/api';
import { Sidebar, type WorkspaceTab } from './components/Sidebar';
import { LandingPage } from './components/LandingPage';
import { DashboardView } from './components/DashboardView';
import { CodeSearchView } from './components/CodeSearchView';
import { ChatWorkspace } from './components/ChatWorkspace';
import { GitHistoryView } from './components/GitHistoryView';
import { CodeIntelligenceView } from './components/CodeIntelligenceView';
import { RepoConnectModal } from './components/RepoConnectModal';
import { RepoSettingsModal } from './components/RepoSettingsModal';
import { FilesDrawer } from './components/FilesDrawer';
import { FolderGit2 } from 'lucide-react';

const STORAGE_KEY_REPOS = 'coderag_repositories_v1';
const STORAGE_KEY_ACTIVE = 'coderag_active_repo_v1';

// Seed repository if clean state
const DEFAULT_PRESET_REPOS: StoredRepository[] = [
  {
    id: 'octocat__spoon-knife',
    fullName: 'octocat/Spoon-Knife',
    owner: 'octocat',
    name: 'Spoon-Knife',
    branch: 'main',
    stars: 14069,
    language: 'HTML',
    filesCount: 3,
    chunksCount: 3,
    lastIndexedAt: new Date().toISOString(),
  },
];

export const App: React.FC = () => {
  const [repositories, setRepositories] = useState<StoredRepository[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REPOS);
      return saved ? JSON.parse(saved) : DEFAULT_PRESET_REPOS;
    } catch {
      return DEFAULT_PRESET_REPOS;
    }
  });

  const [activeRepoId, setActiveRepoId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACTIVE);
      return saved || (DEFAULT_PRESET_REPOS[0]?.id ?? null);
    } catch {
      return DEFAULT_PRESET_REPOS[0]?.id ?? null;
    }
  });

  // Active workspace tab: 'landing' | 'dashboard' | 'chat' | 'search' | 'history' | 'intelligence'
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');

  // Chat message history indexed by repository_id
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessageItem[]>>({});
  const [isQuerying, setIsQuerying] = useState(false);

  // Modals & Drawers
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsRepoId, setSettingsRepoId] = useState<string | null>(null);
  const [isFilesDrawerOpen, setIsFilesDrawerOpen] = useState(false);
  const [repoFiles, setRepoFiles] = useState<RepoFileItem[]>([]);

  // Health and System State
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Sync repositories to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_REPOS, JSON.stringify(repositories));
    } catch {
      // storage quota or private mode
    }
  }, [repositories]);

  // Sync active repo to localStorage
  useEffect(() => {
    if (activeRepoId) {
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE, activeRepoId);
      } catch {
        // storage quota
      }
    }
  }, [activeRepoId]);

  // Check backend health on mount and periodically
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await api.getHealth();
        setHealth(res);
        setBackendError(null);
      } catch (err) {
        setHealth(null);
        setBackendError(
          err instanceof ApiError ? err.message : 'Backend connection offline'
        );
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 15000); // Polling health every 15s
    return () => clearInterval(interval);
  }, []);

  const activeRepo = repositories.find((r) => r.id === activeRepoId) || null;
  const settingsRepo = repositories.find((r) => r.id === settingsRepoId) || activeRepo;

  // Load indexed files for active repository when files drawer opens
  const fetchActiveRepoFiles = useCallback(async () => {
    if (!activeRepo) return;
    try {
      const res = await api.getRepositoryFiles(activeRepo.id);
      setRepoFiles(res.files);
    } catch (err) {
      console.error('Failed to load repo files:', err);
    }
  }, [activeRepo]);

  const handleOpenFilesDrawer = async () => {
    await fetchActiveRepoFiles();
    setIsFilesDrawerOpen(true);
  };

  // Add newly indexed repository
  const handleRepositoryIndexed = (newRepo: StoredRepository) => {
    setRepositories((prev) => {
      const filtered = prev.filter((r) => r.id !== newRepo.id);
      return [newRepo, ...filtered];
    });
    setActiveRepoId(newRepo.id);
    setActiveTab('chat');
  };

  // Update repository after reindexing
  const handleRepositoryReindexed = (updatedRepo: StoredRepository) => {
    setRepositories((prev) =>
      prev.map((r) => (r.id === updatedRepo.id ? updatedRepo : r))
    );
  };

  // Delete repository
  const handleRepositoryDeleted = (repoId: string) => {
    setRepositories((prev) => prev.filter((r) => r.id !== repoId));
    if (activeRepoId === repoId) {
      const remaining = repositories.filter((r) => r.id !== repoId);
      setActiveRepoId(remaining[0]?.id ?? null);
    }
  };

  // Open settings modal for specific repository
  const handleOpenSettingsModal = (repoId: string) => {
    setSettingsRepoId(repoId);
    setIsSettingsModalOpen(true);
  };

  // Send question to RAG chat endpoint
  const handleSendMessage = async (question: string) => {
    if (!activeRepo || isQuerying) return;

    const userMessage: ChatMessageItem = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const currentHistory = chatHistories[activeRepo.id] || [];
    setChatHistories((prev) => ({
      ...prev,
      [activeRepo.id]: [...currentHistory, userMessage],
    }));

    setIsQuerying(true);

    try {
      const res = await api.askQuestion({
        repository_id: activeRepo.id,
        question,
        branch: activeRepo.branch,
        top_k: 5,
      });

      const assistantMessage: ChatMessageItem = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: res.sources,
        insufficientContext: res.insufficient_context,
        retrievedChunksCount: res.retrieved_chunks_count,
        latencyMs: res.latency_ms,
      };

      setChatHistories((prev) => ({
        ...prev,
        [activeRepo.id]: [...(prev[activeRepo.id] || []), assistantMessage],
      }));
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : 'An error occurred while answering your question.';

      const errorAssistantMessage: ChatMessageItem = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `**Error:** ${errorMessage}\n\nPlease verify that the backend is running and that your question references an indexed repository.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        error: errorMessage,
      };

      setChatHistories((prev) => ({
        ...prev,
        [activeRepo.id]: [...(prev[activeRepo.id] || []), errorAssistantMessage],
      }));
    } finally {
      setIsQuerying(false);
    }
  };

  const handleClearHistory = () => {
    if (!activeRepo) return;
    setChatHistories((prev) => ({
      ...prev,
      [activeRepo.id]: [],
    }));
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans antialiased text-slate-100">
      {/* Sidebar Navigation */}
      <Sidebar
        repositories={repositories}
        activeRepoId={activeRepoId}
        activeTab={activeTab}
        onSelectRepo={(id) => setActiveRepoId(id)}
        onSelectTab={(tab) => setActiveTab(tab)}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onOpenSettingsModal={handleOpenSettingsModal}
        health={health}
        backendError={backendError}
      />

      {/* Main Workspace Router */}
      {activeTab === 'landing' ? (
        <LandingPage
          onGetStarted={() => setActiveTab('dashboard')}
          onOpenConnectModal={() => setIsConnectModalOpen(true)}
          health={health}
          repositoriesCount={repositories.length}
        />
      ) : activeTab === 'dashboard' ? (
        <DashboardView
          repositories={repositories}
          activeRepoId={activeRepoId}
          onSelectRepo={(id) => setActiveRepoId(id)}
          onNavigateTab={(tab) => setActiveTab(tab)}
          onOpenConnectModal={() => setIsConnectModalOpen(true)}
          onOpenSettingsModal={handleOpenSettingsModal}
          health={health}
        />
      ) : activeTab === 'search' ? (
        <CodeSearchView
          repository={activeRepo}
          onAskQuestionInChat={(q) => {
            setActiveTab('chat');
            handleSendMessage(q);
          }}
        />
      ) : activeTab === 'chat' ? (
        <ChatWorkspace
          repository={activeRepo}
          messages={activeRepo ? chatHistories[activeRepo.id] || [] : []}
          isQuerying={isQuerying}
          onSendMessage={handleSendMessage}
          onClearHistory={handleClearHistory}
          onOpenFilesDrawer={handleOpenFilesDrawer}
          onOpenConnectModal={() => setIsConnectModalOpen(true)}
        />
      ) : activeTab === 'intelligence' ? (
        activeRepo ? (
          <CodeIntelligenceView
            repository={activeRepo}
            onAskQuestion={(q) => {
              setActiveTab('chat');
              handleSendMessage(q);
            }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950">
            <div className="max-w-md space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-xl shadow-cyan-500/10">
                <FolderGit2 className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">No Repository Selected</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Please connect or select a repository to explore AST code structure and symbols.
                </p>
              </div>
            </div>
          </div>
        )
      ) : activeRepo ? (
        <GitHistoryView repository={activeRepo} />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950">
          <div className="max-w-md space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-purple-600/20 to-indigo-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-xl shadow-purple-500/10">
              <FolderGit2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">No Repository Selected</h2>
              <p className="text-sm text-slate-400 mt-1">
                Please connect or select a repository to browse Git commits and inspect unified diffs.
              </p>
            </div>
            <button
              onClick={() => setIsConnectModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm inline-flex items-center gap-2 shadow-lg shadow-purple-600/25 transition-all"
            >
              Connect a Repository
            </button>
          </div>
        </div>
      )}

      {/* Repository Connection Modal */}
      <RepoConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onRepositoryIndexed={handleRepositoryIndexed}
      />

      {/* Repository Settings Modal */}
      <RepoSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        repository={settingsRepo}
        onRepositoryDeleted={handleRepositoryDeleted}
        onRepositoryReindexed={handleRepositoryReindexed}
        health={health}
      />

      {/* Indexed Source Files Drawer */}
      {activeRepo && (
        <FilesDrawer
          isOpen={isFilesDrawerOpen}
          onClose={() => setIsFilesDrawerOpen(false)}
          repositoryId={activeRepo.id}
          files={repoFiles}
          repositoryOwner={activeRepo.owner}
          repositoryName={activeRepo.name}
          branch={activeRepo.branch}
        />
      )}
    </div>
  );
};

export default App;
