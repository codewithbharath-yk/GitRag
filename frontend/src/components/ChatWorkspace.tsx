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
import { Magnetic, Spotlight, Tilt, TextEffect } from './motion';

interface ChatWorkspaceProps {
  repository: StoredRepository | null;
  messages: ChatMessageItem[];
  isQuerying: boolean;
  onSendMessage: (question: string) => void;
  onClearHistory: () => void;
  onOpenFilesDrawer: () => void;
  onOpenConnectModal: () => void;
}

const THINKING_STAGES = [
  { step: 'Understanding', text: 'Analyzing question and intent...' },
  { step: 'Selecting', text: 'Identifying relevant candidate files from tree...' },
  { step: 'Embedding', text: 'Local BGE embedding & dense Qdrant vector retrieval...' },
  { step: 'Synthesizing', text: 'Formulating grounded answer with verifiable code citations...' },
];

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
  const [thinkingIndex, setThinkingIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isQuerying]);

  useEffect(() => {
    if (!isQuerying) return;
    const interval = setInterval(() => {
      setThinkingIndex((prev) => (prev < THINKING_STAGES.length - 1 ? prev + 1 : prev));
    }, 1800);
    return () => {
      clearInterval(interval);
      setThinkingIndex(0);
    };
  }, [isQuerying]);

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

  if (!repository) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#162623] text-[#F0F5F7]">
        <div className="max-w-md space-y-4">
          <div className="w-16 h-16 mx-auto rounded-xl bg-[#1B2D2A] border border-[#577877]/30 flex items-center justify-center text-[#F0F5F7] shadow-md">
            <FolderGit2 className="w-8 h-8 text-[#577877]" />
          </div>
          <div>
            <TextEffect as="h2" className="text-xl font-bold text-[#F0F5F7]">Connect a Repository to Start Chatting</TextEffect>
            <p className="text-xs text-[#B9CECC] mt-1.5 leading-relaxed">
              CodeRAG searches your codebase with local BGE embeddings and delivers evidence-backed answers with exact line citations.
            </p>
          </div>
          <Magnetic>
            <button
              onClick={onOpenConnectModal}
              className="px-5 py-2.5 rounded-lg bg-[#295255] hover:bg-[#34686C] text-[#F0F5F7] font-medium text-xs inline-flex items-center gap-2 border border-[#577877]/50 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4 text-[#F0F5F7]" />
              <span>Connect Repository</span>
            </button>
          </Magnetic>
        </div>
      </div>
    );
  }

  const githubUrl = `https://github.com/${repository.owner}/${repository.name}`;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#162623] text-[#F0F5F7] overflow-hidden">
      {/* Workspace Header */}
      <header className="p-3.5 px-6 border-b border-[#577877]/25 bg-[#1B2D2A] backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#577877] font-mono">Repo:</span>
              <h2 className="text-sm font-bold text-[#F0F5F7] font-mono truncate">
                {repository.fullName}
              </h2>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-[#1E3430] text-[#6DBE9B] border border-[#6DBE9B]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6DBE9B] animate-pulse" />
                <span>Connected</span>
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-[#162623] text-[#B9CECC] border border-[#577877]/30">
                <GitBranch className="w-3 h-3 text-[#577877]" />
                {repository.branch}
              </span>
              {repository.language && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#162623] text-[#B9CECC] border border-[#577877]/30 hidden sm:inline-block">
                  {repository.language}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[#577877] font-mono mt-0.5">
              <span>{repository.filesCount} files</span>
              <span>•</span>
              <span className="text-[#B9CECC]">{repository.chunksCount} chunks indexed</span>
              {repoStarsText(repository.stars)}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Magnetic pullStrength={0.15}>
            <button
              onClick={onOpenFilesDrawer}
              title="Inspect repository file tree"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#162623] hover:bg-[#1E3430] text-[#B9CECC] hover:text-[#F0F5F7] border border-[#577877]/30 text-xs transition-colors"
            >
              <Files className="w-3.5 h-3.5 text-[#577877]" />
              <span className="hidden sm:inline">Files</span>
            </button>
          </Magnetic>

          <Magnetic pullStrength={0.15}>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open on GitHub"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#162623] hover:bg-[#1E3430] text-[#B9CECC] hover:text-[#F0F5F7] border border-[#577877]/30 text-xs transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#577877]" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </Magnetic>

          {messages.length > 0 && (
            <Magnetic pullStrength={0.15}>
              <button
                onClick={onClearHistory}
                title="Clear conversation"
                className="p-1.5 rounded-lg text-[#577877] hover:text-[#D96B6B] hover:bg-[#1E3430] transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Magnetic>
          )}
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="max-w-3xl mx-auto py-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-3 p-2 px-4 rounded-2xl bg-[#1B2D2A] border border-white/20 mb-1 shadow-md">
                <div className="relative">
                  <img
                    src="/user_avatar.svg"
                    alt="Developer"
                    className="w-8 h-8 rounded-xl border border-white/50 bg-[#162623] p-0.5 object-cover shadow-xs"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#6DBE9B] border-2 border-[#1B2D2A]" title="Developer" />
                </div>
                <div className="flex items-center gap-1.5 text-white/60 font-mono text-xs">
                  <span>⇄</span>
                  <Sparkles className="w-3.5 h-3.5 text-[#6DBE9B]" />
                </div>
                <div className="relative">
                  <img
                    src="/ai_avatar.svg"
                    alt="CodeRAG AI"
                    className="w-8 h-8 rounded-xl border border-[#6DBE9B]/70 bg-[#162623] p-0.5 object-cover shadow-xs"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#6DBE9B] border-2 border-[#1B2D2A]" title="AI Online" />
                </div>
              </div>
              <TextEffect as="h3" className="text-base sm:text-lg font-bold text-white tracking-tight">
                {`Pair Program with CodeRAG on ${repository.fullName}`}
              </TextEffect>
              <p className="text-xs text-[#B9CECC] max-w-md mx-auto leading-relaxed">
                Answers are synthesized strictly from retrieved source files. Citations provide verifiable file locations and line ranges.
              </p>
            </div>

            {/* Suggested Prompts Cards with Tilt & Spotlight */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  title: 'Architecture Overview',
                  prompt: 'What are the main modules in this repository and how are they organized?',
                },
                {
                  title: 'Core Implementation',
                  prompt: 'Where is the main entry point and what does the primary execution flow look like?',
                },
                {
                  title: 'Key Interfaces & Types',
                  prompt: 'What are the central data models, types, or schemas defined in this codebase?',
                },
                {
                  title: 'Developer Onboarding',
                  prompt: 'Explain this codebase to an engineer newly assigned to the project.',
                },
              ].map((card, idx) => (
                <Tilt key={idx} maxAngle={4} className="h-full">
                  <Spotlight variant="teal" className="h-full rounded-xl">
                    <button
                      onClick={() => handlePromptCardClick(card.prompt)}
                      className="w-full h-full p-3.5 text-left rounded-xl border border-[#577877]/30 bg-[#1B2D2A] hover:bg-[#213834] hover:border-[#577877]/60 transition-all group card-hover-teal"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-[#B9CECC] group-hover:text-[#F0F5F7] transition-colors">
                          {card.title}
                        </span>
                        <HelpCircle className="w-3.5 h-3.5 text-[#577877] group-hover:text-[#B9CECC]" />
                      </div>
                      <p className="text-xs text-[#577877] line-clamp-2">{card.prompt}</p>
                    </button>
                  </Spotlight>
                </Tilt>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                repositoryId={repository.id}
                repositoryOwner={repository.owner}
                repositoryName={repository.name}
                branch={repository.branch}
                onRetryQuestion={onSendMessage}
              />
            ))}

            {/* Multi-Stage Thinking Animation with AI Avatar */}
            {isQuerying && (
              <div className="p-4 rounded-xl bg-[#1B2D2A] border border-[#6DBE9B]/40 shadow-lg flex items-center gap-3.5 animate-in fade-in duration-200">
                <div className="relative shrink-0">
                  <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-[#6DBE9B] to-[#295255] opacity-75 blur-xs animate-pulse" />
                  <img
                    src="/ai_avatar.svg"
                    alt="CodeRAG AI Answering"
                    className="relative w-10 h-10 rounded-xl border-2 border-white object-cover bg-[#162623] p-0.5"
                  />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-[#6DBE9B] border-2 border-[#162623] flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#6DBE9B]" />
                        CodeRAG AI Answering...
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white border border-white/20">
                        Stage {thinkingIndex + 1}/4
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-mono text-[#6DBE9B]">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6DBE9B]" />
                      <span>{THINKING_STAGES[thinkingIndex].step}</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#B9CECC]">
                    {THINKING_STAGES[thinkingIndex].text}
                  </p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Bar Area */}
      <div className="p-4 bg-[#1B2D2A] border-t border-[#577877]/25 shrink-0">
        <div className="max-w-4xl mx-auto">
          <Spotlight variant="subtle" className="rounded-xl">
            <form
              onSubmit={handleSubmit}
              className="flex items-end gap-2 p-1.5 rounded-xl bg-[#111E1C] border border-[#577877]/40 focus-within:border-[#295255] focus-within:ring-2 focus-within:ring-[#295255]/40 transition-all shadow-inner"
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isQuerying}
                placeholder="Ask a question about this repository... (Enter to send, Shift+Enter for newline)"
                className="flex-1 bg-transparent border-none text-xs text-[#F0F5F7] placeholder-[#577877] focus:outline-none p-2 resize-none max-h-32 min-h-[38px] leading-relaxed"
              />
              <Magnetic>
                <button
                  type="submit"
                  disabled={!input.trim() || isQuerying}
                  className="px-3.5 py-2 rounded-lg bg-[#295255] hover:bg-[#34686C] disabled:bg-[#1E3430] text-[#F0F5F7] font-medium text-xs flex items-center gap-1.5 border border-[#577877]/40 disabled:opacity-40 transition-all shadow-sm active:scale-[0.98]"
                >
                  {isQuerying ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Send</span>
                </button>
              </Magnetic>
            </form>
          </Spotlight>
          <div className="mt-2 text-center text-[11px] text-[#577877] font-mono">
            Grounding: strictly retrieved chunks • Model: Gemini 2.5 Flash
          </div>
        </div>
      </div>
    </div>
  );
};

function repoStarsText(stars?: number) {
  if (!stars) return null;
  return (
    <>
      <span>•</span>
      <span className="flex items-center gap-1 text-[#D9A066]">
        <Star className="w-3 h-3 fill-[#D9A066]/20" />
        {stars} stars
      </span>
    </>
  );
}
