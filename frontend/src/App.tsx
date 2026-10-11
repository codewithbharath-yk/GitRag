import React, { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from './api/client';
import type {
  StoredRepository,
  ChatMessageItem,
  HealthResponse,
  RepoFileItem,
  UserProfile,
} from './types/api';
import { Sidebar, type WorkspaceTab } from './components/Sidebar';
import { LandingPage } from './components/LandingPage';
import { DashboardView } from './components/DashboardView';
import { RepositoriesView } from './components/RepositoriesView';
import { CodebaseExplorer, type ExplorerSubTab } from './components/CodebaseExplorer';
import { SettingsView } from './components/SettingsView';
import { WorkspaceHeader } from './components/WorkspaceHeader';
import { GlobalCommandBar } from './components/GlobalCommandBar';
import { RepoConnectModal } from './components/RepoConnectModal';
import { RepoSettingsModal } from './components/RepoSettingsModal';
import { FilesDrawer } from './components/FilesDrawer';
import { PageTransition } from './components/motion';
import { ErrorBoundary } from './components/ErrorBoundary';

const STORAGE_KEY_REPOS = 'coderag_repositories_v1';
const STORAGE_KEY_ACTIVE = 'coderag_active_repo_v1';

// Preset default repositories matching user mockup
const DEFAULT_PRESET_REPOS: StoredRepository[] = [
  {
    id: 'codeswithbharath-yk__kumar',
    fullName: 'codeswithbharath-yk/kumar',
    owner: 'codeswithbharath-yk',
    name: 'kumar',
    branch: 'main',
    stars: 34,
    language: 'Python',
    filesCount: 18,
    chunksCount: 64,
    lastIndexedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'octocat__spoon-knife',
    fullName: 'octocat/Spoon-Knife',
    owner: 'octocat',
    name: 'Spoon-Knife',
    branch: 'main',
    stars: 14089,
    language: 'HTML',
    filesCount: 3,
    chunksCount: 3,
    lastIndexedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'vercel__next-js',
    fullName: 'vercel/next.js',
    owner: 'vercel',
    name: 'next.js',
    branch: 'canary',
    stars: 122400,
    language: 'TypeScript',
    filesCount: 240,
    chunksCount: 840,
    lastIndexedAt: new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'facebook__react',
    fullName: 'facebook/react',
    owner: 'facebook',
    name: 'react',
    branch: 'main',
    stars: 226000,
    language: 'JavaScript',
    filesCount: 310,
    chunksCount: 1120,
    lastIndexedAt: new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'microsoft__vscode',
    fullName: 'microsoft/vscode',
    owner: 'microsoft',
    name: 'vscode',
    branch: 'main',
    stars: 161000,
    language: 'TypeScript',
    filesCount: 850,
    chunksCount: 3200,
    lastIndexedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
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

  // User Profile from Onboarding
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('coderag_user_profile');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {
      name: 'Bharath Kumar',
      role: 'Full-Stack Developer',
      githubUsername: 'codewithbharath-yk',
      primaryLanguage: 'TypeScript',
    };
  });

  // User Authentication State: Strict forward-only entry
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem('coderag_is_authenticated') === 'true';
    } catch {
      return false;
    }
  });

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('explorer');
  const [explorerSubTab, setExplorerSubTab] = useState<ExplorerSubTab>('chat');

  // Mobile drawer state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Chat message history indexed by repository_id
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessageItem[]>>({});
  const [isQuerying, setIsQuerying] = useState(false);

  // Modals & Overlays
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsRepoId, setSettingsRepoId] = useState<string | null>(null);
  const [isFilesDrawerOpen, setIsFilesDrawerOpen] = useState(false);
  const [repoFiles, setRepoFiles] = useState<RepoFileItem[]>([]);
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);

  const handleLoginSuccess = (profile: UserProfile) => {
    setUserProfile(profile);
    setIsAuthenticated(true);
    setActiveTab('explorer');
    try {
      localStorage.setItem('coderag_is_authenticated', 'true');
      localStorage.setItem('coderag_user_profile', JSON.stringify(profile));
    } catch {
      // storage error
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      localStorage.removeItem('coderag_is_authenticated');
    } catch {
      // storage error
    }
  };

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

  // Check backend health and sync repositories
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await api.getHealth();
        setHealth(res);
        setBackendError(null);

        // Fetch live indexed repositories from backend
        try {
          const backendRepos = await api.listUserRepositories();
          if (backendRepos && backendRepos.length > 0) {
            const mapped: StoredRepository[] = backendRepos.map((r) => ({
              id: r.repository_id || r.id,
              fullName: r.full_name || `${r.owner}/${r.name}`,
              owner: r.owner,
              name: r.name,
              branch: r.selected_branch || r.default_branch || 'main',
              stars: r.stars_count || 0,
              language: r.language,
              filesCount: r.total_files || 0,
              chunksCount: r.total_chunks || 0,
              lastIndexedAt: r.indexed_at || r.created_at || new Date().toISOString(),
            }));

            // Merge while preserving presets
            setRepositories((prev) => {
              const combined = [...mapped];
              prev.forEach((p) => {
                if (!combined.some((c) => c.fullName.toLowerCase() === p.fullName.toLowerCase())) {
                  combined.push(p);
                }
              });
              return combined;
            });

            if (!activeRepoId || !mapped.some((m) => m.id === activeRepoId)) {
              setActiveRepoId(mapped[0].id);
            }
          }
        } catch {
          // ignore repo list error if unauthenticated or offline
        }
      } catch (err) {
        setHealth(null);
        setBackendError(
          err instanceof ApiError ? err.message : 'Backend connection offline'
        );
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 15000);
    return () => clearInterval(interval);
  }, [activeRepoId]);

  const activeRepo = repositories.find((r) => r.id === activeRepoId) || repositories[0] || null;
  const settingsRepo = repositories.find((r) => r.id === settingsRepoId) || activeRepo;

  // Load indexed files for active repository
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
    setActiveTab('explorer');
    setExplorerSubTab('chat');
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
        question,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: res.sources,
        files_analyzed: res.files_analyzed,
        insufficientContext: res.insufficient_context,
        retrievedChunksCount: res.retrieved_chunks_count,
        latencyMs: res.latency_ms,
      };

      setChatHistories((prev) => ({
        ...prev,
        [activeRepo.id]: [...(prev[activeRepo.id] || []), assistantMessage],
      }));
    } catch (err) {
      const errorMessage: ChatMessageItem = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `Could not retrieve an answer: ${err instanceof Error ? err.message : 'Backend connection error'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        error: err instanceof Error ? err.message : 'Unknown error',
      };

      setChatHistories((prev) => ({
        ...prev,
        [activeRepo.id]: [...(prev[activeRepo.id] || []), errorMessage],
      }));
    } finally {
      setIsQuerying(false);
    }
  };

  // Clear chat history
  const handleClearHistory = () => {
    if (!activeRepo) return;
    setChatHistories((prev) => ({
      ...prev,
      [activeRepo.id]: [],
    }));
  };

  // Navigation handler from sidebar and buttons
  const handleNavigateTab = (tab: WorkspaceTab, subTab?: string) => {
    setActiveTab(tab);
    if (subTab) {
      setExplorerSubTab(subTab as ExplorerSubTab);
    }
  };

  if (!isAuthenticated) {
    return (
      <ErrorBoundary fallbackTitle="Landing Error">
        <LandingPage onLoginSuccess={handleLoginSuccess} />
      </ErrorBoundary>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#162623] text-[#F0F5F7] overflow-hidden select-none font-sans">
      {/* Primary Sidebar */}
      <Sidebar
        repositories={repositories}
        activeRepoId={activeRepoId}
        activeTab={activeTab}
        explorerSubTab={explorerSubTab}
        onSelectRepo={(id) => setActiveRepoId(id)}
        onSelectTab={handleNavigateTab}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onOpenSettingsModal={handleOpenSettingsModal}
        health={health}
        backendError={backendError}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        userProfile={userProfile}
      />

      {/* Main App Content Viewport */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden relative">
        {/* Workspace Top Header */}
        <WorkspaceHeader
          repositories={repositories}
          activeRepo={activeRepo}
          onSelectRepo={(id) => setActiveRepoId(id)}
          onOpenConnectModal={() => setIsConnectModalOpen(true)}
          onOpenCommandBar={() => setIsCommandBarOpen(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
          userProfile={userProfile}
        />

        {/* View Transition Wrapper with Error Boundary */}
        <ErrorBoundary fallbackTitle="Workspace Error">
          <PageTransition tabKey={activeTab} className="flex-1 flex flex-col overflow-hidden">
            {activeTab === 'dashboard' ? (
              <DashboardView
                repositories={repositories}
                activeRepoId={activeRepoId}
                onSelectRepo={(id) => setActiveRepoId(id)}
                onNavigateTab={handleNavigateTab}
                onOpenConnectModal={() => setIsConnectModalOpen(true)}
                onOpenSettingsModal={handleOpenSettingsModal}
                health={health}
              />
            ) : activeTab === 'repositories' ? (
              <RepositoriesView
                repositories={repositories}
                activeRepoId={activeRepoId}
                onSelectRepo={(id) => setActiveRepoId(id)}
                onNavigateToExplorer={(id) => {
                  if (id) setActiveRepoId(id);
                  setActiveTab('explorer');
                }}
                onOpenConnectModal={() => setIsConnectModalOpen(true)}
                onOpenSettingsModal={handleOpenSettingsModal}
              />
            ) : activeTab === 'explorer' ? (
              <CodebaseExplorer
                repository={activeRepo}
                activeSubTab={explorerSubTab}
                onSubTabChange={(sub) => setExplorerSubTab(sub)}
                messages={activeRepo ? chatHistories[activeRepo.id] || [] : []}
                isQuerying={isQuerying}
                onSendMessage={handleSendMessage}
                onClearHistory={handleClearHistory}
                onOpenFilesDrawer={handleOpenFilesDrawer}
                onOpenConnectModal={() => setIsConnectModalOpen(true)}
              />
            ) : (
              <SettingsView
                onSave={() => {}}
                userProfile={userProfile}
                onLogout={handleLogout}
              />
            )}
          </PageTransition>
        </ErrorBoundary>
      </div>

      {/* Global Command Bar (Ctrl+K) */}
      <GlobalCommandBar
        isOpen={isCommandBarOpen}
        onClose={() => setIsCommandBarOpen(false)}
        repositories={repositories}
        activeRepo={activeRepo}
        onSelectRepo={(id) => setActiveRepoId(id)}
        onNavigateTab={handleNavigateTab}
        onAskQuestion={handleSendMessage}
      />



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
