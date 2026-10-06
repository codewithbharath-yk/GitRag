import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Loader2,
  Trash2,
  Files,
  ExternalLink,
  GitBranch,
  Star,
  Sparkles,
  HelpCircle,
  FolderGit2,
  Plus,
} from 'lucide-react';
import type { ChatMessageItem, StoredRepository } from '../types/api';
import { ChatMessage } from './ChatMessage';

interface ChatWorkspaceProps {
  repository: StoredRepository | null;
  messages: ChatMessageItem[];
  isQuerying: boolean;
  onSendMessage: (question: string) => void;
  onClearHistory: () => void;
  onOpenFilesDrawer: () => void;
  onOpenConnectModal: () => void;
}

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  repository,
  messages,
  isQuerying,
  onSendMessage,
  onClearHistory,
  onOpenFilesDrawer,
  onOpenConnectModal,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isQuerying]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isQuerying || !repository) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handlePromptCardClick = (prompt: string) => {
    if (isQuerying || !repository) return;
    onSendMessage(prompt);
  };

  // If no repository is active yet
  if (!repository) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950">
        <div className="max-w-md space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-xl shadow-blue-500/10">
            <FolderGit2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Welcome to CodeRAG</h2>
            <p className="text-sm text-slate-400 mt-1">
              Connect a GitHub repository to index its source code into Qdrant and ask evidence-grounded questions using Gemini.
            </p>
          </div>
          <button
            onClick={onOpenConnectModal}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm inline-flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Connect a Repository</span>
          </button>
        </div>
      </div>
    );
  }

  const githubUrl = `https://github.com/${repository.owner}/${repository.name}`;

  return (
    <div className="flex-1 flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* Workspace Header */}
      <header className="p-3.5 px-6 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100 font-mono truncate">
                {repository.fullName}
              </h2>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                <GitBranch className="w-3 h-3 text-slate-400" />
                {repository.branch}
              </span>
              {repository.language && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-blue-500/15 text-blue-300 border border-blue-500/30 hidden sm:inline-block">
                  {repository.language}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5">
              <span>{repository.filesCount} files</span>
              <span>•</span>
              <span className="text-indigo-400">{repository.chunksCount} chunks in Qdrant</span>
              {repository.stars > 0 && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-amber-400">
                    <Star className="w-3 h-3 fill-amber-400/20" />
                    {repository.stars}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenFilesDrawer}
            title="Inspect indexed source files"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs transition-colors"
          >
            <Files className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Source Files</span>
          </button>

          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open repository on GitHub"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">GitHub</span>
          </a>

          {messages.length > 0 && (
            <button
              onClick={onClearHistory}
              title="Clear chat history"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-900 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          /* Empty State with Prompt Suggestions */
          <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">
                Ask anything about <code className="text-blue-300 font-mono">{repository.fullName}</code>
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Questions are answered using exact source code retrieved from the repository index. Citations include verifiable file paths and line ranges.
              </p>
            </div>

            {/* Suggested Prompts Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  title: 'Architecture & Overview',
                  prompt: 'What is the purpose of this project according to its README and files?',
                },
                {
                  title: 'Core Implementation',
                  prompt: 'Which functions or components handle the main logic and what do they do?',
                },
                {
                  title: 'HTML, CSS & UI Structure',
                  prompt: 'What HTML elements, styling rules, or UI components are defined?',
                },
                {
                  title: 'Onboarding Summary',
                  prompt: 'Explain this codebase to a new developer joining the team.',
                },
              ].map((card, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePromptCardClick(card.prompt)}
                  className="p-3.5 text-left rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900 hover:border-blue-500/40 transition-all group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-200 group-hover:text-blue-300 transition-colors">
                      {card.title}
                    </span>
                    <HelpCircle className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400" />
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">{card.prompt}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Render Conversation Messages */
          <div className="divide-y divide-slate-850">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                repositoryOwner={repository.owner}
                repositoryName={repository.name}
                branch={repository.branch}
              />
            ))}

            {/* Streaming / Loading Indicator */}
            {isQuerying && (
              <div className="py-5 px-4 sm:px-6 bg-slate-900/60 border-b border-slate-800">
                <div className="max-w-4xl mx-auto flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  </div>
                  <div className="flex-1 space-y-1.5 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs text-slate-300">CodeRAG Assistant</span>
                      <span className="text-[11px] text-indigo-400 font-mono">Retrieving evidence...</span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono animate-pulse">
                      Searching Qdrant vector space and synthesizing code evidence with Gemini 2.5 Flash...
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Input Form */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/90 backdrop-blur-md shrink-0">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask a question about ${repository.name}... (e.g. Where is authentication handled?)`}
              disabled={isQuerying}
              className="w-full px-4 py-3 pr-14 bg-slate-900 border border-slate-700/80 rounded-2xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/80 resize-none disabled:opacity-50 transition-colors shadow-inner"
            />
            <button
              type="submit"
              disabled={!input.trim() || isQuerying}
              className="absolute right-3 bottom-3.5 p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-30 disabled:hover:bg-blue-600 transition-colors shadow-md shadow-blue-600/20"
            >
              {isQuerying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>

          <div className="flex items-center justify-between mt-2 px-2 text-[11px] text-slate-500">
            <span>
              Press <kbd className="px-1 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px]">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px]">Shift + Enter</kbd> for new line
            </span>
            <span>Evidence grounded with Google Gemini</span>
          </div>
        </div>
      </div>
    </div>
  );
};
