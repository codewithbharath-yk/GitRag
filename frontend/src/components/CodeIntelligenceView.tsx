import React, { useState, useEffect } from 'react';
import {
  Code2,
  Search,
  Braces,
  MessageSquare,
  FileCode,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Layers,
} from 'lucide-react';
import { api } from '../api/client';
import type {
  StoredRepository,
  CodeSymbol,
  SymbolType,
  ParsedFileIntelligence,
} from '../types/api';
import { Magnetic, Spotlight, Tilt, TextEffect } from './motion';
import { useNavigation } from '../context/NavigationContext';

interface CodeIntelligenceViewProps {
  repository: StoredRepository;
  onAskQuestion?: (question: string) => void;
  initialViewMode?: 'symbols' | 'files';
}

export const CodeIntelligenceView: React.FC<CodeIntelligenceViewProps> = ({
  repository,
  onAskQuestion,
  initialViewMode = 'symbols',
}) => {
  const { symbolName, setSymbolName } = useNavigation();

  const [symbols, setSymbols] = useState<CodeSymbol[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedSymbol, setSelectedSymbol] = useState<CodeSymbol | null>(null);

  // File Dependency / Architecture mode
  const [viewMode, setViewMode] = useState<'symbols' | 'files'>(initialViewMode);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileIntelligence, setFileIntelligence] = useState<ParsedFileIntelligence | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [relationshipsData, setRelationshipsData] = useState<any>(null);

  // Progressive disclosure states
  const [showDocstring, setShowDocstring] = useState(true);
  const [showCodeSnippet, setShowCodeSnippet] = useState(true);
  const [showAstDetails, setShowAstDetails] = useState(false);

  // Sync initialViewMode if prop changes
  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode]);

  // Fetch all symbols for repository
  const loadSymbols = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getRepositorySymbols(repository.id, {
        branch: repository.branch,
      });
      setSymbols(data);
      if (data.length > 0) {
        if (symbolName) {
          const match = data.find((s) => s.name === symbolName);
          setSelectedSymbol(match || data[0]);
        } else {
          setSelectedSymbol((prev) => prev || data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load repository symbols:', err);
    } finally {
      setLoading(false);
    }
  }, [repository.id, repository.branch, symbolName]);

  // Fetch relationships graph
  const loadRelationships = React.useCallback(async () => {
    try {
      const data = await api.getRepositoryRelationships(repository.id, {
        branch: repository.branch,
      });
      setRelationshipsData(data);
      if (!selectedFile && data?.file_dependencies) {
        const files = Object.keys(data.file_dependencies);
        if (files.length > 0) {
          setSelectedFile(files[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load relationships:', err);
    }
  }, [repository.id, repository.branch, selectedFile]);

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      if (ignore) return;
      await Promise.all([loadSymbols(), loadRelationships()]);
    };
    run();
    return () => {
      ignore = true;
    };
  }, [loadSymbols, loadRelationships]);

  // Fetch intelligence for single file
  useEffect(() => {
    if (!selectedFile) return;
    const fetchFileIntel = async () => {
      try {
        setLoadingFile(true);
        const intel = await api.getFileIntelligence(
          repository.id,
          selectedFile,
          repository.branch
        );
        setFileIntelligence(intel);
      } catch (err) {
        console.error('Failed to load file intelligence:', err);
        setFileIntelligence(null);
      } finally {
        setLoadingFile(false);
      }
    };
    fetchFileIntel();
  }, [selectedFile, repository.id, repository.branch]);

  // Filter symbols by query and type
  const filteredSymbols = symbols.filter((sym) => {
    const matchesQuery =
      sym.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sym.file_path.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || sym.symbol_type === selectedType;
    return matchesQuery && matchesType;
  });

  const getSymbolBadgeColor = (type: SymbolType) => {
    switch (type) {
      case 'class':
      case 'interface':
        return 'bg-[#D4A373]/20 text-[#D4A373] border-[#D4A373]/40';
      case 'function':
        return 'bg-[var(--bg-well)] text-[var(--text-primary)] border-[var(--border-subtle)]';
      case 'method':
        return 'bg-[var(--bg-well)] text-[var(--text-secondary)] border-[var(--border-subtle)]';
      case 'constant':
      case 'variable':
        return 'bg-[var(--bg-well)] text-[var(--text-muted)] border-[var(--border-subtle)]';
      default:
        return 'bg-[var(--bg-well)] text-[var(--text-muted)] border-[var(--border-subtle)]';
    }
  };

  const handleAskAboutSymbol = (sym: CodeSymbol) => {
    if (!onAskQuestion) return;
    const question = `Where is ${sym.name} defined and how does it work? Explain its role in ${sym.file_path}.`;
    onAskQuestion(question);
  };

  const allIndexedFiles = relationshipsData?.file_dependencies
    ? Object.keys(relationshipsData.file_dependencies)
    : [];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)] font-sans">
      {/* Top Header */}
      <div className="p-4 px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#D4A373] border border-[#D4A373]/40 flex items-center justify-center text-[#1F3B2C] shadow-sm shrink-0">
            <Code2 className="w-5 h-5 text-[#1F3B2C]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                <TextEffect as="span">Code Intelligence & AST Structure</TextEffect>
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--bg-well)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                Tree-Sitter AST
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] font-mono">
              {repository.fullName} • branch: {repository.branch} • {symbols.length} symbol{symbols.length === 1 ? '' : 's'} extracted
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="p-1 rounded-xl bg-[var(--bg-well)] border border-[var(--border-subtle)] flex items-center gap-1 text-xs">
            <Magnetic pullStrength={0.12}>
              <button
                onClick={() => setViewMode('symbols')}
                className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'symbols'
                    ? 'bg-[#D4A373] text-[#1F3B2C] shadow-sm font-bold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                <Braces className="w-3.5 h-3.5" />
                <span>Symbol Explorer</span>
              </button>
            </Magnetic>
            <Magnetic pullStrength={0.12}>
              <button
                onClick={() => {
                  setViewMode('files');
                  if (!selectedFile && allIndexedFiles.length > 0) {
                    setSelectedFile(allIndexedFiles[0]);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'files'
                    ? 'bg-[#D4A373] text-[#1F3B2C] shadow-sm font-bold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Architecture Graph</span>
              </button>
            </Magnetic>
          </div>

          <button
            onClick={() => loadSymbols()}
            disabled={loading}
            title="Refresh symbols"
            className="p-2 rounded-xl bg-[var(--bg-well)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'symbols' ? (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Panel: Search & Filter Symbols List */}
          <div className={`md:w-5/12 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden ${selectedSymbol ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-3 border-b border-[var(--border-subtle)] space-y-2.5 bg-[var(--bg-well)]">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Filter symbols by identifier, class, or path..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#D4A373] font-mono transition-colors"
                />
              </div>

              {/* Type Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-mono">
                {['all', 'function', 'class', 'method', 'interface', 'variable'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-2.5 py-0.5 rounded-lg border transition-all uppercase tracking-wider shrink-0 cursor-pointer ${
                      selectedType === type
                        ? 'bg-[#D4A373] text-[#1F3B2C] border-[#D4A373] font-bold'
                        : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Symbols List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">
              {loading && symbols.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                  Analyzing syntax trees with Tree-Sitter...
                </div>
              ) : filteredSymbols.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                  No code symbols matched the criteria.
                </div>
              ) : (
                filteredSymbols.map((sym) => {
                  const isSelected = selectedSymbol?.name === sym.name && selectedSymbol?.file_path === sym.file_path;
                  return (
                    <div
                      key={`${sym.file_path}::${sym.name}::${sym.start_line}`}
                      onClick={() => {
                        setSelectedSymbol(sym);
                        setSymbolName(sym.name);
                      }}
                      className={`p-3 px-4 cursor-pointer transition-colors relative flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#D4A373]/15 border-l-4 border-[#D4A373]'
                          : 'hover:bg-[var(--bg-card-hover)] border-l-4 border-transparent'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[var(--text-primary)] truncate">
                            {sym.name}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono uppercase border ${getSymbolBadgeColor(
                              sym.symbol_type
                            )}`}
                          >
                            {sym.symbol_type}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] font-mono truncate mt-1">
                          {sym.file_path}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-[var(--text-muted)] font-mono block">
                          L{sym.start_line}–{sym.end_line}
                        </span>
                        {sym.parameters && sym.parameters.length > 0 && (
                          <span className="text-[9px] px-1 rounded bg-[var(--bg-well)] text-[var(--text-secondary)] font-mono mt-1 inline-block">
                            ({sym.parameters.length} args)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Selected Symbol Detail Inspector */}
          <div className={`md:w-7/12 flex-1 flex flex-col bg-[var(--bg-base)] overflow-y-auto ${!selectedSymbol ? 'hidden md:flex' : 'flex'}`}>
            {selectedSymbol ? (
              <div className="p-6 space-y-5">
                {/* Symbol Detail Header */}
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedSymbol(null);
                        setSymbolName(null);
                      }}
                      className="md:hidden p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
                      title="Back to symbols list"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
                      {selectedSymbol.symbol_type}: {selectedSymbol.name}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-well)] text-[#D4A373] border border-[var(--border-subtle)] font-semibold">
                    Line {selectedSymbol.start_line}
                  </span>
                </div>

                {/* Identity Card */}
                <Tilt maxAngle={3}>
                  <Spotlight variant="subtle" className="rounded-2xl">
                    <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-sm space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-mono uppercase font-bold border ${getSymbolBadgeColor(
                                selectedSymbol.symbol_type
                              )}`}
                            >
                              {selectedSymbol.symbol_type}
                            </span>
                            {selectedSymbol.container_name && (
                              <span className="text-xs font-mono text-[#D4A373]">
                                in {selectedSymbol.container_name}
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded text-[11px] bg-[var(--bg-well)] text-[var(--text-secondary)] border border-[var(--border-subtle)] font-mono">
                              {selectedSymbol.language}
                            </span>
                          </div>
                          <TextEffect as="h2" className="text-xl font-bold font-mono text-[var(--text-primary)] tracking-tight">
                            {selectedSymbol.name}
                          </TextEffect>
                        </div>

                        {/* Ask in Chat Action Button in Antique Gold */}
                        <Magnetic>
                          <button
                            onClick={() => handleAskAboutSymbol(selectedSymbol)}
                            className="py-2 px-3.5 rounded-xl bg-[#D4A373] hover:bg-[#c29263] text-[#1F3B2C] font-bold text-xs flex items-center gap-1.5 border border-[#D4A373]/40 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-[#1F3B2C]" />
                            <span>Ask in Chat</span>
                          </button>
                        </Magnetic>
                      </div>

                      {/* Metadata Row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[var(--border-subtle)] text-xs font-mono">
                        <div>
                          <span className="text-[var(--text-muted)] block text-[11px]">Location</span>
                          <span className="text-[var(--text-secondary)] truncate block">{selectedSymbol.file_path}</span>
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)] block text-[11px]">Lines</span>
                          <span className="text-[var(--text-primary)] font-semibold">
                            L{selectedSymbol.start_line} – L{selectedSymbol.end_line}
                          </span>
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)] block text-[11px]">Parameters</span>
                          <span className="text-[var(--text-secondary)]">
                            {selectedSymbol.parameters?.length ? selectedSymbol.parameters.join(', ') : 'none'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)] block text-[11px]">Return Type</span>
                          <span className="text-[var(--text-secondary)]">{selectedSymbol.return_type || 'unspecified'}</span>
                        </div>
                      </div>
                    </div>
                  </Spotlight>
                </Tilt>

                {/* Docstring Accordion */}
                {selectedSymbol.docstring && (
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
                    <button
                      onClick={() => setShowDocstring(!showDocstring)}
                      className="w-full p-4 flex items-center justify-between hover:bg-[var(--bg-card-hover)] transition-colors text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-[#D4A373]" />
                        <span>Documentation & Docstring</span>
                      </div>
                      {showDocstring ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
                    </button>
                    {showDocstring && (
                      <div className="p-4 pt-0 border-t border-[var(--border-subtle)] bg-[var(--bg-well)]/40">
                        <p className="text-xs text-[var(--text-secondary)] font-sans leading-relaxed whitespace-pre-wrap mt-3">
                          {selectedSymbol.docstring}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Source Snippet Accordion */}
                {selectedSymbol.source_snippet && (
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden shadow-sm">
                    <button
                      onClick={() => setShowCodeSnippet(!showCodeSnippet)}
                      className="w-full px-4 py-3 bg-[var(--bg-well)] border-b border-[var(--border-subtle)] flex items-center justify-between text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <span>Source Code Snippet (lines {selectedSymbol.start_line}–{selectedSymbol.end_line})</span>
                      {showCodeSnippet ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
                    </button>
                    {showCodeSnippet && (
                      <pre className="p-4 text-xs font-mono text-[var(--text-primary)] overflow-x-auto leading-relaxed bg-[var(--bg-well)]">
                        <code>{selectedSymbol.source_snippet}</code>
                      </pre>
                    )}
                  </div>
                )}

                {/* Progressive Disclosure: Advanced AST Parser Internals */}
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
                  <button
                    onClick={() => setShowAstDetails(!showAstDetails)}
                    className="w-full p-3.5 px-4 flex items-center justify-between text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <span>Parser & AST Internal Boundaries</span>
                    {showAstDetails ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
                  </button>
                  {showAstDetails && (
                    <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-well)] text-[11px] font-mono space-y-1.5 text-[var(--text-muted)]">
                      <div>Symbol SHA: <span className="text-[var(--text-secondary)]">{selectedSymbol.file_path}::{selectedSymbol.name}</span></div>
                      <div>Byte Range: <span className="text-[var(--text-secondary)]">Start line {selectedSymbol.start_line}, End line {selectedSymbol.end_line}</span></div>
                      <div>AST Provider: <span className="text-[#D4A373]">Tree-Sitter Multi-Language Engine</span></div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--text-muted)]">
                <Braces className="w-10 h-10 text-[#D4A373] mb-3" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">Select a code symbol to inspect</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm">
                  Click any function, class, or method on the left to see its parameters, docstrings, source lines, and AST hierarchy.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Architecture / File Dependency Mode */
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left: Indexed Files List */}
          <div className="md:w-5/12 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="p-3 border-b border-[var(--border-subtle)] bg-[var(--bg-well)] flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--text-primary)]">Indexed Files Architecture</span>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">{allIndexedFiles.length} files</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">
              {allIndexedFiles.map((filePath) => {
                const isSelected = selectedFile === filePath;
                const deps = relationshipsData?.file_dependencies?.[filePath] || [];
                return (
                  <div
                    key={filePath}
                    onClick={() => setSelectedFile(filePath)}
                    className={`p-3 px-4 cursor-pointer transition-colors relative flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#D4A373]/15 border-l-4 border-[#D4A373]'
                        : 'hover:bg-[var(--bg-card-hover)] border-l-4 border-transparent'
                    }`}
                  >
                    <div className="min-w-0 flex items-center gap-2 truncate">
                      <FileCode className="w-3.5 h-3.5 text-[#D4A373] shrink-0" />
                      <span className="font-mono text-xs font-medium text-[var(--text-primary)] truncate">
                        {filePath}
                      </span>
                    </div>

                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-well)] border border-[var(--border-subtle)] text-[var(--text-muted)] font-mono shrink-0">
                      {deps.length} deps
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: File Architecture Inspector */}
          <div className="md:w-7/12 flex-1 flex flex-col bg-[var(--bg-base)] overflow-y-auto p-6 space-y-5">
            {loadingFile ? (
              <div className="flex flex-col items-center justify-center p-12 space-y-3">
                <RefreshCw className="w-6 h-6 animate-spin text-[#D4A373]" />
                <span className="text-xs font-mono text-[var(--text-muted)]">Analyzing file architecture...</span>
              </div>
            ) : selectedFile ? (
              <>
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="md:hidden p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
                      title="Back to files list"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
                      {selectedFile}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-3">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-[#D4A373]" />
                    <span className="font-mono font-bold text-sm text-[var(--text-primary)]">{selectedFile}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono text-[var(--text-muted)]">
                    <span>Language: <strong className="text-[var(--text-secondary)]">{fileIntelligence?.language || 'Unknown'}</strong></span>
                    <span>Symbols: <strong className="text-[var(--text-primary)]">{fileIntelligence?.symbols?.length || 0}</strong></span>
                    <span>Imports: <strong className="text-[var(--text-primary)]">{fileIntelligence?.imports?.length || 0}</strong></span>
                  </div>
                </div>

                {/* Direct File Dependencies */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    Import Dependencies ({fileIntelligence?.imports?.length || 0})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {fileIntelligence?.imports?.map((imp, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-secondary)] flex items-center justify-between"
                      >
                        <span className="truncate">{imp.module}</span>
                        {imp.names && imp.names.length > 0 && (
                          <span className="text-[10px] text-[#D4A373]">({imp.names.join(', ')})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-[var(--text-muted)]">
                <Layers className="w-10 h-10 text-[#D4A373] mb-3" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">Select a file to inspect its architectural graph</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
