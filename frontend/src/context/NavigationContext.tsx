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
  modalOpen?: string | null; // e.g. 'connect', 'settings', 'files', 'mobile'
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
  const historyStackRef = useRef<NavigationState[]>([parseUrlState(defaultRepoId)]);
  const overlaysRef = useRef<Map<string, () => void>>(new Map());
  const isNavigatingRef = useRef(false);

  // Register an active overlay (drawer, modal) so browser back closes it first
  const registerOverlay = useCallback((id: string, onClose: () => void) => {
    overlaysRef.current.set(id, onClose);
    return () => {
      overlaysRef.current.delete(id);
    };
  }, []);

  // Sync state to URL and history stack
  const pushState = useCallback((nextState: NavigationState, replace = false) => {
    const currentState = historyStackRef.current[historyStackRef.current.length - 1];
    
    // Skip duplicate entries
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
      }
    } catch {
      // ignore history API errors
    }

    setNavState(stampedState);
    if (stampedState.repoId && stampedState.repoId !== currentState?.repoId) {
      onRepoChange?.(stampedState.repoId);
    }
  }, [onRepoChange]);

  // Handle browser back/forward buttons (popstate)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // 1. If any overlay (modal, drawer) is currently open, close the most recent overlay first
      if (overlaysRef.current.size > 0) {
        const entries = Array.from(overlaysRef.current.entries());
        const [, closeLatest] = entries[entries.length - 1];
        closeLatest();
        // Prevent navigating the page away while closing overlay
        try {
          const currentUrl = stateToUrl(navState);
          window.history.pushState(navState, '', currentUrl);
        } catch {}
        return;
      }

      // 2. Otherwise restore state from popstate event or parse URL
      const targetState: NavigationState = event.state || parseUrlState(defaultRepoId);
      
      // Update history stack
      if (historyStackRef.current.length > 1) {
        historyStackRef.current.pop();
      }

      isNavigatingRef.current = true;
      setNavState(targetState);
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
      pushState(next, options?.replace ?? false);
    },
    [navState, pushState]
  );

  // Intelligent Contextual Back Navigation
  const goBack = useCallback(
    (fallback?: Partial<NavigationState>) => {
      // 1. If an overlay is open, close it
      if (overlaysRef.current.size > 0) {
        const entries = Array.from(overlaysRef.current.entries());
        const [, closeLatest] = entries[entries.length - 1];
        closeLatest();
        return;
      }

      // 2. If inspecting a commit in git diffs -> close commit detail
      if (navState.commitSha) {
        navigate('explorer', { subTab: 'diffs', commitSha: null });
        return;
      }

      // 3. If inspecting an AST symbol -> close symbol detail
      if (navState.symbolName) {
        navigate('explorer', { subTab: 'ast', symbolName: null });
        return;
      }

      // 4. If in a specific subtab of explorer other than 'chat' -> return to chat or repositories
      if (navState.tab === 'explorer' && navState.subTab && navState.subTab !== 'chat') {
        navigate('explorer', { subTab: 'chat' });
        return;
      }

      // 5. If we have multiple entries in internal history stack, use browser history.back()
      if (historyStackRef.current.length > 1) {
        window.history.back();
        return;
      }

      // 6. Sensible contextual fallbacks when opened directly or no history
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
    [navState, navigate]
  );

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
    historyStackRef.current.length > 1 ||
    Boolean(navState.commitSha) ||
    Boolean(navState.symbolName) ||
    (navState.tab === 'explorer' && navState.subTab !== 'chat') ||
    navState.tab === 'settings' ||
    navState.tab === 'repositories';

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
        historyLength: historyStackRef.current.length,
        navigate,
        goBack,
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
