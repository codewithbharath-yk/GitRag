"""
Data Models for Advanced Code Intelligence and Structural Code Analysis.

Defines schemas for symbols (classes, methods, functions, imports, exports),
relationships (contains, imports, located_in, calls), and repository intelligence index.
"""

from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class SymbolType(str, Enum):
    FUNCTION = "function"
    METHOD = "method"
    CLASS = "class"
    INTERFACE = "interface"
    IMPORT = "import"
    EXPORT = "export"
    VARIABLE = "variable"
    CONSTANT = "constant"


class RelationshipType(str, Enum):
    IMPORTS = "imports"          # FILE A -> imports -> FILE B (or MODULE B)
    CONTAINS = "contains"        # CLASS A -> contains -> METHOD B
    LOCATED_IN = "located_in"    # SYMBOL A -> located_in -> FILE A
    EXTENDS = "extends"          # CLASS A -> extends -> CLASS B


class CodeSymbol(BaseModel):
    """
    Represents an extracted code symbol (function, class, method, etc.).
    """
    name: str = Field(..., description="Symbol identifier name")
    symbol_type: SymbolType = Field(..., description="Type of symbol")
    file_path: str = Field(..., description="Relative file path in repository")
    start_line: int = Field(..., description="1-indexed starting line")
    end_line: int = Field(..., description="1-indexed ending line")
    parent_symbol: Optional[str] = Field(default=None, description="Parent class or container name")
    language: str = Field(default="unknown", description="Programming language")
    parameters: List[str] = Field(default_factory=list, description="Parameter names if applicable")
    return_type: Optional[str] = Field(default=None, description="Return type annotation if present")
    docstring: Optional[str] = Field(default=None, description="Associated docstring or leading comment")
    source_snippet: Optional[str] = Field(default=None, description="Compact source code snippet")


class CodeImport(BaseModel):
    """
    Represents an imported module or symbol within a source file.
    """
    file_path: str = Field(..., description="File where import is declared")
    source_module: str = Field(..., description="Module path being imported (e.g. 'os', './auth', 'app.rag.chunker')")
    imported_symbols: List[str] = Field(default_factory=list, description="Symbols imported from the module")
    alias: Optional[str] = Field(default=None, description="Import alias if specified ('as foo')")
    is_relative: bool = Field(default=False, description="Whether the import uses a relative path")
    line_number: int = Field(..., description="1-indexed line where import occurs")


class CodeExport(BaseModel):
    """
    Represents an exported symbol in JS/TS or __all__ in Python.
    """
    file_path: str = Field(..., description="File where export is declared")
    symbol_name: str = Field(..., description="Exported symbol name")
    is_default: bool = Field(default=False, description="Whether this is the default export")
    line_number: int = Field(..., description="1-indexed line number")


class CodeRelationship(BaseModel):
    """
    Directed relationship between two code entities.
    Example: FILE A -> imports -> FILE B
             CLASS A -> contains -> METHOD B
             FUNCTION A -> located_in -> FILE A
    """
    source: str = Field(..., description="Source entity (file path, class name, function name)")
    target: str = Field(..., description="Target entity (file path, method name, imported module)")
    relationship_type: RelationshipType = Field(..., description="Type of relationship")
    file_path: str = Field(..., description="Context file where this relationship is grounded")
    line_number: Optional[int] = Field(default=None, description="Line number where relationship occurs")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional context")


class ParsedFileIntelligence(BaseModel):
    """
    Comprehensive structural intelligence extracted for a single source file.
    """
    file_path: str = Field(..., description="Relative file path")
    language: str = Field(..., description="Programming language")
    line_count: int = Field(default=0, description="Total lines in file")
    symbols: List[CodeSymbol] = Field(default_factory=list, description="Discovered symbols")
    imports: List[CodeImport] = Field(default_factory=list, description="Import statements")
    exports: List[CodeExport] = Field(default_factory=list, description="Export declarations")
    relationships: List[CodeRelationship] = Field(default_factory=list, description="Extracted relationships")


class RepositoryIntelligenceData(BaseModel):
    """
    Whole-repository intelligence index combining symbol indices,
    cross-file relationships, and file-level intelligence.
    """
    repository_id: str = Field(..., description="Unique repository identifier")
    branch: str = Field(default="main", description="Branch name")
    total_files: int = Field(default=0, description="Total parsed files")
    total_symbols: int = Field(default=0, description="Total extracted symbols")
    files: Dict[str, ParsedFileIntelligence] = Field(default_factory=dict, description="File intelligence by path")
    symbol_index: Dict[str, List[CodeSymbol]] = Field(default_factory=dict, description="Symbol name to locations")
    file_dependencies: Dict[str, List[str]] = Field(default_factory=dict, description="File path to imported file paths")
    file_dependents: Dict[str, List[str]] = Field(default_factory=dict, description="File path to files importing it")
