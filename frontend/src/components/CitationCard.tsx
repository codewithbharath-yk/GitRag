import React, { useState } from 'react';
import { ExternalLink, FileCode, Check, Copy } from 'lucide-react';
import type { SourceCitation } from '../types/api';
import { Magnetic } from './motion/Magnetic';

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
    <div className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[#D4A373]/40 hover:bg-[var(--bg-card-hover)] transition-all text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <div className="p-1.5 rounded bg-[var(--bg-well)] border border-[var(--border-subtle)] text-[#D4A373] shrink-0">
          <FileCode className="w-4 h-4 text-[#D4A373]" />
        </div>
        <div className="min-w-0 truncate">
          <span className="font-mono text-[var(--text-primary)] font-medium truncate block">
            {citation.path}
          </span>
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-[11px] font-mono">
            <span>
              Lines <strong className="text-[var(--text-primary)]">L{citation.start_line}</strong>–
              <strong className="text-[var(--text-primary)]">L{citation.end_line}</strong>
            </span>
            <span>•</span>
            <span>
              {citation.end_line - citation.start_line + 1} lines
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        {/* Similarity Score */}
        <span
          className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
            scorePercent >= 70
              ? 'bg-[#D4A373] text-[#1F3B2C] font-bold border border-[#D4A373]'
              : scorePercent >= 45
              ? 'bg-[#D4A373]/20 text-[#D4A373] border border-[#D4A373]/40'
              : 'bg-[var(--bg-well)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
          }`}
          title={`Cosine similarity score: ${citation.score.toFixed(4)}`}
        >
          {scorePercent}% match
        </span>

        {/* Copy Citation */}
        <button
          onClick={handleCopyPath}
          title="Copy file path and line reference"
          className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)] transition-colors cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#D4A373]" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        {/* GitHub External Anchor */}
        {githubUrl && (
          <Magnetic pullStrength={0.15}>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open actual source at GitHub line"
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#D4A373] hover:bg-[#c29263] text-[#1F3B2C] font-bold transition-colors border border-[#D4A373]/40 font-sans text-xs cursor-pointer shadow-sm"
            >
              <span>Open source</span>
              <ExternalLink className="w-3 h-3 text-[#1F3B2C]" />
            </a>
          </Magnetic>
        )}
      </div>
    </div>
  );
};
