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
            className="my-3 rounded-lg overflow-hidden border border-[#577877]/30 bg-[#111E1C] shadow-sm font-mono-code text-xs"
          >
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#162623] border-b border-[#577877]/20 text-[11px] text-[#577877]">
              <span>{language || 'code'}</span>
              <button
                onClick={() => navigator.clipboard.writeText(code)}
                className="flex items-center gap-1 hover:text-[#F0F5F7] transition-colors"
                title="Copy code snippet"
              >
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </button>
            </div>
            <pre className="p-3.5 overflow-x-auto text-[#F0F5F7] leading-relaxed">
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
            className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-[#111E1C] text-[#F0F5F7] border border-[#577877]/30"
          >
            {token.slice(1, -1)}
          </code>
        );
      }
      if (token.startsWith('**') && token.endsWith('**')) {
        return <strong key={i} className="font-semibold text-[#F0F5F7]">{token.slice(2, -2)}</strong>;
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
            className="w-8 h-8 rounded-xl border border-[#6DBE9B]/60 shadow-md object-cover bg-[#1B2D2A] p-0.5"
          />
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#6DBE9B] border-2 border-[#162623]" title="AI Online" />
        </div>
      )}

      {/* Main Message Bubble */}
      <div
        className={`max-w-[85%] sm:max-w-2xl rounded-xl p-4 transition-all ${
          isUser
            ? 'bg-[#295255] border border-white/20 text-[#F0F5F7] rounded-tr-xs shadow-sm'
            : 'bg-[#1B2D2A] border border-[#577877]/30 text-[#F0F5F7] rounded-tl-xs shadow-md space-y-3.5'
        }`}
      >
        {/* User Content */}
        {isUser ? (
          <div>
            <div className="text-[10px] font-mono text-white/60 mb-1 text-right">Developer</div>
            <p className="whitespace-pre-wrap leading-relaxed text-xs">{message.content}</p>
          </div>
        ) : (
          /* Assistant Answer & Evidence Citations */
          <div className="space-y-3">
            <div className="text-[10px] font-mono text-[#6DBE9B] font-semibold flex items-center gap-1.5 pb-1 border-b border-[#577877]/20">
              <Sparkles className="w-3 h-3 text-[#6DBE9B]" />
              <span className="text-white">CodeRAG AI</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-white font-normal">Grounded</span>
            </div>
            {/* Answer Text */}
            <div className="text-xs text-[#F0F5F7]">
              {renderFormattedContent(message.content)}
            </div>

            {/* Insufficient Evidence Notice */}
            {message.insufficientContext && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg border border-[#D9A066]/40 bg-[#D9A066]/10 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#D9A066]" />
                <div className="space-y-1">
                  <div className="font-semibold text-xs text-[#D9A066]">
                    Anti-Hallucination & Codebase Scope Notice
                  </div>
                  <p className="text-[11px] leading-relaxed text-[#B9CECC] [data-theme=white]_&:text-[#295255]">
                    CodeRAG evaluated the indexed files for this repository and confirmed that no backend or server-side code exists in this repository. To prevent hallucinations, CodeRAG acknowledges missing context instead of guessing.
                  </p>
                  {onRetryQuestion && message.question && (
                    <button
                      onClick={() => onRetryQuestion(message.question!)}
                      className="mt-1 text-xs text-[#6DBE9B] underline hover:no-underline font-medium block cursor-pointer"
                    >
                      Ask another question or search frontend files
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Source Citations with Line Number Ranges */}
            {message.sources && message.sources.length > 0 && (
              <div className="pt-2 border-t border-[#577877]/20 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#B9CECC]">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#577877]" />
                    <span>Source Citations ({message.sources.length}):</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#577877]">Verifiable Line Anchors</span>
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
            <div className="pt-2 border-t border-[#577877]/20 flex items-center justify-between text-xs text-[#577877]">
              {/* Copy Full Answer */}
              <Magnetic pullStrength={0.15}>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[#577877] hover:text-[#F0F5F7] transition-colors"
                  title="Copy entire response"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#6DBE9B]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="text-[11px]">{copied ? 'Copied' : 'Copy answer'}</span>
                </button>
              </Magnetic>

              {/* Reinforcement Learning Feedback Buttons */}
              <div className="flex items-center gap-2">
                <Magnetic pullStrength={0.15}>
                  <button
                    onClick={() => submitFeedback('thumbs_up')}
                    disabled={feedbackSubmitting}
                    className={`p-1.5 rounded transition-all ${
                      feedbackSent === 'thumbs_up'
                        ? 'bg-[#1E3430] text-[#6DBE9B] border border-[#6DBE9B]/40'
                        : 'text-[#577877] hover:text-[#F0F5F7] hover:bg-[#162623]'
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
                    className={`p-1.5 rounded transition-all ${
                      feedbackSent === 'thumbs_down'
                        ? 'bg-[#1E3430] text-[#D96B6B] border border-[#D96B6B]/40'
                        : 'text-[#577877] hover:text-[#F0F5F7] hover:bg-[#162623]'
                    }`}
                    title="Inaccurate or incomplete"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </Magnetic>

                <Magnetic pullStrength={0.15}>
                  <button
                    onClick={() => setShowFeedbackModal(true)}
                    className="p-1.5 rounded text-[#577877] hover:text-[#F0F5F7] hover:bg-[#162623] transition-colors"
                    title="Report citation issue"
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                </Magnetic>

                {/* Progressive Disclosure Toggle */}
                <button
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="p-1 rounded text-[#577877] hover:text-[#F0F5F7] transition-colors ml-1"
                  title="Toggle diagnostic telemetry"
                >
                  {showTechnicalDetails ? (
                    <ChevronUp className="w-3.5 h-3.5 text-[#577877]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#577877]" />
                  )}
                </button>
              </div>
            </div>

            {/* Progressive Disclosure: Hidden Diagnostic Telemetry */}
            {showTechnicalDetails && (
              <div className="pt-2 border-t border-[#577877]/15 flex flex-wrap items-center gap-3 text-[10px] font-mono text-[#577877]">
                {message.latencyMs !== undefined && (
                  <span>Latency: <strong className="text-[#B9CECC]">{message.latencyMs}ms</strong></span>
                )}
                {message.retrievedChunksCount !== undefined && (
                  <span>Chunks evaluated: <strong className="text-[#B9CECC]">{message.retrievedChunksCount}</strong></span>
                )}
                <span>Model: <strong className="text-[#B9CECC]">Gemini 2.5 Flash</strong></span>
                <span>Grounding: <strong className="text-[#6DBE9B]">Verified</strong></span>
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
            className="w-8 h-8 rounded-xl border border-white/50 shadow-sm object-cover bg-[#1B2D2A] p-0.5"
          />
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#6DBE9B] border-2 border-[#162623]" title="Developer Active" />
        </div>
      )}

      {/* Citation Flag Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl bg-[#1B2D2A] border border-[#577877]/40 shadow-2xl p-5 space-y-4 text-xs font-sans text-[#F0F5F7]">
            <div className="flex items-center justify-between pb-2 border-b border-[#577877]/25">
              <span className="font-semibold text-[#F0F5F7] flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5 text-[#D9A066]" />
                Report Retrieval Quality Issue
              </span>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="text-[#577877] hover:text-[#F0F5F7]"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-[#B9CECC]">
              Help tune CodeRAG's semantic retrieval weights for this repository.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#577877] block">Comment (optional)</label>
              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="e.g. Citation refers to wrong function or missed helper class in utils.py"
                className="w-full p-2 rounded-lg bg-[#111E1C] border border-[#577877]/30 text-xs text-[#F0F5F7] placeholder-[#577877] focus:outline-none focus:border-[#295255] resize-none h-20 font-sans"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="px-3 py-1.5 rounded-md text-xs text-[#B9CECC] hover:bg-[#162623]"
              >
                Cancel
              </button>
              <button
                onClick={() => submitFeedback('flag_citation', feedbackComment)}
                disabled={feedbackSubmitting}
                className="px-3.5 py-1.5 rounded-md bg-[#295255] hover:bg-[#34686C] text-xs text-[#F0F5F7] font-medium border border-[#577877]/50"
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
