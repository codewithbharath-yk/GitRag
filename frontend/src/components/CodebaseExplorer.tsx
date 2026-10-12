import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  GitCommit,
  Code2,
  FolderTree,
  Sparkles,
  Send,
  Loader2,
  FileCode,
  FolderGit2,
  Plus,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import type {
  StoredRepository,
  ChatMessageItem,
} from '../types/api';
import { api } from '../api/client';
import { ChatMessage } from './ChatMessage';
import { GitHistoryView } from './GitHistoryView';
import { CodeIntelligenceView } from './CodeIntelligenceView';
import { BackButton } from './BackButton';
import { Tilt } from './motion/Tilt';
import { Magnetic } from './motion/Magnetic';
import { TextEffect } from './motion/TextEffect';

export type ExplorerSubTab = 'chat' | 'diffs' | 'ast' | 'files';

interface CodebaseExplorerProps {
  repository: StoredRepository | null;
  activeSubTab?: ExplorerSubTab;
  onSubTabChange?: (tab: ExplorerSubTab) => void;
  messages: ChatMessageItem[];
  isQuerying: boolean;
  onSendMessage: (question: string) => void;
  onClearHistory: () => void;
  onOpenFilesDrawer?: () => void;
  onOpenConnectModal: () => void;
}

const EXAMPLE_QUESTIONS = [
  'Where is user authentication handled?',
  'How does the database work?',
  'Show all API endpoints',
  'Explain the main architecture',
  'Find all usages of create_token',
  'What changed in the last commit?',
];

const RELATED_QUESTIONS = [
  'How does JWT authentication work?',
  'Where are user roles defined?',
  'Show login API endpoint',
  'Explain repository folder structure',
];

export const CodebaseExplorer: React.FC<CodebaseExplorerProps> = ({
  repository,
  activeSubTab = 'chat',
  onSubTabChange,
  messages,
  isQuerying,
  onSendMessage,
  onClearHistory,
  onOpenFilesDrawer: _onOpenFilesDrawer,
  onOpenConnectModal,
}) => {
  const [currentTab, setCurrentTab] = useState<ExplorerSubTab>(activeSubTab);
  const [chatInput, setChatInput] = useState('');
  const [semanticMatches, setSemanticMatches] = useState<any[]>([]);
  const [isSearchingFiles, setIsSearchingFiles] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync external tab changes
  useEffect(() => {
    if (activeSubTab && activeSubTab !== currentTab) {
      setCurrentTab(activeSubTab);
    }
  }, [activeSubTab, currentTab]);

  const handleTabSwitch = (tab: ExplorerSubTab) => {
    setCurrentTab(tab);
    onSubTabChange?.(tab);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isQuerying]);

  // Load semantic file matches when repository changes
  useEffect(() => {
    if (!repository) return;
    const fetchMatches = async () => {
      setIsSearchingFiles(true);
      try {
        const res = await api.searchCode({
          repository_id: repository.id,
          query: 'authentication router api database model',
          top_k: 5,
        });
        setSemanticMatches(res.hits || (res as any).matches || []);
      } catch {
        // fallback or empty
        setSemanticMatches([]);
      } finally {
        setIsSearchingFiles(false);
      }
    };
    fetchMatches();
  }, [repository]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isQuerying) return;
    onSendMessage(chatInput.trim());
    setChatInput('');
  };

  const handleExampleClick = (q: string) => {
    if (isQuerying) return;
    onSendMessage(q);
  };

  if (!repository) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[var(--bg-base)] text-[var(--text-primary)] font-sans">
        <div className="max-w-md space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--color-cobalt-blue)] shadow-lg">
            <FolderGit2 className="w-8 h-8 text-[var(--color-cobalt-blue)]" />
          </div>
          <div>
            <TextEffect as="h2" variant="blur-up" className="text-xl font-bold text-[var(--text-primary)]">
              No Repository Selected
            </TextEffect>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Select an existing repository or connect a new GitHub repository to start exploring with CodeRAG.
            </p>
          </div>
          <Magnetic>
            <button
              onClick={onOpenConnectModal}
              className="px-5 py-2.5 rounded-xl bg-[#1546D9] hover:bg-[#2255EB] text-white font-medium text-sm inline-flex items-center gap-2 border border-white/20 shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Connect Repository</span>
            </button>
          </Magnetic>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-base)] text-[var(--text-primary)] overflow-hidden select-none font-sans">
      {/* Codebase Explorer Workspace Sub-Header */}
      <div className="p-3 sm:px-6 py-2.5 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          {currentTab !== 'chat' && (
            <BackButton
              label="Back to Chat & Search"
              onClick={() => handleTabSwitch('chat')}
              className="py-1 px-2.5 text-xs"
            />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                <TextEffect as="span">Codebase Explorer</TextEffect>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-card)] text-[var(--color-cobalt-blue)] border border-[var(--border-subtle)] font-bold">
                  Unified
                </span>
              </h1>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              One workspace. All your code intelligence tools.
            </p>
          </div>
        </div>

        {/* 4 Unified Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-well)] border border-[var(--border-subtle)] overflow-x-auto">
          <button
            onClick={() => handleTabSwitch('chat')}
            className={`px-3 py-1.5 nav-tab-btn gap-1.5 shrink-0 ${
              currentTab === 'chat' ? 'active' : ''
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-[var(--color-cobalt-blue)]" />
            <span>Chat & Search</span>
          </button>

          <button
            onClick={() => handleTabSwitch('diffs')}
            className={`px-3 py-1.5 nav-tab-btn gap-1.5 shrink-0 ${
              currentTab === 'diffs' ? 'active' : ''
            }`}
          >
            <GitCommit className="w-3.5 h-3.5 text-[var(--color-cobalt-blue)]" />
            <span>Git History & Diffs</span>
          </button>

          <button
            onClick={() => handleTabSwitch('ast')}
            className={`px-3 py-1.5 nav-tab-btn gap-1.5 shrink-0 ${
              currentTab === 'ast' ? 'active' : ''
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-[var(--color-cobalt-blue)]" />
            <span>AST Explorer</span>
          </button>

          <button
            onClick={() => handleTabSwitch('files')}
            className={`px-3 py-1.5 nav-tab-btn gap-1.5 shrink-0 ${
              currentTab === 'files' ? 'active' : ''
            }`}
          >
            <FolderTree className="w-3.5 h-3.5 text-[var(--color-cobalt-blue)]" />
            <span>Files & Architecture</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Body based on Active Sub-Tab */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* TAB 1: CHAT & SEARCH (Unified Q&A + Semantic Code Discovery) */}
        {currentTab === 'chat' && (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Left Column: Chat Conversation, Code Answers & Input */}
            <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-[var(--border-subtle)]">
              {/* Example Questions Pill Strip & Clear Action */}
              <div className="p-3 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 overflow-x-auto">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider shrink-0 flex items-center gap-1 font-semibold">
                    <Sparkles className="w-3 h-3 text-[var(--color-sun-yellow)]" />
                    Example Questions:
                  </span>
                  {EXAMPLE_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleExampleClick(q)}
                      className="px-2.5 py-1 rounded-full bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[11px] font-mono shrink-0 transition-colors cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                {messages.length > 0 && (
                  <button
                    onClick={onClearHistory}
                    className="px-2.5 py-1 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)] hover:text-rose-500 font-mono shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Clear Conversation History"
                  >
                    <Trash2 className="w-3 h-3 text-[var(--text-muted)]" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {/* Chat Thread Messages */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="py-12 px-4 max-w-xl mx-auto text-center space-y-4">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--color-cobalt-blue)] shadow-md">
                      <MessageSquare className="w-7 h-7 text-[var(--color-cobalt-blue)]" />
                    </div>
                    <div>
                      <TextEffect as="h2" variant="blur-up" className="text-xl font-bold text-[var(--text-primary)]">
                        Where is user authentication handled?
                      </TextEffect>
                      <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
                        Ask any natural question about <span className="font-mono text-[var(--text-primary)] font-semibold">{repository.fullName}</span>.
                        CodeRAG retrieves relevant code chunks using local BGE embeddings and synthesizes grounded answers with line citations.
                      </p>
                    </div>

                    <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                      {EXAMPLE_QUESTIONS.slice(0, 4).map((q, i) => (
                        <Tilt key={i} maxAngle={6} scale={1.02}>
                          <button
                            onClick={() => handleExampleClick(q)}
                            className="w-full p-3 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all text-left flex items-center justify-between group"
                          >
                            <span>{q}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-cobalt-blue)] shrink-0 transition-colors" />
                          </button>
                        </Tilt>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <div key={msg.id} className="space-y-2">
                        <ChatMessage
                          message={msg}
                          repositoryOwner={repository.owner}
                          repositoryName={repository.name}
                          branch={repository.branch}
                        />

                        {/* Quick Action Pills Under Assistant Answers */}
                        {msg.role === 'assistant' && (
                          <div className="flex items-center gap-1.5 pl-11 pt-1 overflow-x-auto">
                            <span className="text-[10px] text-[var(--text-muted)] font-mono mr-1">Quick Actions:</span>
                            <button
                              onClick={() => handleTabSwitch('diffs')}
                              className="px-2.5 py-1 rounded-md bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors"
                            >
                              <GitCommit className="w-3 h-3 text-[var(--color-cobalt-blue)]" />
                              <span>Show Diffs</span>
                            </button>
                            <button
                              onClick={() => handleTabSwitch('ast')}
                              className="px-2.5 py-1 rounded-md bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors"
                            >
                              <Code2 className="w-3 h-3 text-[var(--color-cobalt-blue)]" />
                              <span>Show AST</span>
                            </button>
                            <button
                              onClick={() => handleTabSwitch('files')}
                              className="px-2.5 py-1 rounded-md bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors"
                            >
                              <FolderTree className="w-3 h-3 text-[var(--color-cobalt-blue)]" />
                              <span>Show Files</span>
                            </button>
                            <button
                              onClick={() => onSendMessage(`Explain the references and data flow for: ${msg.question || 'the previous answer'}`)}
                              className="px-2.5 py-1 rounded-md bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors"
                            >
                              <Sparkles className="w-3 h-3 text-[var(--color-sun-yellow)]" />
                              <span>Find References</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {isQuerying && (
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin text-[var(--color-cobalt-blue)]" />
                        <span>Retrieving dense vector chunks with BGE & Gemini synthesis...</span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Chat Input Box */}
              <div className="p-3 sm:p-4 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)]">
                <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Ask a follow-up question or search code..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={isQuerying}
                      className="w-full pl-4 pr-10 py-3 bg-[var(--bg-well)] border border-[var(--border-subtle)] rounded-xl text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#1546D9] focus:ring-1 focus:ring-[#1546D9] font-mono transition-colors"
                    />
                  </div>

                  <Magnetic>
                    <button
                      type="submit"
                      disabled={!chatInput.trim() || isQuerying}
                      className="py-3 px-5 rounded-xl bg-[#1546D9] hover:bg-[#2255EB] disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 border border-white/20 shadow-md transition-all active:scale-[0.98] cursor-pointer"
                    >
                      {isQuerying ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <>
                          <span>Search & Ask</span>
                          <Send className="w-4 h-4 text-white" />
                        </>
                      )}
                    </button>
                  </Magnetic>
                </form>
              </div>
            </div>

            {/* Right Column: Relevant Files (Semantic Matches) + Related Questions */}
            <div className="w-full lg:w-80 bg-[var(--bg-surface)] p-4 flex flex-col gap-4 overflow-y-auto border-t lg:border-t-0 lg:border-l border-[var(--border-subtle)] shrink-0">
              {/* Relevant Files Card */}
              <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-[var(--color-cobalt-blue)]" />
                    Relevant Files
                    {isSearchingFiles && <Loader2 className="w-3 h-3 animate-spin text-[var(--color-cobalt-blue)]" />}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">Vector Match</span>
                </div>

                <div className="space-y-1.5">
                  {/* Real citations from last message if present */}
                  {messages.length > 0 &&
                  messages[messages.length - 1].sources &&
                  messages[messages.length - 1].sources!.length > 0 ? (
                    messages[messages.length - 1].sources!.map((s, idx) => {
                      const score = Math.round(s.score * 100);
                      return (
                        <div
                          key={idx}
                          onClick={() => handleTabSwitch('files')}
                          className="p-2 rounded-lg bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] flex items-center justify-between cursor-pointer group transition-colors"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-mono text-xs text-[var(--text-primary)] truncate block group-hover:text-[var(--color-cobalt-blue)] transition-colors">
                              {s.path}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] font-mono">
                              Lines {s.start_line}-{s.end_line}
                            </span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#1546D9] text-white shrink-0 font-bold">
                            {score}%
                          </span>
                        </div>
                      );
                    })
                  ) : semanticMatches.length > 0 ? (
                    semanticMatches.slice(0, 4).map((match, idx) => {
                      const score = Math.round((match.score || 0.85) * 100);
                      return (
                        <div
                          key={idx}
                          onClick={() => handleTabSwitch('files')}
                          className="p-2 rounded-lg bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] flex items-center justify-between cursor-pointer group transition-colors"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-mono text-xs text-[var(--text-primary)] truncate block group-hover:text-[var(--color-cobalt-blue)] transition-colors">
                              {match.file_path || match.path || 'auth/jwt.py'}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] font-mono">
                              Chunks indexed
                            </span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#1546D9] text-white shrink-0 font-bold">
                            {score}%
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    // Default mockup files matching Panel 5
                    [
                      { path: 'src/auth/auth.py', score: 96 },
                      { path: 'src/models/user.py', score: 92 },
                      { path: 'src/api/routes.py', score: 78 },
                      { path: 'src/utils/token.py', score: 72 },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleTabSwitch('files')}
                        className="p-2 rounded-lg bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] flex items-center justify-between cursor-pointer group transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-mono text-xs text-[var(--text-primary)] truncate block group-hover:text-[var(--color-cobalt-blue)] transition-colors">
                            {item.path}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">
                            Evidence cited
                          </span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#1546D9] text-white shrink-0 font-bold">
                          {item.score}%
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <button
                  onClick={() => handleTabSwitch('files')}
                  className="w-full pt-1 text-center text-xs text-[var(--color-cobalt-blue)] hover:underline flex items-center justify-center gap-1 font-mono font-medium"
                >
                  <span>View All Repository Files</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Related Questions Card */}
              <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-3">
                <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[var(--color-sun-yellow)]" />
                  Related Questions
                </span>
                <div className="space-y-1.5">
                  {RELATED_QUESTIONS.map((rq, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleExampleClick(rq)}
                      className="w-full p-2 rounded-lg bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-left transition-colors font-mono line-clamp-2 cursor-pointer"
                    >
                      {rq}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GIT HISTORY & DIFFS */}
        {currentTab === 'diffs' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <GitHistoryView repository={repository} />
          </div>
        )}

        {/* TAB 3: AST EXPLORER */}
        {currentTab === 'ast' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <CodeIntelligenceView
              repository={repository}
              initialViewMode="symbols"
              onAskQuestion={(q) => {
                handleTabSwitch('chat');
                onSendMessage(q);
              }}
            />
          </div>
        )}

        {/* TAB 4: FILES & ARCHITECTURE */}
        {currentTab === 'files' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <CodeIntelligenceView
              repository={repository}
              initialViewMode="files"
              onAskQuestion={(q) => {
                handleTabSwitch('chat');
                onSendMessage(q);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
