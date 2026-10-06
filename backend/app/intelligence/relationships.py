"""
Relationship Builder and Cross-File Dependency Resolver.

Builds graph-like relationships across the repository based on parsed AST evidence:
- Resolves file imports to local project files where possible.
- Tracks which files depend on file X and which files file X depends on.
- Indexes symbols by name for fast O(1) symbol lookup.
"""

from pathlib import Path
from typing import Dict, List, Set, Optional

from app.intelligence.models import (
    ParsedFileIntelligence,
    CodeSymbol,
    CodeImport,
    CodeRelationship,
    RelationshipType,
    RepositoryIntelligenceData,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)


class RelationshipBuilder:
    """
    Builds repository-wide intelligence indexes and resolves code relationships.
    """

    @staticmethod
    def build_repository_intelligence(
        repository_id: str,
        branch: str,
        parsed_files: Dict[str, ParsedFileIntelligence],
    ) -> RepositoryIntelligenceData:
        """
        Synthesize file-level intelligence into an indexed whole-repository intelligence model.
        """
        all_file_paths = set(parsed_files.keys())
        symbol_index: Dict[str, List[CodeSymbol]] = {}
        file_dependencies: Dict[str, List[str]] = {p: [] for p in all_file_paths}
        file_dependents: Dict[str, List[str]] = {p: [] for p in all_file_paths}
        total_symbols = 0

        # 1. Build Symbol Index
        for file_path, file_intel in parsed_files.items():
            for symbol in file_intel.symbols:
                total_symbols += 1
                sym_name = symbol.name
                if sym_name not in symbol_index:
                    symbol_index[sym_name] = []
                symbol_index[sym_name].append(symbol)

                # Also index lowercase for case-insensitive lookup
                sym_lower = sym_name.lower()
                if sym_lower != sym_name:
                    if sym_lower not in symbol_index:
                        symbol_index[sym_lower] = []
                    symbol_index[sym_lower].append(symbol)

        # 2. Resolve Cross-File Import Dependencies
        for file_path, file_intel in parsed_files.items():
            resolved_deps: Set[str] = set()

            for imp in file_intel.imports:
                target_file = RelationshipBuilder._resolve_import_to_file(
                    importing_file=file_path,
                    source_module=imp.source_module,
                    all_files=all_file_paths,
                )
                if target_file and target_file != file_path:
                    resolved_deps.add(target_file)
                    # Add explicit inter-file relationship
                    file_intel.relationships.append(
                        CodeRelationship(
                            source=file_path,
                            target=target_file,
                            relationship_type=RelationshipType.IMPORTS,
                            file_path=file_path,
                            line_number=imp.line_number,
                            metadata={"resolved_file": target_file},
                        )
                    )

            file_dependencies[file_path] = sorted(list(resolved_deps))
            for dep in resolved_deps:
                if dep in file_dependents:
                    file_dependents[dep].append(file_path)

        # Deduplicate dependents
        for dep in file_dependents:
            file_dependents[dep] = sorted(list(set(file_dependents[dep])))

        return RepositoryIntelligenceData(
            repository_id=repository_id,
            branch=branch,
            total_files=len(parsed_files),
            total_symbols=total_symbols,
            files=parsed_files,
            symbol_index=symbol_index,
            file_dependencies=file_dependencies,
            file_dependents=file_dependents,
        )

    @staticmethod
    def _resolve_import_to_file(
        importing_file: str,
        source_module: str,
        all_files: Set[str],
    ) -> Optional[str]:
        """
        Attempt to map an import string (e.g., './auth', 'app.rag.chunker', 'user_service')
        to an actual repository file path. Returns None if external library.
        """
        if not source_module:
            return None

        # Clean string
        mod = source_module.replace("\\", "/").strip("./")

        # 1. Exact match with extension
        for ext in (".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".go"):
            candidate = f"{mod}{ext}"
            if candidate in all_files:
                return candidate

        # 2. Relative resolution from importing file's directory
        importing_dir = Path(importing_file).parent.as_posix()
        if importing_dir and importing_dir != ".":
            for ext in (".py", ".js", ".jsx", ".ts", ".tsx"):
                candidate = f"{importing_dir}/{mod}{ext}"
                if candidate in all_files:
                    return candidate
                # index file resolution
                index_candidate = f"{importing_dir}/{mod}/index{ext}"
                if index_candidate in all_files:
                    return index_candidate

        # 3. Python dotted path conversion: app.rag.chunker -> app/rag/chunker.py
        slashed = mod.replace(".", "/")
        for ext in (".py", ".js", ".ts"):
            candidate = f"{slashed}{ext}"
            if candidate in all_files:
                return candidate
            # also search within subdirectories
            for f in all_files:
                if f.endswith(f"/{candidate}"):
                    return f

        # 4. Submodule / basename match (e.g. 'sample_code.sample_repo.database' -> 'database.py')
        last_segment = mod.split(".")[-1].split("/")[-1].lower()
        matching_files = [f for f in all_files if Path(f).stem.lower() == last_segment]
        if len(matching_files) == 1:
            return matching_files[0]

        return None
