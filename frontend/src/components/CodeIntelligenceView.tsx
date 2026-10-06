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
} from 'lucide-react';
import { api } from '../api/client';
import type {
  StoredRepository,
  CodeSymbol,
  SymbolType,
  ParsedFileIntelligence,
} from '../types/api';

interface CodeIntelligenceViewProps {
  repository: StoredRepository;
  onAskQuestion?: (question: string) => void;
}

export const CodeIntelligenceView: React.FC<CodeIntelligenceViewProps> = ({
  repository,
  onAskQuestion,
}) => {
  const [symbols, setSymbols] = useState<CodeSymbol[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedSymbol, setSelectedSymbol] = useState<CodeSymbol | null>(null);

  // File Dependency / Intelligence mode
  const [viewMode, setViewMode] = useState<'symbols' | 'files'>('symbols');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileIntelligence, setFileIntelligence] = useState<ParsedFileIntelligence | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [relationshipsData, setRelationshipsData] = useState<any>(null);

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
    } catch (err) {
      console.error('Failed to load relationships:', err);
    }
  }, [repository.id, repository.branch]);

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
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'function':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'method':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'constant':
      case 'variable':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
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
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-100 tracking-tight">
                Code Intelligence & AST Structure
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Tree-Sitter & AST
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              {repository.fullName} • branch: {repository.branch} • {symbols.length} symbols extracted
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="p-1 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-1 text-xs">
            <button
              onClick={() => setViewMode('symbols')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                viewMode === 'symbols'
                  ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Braces className="w-3.5 h-3.5" />
              <span>Symbol Explorer</span>
            </button>
            <button
              onClick={() => {
                setViewMode('files');
                if (!selectedFile && allIndexedFiles.length > 0) {
                  setSelectedFile(allIndexedFiles[0]);
                }
              }}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                viewMode === 'files'
                  ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>File Architecture</span>
            </button>
          </div>

          <button
            onClick={loadSymbols}
            disabled={loading}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800 transition-colors"
            title="Refresh symbols"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'symbols' ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Symbol List and Filters */}
          <div className="w-96 border-r border-slate-800/80 bg-slate-950 flex flex-col shrink-0">
            {/* Search and Filters */}
            <div className="p-3 border-b border-slate-800 space-y-2 bg-slate-900/40">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search symbols or files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
                />
              </div>

              {/* Filter Type Pills */}
              <div className="flex items-center gap-1 overflow-x-auto text-[11px] pb-1 scrollbar-none">
                {['all', 'function', 'class', 'method', 'constant'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedType(t)}
                    className={`px-2.5 py-1 rounded-md capitalize font-medium transition-all ${
                      selectedType === t
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Symbols Scrollable List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-xs gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                  <span>Parsing repository symbols...</span>
                </div>
              ) : filteredSymbols.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs px-4">
                  No symbols found matching your criteria. Try indexing the repository or clearing search filters.
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
                          ? 'bg-cyan-950/40 border-cyan-500/50 shadow-sm shadow-cyan-500/10'
                          : 'bg-slate-900/30 border-slate-850 hover:bg-slate-900 hover:border-slate-800'
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
                          <span className="font-mono font-medium text-slate-200 truncate block">
                            {sym.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate flex items-center gap-1">
                          <span>{sym.file_path}</span>
                          <span>:</span>
                          <span className="text-cyan-400">L{sym.start_line}-{sym.end_line}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Symbol Detail Inspector */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
            {selectedSymbol ? (
              <div className="max-w-3xl space-y-6">
                {/* Symbol Header Card */}
                <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm space-y-4">
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
                          <span className="text-xs text-slate-400 font-mono">
                            in class <strong className="text-slate-200">{selectedSymbol.parent_symbol}</strong>
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 font-mono">
                          {selectedSymbol.language}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold font-mono text-white tracking-tight">
                        {selectedSymbol.name}
                      </h2>
                    </div>

                    {/* Ask in Chat Action Button */}
                    <button
                      onClick={() => handleAskAboutSymbol(selectedSymbol)}
                      className="py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-600/20 transition-all active:scale-[0.98]"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Ask in Chat</span>
                    </button>
                  </div>

                  {/* Metadata Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Location</span>
                      <span className="text-slate-200 truncate block">{selectedSymbol.file_path}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Lines</span>
                      <span className="text-cyan-400 font-semibold">
                        L{selectedSymbol.start_line} – L{selectedSymbol.end_line}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Parameters</span>
                      <span className="text-slate-200">
                        {selectedSymbol.parameters?.length ? selectedSymbol.parameters.join(', ') : 'none'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Return Type</span>
                      <span className="text-slate-200">{selectedSymbol.return_type || 'unspecified'}</span>
                    </div>
                  </div>
                </div>

                {/* Docstring */}
                {selectedSymbol.docstring && (
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/30 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Documentation</span>
                    </div>
                    <p className="text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-wrap">
                      {selectedSymbol.docstring}
                    </p>
                  </div>
                )}

                {/* Source Snippet */}
                {selectedSymbol.source_snippet && (
                  <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/60 shadow-xl">
                    <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                      <span>Source Code Snippet</span>
                      <span>lines {selectedSymbol.start_line}-{selectedSymbol.end_line}</span>
                    </div>
                    <pre className="p-4 text-xs font-mono text-cyan-100 overflow-x-auto leading-relaxed bg-slate-950/80">
                      <code>{selectedSymbol.source_snippet}</code>
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
                <Box className="w-8 h-8 text-slate-600 mb-2" />
                <span>Select a symbol to inspect its definition, parameters, and AST boundaries.</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* View Mode: Files & Dependencies */
        <div className="flex-1 flex overflow-hidden">
          {/* File Selector */}
          <div className="w-80 border-r border-slate-800/80 bg-slate-950 flex flex-col shrink-0">
            <div className="p-3 border-b border-slate-800 bg-slate-900/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Indexed Source Files
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {allIndexedFiles.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
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
                          ? 'bg-cyan-950/40 border-cyan-500/50 shadow-sm shadow-cyan-500/10'
                          : 'bg-slate-900/30 border-slate-850 hover:bg-slate-900 hover:border-slate-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="font-mono text-slate-200 font-medium truncate block">
                            {file}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          imports {deps.length} file(s)
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* File Architecture Details */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-950 space-y-6">
            {selectedFile ? (
              <div className="max-w-3xl space-y-6">
                {/* File Header */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold font-mono text-white">{selectedFile}</h2>
                    <p className="text-xs text-slate-400 font-mono">
                      {fileIntelligence?.line_count || 0} lines • {fileIntelligence?.symbols.length || 0} symbol(s) defined
                    </p>
                  </div>
                </div>

                {/* Import Dependencies Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Imported Files */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/30 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Files Imported by this File</span>
                    </div>
                    {relationshipsData?.file_dependencies?.[selectedFile]?.length ? (
                      <div className="space-y-1">
                        {relationshipsData.file_dependencies[selectedFile].map((dep: string) => (
                          <div
                            key={dep}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 flex items-center gap-2"
                          >
                            <FileCode className="w-3 h-3 text-cyan-400" />
                            <span className="truncate">{dep}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No local file dependencies.</p>
                    )}
                  </div>

                  {/* Dependent Files (Who imports this) */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/30 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      <span>Files that Import this File</span>
                    </div>
                    {relationshipsData?.file_dependents?.[selectedFile]?.length ? (
                      <div className="space-y-1">
                        {relationshipsData.file_dependents[selectedFile].map((dep: string) => (
                          <div
                            key={dep}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-blue-300 flex items-center gap-2"
                          >
                            <FileCode className="w-3 h-3 text-blue-400" />
                            <span className="truncate">{dep}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No local files import this file directly.</p>
                    )}
                  </div>
                </div>

                {/* Symbols Declared in this File */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/30 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    <Braces className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Symbols Defined in this File</span>
                  </div>

                  {loadingFile ? (
                    <div className="py-6 text-center text-xs text-slate-500">Loading symbols...</div>
                  ) : fileIntelligence?.symbols.length ? (
                    <div className="space-y-2">
                      {fileIntelligence.symbols.map((sym, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-lg bg-slate-950/70 border border-slate-850 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${getSymbolBadgeColor(
                                sym.symbol_type
                              )}`}
                            >
                              {sym.symbol_type}
                            </span>
                            <span className="font-mono font-medium text-slate-200">{sym.name}</span>
                            {sym.parent_symbol && (
                              <span className="text-slate-500 text-[11px]">in {sym.parent_symbol}</span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-cyan-400">
                            lines {sym.start_line}-{sym.end_line}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No top-level functions or classes detected in this file.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
                <span>Select a file from the left to inspect its dependency tree and AST declarations.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
