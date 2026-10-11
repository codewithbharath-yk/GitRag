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
    <div className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border border-[#577877]/30 bg-[#1B2D2A] hover:border-[#577877]/60 hover:bg-[#213834] transition-all text-xs card-hover-teal">
      <div className="flex items-center gap-2 min-w-0">
        <div className="p-1.5 rounded bg-[#162623] border border-[#577877]/30 text-[#577877] shrink-0">
          <FileCode className="w-4 h-4 text-[#577877]" />
        </div>
        <div className="min-w-0 truncate">
          <span className="font-mono text-[#F0F5F7] font-medium truncate block">
            {citation.path}
          </span>
          <div className="flex items-center gap-2 text-[#577877] text-[11px] font-mono">
            <span>
              Lines <strong className="text-[#B9CECC]">L{citation.start_line}</strong>–
              <strong className="text-[#B9CECC]">L{citation.end_line}</strong>
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
              ? 'bg-[#1E3430] text-[#6DBE9B] border border-[#6DBE9B]/30'
              : scorePercent >= 45
              ? 'bg-[#1E3430] text-[#D9A066] border border-[#D9A066]/30'
              : 'bg-[#162623] text-[#B9CECC] border border-[#577877]/30'
          }`}
          title={`Cosine similarity score: ${citation.score.toFixed(4)}`}
        >
          {scorePercent}% match
        </span>

        {/* Copy Citation */}
        <button
          onClick={handleCopyPath}
          title="Copy file path and line reference"
          className="p-1.5 rounded text-[#577877] hover:text-[#F0F5F7] hover:bg-[#162623] transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#6DBE9B]" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        {/* GitHub External Anchor */}
        {githubUrl && (
          <Magnetic pullStrength={0.15}>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open actual source at GitHub line"
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#295255] hover:bg-[#34686C] text-[#F0F5F7] transition-colors border border-[#577877]/40 font-sans text-xs"
            >
              <span>Open source</span>
              <ExternalLink className="w-3 h-3 text-[#B9CECC]" />
            </a>
          </Magnetic>
        )}
      </div>
    </div>
  );
};
