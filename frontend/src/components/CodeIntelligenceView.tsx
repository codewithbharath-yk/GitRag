import React, { useState, useEffect } from 'react';
import {
  Code2,
  Search,
  Box,
  Braces,
  Layers,
  ArrowRight,
  MessageSquare,
  FileCode,
  Sparkles,
  RefreshCw,
  FolderTree,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '../api/client';
import type {
  StoredRepository,
  CodeSymbol,
  SymbolType,
  ParsedFileIntelligence,
} from '../types/api';
import { Magnetic, Spotlight, Tilt, TextEffect } from './motion';

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
        setSelectedSymbol((prev) => prev || data[0]);
      }
    } catch (err) {
      console.error('Failed to load repository symbols:', err);
    } finally {
      setLoading(false);
    }
  }, [repository.id, repository.branch]);

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

  // Load specific file intelligence when selected
  useEffect(() => {
    if (!selectedFile) return;
    const fetchFileIntel = async () => {
      setLoadingFile(true);
      try {
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
        return 'bg-[#295255] text-[#F0F5F7] border-[#577877]/60';
      case 'function':
        return 'bg-[#1E3430] text-[#B9CECC] border-[#577877]/40';
      case 'method':
        return 'bg-[#1E3430] text-[#B9CECC] border-[#577877]/30';
      case 'constant':
      case 'variable':
        return 'bg-[#162623] text-[#577877] border-[#577877]/30';
      default:
        return 'bg-[#162623] text-[#577877] border-[#577877]/30';
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#162623] text-[#F0F5F7] font-sans">
      {/* Top Header */}
      <div className="p-4 px-6 border-b border-[#577877]/25 bg-[#1B2D2A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#295255] border border-[#577877]/40 flex items-center justify-center text-[#F0F5F7] shadow-sm">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#F0F5F7] tracking-tight">
                <TextEffect as="span">Code Intelligence & AST Structure</TextEffect>
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#162623] text-[#B9CECC] border border-[#577877]/40">
                Tree-Sitter AST
              </span>
            </div>
            <p className="text-xs text-[#577877] font-mono">
              {repository.fullName} • branch: {repository.branch} • {symbols.length} symbol{symbols.length === 1 ? '' : 's'} extracted
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="p-1 rounded-xl bg-[#111E1C] border border-[#577877]/30 flex items-center gap-1 text-xs">
            <Magnetic pullStrength={0.12}>
              <button
                onClick={() => setViewMode('symbols')}
                className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                  viewMode === 'symbols'
                    ? 'bg-[#295255] text-[#F0F5F7] border border-[#577877]/60 shadow-sm'
                    : 'text-[#B9CECC] hover:text-[#F0F5F7] hover:bg-[#1E3430]'
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
                className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                  viewMode === 'files'
                    ? 'bg-[#295255] text-[#F0F5F7] border border-[#577877]/60 shadow-sm'
                    : 'text-[#B9CECC] hover:text-[#F0F5F7] hover:bg-[#1E3430]'
                }`}
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span>File Architecture</span>
              </button>
            </Magnetic>
          </div>

          <Magnetic pullStrength={0.15}>
            <button
              onClick={loadSymbols}
              disabled={loading}
              className="p-2 rounded-lg text-[#577877] hover:text-[#F0F5F7] hover:bg-[#1E3430] border border-[#577877]/30 transition-colors"
              title="Refresh symbols"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#B9CECC]' : ''}`} />
            </button>
          </Magnetic>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'symbols' ? (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Column: Symbol List and Filters */}
          <div className="w-full md:w-80 lg:w-96 border-r border-[#577877]/25 bg-[#1B2D2A] flex flex-col shrink-0">
            {/* Search and Filters */}
            <div className="p-3 border-b border-[#577877]/25 space-y-2 bg-[#111E1C]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#577877]" />
                <input
                  type="text"
                  placeholder="Search symbols or files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#162623] border border-[#577877]/30 rounded-lg text-xs text-[#F0F5F7] placeholder-[#577877] focus:outline-none focus:border-[#295255] transition-colors font-mono"
                />
              </div>

              {/* Filter Type Pills */}
              <div className="flex items-center gap-1 overflow-x-auto text-[11px] pb-1 scrollbar-none">
                {['all', 'function', 'class', 'method', 'constant'].map((t) => (
                  <Magnetic key={t} pullStrength={0.1}>
                    <button
                      onClick={() => setSelectedType(t)}
                      className={`px-2.5 py-1 rounded-md capitalize font-medium transition-all ${
                        selectedType === t
                          ? 'bg-[#295255] text-[#F0F5F7] border border-[#577877]/50'
                          : 'text-[#577877] hover:text-[#F0F5F7] hover:bg-[#1E3430]'
                      }`}
                    >
                      {t}
                    </button>
                  </Magnetic>
                ))}
              </div>
            </div>

            {/* Symbols Scrollable List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-[#577877] text-xs gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#B9CECC]" />
                  <span>Parsing repository symbols with Tree-Sitter...</span>
                </div>
              ) : filteredSymbols.length === 0 ? (
                <div className="text-center py-16 text-[#577877] text-xs px-4">
                  No symbols found matching your criteria.
                </div>
              ) : (
                filteredSymbols.map((sym, idx) => {
                  const isSelected = selectedSymbol?.name === sym.name && selectedSymbol?.file_path === sym.file_path;
                  return (
                    <button
                      key={`${sym.file_path}:${sym.name}:${idx}`}
                      onClick={() => setSelectedSymbol(sym)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all text-xs flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-[#213834] border-[#577877] shadow-sm'
                          : 'bg-[#162623] border-[#577877]/25 hover:bg-[#1E3430] hover:border-[#577877]/50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${getSymbolBadgeColor(
                              sym.symbol_type
                            )}`}
                          >
                            {sym.symbol_type}
                          </span>
                          <span className="font-mono font-medium text-[#F0F5F7] truncate block">
                            {sym.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#577877] font-mono truncate flex items-center gap-1">
                          <span className="truncate">{sym.file_path}</span>
                          <span>:</span>
                          <span className="text-[#B9CECC]">L{sym.start_line}-{sym.end_line}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-[#577877] shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Symbol Detail Inspector */}
          <div className="flex-1 overflow-y-auto p-6 bg-[#162623]">
            {selectedSymbol ? (
              <div className="max-w-3xl space-y-6">
                {/* Symbol Header Card with Tilt & Spotlight */}
                <Tilt maxAngle={2}>
                  <Spotlight variant="teal" className="rounded-2xl">
                    <div className="p-5 rounded-2xl border border-[#577877]/30 bg-[#1B2D2A] space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-mono font-semibold border ${getSymbolBadgeColor(
                                selectedSymbol.symbol_type
                              )}`}
                            >
                              {selectedSymbol.symbol_type.toUpperCase()}
                            </span>
                            {selectedSymbol.parent_symbol && (
                              <span className="text-xs text-[#577877] font-mono">
                                in class <strong className="text-[#F0F5F7]">{selectedSymbol.parent_symbol}</strong>
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded text-[11px] bg-[#111E1C] text-[#B9CECC] border border-[#577877]/30 font-mono">
                              {selectedSymbol.language}
                            </span>
                          </div>
                          <TextEffect as="h2" className="text-xl font-bold font-mono text-[#F0F5F7] tracking-tight">
                            {selectedSymbol.name}
                          </TextEffect>
                        </div>

                        {/* Ask in Chat Action Button */}
                        <Magnetic>
                          <button
                            onClick={() => handleAskAboutSymbol(selectedSymbol)}
                            className="py-2 px-3.5 rounded-xl bg-[#295255] hover:bg-[#34686C] text-[#F0F5F7] font-medium text-xs flex items-center gap-1.5 border border-[#577877]/50 shadow-sm transition-all active:scale-[0.98]"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-[#F0F5F7]" />
                            <span>Ask in Chat</span>
                          </button>
                        </Magnetic>
                      </div>

                      {/* Metadata Row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#577877]/20 text-xs font-mono">
                        <div>
                          <span className="text-[#577877] block text-[11px]">Location</span>
                          <span className="text-[#B9CECC] truncate block">{selectedSymbol.file_path}</span>
                        </div>
                        <div>
                          <span className="text-[#577877] block text-[11px]">Lines</span>
                          <span className="text-[#F0F5F7] font-semibold">
                            L{selectedSymbol.start_line} – L{selectedSymbol.end_line}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#577877] block text-[11px]">Parameters</span>
                          <span className="text-[#B9CECC]">
                            {selectedSymbol.parameters?.length ? selectedSymbol.parameters.join(', ') : 'none'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#577877] block text-[11px]">Return Type</span>
                          <span className="text-[#B9CECC]">{selectedSymbol.return_type || 'unspecified'}</span>
                        </div>
                      </div>
                    </div>
                  </Spotlight>
                </Tilt>

                {/* Docstring Accordion */}
                {selectedSymbol.docstring && (
                  <div className="rounded-xl border border-[#577877]/30 bg-[#1B2D2A] overflow-hidden">
                    <button
                      onClick={() => setShowDocstring(!showDocstring)}
                      className="w-full p-4 flex items-center justify-between hover:bg-[#1E3430] transition-colors text-xs font-semibold text-[#F0F5F7] uppercase tracking-wider"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-[#577877]" />
                        <span>Documentation & Docstring</span>
                      </div>
                      {showDocstring ? <ChevronUp className="w-4 h-4 text-[#577877]" /> : <ChevronDown className="w-4 h-4 text-[#577877]" />}
                    </button>
                    {showDocstring && (
                      <div className="p-4 pt-0 border-t border-[#577877]/20 bg-[#111E1C]/40">
                        <p className="text-xs text-[#B9CECC] font-sans leading-relaxed whitespace-pre-wrap mt-3">
                          {selectedSymbol.docstring}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Source Snippet Accordion */}
                {selectedSymbol.source_snippet && (
                  <div className="rounded-xl border border-[#577877]/30 bg-[#1B2D2A] overflow-hidden shadow-md">
                    <button
                      onClick={() => setShowCodeSnippet(!showCodeSnippet)}
                      className="w-full px-4 py-3 bg-[#111E1C] border-b border-[#577877]/20 flex items-center justify-between text-xs font-mono text-[#577877] hover:text-[#F0F5F7] transition-colors"
                    >
                      <span>Source Code Snippet (lines {selectedSymbol.start_line}–{selectedSymbol.end_line})</span>
                      {showCodeSnippet ? <ChevronUp className="w-4 h-4 text-[#577877]" /> : <ChevronDown className="w-4 h-4 text-[#577877]" />}
                    </button>
                    {showCodeSnippet && (
                      <pre className="p-4 text-xs font-mono text-[#F0F5F7] overflow-x-auto leading-relaxed bg-[#111E1C]">
                        <code>{selectedSymbol.source_snippet}</code>
                      </pre>
                    )}
                  </div>
                )}

                {/* Progressive Disclosure: Advanced AST Parser Internals */}
                <div className="rounded-xl border border-[#577877]/20 bg-[#1B2D2A] overflow-hidden">
                  <button
                    onClick={() => setShowAstDetails(!showAstDetails)}
                    className="w-full p-3.5 px-4 flex items-center justify-between text-xs font-mono text-[#577877] hover:text-[#F0F5F7] transition-colors"
                  >
                    <span>Parser & AST Internal Boundaries</span>
                    {showAstDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {showAstDetails && (
                    <div className="p-3.5 pt-0 border-t border-[#577877]/15 text-[11px] font-mono text-[#577877] space-y-1 bg-[#111E1C]/50">
                      <div className="flex justify-between">
                        <span>Language grammar:</span>
                        <span className="text-[#B9CECC]">{selectedSymbol.language} (Tree-Sitter)</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Token span:</span>
                        <span className="text-[#B9CECC]">Lines {selectedSymbol.start_line}–{selectedSymbol.end_line}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Parent context:</span>
                        <span className="text-[#B9CECC]">{selectedSymbol.parent_symbol || 'root'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[#577877] text-xs">
                <Box className="w-8 h-8 text-[#295255] mb-2" />
                <span>Select a symbol to inspect its definition, parameters, and AST boundaries.</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* View Mode: Files & Dependencies */
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* File Selector */}
          <div className="w-full md:w-80 border-r border-[#577877]/25 bg-[#1B2D2A] flex flex-col shrink-0">
            <div className="p-3 border-b border-[#577877]/25 bg-[#111E1C] text-xs font-semibold text-[#577877] uppercase tracking-wider">
              Indexed Source Files ({allIndexedFiles.length})
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {allIndexedFiles.length === 0 ? (
                <div className="text-center py-12 text-[#577877] text-xs">
                  No indexed files found.
                </div>
              ) : (
                allIndexedFiles.map((file) => {
                  const isSel = selectedFile === file;
                  const deps = relationshipsData?.file_dependencies?.[file] || [];
                  return (
                    <button
                      key={file}
                      onClick={() => setSelectedFile(file)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all text-xs flex items-center justify-between gap-2 ${
                        isSel
                          ? 'bg-[#213834] border-[#577877] shadow-sm'
                          : 'bg-[#162623] border-[#577877]/25 hover:bg-[#1E3430] hover:border-[#577877]/50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <FileCode className="w-3.5 h-3.5 text-[#577877] shrink-0" />
                          <span className="font-mono text-[#F0F5F7] font-medium truncate block">
                            {file}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#577877] font-mono mt-0.5">
                          imports {deps.length} file{deps.length === 1 ? '' : 's'}
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-[#577877] shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* File Architecture Details */}
          <div className="flex-1 overflow-y-auto p-6 bg-[#162623] space-y-6">
            {selectedFile ? (
              <div className="max-w-3xl space-y-6">
                {/* File Header */}
                <div className="p-4 rounded-xl border border-[#577877]/30 bg-[#1B2D2A] flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold font-mono text-[#F0F5F7]">{selectedFile}</h2>
                    <p className="text-xs text-[#577877] font-mono">
                      {fileIntelligence?.line_count || 0} lines • {fileIntelligence?.symbols.length || 0} symbol{fileIntelligence?.symbols.length === 1 ? '' : 's'} defined
                    </p>
                  </div>
                </div>

                {/* Import Dependencies Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Imported Files */}
                  <Tilt maxAngle={2} className="h-full">
                    <Spotlight variant="teal" className="rounded-xl h-full">
                      <div className="p-4 rounded-xl border border-[#577877]/30 bg-[#1B2D2A] space-y-3 h-full">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#F0F5F7] uppercase tracking-wider">
                          <ArrowRight className="w-3.5 h-3.5 text-[#577877]" />
                          <span>Files Imported by this File</span>
                        </div>
                        {relationshipsData?.file_dependencies?.[selectedFile]?.length ? (
                          <div className="space-y-1">
                            {relationshipsData.file_dependencies[selectedFile].map((dep: string) => (
                              <div
                                key={dep}
                                className="px-2.5 py-1.5 rounded-lg bg-[#111E1C] border border-[#577877]/30 text-xs font-mono text-[#B9CECC] flex items-center gap-2"
                              >
                                <FileCode className="w-3 h-3 text-[#577877]" />
                                <span className="truncate">{dep}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-[#577877] italic">No local file dependencies.</p>
                        )}
                      </div>
                    </Spotlight>
                  </Tilt>

                  {/* Dependent Files (Who imports this) */}
                  <Tilt maxAngle={2} className="h-full">
                    <Spotlight variant="teal" className="rounded-xl h-full">
                      <div className="p-4 rounded-xl border border-[#577877]/30 bg-[#1B2D2A] space-y-3 h-full">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#F0F5F7] uppercase tracking-wider">
                          <Layers className="w-3.5 h-3.5 text-[#577877]" />
                          <span>Files that Import this File</span>
                        </div>
                        {relationshipsData?.file_dependents?.[selectedFile]?.length ? (
                          <div className="space-y-1">
                            {relationshipsData.file_dependents[selectedFile].map((dep: string) => (
                              <div
                                key={dep}
                                className="px-2.5 py-1.5 rounded-lg bg-[#111E1C] border border-[#577877]/30 text-xs font-mono text-[#B9CECC] flex items-center gap-2"
                              >
                                <FileCode className="w-3 h-3 text-[#577877]" />
                                <span className="truncate">{dep}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-[#577877] italic">No local files import this file directly.</p>
                        )}
                      </div>
                    </Spotlight>
                  </Tilt>
                </div>

                {/* Symbols Declared in this File */}
                <div className="p-4 rounded-xl border border-[#577877]/30 bg-[#1B2D2A] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#F0F5F7] uppercase tracking-wider">
                    <Braces className="w-3.5 h-3.5 text-[#577877]" />
                    <span>Symbols Defined in this File</span>
                  </div>

                  {loadingFile ? (
                    <div className="py-6 text-center text-xs text-[#577877]">Loading symbols...</div>
                  ) : fileIntelligence?.symbols.length ? (
                    <div className="space-y-2">
                      {fileIntelligence.symbols.map((sym, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-lg bg-[#111E1C] border border-[#577877]/30 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${getSymbolBadgeColor(
                                sym.symbol_type
                              )}`}
                            >
                              {sym.symbol_type}
                            </span>
                            <span className="font-mono font-medium text-[#F0F5F7]">{sym.name}</span>
                            {sym.parent_symbol && (
                              <span className="text-[#577877] text-[11px]">in {sym.parent_symbol}</span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-[#B9CECC]">
                            lines {sym.start_line}-{sym.end_line}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#577877] italic">No top-level functions or classes detected in this file.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[#577877] text-xs">
                <span>Select a file from the left to inspect its dependency tree and AST declarations.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
