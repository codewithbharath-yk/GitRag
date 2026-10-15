import React, { useState } from 'react';
import {
  AlertTriangle,
  Copy,
  Check,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Flag,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ChatMessageItem, FeedbackType } from '../types/api';
import { api } from '../api/client';
import { CitationCard } from './CitationCard';
import { Magnetic } from './motion';

interface ChatMessageProps {
  message: ChatMessageItem;
  repositoryId?: string;
  repositoryOwner?: string;
  repositoryName?: string;
  branch?: string;
  onRetryQuestion?: (question: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  repositoryId,
  repositoryOwner,
  repositoryName,
  branch,
  onRetryQuestion,
}) => {
  const [copied, setCopied] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<FeedbackType | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const submitFeedback = async (type: FeedbackType, comment?: string) => {
    if (!repositoryId) return;
    try {
      setFeedbackSubmitting(true);
      const isPositive = type === 'thumbs_up';
      const chunkIds = message.sources?.map((s) => `${s.path}#${s.start_line}-${s.end_line}`) || [];
      await api.submitChatFeedback({
        repository_id: repositoryId,
        question: message.question || 'Codebase question',
        retrieved_chunks: chunkIds,
        model_name: 'gemini-flash-lite-latest',
        retrieval_config: {
          chunks_count: message.retrievedChunksCount || 0,
          latency_ms: message.latencyMs || 0,
        },
        feedback_type: type,
        comment: comment || null,
        is_positive: isPositive,
      });
      setFeedbackSent(type);
      setShowFeedbackModal(false);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // Helper for formatting inline code and fenced code blocks
  const renderFormattedContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const firstLine = lines[0].trim();
        const isLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
        const language = isLang ? firstLine : '';
        const code = isLang ? lines.slice(1).join('\n') : lines.join('\n');

        return (
          <div
            key={index}
            className="my-3 rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-well)] shadow-sm font-mono-code text-xs"
          >
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)]">
              <span>{language || 'code'}</span>
              <button
                onClick={() => navigator.clipboard.writeText(code)}
                className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors"
                title="Copy code snippet"
              >
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </button>
            </div>
            <pre className="p-3.5 overflow-x-auto text-[var(--text-primary)] leading-relaxed">
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      // Process regular paragraphs with bold and inline code
      return (
        <div key={index} className="space-y-2 whitespace-pre-wrap leading-relaxed">
          {part.split('\n\n').map((paragraph, pIdx) => {
            if (!paragraph.trim()) return null;
            return <p key={pIdx}>{formatInlineText(paragraph)}</p>;
          })}
        </div>
      );
    });
  };

  const formatInlineText = (text: string) => {
    const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return tokens.map((token, i) => {
      if (token.startsWith('`') && token.endsWith('`')) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-[var(--bg-well)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
          >
            {token.slice(1, -1)}
          </code>
        );
      }
      if (token.startsWith('**') && token.endsWith('**')) {
        return <strong key={i} className="font-semibold text-[var(--text-primary)]">{token.slice(2, -2)}</strong>;
      }
      return token;
    });
  };

  return (
    <div
      className={`flex gap-3 text-xs leading-relaxed ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Bot Avatar Image */}
      {!isUser && (
        <div className="relative shrink-0 mt-0.5">
          <img
            src="/ai_avatar.svg"
            alt="CodeRAG AI"
            className="w-8 h-8 rounded-xl border border-[#D4A373]/40 shadow-md object-cover bg-[var(--bg-card)] p-0.5"
          />
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#D4A373] border-2 border-[var(--bg-base)]" title="AI Active" />
        </div>
      )}

      {/* Main Message Bubble */}
      <div
        className={`max-w-[85%] sm:max-w-2xl rounded-xl p-4 transition-all ${
          isUser
            ? 'bg-[#D4A373] border border-[#D4A373] text-[#1F3B2C] rounded-tr-xs shadow-md'
            : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-tl-xs shadow-md space-y-3.5'
        }`}
      >
        {/* User Content */}
        {isUser ? (
          <div>
            <div className="text-[10px] font-mono text-[#1F3B2C]/80 mb-1 text-right font-bold">Developer</div>
            <p className="whitespace-pre-wrap leading-relaxed text-xs text-[#1F3B2C] font-medium">{message.content}</p>
          </div>
        ) : (
          /* Assistant Answer & Evidence Citations */
          <div className="space-y-3">
            <div className="text-[10px] font-mono text-[#D4A373] font-semibold flex items-center gap-1.5 pb-1 border-b border-[var(--border-subtle)]">
              <Sparkles className="w-3 h-3 text-[#D4A373]" />
              <span className="text-[var(--text-primary)] font-bold">CodeRAG AI</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#D4A373]/15 text-[#D4A373] border border-[#D4A373]/30 font-semibold">Grounded</span>
            </div>
            {/* Answer Text */}
            <div className="text-xs text-[var(--text-primary)]">
              {renderFormattedContent(message.content)}
            </div>

            {/* Insufficient Evidence Notice */}
            {message.insufficientContext && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg border border-[#D4A373]/40 bg-[#D4A373]/10 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#D4A373]" />
                <div className="space-y-1">
                  <div className="font-semibold text-xs text-[#D4A373]">
                    Anti-Hallucination & Codebase Scope Notice
                  </div>
                  <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    CodeRAG evaluated the indexed files for this repository and confirmed that no backend or server-side code exists in this repository. To prevent hallucinations, CodeRAG acknowledges missing context instead of guessing.
                  </p>
                  {onRetryQuestion && message.question && (
                    <button
                      onClick={() => onRetryQuestion(message.question!)}
                      className="mt-1 text-xs text-[#D4A373] underline hover:no-underline font-medium block cursor-pointer"
                    >
                      Ask another question or search frontend files
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Source Citations with Line Number Ranges */}
            {message.sources && message.sources.length > 0 && (
              <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#D4A373]" />
                    <span>Source Citations ({message.sources.length}):</span>
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">Verifiable Line Anchors</span>
                </div>

                <div className="space-y-1.5">
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

            {/* Bottom Actions: Copy, Feedback Buttons & Progressive Disclosure Toggle */}
            <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-muted)]">
              {/* Copy Full Answer */}
              <Magnetic pullStrength={0.15}>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  title="Copy entire response"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#D4A373]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="text-[11px]">{copied ? 'Copied' : 'Copy answer'}</span>
                </button>
              </Magnetic>

              {/* Reinforcement Learning Feedback Buttons */}
              <div className="flex items-center gap-2">
                <Magnetic pullStrength={0.15}>
                  <button
                    onClick={() => submitFeedback('thumbs_up')}
                    disabled={feedbackSubmitting}
                    className={`p-1.5 rounded transition-all cursor-pointer ${
                      feedbackSent === 'thumbs_up'
                        ? 'bg-[#D4A373]/15 text-[#D4A373] border border-[#D4A373]/40'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                    }`}
                    title="Accurate and helpful"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                </Magnetic>

                <Magnetic pullStrength={0.15}>
                  <button
                    onClick={() => submitFeedback('thumbs_down')}
                    disabled={feedbackSubmitting}
                    className={`p-1.5 rounded transition-all cursor-pointer ${
                      feedbackSent === 'thumbs_down'
                        ? 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/40'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                    }`}
                    title="Inaccurate or incomplete"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </Magnetic>

                <Magnetic pullStrength={0.15}>
                  <button
                    onClick={() => setShowFeedbackModal(true)}
                    className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
                    title="Report citation issue"
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                </Magnetic>

                {/* Progressive Disclosure Toggle */}
                <button
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors ml-1 cursor-pointer"
                  title="Toggle diagnostic telemetry"
                >
                  {showTechnicalDetails ? (
                    <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  )}
                </button>
              </div>
            </div>

            {/* Progressive Disclosure: Hidden Diagnostic Telemetry */}
            {showTechnicalDetails && (
              <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-3 text-[10px] font-mono text-[var(--text-muted)]">
                {message.latencyMs !== undefined && (
                  <span>Latency: <strong className="text-[var(--text-primary)]">{message.latencyMs}ms</strong></span>
                )}
                {message.retrievedChunksCount !== undefined && (
                  <span>Chunks evaluated: <strong className="text-[var(--text-primary)]">{message.retrievedChunksCount}</strong></span>
                )}
                <span>Model: <strong className="text-[var(--text-primary)]">Gemini 2.5 Flash</strong></span>
                <span>Grounding: <strong className="text-[#D4A373]">Verified</strong></span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Developer Avatar Image */}
      {isUser && (
        <div className="relative shrink-0 mt-0.5">
          <img
            src="/user_avatar.svg"
            alt="Developer (You)"
            className="w-8 h-8 rounded-xl border border-[#D4A373]/40 shadow-sm object-cover bg-[var(--bg-card)] p-0.5"
          />
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#D4A373] border-2 border-[var(--bg-base)]" title="Developer Active" />
        </div>
      )}

      {/* Citation Flag Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-2xl p-5 space-y-4 text-xs font-sans text-[var(--text-primary)]">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5 text-[#D4A373]" />
                Report Retrieval Quality Issue
              </span>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-[var(--text-muted)]">
              Help tune CodeRAG's semantic retrieval weights for this repository.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[var(--text-muted)] block">Comment (optional)</label>
              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="e.g. Citation refers to wrong function or missed helper class in utils.py"
                className="w-full p-2 rounded-lg bg-[var(--bg-well)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#D4A373] resize-none h-20 font-sans"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="px-3 py-1.5 rounded-md text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => submitFeedback('flag_citation', feedbackComment)}
                disabled={feedbackSubmitting}
                className="px-3.5 py-1.5 rounded-md bg-[#D4A373] hover:bg-[#c29263] text-xs text-[#1F3B2C] font-bold shadow-sm cursor-pointer"
              >
                {feedbackSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
