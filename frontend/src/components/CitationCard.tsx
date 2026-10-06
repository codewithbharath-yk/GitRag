import React, { useState } from 'react';
import { ExternalLink, FileCode, Check, Copy } from 'lucide-react';
import type { SourceCitation } from '../types/api';

interface CitationCardProps {
  citation: SourceCitation;
  repositoryOwner?: string;
  repositoryName?: string;
  branch?: string;
}

export const CitationCard: React.FC<CitationCardProps> = ({
  citation,
  repositoryOwner,
  repositoryName,
  branch = 'main',
}) => {
  const [copied, setCopied] = useState(false);

  // Compute percentage score
  const scorePercent = Math.min(100, Math.max(0, Math.round(citation.score * 100)));

  // Generate GitHub line anchor link if repo info is available
  const githubUrl =
    repositoryOwner && repositoryName
      ? `https://github.com/${repositoryOwner}/${repositoryName}/blob/${branch}/${citation.path}#L${citation.start_line}-L${citation.end_line}`
      : null;

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${citation.path}:${citation.start_line}-${citation.end_line}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group flex flex-col md:flex-row md:items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-700/60 bg-slate-900/60 hover:border-blue-500/50 hover:bg-slate-850 transition-all text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <div className="p-1.5 rounded bg-blue-550/10 text-blue-400 shrink-0">
          <FileCode className="w-4 h-4 text-blue-400" />
        </div>
        <div className="min-w-0 truncate">
          <span className="font-mono text-slate-200 font-medium truncate block">
            {citation.path}
          </span>
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <span>
              Lines <strong className="text-slate-300">{citation.start_line}</strong>–
              <strong className="text-slate-300">{citation.end_line}</strong>
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">
              {citation.end_line - citation.start_line + 1} lines
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
        {/* Similarity Score */}
        <span
          className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
            scorePercent >= 75
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : scorePercent >= 50
              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
          }`}
          title={`Cosine similarity score: ${citation.score.toFixed(4)}`}
        >
          {scorePercent}% match
        </span>

        {/* Copy Citation */}
        <button
          onClick={handleCopyPath}
          title="Copy file path and line reference"
          className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        {/* GitHub External Anchor */}
        {githubUrl && (
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="View code lines on GitHub"
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 font-sans"
          >
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
};
