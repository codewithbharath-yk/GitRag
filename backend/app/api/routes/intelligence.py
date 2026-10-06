"""
Code Intelligence API Routes.

Exposes REST endpoints for querying AST-parsed symbols, file dependencies,
class/method hierarchies, code relationships, fuzzy symbol search,
repository hotspot analysis, and class hierarchy introspection.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status, Depends

from app.auth.models import User
from app.auth.dependencies import get_current_user, get_optional_user
from app.intelligence.models import (
    CodeSymbol,
    SymbolType,
    ParsedFileIntelligence,
    CodeRelationship,
)
from app.intelligence.service import get_intelligence_service
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/repositories", tags=["Code Intelligence"])


@router.get(
    "/{repository_id}/symbols",
    response_model=List[CodeSymbol],
    status_code=status.HTTP_200_OK,
    summary="Search Repository Symbols",
    description="Query AST-extracted symbols (functions, classes, methods, constants) with optional name or type filter.",
)
async def get_repository_symbols(
    repository_id: str,
    branch: Optional[str] = Query(default="main", description="Branch name"),
    file_path: Optional[str] = Query(default=None, description="Filter symbols by specific relative file path"),
    query: Optional[str] = Query(default=None, description="Symbol name substring or prefix search"),
    symbol_type: Optional[SymbolType] = Query(default=None, description="Filter by symbol type (class, function, method)"),
) -> List[CodeSymbol]:
    intel_service = get_intelligence_service()
    intel = intel_service.get_repository_intelligence(repository_id, branch=branch or "main")

    if not intel:
        # Repository not indexed or has no intelligence
        return []

    symbols: List[CodeSymbol] = []
    if file_path:
        norm_path = file_path.replace("\\", "/")
        for p, file_intel in intel.files.items():
            if p == norm_path or p.endswith(norm_path) or norm_path.endswith(p):
                symbols = file_intel.symbols
                break
    else:
        for file_intel in intel.files.values():
            symbols.extend(file_intel.symbols)

    # Filter by query
    if query:
        q_low = query.strip().lower()
        symbols = [s for s in symbols if q_low in s.name.lower()]

    # Filter by type
    if symbol_type:
        symbols = [s for s in symbols if s.symbol_type == symbol_type]

    return symbols


@router.get(
    "/{repository_id}/file-intelligence",
    response_model=ParsedFileIntelligence,
    status_code=status.HTTP_200_OK,
    summary="Get File Structural Intelligence",
    description="Retrieve parsed AST intelligence for a file including classes, methods, imports, and relationships.",
)
async def get_file_intelligence(
    repository_id: str,
    file_path: str = Query(..., description="Relative file path"),
    branch: Optional[str] = Query(default="main", description="Branch name"),
) -> ParsedFileIntelligence:
    intel_service = get_intelligence_service()
    intel = intel_service.get_repository_intelligence(repository_id, branch=branch or "main")

    if not intel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No intelligence index found for repository '{repository_id}'. Please index the repository first.",
        )

    norm_path = file_path.replace("\\", "/")
    for p, file_intel in intel.files.items():
        if p == norm_path or p.endswith(norm_path) or norm_path.endswith(p):
            return file_intel

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"File '{file_path}' not found in code intelligence index for repository '{repository_id}'.",
    )


@router.get(
    "/{repository_id}/relationships",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Get Code Relationships & Dependency Graph",
    description="Retrieve the repository dependency graph: files imported, files dependent, and cross-file relationships.",
)
async def get_code_relationships(
    repository_id: str,
    file_path: Optional[str] = Query(default=None, description="Optional file path to isolate dependency tree"),
    branch: Optional[str] = Query(default="main", description="Branch name"),
) -> Dict[str, Any]:
    intel_service = get_intelligence_service()
    intel = intel_service.get_repository_intelligence(repository_id, branch=branch or "main")

    if not intel:
        return {
            "repository_id": repository_id,
            "branch": branch or "main",
            "file_dependencies": {},
            "file_dependents": {},
            "total_files": 0,
        }

    if file_path:
        deps = intel_service.get_file_dependencies(repository_id, file_path, branch=branch or "main")
        return {
            "repository_id": repository_id,
            "branch": branch or "main",
            "file_path": deps.get("file_path", file_path),
            "imports": deps.get("imports", []),
            "imported_by": deps.get("imported_by", []),
        }

    return {
        "repository_id": repository_id,
        "branch": branch or "main",
        "total_files": intel.total_files,
        "total_symbols": intel.total_symbols,
        "file_dependencies": intel.file_dependencies,
        "file_dependents": intel.file_dependents,
    }


@router.get(
    "/{repository_id}/hotspots",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Repository Hotspot Analysis",
    description="""
    Identifies the most architecturally significant files and symbols:
    - most_imported_files: files depended upon by the most other files
    - most_symbols_files: files with the highest symbol density
    - dependency_hub_files: files that import the most other files
    - most_referenced_symbols: symbol names referenced across the most import statements
    """,
)
async def get_repository_hotspots(
    repository_id: str,
    branch: Optional[str] = Query(default="main", description="Branch name"),
    top_k: int = Query(default=10, ge=1, le=50, description="Number of top entries per category"),
) -> Dict[str, Any]:
    intel_service = get_intelligence_service()
    hotspots = intel_service.get_repository_hotspots(
        repository_id=repository_id,
        branch=branch or "main",
        top_k=top_k,
    )
    if not hotspots:
        return {
            "repository_id": repository_id,
            "branch": branch or "main",
            "total_files": 0,
            "total_symbols": 0,
            "most_imported_files": [],
            "most_symbols_files": [],
            "dependency_hub_files": [],
            "most_referenced_symbols": [],
        }
    return hotspots


@router.get(
    "/{repository_id}/symbols/search",
    response_model=List[Dict[str, Any]],
    status_code=status.HTTP_200_OK,
    summary="Fuzzy Symbol Search",
    description="Search symbols by fuzzy/approximate name matching. Returns scored results ranked by similarity.",
)
async def fuzzy_search_symbols(
    repository_id: str,
    q: str = Query(..., description="Search query for fuzzy symbol name matching"),
    branch: Optional[str] = Query(default="main", description="Branch name"),
    top_k: int = Query(default=10, ge=1, le=50, description="Maximum results to return"),
    min_score: float = Query(default=0.4, ge=0.0, le=1.0, description="Minimum similarity score (0.0 - 1.0)"),
) -> List[Dict[str, Any]]:
    intel_service = get_intelligence_service()
    results = intel_service.fuzzy_search_symbols(
        repository_id=repository_id,
        query=q,
        branch=branch or "main",
        top_k=top_k,
        min_score=min_score,
    )
    return [
        {
            "symbol": sym.model_dump(),
            "score": score,
        }
        for sym, score in results
    ]


@router.get(
    "/{repository_id}/classes/{class_name}/hierarchy",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Class Hierarchy & Methods",
    description="Retrieve a class's full definition including all methods with parameters, return types, docstrings, and source snippets.",
)
async def get_class_hierarchy(
    repository_id: str,
    class_name: str,
    branch: Optional[str] = Query(default="main", description="Branch name"),
) -> Dict[str, Any]:
    intel_service = get_intelligence_service()
    hierarchy = intel_service.get_class_hierarchy(
        repository_id=repository_id,
        class_name=class_name,
        branch=branch or "main",
    )
    if not hierarchy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class '{class_name}' not found in repository '{repository_id}'. Ensure the repository is indexed.",
        )
    return hierarchy
