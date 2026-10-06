import React from 'react';
import {
  Sparkles,
  ArrowRight,
  FolderGit2,
  Search,
  MessageSquare,
  GitCommit,
  Code2,
  Zap,
  Database,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import type { HealthResponse } from '../types/api';

interface LandingPageProps {
  onGetStarted: () => void;
  onOpenConnectModal: () => void;
  health: HealthResponse | null;
  repositoriesCount: number;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onGetStarted,
  onOpenConnectModal,
  health,
  repositoriesCount,
}) => {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Banner / Navbar */}
      <nav className="sticky top-0 z-20 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-white flex items-center gap-2">
              CodeRAG
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                v1.0 Production
              </span>
            </span>
            <span className="text-xs text-slate-400 block -mt-0.5">AI GitHub Codebase Assistant</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>OpenRouter Nemotron + Gemini 2.5 + Qdrant</span>
          </div>
          <button
            onClick={onGetStarted}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all"
          >
            <span>Launch Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 pt-16 pb-20 max-w-5xl mx-auto text-center">
        {/* Glow backdrop effect */}
        <div className="absolute inset-0 -top-20 flex items-center justify-center pointer-events-none opacity-40">
          <div className="w-[600px] h-[350px] bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 blur-[120px] rounded-full" />
        </div>

        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-medium tracking-wide">
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span>Production-Grade Retrieval-Augmented Generation</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Understand Any Codebase <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-400">
              With Exact Source Citations
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Connect public or private GitHub repositories. Ask deep architectural questions, perform semantic code search, and inspect AST relationships backed by Qdrant vector retrieval and Gemini reasoning.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              onClick={onGetStarted}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-xl shadow-blue-600/30 flex items-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Explore Workspace</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenConnectModal}
              className="px-6 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 text-slate-200 border border-slate-700/80 font-semibold text-sm flex items-center gap-2.5 transition-all hover:border-slate-600"
            >
              <FolderGit2 className="w-4 h-4 text-blue-400" />
              <span>Index GitHub Repository</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto pt-8">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
              <span className="text-xl font-bold text-white block">{repositoriesCount}</span>
              <span className="text-xs text-slate-400">Active Repositories</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
              <span className="text-xl font-bold text-cyan-400 block">2048-dim</span>
              <span className="text-xs text-slate-400">Nemotron Embeddings</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
              <span className="text-xl font-bold text-indigo-400 block">Zero Fake</span>
              <span className="text-xs text-slate-400">Truthful Citations Only</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
              <span className="text-xl font-bold text-emerald-400 block">
                {health ? '100% Online' : 'Connecting'}
              </span>
              <span className="text-xs text-slate-400">System Health</span>
            </div>
          </div>
        </div>
      </section>

      {/* Core Architecture Overview */}
      <section className="px-6 py-16 max-w-6xl mx-auto border-t border-slate-800/80">
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-xs font-semibold text-blue-400 tracking-wider uppercase">How CodeRAG Works</h2>
          <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            From Raw Git Trees to Grounded Code Answers
          </p>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            A production pipeline separating dense code chunk embedding from generative reasoning to ensure truthful answers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all space-y-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">1. Ingestion & Filtering</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Discovers files from GitHub trees while filtering `.git`, build outputs, binaries, and sensitive tokens. Chunks source code with line tracking.
            </p>
            <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5 pt-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sanitized and bounded chunking</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all space-y-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">2. OpenRouter & Qdrant</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Embeds code chunks using NVIDIA Nemotron 3 Embed (2048-dim) and stores vectors in persistent Qdrant with user-scoped multi-tenant isolation.
            </p>
            <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5 pt-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Persistent Cosine similarity</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all space-y-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">3. Gemini 2.5 Flash Grounding</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Retrieves top evidence chunks and synthesizes an accurate answer. Every claim links to exact GitHub file paths and line ranges.
            </p>
            <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5 pt-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Admits lack of context gracefully</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase Grid */}
      <section className="px-6 py-16 max-w-6xl mx-auto border-t border-slate-800/80">
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-xs font-semibold text-indigo-400 tracking-wider uppercase">Built for Real Developers</h2>
          <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Every Tool You Need to Explore Foreign Codebases
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-semibold text-white">AI Codebase Chat</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ask natural language questions about architecture, algorithms, and dependencies with direct clickable line citations.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <Search className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-semibold text-white">Semantic Code Search</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Query concepts in plain English. Match code snippets by intent rather than exact keyword strings.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
              <Code2 className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-semibold text-white">AST Symbols & Hotspots</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Introspect classes, methods, imports, and cross-file dependencies extracted via Tree-sitter AST parsing.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <GitCommit className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-semibold text-white">Git Diff & History AI</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Browse commits, view unified diff patches, and have Gemini explain why code changed between releases.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Footer Section */}
      <section className="px-6 py-20 max-w-4xl mx-auto text-center space-y-6">
        <div className="p-10 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-blue-500/30 shadow-2xl shadow-blue-500/10 space-y-6">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Ready to explore your codebase?
          </h2>
          <p className="text-sm text-slate-300 max-w-lg mx-auto">
            Connect any GitHub repository now or start chatting with pre-indexed sample repositories.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onGetStarted}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all"
            >
              <span>Get Started Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onOpenConnectModal}
              className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 flex items-center gap-2 transition-all"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Connect Repository</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 px-6 py-8 text-center text-xs text-slate-500">
        <p>© 2026 CodeRAG — AI GitHub Codebase Assistant. Powered by OpenRouter, Qdrant & Gemini.</p>
      </footer>
    </div>
  );
};
