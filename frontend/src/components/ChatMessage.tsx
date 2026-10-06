import React, { useState } from 'react';
import { Bot, User, AlertTriangle, Clock, Layers, Copy, Check, Sparkles } from 'lucide-react';
import type { ChatMessageItem } from '../types/api';
import { CitationCard } from './CitationCard';

interface ChatMessageProps {
  message: ChatMessageItem;
  repositoryOwner?: string;
  repositoryName?: string;
  branch?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  repositoryOwner,
  repositoryName,
  branch,
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to format assistant answers with basic Markdown handling (bold, code blocks, bullet points)
  const renderFormattedContent = (content: string) => {
    // Split by code blocks first
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          value: content.slice(lastIndex, match.index),
        });
      }
      parts.push({
        type: 'code',
        lang: match[1] || 'text',
        value: match[2].trim(),
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        value: content.slice(lastIndex),
      });
    }

    return (
      <div className="space-y-3 leading-relaxed text-sm text-slate-200">
        {parts.map((part, idx) => {
          if (part.type === 'code') {
            return (
              <div
                key={idx}
                className="my-3 rounded-lg overflow-hidden border border-slate-700/80 bg-slate-950 font-mono text-xs"
              >
                {part.lang && (
                  <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span className="uppercase tracking-wider">{part.lang}</span>
                  </div>
                )}
                <pre className="p-3.5 overflow-x-auto text-emerald-300 leading-normal">
                  <code>{part.value}</code>
                </pre>
              </div>
            );
          }

          // Format paragraph text (handles newlines, bullet lists, inline code)
          const paragraphs = part.value.split('\n\n');
          return (
            <div key={idx} className="space-y-2">
              {paragraphs.map((p, pIdx) => {
                if (p.trim().startsWith('* ') || p.trim().startsWith('- ')) {
                  const listItems = p.split('\n').filter((l) => l.trim().length > 0);
                  return (
                    <ul key={pIdx} className="list-disc list-inside space-y-1 pl-1 text-slate-300">
                      {listItems.map((item, iIdx) => (
                        <li key={iIdx} className="leading-relaxed">
                          {renderInlineStyles(item.replace(/^[-*]\s+/, ''))}
                        </li>
                      ))}
                    </ul>
                  );
                }

                return (
                  <p key={pIdx} className="leading-relaxed">
                    {renderInlineStyles(p)}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // Helper for inline backticks and bold text
  const renderInlineStyles = (text: string) => {
    const inlineRegex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
    const parts = text.split(inlineRegex);

    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-800 text-blue-300 font-mono text-xs border border-slate-700/60"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-slate-100">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div
      className={`py-4 px-4 sm:px-6 transition-colors ${
        isUser
          ? 'bg-slate-900/40 border-b border-slate-800/40'
          : 'bg-slate-900/80 border-b border-slate-800/80 shadow-sm'
      }`}
    >
      <div className="max-w-4xl mx-auto flex gap-4">
        {/* Avatar */}
        <div className="shrink-0 mt-0.5">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <User className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-sm shadow-indigo-500/10">
              <Bot className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-xs text-slate-300">
              {isUser ? 'You' : 'CodeRAG Assistant'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-mono">{message.timestamp}</span>
              {!isUser && (
                <button
                  onClick={handleCopy}
                  title="Copy response"
                  className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          {/* Main Message Text */}
          {isUser ? (
            <div className="text-slate-100 text-sm whitespace-pre-wrap font-medium">
              {message.content}
            </div>
          ) : (
            <div>{renderFormattedContent(message.content)}</div>
          )}

          {/* Insufficient Evidence Notice */}
          {message.insufficientContext && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <strong className="font-semibold block text-amber-200">Insufficient Code Evidence</strong>
                The system did not find adequate evidence in the indexed repository files to guarantee a factual answer. To prevent hallucinations, CodeRAG acknowledges missing context rather than inventing details.
              </div>
            </div>
          )}

          {/* Source Citations */}
          {message.sources && message.sources.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Verified Source Evidence ({message.sources.length} chunks):</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {message.sources.map((citation, cIdx) => (
                  <CitationCard
                    key={cIdx}
                    citation={citation}
                    repositoryOwner={repositoryOwner}
                    repositoryName={repositoryName}
                    branch={branch}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Latency and Retrieved Chunks Meta */}
          {!isUser && (message.latencyMs !== undefined || message.retrievedChunksCount !== undefined) && (
            <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500 font-mono">
              {message.latencyMs !== undefined && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {(message.latencyMs / 1000).toFixed(2)}s
                </span>
              )}
              {message.retrievedChunksCount !== undefined && (
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  {message.retrievedChunksCount} chunks retrieved
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
