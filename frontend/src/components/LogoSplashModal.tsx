import React from 'react';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Layers,
  Code2,
  X,
} from 'lucide-react';
import { Magnetic, Spotlight, Tilt, TextEffect } from './motion';
import { ThemeToggle } from './ThemeToggle';

interface LogoSplashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnterWorkspace: () => void;
}

/**
 * LogoSplashModal — Welcoming entrance popup showcasing CodeRAG branding,
 * visual emblem, high-contrast white & green theme, and direct entrance into GitRAG.
 */
export const LogoSplashModal: React.FC<LogoSplashModalProps> = ({
  isOpen,
  onClose,
  onEnterWorkspace,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <Spotlight
        color="teal"
        className="relative w-full max-w-lg rounded-2xl bg-[#162623] border border-[#577877]/40 shadow-[0_20px_60px_rgba(0,0,0,0.6)] p-6 sm:p-8 space-y-6 text-[#F0F5F7] overflow-hidden"
      >
        {/* Ambient Top Glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-40 bg-[#295255]/40 rounded-full blur-3xl" />

        {/* Top Controls: Theme Toggle & Close */}
        <div className="absolute top-4 left-4 z-10">
          <ThemeToggle />
        </div>
        <Magnetic>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-[#577877] hover:text-[#FFFFFF] hover:bg-[#1B2D2A] transition-colors cursor-pointer"
            aria-label="Close intro"
          >
            <X className="w-5 h-5" />
          </button>
        </Magnetic>

        {/* Logo Icon & Branding */}
        <div className="flex flex-col items-center text-center space-y-3 pt-2">
          <Tilt maxAngle={12} scale={1.05} className="relative group">
            {/* Pulsing ring around logo */}
            <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-r from-[#6DBE9B] to-[#295255] opacity-60 blur-md group-hover:opacity-100 transition duration-500 animate-pulse" />
            <div className="relative w-20 h-20 rounded-2xl bg-[#1B2D2A] border-2 border-white/60 p-2 shadow-2xl flex items-center justify-center">
              <img
                src="/coderag_logo.svg"
                alt="CodeRAG Emblem"
                className="w-full h-full object-contain"
              />
            </div>
          </Tilt>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/10 border border-white/20 text-white text-[11px] font-mono tracking-wide">
              <Sparkles className="w-3 h-3 text-[#6DBE9B]" />
              <span>AI GitHub Code Assistant</span>
            </div>
            <TextEffect
              as="h2"
              variant="blur-up"
              className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white"
            >
              CodeRAG
            </TextEffect>
            <p className="text-xs sm:text-sm text-[#B9CECC] max-w-sm mx-auto leading-relaxed">
              Understand, search, and navigate any GitHub repository with evidence-grounded AI answers.
            </p>
          </div>
        </div>

        {/* Chatbot Visual Demonstration (AI + Developer) */}
        <div className="p-3.5 rounded-xl bg-[#111E1C] border border-white/15 space-y-2.5 shadow-inner">
          {/* User message preview */}
          <div className="flex items-start justify-end gap-2 text-right">
            <div className="max-w-[80%] bg-[#295255] border border-white/25 rounded-lg p-2 text-[11px] text-white shadow-xs">
              <span className="text-[9px] block text-white/70 font-mono mb-0.5">Developer (You)</span>
              Where is authentication handled in this repository?
            </div>
            <img
              src="/user_avatar.svg"
              alt="Developer Avatar"
              className="w-7 h-7 rounded-lg border border-white/60 bg-[#1B2D2A] p-0.5 shrink-0 shadow-xs"
            />
          </div>

          {/* AI message preview */}
          <div className="flex items-start justify-start gap-2 text-left">
            <div className="relative shrink-0">
              <img
                src="/ai_avatar.svg"
                alt="CodeRAG AI"
                className="w-7 h-7 rounded-lg border border-[#6DBE9B] bg-[#1B2D2A] p-0.5 shrink-0 shadow-xs"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#6DBE9B] border border-[#111E1C]" />
            </div>
            <div className="max-w-[85%] bg-[#1B2D2A] border border-[#577877]/30 rounded-lg p-2 text-[11px] text-[#F0F5F7] shadow-xs">
              <span className="text-[9px] block text-[#6DBE9B] font-mono mb-0.5 flex items-center gap-1 font-semibold">
                <Sparkles className="w-2.5 h-2.5" /> CodeRAG AI
              </span>
              Verified in <code className="text-white font-mono bg-black/40 px-1 py-0.5 rounded border border-white/10">auth/jwt.py:14-48</code> with SHA-256 HMAC tokens.
            </div>
          </div>
        </div>

        {/* 4 Feature Highlights with White & Deep Teal accents */}
        <div className="grid grid-cols-2 gap-2.5 pt-0 text-xs">
          <Tilt maxAngle={8} scale={1.02} className="h-full">
            <div className="p-3 rounded-xl bg-[#1B2D2A] border border-[#577877]/30 space-y-1 h-full">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Cpu className="w-4 h-4 text-[#6DBE9B]" />
                <span>Question RAG</span>
              </div>
              <p className="text-[11px] text-[#B9CECC] leading-tight">
                Local BGE embeddings with lazy chunking.
              </p>
            </div>
          </Tilt>

          <Tilt maxAngle={8} scale={1.02} className="h-full">
            <div className="p-3 rounded-xl bg-[#1B2D2A] border border-[#577877]/30 space-y-1 h-full">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Code2 className="w-4 h-4 text-[#6DBE9B]" />
                <span>AST Tree & Diffs</span>
              </div>
              <p className="text-[11px] text-[#B9CECC] leading-tight">
                Tree-Sitter syntax and symbol relations.
              </p>
            </div>
          </Tilt>

          <Tilt maxAngle={8} scale={1.02} className="h-full">
            <div className="p-3 rounded-xl bg-[#1B2D2A] border border-[#577877]/30 space-y-1 h-full">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Layers className="w-4 h-4 text-[#6DBE9B]" />
                <span>Real Citations</span>
              </div>
              <p className="text-[11px] text-[#B9CECC] leading-tight">
                Direct line numbers #L1-45 in GitHub files.
              </p>
            </div>
          </Tilt>

          <Tilt maxAngle={8} scale={1.02} className="h-full">
            <div className="p-3 rounded-xl bg-[#1B2D2A] border border-[#577877]/30 space-y-1 h-full">
              <div className="flex items-center gap-2 text-white font-semibold">
                <ShieldCheck className="w-4 h-4 text-[#6DBE9B]" />
                <span>Safe & Private</span>
              </div>
              <p className="text-[11px] text-[#B9CECC] leading-tight">
                Static analysis only; no code execution.
              </p>
            </div>
          </Tilt>
        </div>

        {/* Enter Action Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <Magnetic className="w-full">
            <button
              onClick={() => {
                onEnterWorkspace();
                onClose();
              }}
              className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#295255] to-[#34686C] hover:from-[#34686C] hover:to-[#3E7C81] text-white font-bold text-sm flex items-center justify-center gap-2.5 border-2 border-white/60 shadow-xl shadow-[#295255]/50 transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>Enter GitRAG Workspace</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </Magnetic>
        </div>

        {/* Subtle footer tip */}
        <div className="text-center">
          <span className="text-[11px] text-[#577877] font-mono">
            Powered by FastAPI • Qdrant • Tree-Sitter • Gemini
          </span>
        </div>
      </Spotlight>
    </div>
  );
};
