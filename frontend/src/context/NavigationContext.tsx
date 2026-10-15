import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { WorkspaceTab } from '../components/Sidebar';
import type { ExplorerSubTab } from '../components/CodebaseExplorer';

export interface NavigationState {
  tab: WorkspaceTab;
  subTab?: ExplorerSubTab;
  repoId?: string | null;
  commitSha?: string | null;
  symbolName?: string | null;
  settingsSection?: string;
  landingStep?: 'landing' | 'showcase' | 'auth';
  modalOpen?: string | null;
  timestamp?: number;
}

interface NavigationContextType {
  tab: WorkspaceTab;
  subTab: ExplorerSubTab;
  repoId: string | null;
  commitSha: string | null;
  symbolName: string | null;
  settingsSection: string;
  landingStep: 'landing' | 'showcase' | 'auth';
  canGoBack: boolean;
  canGoForward: boolean;
  historyLength: number;
  
  // Navigation actions
  navigate: (
    tab: WorkspaceTab,
    options?: {
      subTab?: ExplorerSubTab;
      repoId?: string | null;
      commitSha?: string | null;
      symbolName?: string | null;
      settingsSection?: string;
      replace?: boolean;
    }
  ) => void;
  goBack: (fallback?: Partial<NavigationState>) => void;
  goForward: () => void;
  setSubTab: (subTab: ExplorerSubTab) => void;
  setCommitSha: (sha: string | null) => void;
  setSymbolName: (name: string | null) => void;
  setSettingsSection: (section: string) => void;
  setLandingStep: (step: 'landing' | 'showcase' | 'auth') => void;
  registerOverlay: (id: string, onClose: () => void) => () => void;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

function stateToUrl(state: NavigationState): string {
  const params = new URLSearchParams();
  params.set('tab', state.tab);
  if (state.subTab) params.set('subTab', state.subTab);
  if (state.repoId) params.set('repo', state.repoId);
  if (state.commitSha) params.set('commit', state.commitSha);
  if (state.symbolName) params.set('symbol', state.symbolName);
  if (state.settingsSection && state.tab === 'settings') {
    params.set('section', state.settingsSection);
  }
  if (state.landingStep) params.set('step', state.landingStep);
  return `${window.location.pathname}?${params.toString()}`;
}

function parseUrlState(defaultRepoId: string | null): NavigationState {
  if (typeof window === 'undefined') {
    return { tab: 'explorer', subTab: 'chat', repoId: defaultRepoId };
  }
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab') as WorkspaceTab | null;
  const subTabParam = params.get('subTab') as ExplorerSubTab | null;
  const repoParam = params.get('repo');
  const commitParam = params.get('commit');
  const symbolParam = params.get('symbol');
  const sectionParam = params.get('section');
  const stepParam = params.get('step') as 'landing' | 'showcase' | 'auth' | null;

  const validTabs: WorkspaceTab[] = ['dashboard', 'repositories', 'explorer', 'settings'];
  const validSubTabs: ExplorerSubTab[] = ['chat', 'diffs', 'ast', 'files'];

  const tab = tabParam && validTabs.includes(tabParam) ? tabParam : 'explorer';
  const subTab = subTabParam && validSubTabs.includes(subTabParam) ? subTabParam : 'chat';

  return {
    tab,
    subTab,
    repoId: repoParam || defaultRepoId,
    commitSha: commitParam || null,
    symbolName: symbolParam || null,
    settingsSection: sectionParam || 'appearance',
    landingStep: stepParam || 'landing',
    timestamp: Date.now(),
  };
}

export const NavigationProvider: React.FC<{
  children: React.ReactNode;
  defaultRepoId?: string | null;
  onRepoChange?: (id: string) => void;
}> = ({ children, defaultRepoId = null, onRepoChange }) => {
  const [navState, setNavState] = useState<NavigationState>(() => parseUrlState(defaultRepoId));
  
  // History stacks for bidirectional navigation
  const historyStackRef = useRef<NavigationState[]>([parseUrlState(defaultRepoId)]);
  const forwardStackRef = useRef<NavigationState[]>([]);
  
  const [forwardStackLength, setForwardStackLength] = useState<number>(0);
  const [historyStackLength, setHistoryStackLength] = useState<number>(1);
  
  const overlaysRef = useRef<Map<string, () => void>>(new Map());
  const isNavigatingRef = useRef(false);

  // Register an active overlay (drawer, modal) so back closes it first
  const registerOverlay = useCallback((id: string, onClose: () => void) => {
    overlaysRef.current.set(id, onClose);
    return () => {
      overlaysRef.current.delete(id);
    };
  }, []);

  // Sync state to URL and history stack
  const pushState = useCallback((nextState: NavigationState, replace = false, isBidirectional = false) => {
    const currentState = historyStackRef.current[historyStackRef.current.length - 1];
    
    // Skip duplicate identical entries
    if (
      currentState &&
      currentState.tab === nextState.tab &&
      currentState.subTab === nextState.subTab &&
      currentState.repoId === nextState.repoId &&
      currentState.commitSha === nextState.commitSha &&
      currentState.symbolName === nextState.symbolName &&
      currentState.settingsSection === nextState.settingsSection &&
      currentState.landingStep === nextState.landingStep
    ) {
      return;
    }

    const stampedState = { ...nextState, timestamp: Date.now() };
    const url = stateToUrl(stampedState);

    try {
      if (replace) {
        window.history.replaceState(stampedState, '', url);
        if (historyStackRef.current.length > 0) {
          historyStackRef.current[historyStackRef.current.length - 1] = stampedState;
        } else {
          historyStackRef.current.push(stampedState);
        }
      } else {
        window.history.pushState(stampedState, '', url);
        historyStackRef.current.push(stampedState);
        // Regular forward navigation clears forward stack
        if (!isBidirectional) {
          forwardStackRef.current = [];
          setForwardStackLength(0);
        }
      }
    } catch {
      // ignore history API errors
    }

    setHistoryStackLength(historyStackRef.current.length);
    setNavState(stampedState);
    if (stampedState.repoId && stampedState.repoId !== currentState?.repoId) {
      onRepoChange?.(stampedState.repoId);
    }
  }, [onRepoChange]);

  // Handle browser back/forward buttons (popstate)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // 1. If any overlay is open, close it first
      if (overlaysRef.current.size > 0) {
        const entries = Array.from(overlaysRef.current.entries());
        const [, closeLatest] = entries[entries.length - 1];
        closeLatest();
        try {
          const currentUrl = stateToUrl(navState);
          window.history.pushState(navState, '', currentUrl);
        } catch {}
        return;
      }

      // 2. Restore state from popstate or parse URL
      const targetState: NavigationState = event.state || parseUrlState(defaultRepoId);

      // Push current to forward stack if moving backward
      if (historyStackRef.current.length > 1) {
        const prev = historyStackRef.current.pop();
        if (prev) {
          forwardStackRef.current.push(prev);
          setForwardStackLength(forwardStackRef.current.length);
        }
      }

      isNavigatingRef.current = true;
      setNavState(targetState);
      setHistoryStackLength(historyStackRef.current.length);
      if (targetState.repoId) {
        onRepoChange?.(targetState.repoId);
      }
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 50);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navState, defaultRepoId, onRepoChange]);

  // Primary navigate method
  const navigate = useCallback(
    (
      tab: WorkspaceTab,
      options?: {
        subTab?: ExplorerSubTab;
        repoId?: string | null;
        commitSha?: string | null;
        symbolName?: string | null;
        settingsSection?: string;
        replace?: boolean;
      }
    ) => {
      const next: NavigationState = {
        tab,
        subTab: options?.subTab !== undefined ? options.subTab : navState.subTab,
        repoId: options?.repoId !== undefined ? options.repoId : navState.repoId,
        commitSha: options?.commitSha !== undefined ? options.commitSha : null,
        symbolName: options?.symbolName !== undefined ? options.symbolName : null,
        settingsSection: options?.settingsSection || navState.settingsSection || 'appearance',
        landingStep: navState.landingStep,
      };
      pushState(next, options?.replace ?? false, false);
    },
    [navState, pushState]
  );

  // Contextual & Stack-based Back Navigation
  const goBack = useCallback(
    (fallback?: Partial<NavigationState>) => {
      // 1. If an overlay is open, close it
      if (overlaysRef.current.size > 0) {
        const entries = Array.from(overlaysRef.current.entries());
        const [, closeLatest] = entries[entries.length - 1];
        closeLatest();
        return;
      }

      // Save current state into forward stack before moving back
      forwardStackRef.current.push({ ...navState, timestamp: Date.now() });
      setForwardStackLength(forwardStackRef.current.length);

      // 2. Commit detail view -> return to Git Diffs overview
      if (navState.commitSha) {
        navigate('explorer', { subTab: 'diffs', commitSha: null });
        return;
      }

      // 3. AST symbol detail -> return to AST overview
      if (navState.symbolName) {
        navigate('explorer', { subTab: 'ast', symbolName: null });
        return;
      }

      // 4. Explorer subtab (diffs, ast, files) -> return to Chat
      if (navState.tab === 'explorer' && navState.subTab && navState.subTab !== 'chat') {
        navigate('explorer', { subTab: 'chat' });
        return;
      }

      // 5. Internal history stack navigation
      if (historyStackRef.current.length > 1) {
        historyStackRef.current.pop(); // pop current
        const targetState = historyStackRef.current[historyStackRef.current.length - 1];
        if (targetState) {
          const url = stateToUrl(targetState);
          try {
            window.history.pushState(targetState, '', url);
          } catch {}
          setNavState(targetState);
          setHistoryStackLength(historyStackRef.current.length);
          if (targetState.repoId) {
            onRepoChange?.(targetState.repoId);
          }
          return;
        }
      }

      // 6. Direct entry contextual fallback
      if (fallback) {
        navigate(fallback.tab || 'dashboard', {
          subTab: fallback.subTab,
          repoId: fallback.repoId,
          settingsSection: fallback.settingsSection,
        });
        return;
      }

      switch (navState.tab) {
        case 'explorer':
          navigate('repositories');
          break;
        case 'repositories':
          navigate('dashboard');
          break;
        case 'settings':
          navigate('dashboard');
          break;
        case 'dashboard':
        default:
          navigate('dashboard');
          break;
      }
    },
    [navState, navigate, onRepoChange]
  );

  // Forward Navigation
  const goForward = useCallback(() => {
    if (forwardStackRef.current.length === 0) return;

    const nextState = forwardStackRef.current.pop();
    setForwardStackLength(forwardStackRef.current.length);

    if (nextState) {
      historyStackRef.current.push(nextState);
      setHistoryStackLength(historyStackRef.current.length);
      const url = stateToUrl(nextState);
      try {
        window.history.pushState(nextState, '', url);
      } catch {}
      setNavState(nextState);
      if (nextState.repoId) {
        onRepoChange?.(nextState.repoId);
      }
    }
  }, [onRepoChange]);

  const setSubTab = useCallback(
    (subTab: ExplorerSubTab) => {
      navigate(navState.tab === 'explorer' ? 'explorer' : navState.tab, { subTab, commitSha: null, symbolName: null });
    },
    [navState.tab, navigate]
  );

  const setCommitSha = useCallback(
    (commitSha: string | null) => {
      navigate('explorer', { subTab: 'diffs', commitSha });
    },
    [navigate]
  );

  const setSymbolName = useCallback(
    (symbolName: string | null) => {
      navigate('explorer', { subTab: 'ast', symbolName });
    },
    [navigate]
  );

  const setSettingsSection = useCallback(
    (settingsSection: string) => {
      navigate('settings', { settingsSection });
    },
    [navigate]
  );

  const setLandingStep = useCallback(
    (landingStep: 'landing' | 'showcase' | 'auth') => {
      setNavState((prev) => {
        const next = { ...prev, landingStep, timestamp: Date.now() };
        try {
          window.history.pushState(next, '', stateToUrl(next));
        } catch {}
        return next;
      });
    },
    []
  );

  const canGoBack =
    historyStackLength > 1 ||
    Boolean(navState.commitSha) ||
    Boolean(navState.symbolName) ||
    (navState.tab === 'explorer' && navState.subTab !== 'chat') ||
    navState.tab === 'settings' ||
    navState.tab === 'repositories';

  const canGoForward = forwardStackLength > 0;

  return (
    <NavigationContext.Provider
      value={{
        tab: navState.tab,
        subTab: navState.subTab || 'chat',
        repoId: navState.repoId || defaultRepoId,
        commitSha: navState.commitSha || null,
        symbolName: navState.symbolName || null,
        settingsSection: navState.settingsSection || 'appearance',
        landingStep: navState.landingStep || 'landing',
        canGoBack,
        canGoForward,
        historyLength: historyStackLength,
        navigate,
        goBack,
        goForward,
        setSubTab,
        setCommitSha,
        setSymbolName,
        setSettingsSection,
        setLandingStep,
        registerOverlay,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return ctx;
};
