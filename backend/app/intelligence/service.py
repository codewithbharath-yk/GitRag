"""
Code Intelligence Service.

Coordinates file parsing, repository-wide intelligence caching,
symbol lookups, dependency graph queries, structural intent detection,
hotspot analysis, fuzzy search, and class hierarchy resolution.
"""

from typing import Dict, List, Optional, Tuple, Any
import re
from difflib import SequenceMatcher

from app.intelligence.models import (
    CodeSymbol,
    CodeRelationship,
    ParsedFileIntelligence,
    RepositoryIntelligenceData,
    SymbolType,
)
from app.intelligence.parser import CodeParserService
from app.intelligence.relationships import RelationshipBuilder
from app.rag.file_scanner import DiscoveredFile
from app.utils.logger import get_logger

logger = get_logger(__name__)


class IntelligenceService:
    """
    Central service for Code Intelligence operations.
    """

    def __init__(self, parser_service: Optional[CodeParserService] = None):
        self.parser_service = parser_service or CodeParserService()
        # Cache indexed intelligence per (repository_id, branch)
        self._intel_cache: Dict[Tuple[str, str], RepositoryIntelligenceData] = {}

    def analyze_repository_files(
        self,
        repository_id: str,
        branch: str,
        files: List[DiscoveredFile],
    ) -> RepositoryIntelligenceData:
        """
        Parse all discovered source files, extract AST symbols, and build
        a cross-file dependency graph and symbol index.
        """
        logger.info(f"Analyzing {len(files)} files for code intelligence (repo={repository_id}, branch={branch})...")
        parsed_files: Dict[str, ParsedFileIntelligence] = {}

        for f in files:
            file_intel = self.parser_service.parse_file(
                file_path=f.path,
                content=f.content,
                language=f.language,
            )
            parsed_files[f.path] = file_intel

        repo_intel = RelationshipBuilder.build_repository_intelligence(
            repository_id=repository_id,
            branch=branch,
            parsed_files=parsed_files,
        )

        # Store in cache
        key = (repository_id, branch)
        self._intel_cache[key] = repo_intel
        logger.info(
            f"Code intelligence analysis complete for {repository_id}: "
            f"{repo_intel.total_symbols} symbols across {repo_intel.total_files} files."
        )
        return repo_intel

    def get_repository_intelligence(
        self,
        repository_id: str,
        branch: str = "main",
    ) -> Optional[RepositoryIntelligenceData]:
        """
        Retrieve cached repository intelligence.
        """
        key = (repository_id, branch)
        if key in self._intel_cache:
            return self._intel_cache[key]
        # Fallback to any branch if default
        for (r_id, _), intel in self._intel_cache.items():
            if r_id == repository_id:
                return intel
        return None

    def lookup_symbol(
        self,
        repository_id: str,
        symbol_name: str,
        branch: str = "main",
    ) -> List[CodeSymbol]:
        """
        Look up code symbols by exact name or case-insensitive match.
        """
        intel = self.get_repository_intelligence(repository_id, branch)
        if not intel:
            return []

        # Exact match
        if symbol_name in intel.symbol_index:
            return intel.symbol_index[symbol_name]
        # Lowercase match
        sym_low = symbol_name.lower()
        if sym_low in intel.symbol_index:
            return intel.symbol_index[sym_low]
        return []

    def fuzzy_search_symbols(
        self,
        repository_id: str,
        query: str,
        branch: str = "main",
        top_k: int = 10,
        min_score: float = 0.4,
    ) -> List[Tuple[CodeSymbol, float]]:
        """
        Fuzzy search symbols by name similarity.
        Returns a ranked list of (symbol, score) tuples where score is 0.0-1.0.
        """
        intel = self.get_repository_intelligence(repository_id, branch)
        if not intel:
            return []

        query_low = query.strip().lower()
        scored: List[Tuple[CodeSymbol, float]] = []

        seen: set = set()
        for sym_name, sym_list in intel.symbol_index.items():
            # Skip lowercase duplicate keys
            if sym_name != sym_name.lower() and sym_name.lower() in intel.symbol_index:
                continue
            ratio = SequenceMatcher(None, query_low, sym_name.lower()).ratio()
            # Also check substring containment as a boost
            if query_low in sym_name.lower():
                ratio = max(ratio, 0.7)
            if ratio >= min_score:
                for sym in sym_list:
                    key = (sym.file_path, sym.name, sym.start_line)
                    if key not in seen:
                        seen.add(key)
                        scored.append((sym, round(ratio, 3)))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]

    def get_class_hierarchy(
        self,
        repository_id: str,
        class_name: str,
        branch: str = "main",
    ) -> Dict[str, Any]:
        """
        Return methods, parent class, and sibling context for a given class name.
        """
        intel = self.get_repository_intelligence(repository_id, branch)
        if not intel:
            return {}

        classes = [
            s for s in self.lookup_symbol(repository_id, class_name, branch)
            if s.symbol_type.value == "class"
        ]
        if not classes:
            return {}

        result = []
        for cls in classes:
            file_intel = intel.files.get(cls.file_path)
            methods = []
            if file_intel:
                methods = [
                    {
                        "name": s.name,
                        "start_line": s.start_line,
                        "end_line": s.end_line,
                        "parameters": s.parameters,
                        "return_type": s.return_type,
                        "docstring": s.docstring,
                        "source_snippet": s.source_snippet,
                    }
                    for s in file_intel.symbols
                    if s.parent_symbol == cls.name
                ]
            result.append({
                "name": cls.name,
                "file_path": cls.file_path,
                "start_line": cls.start_line,
                "end_line": cls.end_line,
                "language": cls.language,
                "docstring": cls.docstring,
                "source_snippet": cls.source_snippet,
                "methods": methods,
            })

        return {"class_name": class_name, "definitions": result}

    def get_repository_hotspots(
        self,
        repository_id: str,
        branch: str = "main",
        top_k: int = 10,
    ) -> Dict[str, Any]:
        """
        Identify the most important files and symbols in the repository by:
        - File hotspots: files that are most imported by other files
        - Symbol hotspots: files with the most symbols defined
        - Dependency hubs: files that import the most other files
        """
        intel = self.get_repository_intelligence(repository_id, branch)
        if not intel:
            return {}

        # Most imported files (highest dependent count)
        import_counts = {
            fp: len(dependents)
            for fp, dependents in intel.file_dependents.items()
        }
        most_imported = sorted(import_counts.items(), key=lambda x: x[1], reverse=True)[:top_k]

        # Files with most symbols defined
        symbol_counts = {
            fp: len(fi.symbols)
            for fp, fi in intel.files.items()
        }
        most_symbols = sorted(symbol_counts.items(), key=lambda x: x[1], reverse=True)[:top_k]

        # Files that import the most other files (dependency hubs)
        dep_hub_counts = {
            fp: len(deps)
            for fp, deps in intel.file_dependencies.items()
        }
        dep_hubs = sorted(dep_hub_counts.items(), key=lambda x: x[1], reverse=True)[:top_k]

        # Most referenced symbols (appearing in the most files' import lists by name)
        sym_ref_counts: Dict[str, int] = {}
        for fp, fi in intel.files.items():
            for imp in fi.imports:
                for sym_name in imp.imported_symbols:
                    sym_ref_counts[sym_name] = sym_ref_counts.get(sym_name, 0) + 1
        most_referenced_syms = sorted(sym_ref_counts.items(), key=lambda x: x[1], reverse=True)[:top_k]

        return {
            "repository_id": repository_id,
            "branch": branch,
            "total_files": intel.total_files,
            "total_symbols": intel.total_symbols,
            "most_imported_files": [
                {"file_path": fp, "imported_by_count": count}
                for fp, count in most_imported
            ],
            "most_symbols_files": [
                {"file_path": fp, "symbol_count": count}
                for fp, count in most_symbols
            ],
            "dependency_hub_files": [
                {"file_path": fp, "imports_count": count}
                for fp, count in dep_hubs
            ],
            "most_referenced_symbols": [
                {"symbol_name": name, "reference_count": count}
                for name, count in most_referenced_syms
            ],
        }

    def get_file_symbols(
        self,
        repository_id: str,
        file_path: str,
        branch: str = "main",
    ) -> List[CodeSymbol]:
        """
        Retrieve all symbols declared in a specific file.
        """
        intel = self.get_repository_intelligence(repository_id, branch)
        if not intel or file_path not in intel.files:
            return []
        return intel.files[file_path].symbols

    def get_file_dependencies(
        self,
        repository_id: str,
        file_path: str,
        branch: str = "main",
    ) -> Dict[str, Any]:
        """
        Return the list of files imported by file_path, and files that import file_path.
        """
        intel = self.get_repository_intelligence(repository_id, branch)
        if not intel:
            return {"imports": [], "imported_by": []}

        # Normalize file path matching
        norm_path = file_path.replace("\\", "/")
        matching_path = None
        for p in intel.files.keys():
            if p == norm_path or p.endswith(norm_path) or norm_path.endswith(p):
                matching_path = p
                break

        if not matching_path:
            return {"imports": [], "imported_by": []}

        return {
            "file_path": matching_path,
            "imports": intel.file_dependencies.get(matching_path, []),
            "imported_by": intel.file_dependents.get(matching_path, []),
        }

    def detect_structural_context(
        self,
        repository_id: str,
        query: str,
        branch: str = "main",
        max_evidence_items: int = 12,
    ) -> Optional[str]:
        """
        Analyzes a natural language question for structural inquiries:
        - "Where is <symbol> defined?"
        - "What methods belong to <Class>?"
        - "Which files import <file>?"
        - "What parameters does <function> take?"
        Returns richly formatted structural evidence text including docstrings,
        parameters, return types, and source snippets where available.
        """
        intel = self.get_repository_intelligence(repository_id, branch)
        if not intel:
            return None

        evidence_lines = []
        tokens = re.findall(r"[A-Za-z0-9_\.]+", query)
        query_low = query.lower()

        STOP_WORDS = {
            "where", "what", "which", "how", "does", "the", "this", "that",
            "with", "from", "class", "file", "are", "all", "any", "can",
            "and", "for", "have", "has", "its", "get", "set", "list",
        }

        def _format_symbol_evidence(sym: CodeSymbol) -> str:
            """Format a symbol with rich metadata for the prompt."""
            parent_info = f" (method of class '{sym.parent_symbol}')" if sym.parent_symbol else ""
            params_info = ""
            if sym.parameters:
                params_info = f" | params: ({', '.join(sym.parameters)})"
            ret_info = f" | returns: {sym.return_type}" if sym.return_type else ""
            doc_info = f" | doc: {sym.docstring[:120]}" if sym.docstring else ""
            snippet_info = ""
            if sym.source_snippet:
                first_line = sym.source_snippet.split("\n")[0].strip()
                snippet_info = f"\n    signature: `{first_line}`"
            return (
                f"[Symbol Definition] {sym.symbol_type.value.capitalize()} '{sym.name}'{parent_info} "
                f"→ {sym.file_path}:L{sym.start_line}-{sym.end_line} [{sym.language}]"
                f"{params_info}{ret_info}{doc_info}{snippet_info}"
            )

        # 1. File dependency questions ("which files import auth.py", "who depends on database")
        if any(term in query_low for term in ["import", "depend", "require", "who uses", "used by"]):
            for token in tokens:
                if token.lower() in STOP_WORDS:
                    continue
                clean_tok = token.rstrip(".")
                for fpath, dependents in intel.file_dependents.items():
                    if clean_tok.lower() in fpath.lower():
                        if dependents:
                            deps_str = ", ".join(dependents)
                            evidence_lines.append(
                                f"[File Relationship] File '{fpath}' is imported by {len(dependents)} file(s): {deps_str}."
                            )
                        else:
                            evidence_lines.append(
                                f"[File Relationship] File '{fpath}' is not imported by any other local file."
                            )

        # 2. Class method / structure questions
        if any(term in query_low for term in ["method", "function", "belong", "contain", "inside", "define"]):
            for token in tokens:
                if token.lower() in STOP_WORDS or len(token) < 3:
                    continue
                matches = [
                    s for s in self.lookup_symbol(repository_id, token, branch)
                    if s.symbol_type == SymbolType.CLASS
                ]
                for cls_sym in matches:
                    file_intel = intel.files.get(cls_sym.file_path)
                    if file_intel:
                        methods = [
                            s for s in file_intel.symbols
                            if s.parent_symbol == cls_sym.name or (
                                s.symbol_type == SymbolType.METHOD and
                                cls_sym.start_line <= s.start_line <= cls_sym.end_line
                            )
                        ]
                        if methods:
                            m_detail = []
                            for m in methods:
                                pstr = f"({', '.join(m.parameters)})" if m.parameters else "()"
                                rstr = f" → {m.return_type}" if m.return_type else ""
                                m_detail.append(f"{m.name}{pstr}{rstr} [L{m.start_line}-{m.end_line}]")
                            cls_doc = f" | doc: {cls_sym.docstring[:80]}" if cls_sym.docstring else ""
                            evidence_lines.append(
                                f"[Class Structure] Class '{cls_sym.name}' in {cls_sym.file_path}"
                                f" (L{cls_sym.start_line}-{cls_sym.end_line}){cls_doc}\n"
                                f"    Methods: {', '.join(m_detail)}"
                            )

        # 3. Specific symbol definition / parameter / return type questions
        for token in tokens:
            if len(token) < 3 or token.lower() in STOP_WORDS:
                continue
            sym_matches = self.lookup_symbol(repository_id, token, branch)
            for sym in sym_matches:
                evidence_lines.append(_format_symbol_evidence(sym))

        # 4. If no direct hit, try fuzzy search for top candidates
        if not evidence_lines and len(query.strip()) >= 4:
            fuzzy_hits = self.fuzzy_search_symbols(repository_id, query, branch, top_k=3)
            for sym, score in fuzzy_hits:
                evidence_lines.append(
                    f"[Fuzzy Symbol Match (score={score})] {_format_symbol_evidence(sym)}"
                )

        if evidence_lines:
            unique_evidence = list(dict.fromkeys(evidence_lines))
            return "\n".join(unique_evidence[:max_evidence_items])

        return None


# Global singleton instance
_intelligence_service_instance: Optional[IntelligenceService] = None


def get_intelligence_service() -> IntelligenceService:
    global _intelligence_service_instance
    if _intelligence_service_instance is None:
        _intelligence_service_instance = IntelligenceService()
    return _intelligence_service_instance
