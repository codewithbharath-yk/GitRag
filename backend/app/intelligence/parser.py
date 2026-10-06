"""
Modular Parser Architecture for Advanced Code Intelligence.

Provides a pluggable parser interface with concrete adapters:
1. PythonAstCodeParser: High-fidelity AST parsing for Python using standard library `ast`.
2. TreeSitterCodeParser: Robust Tree-sitter parsing for JavaScript, TypeScript, and JSX/TSX.
3. GenericRegexParser: Robust regex/tokenization fallback for other languages (Java, Go, Rust, etc.).
4. CodeParserService: Unified parser router and orchestrator with error resilience.
"""

from abc import ABC, abstractmethod
import ast
import re
from typing import List, Optional, Dict, Any, Set
from pathlib import Path

from app.intelligence.models import (
    CodeSymbol,
    SymbolType,
    CodeImport,
    CodeExport,
    CodeRelationship,
    RelationshipType,
    ParsedFileIntelligence,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Tree-sitter imports with safe initialization
_TREE_SITTER_AVAILABLE = False
_TS_PARSERS: Dict[str, Any] = {}

try:
    from tree_sitter import Language, Parser
    import tree_sitter_python
    import tree_sitter_javascript
    import tree_sitter_typescript

    # Initialize language instances
    py_lang = Language(tree_sitter_python.language())
    js_lang = Language(tree_sitter_javascript.language())
    ts_lang = Language(tree_sitter_typescript.language_typescript())
    tsx_lang = Language(tree_sitter_typescript.language_tsx())

    _TS_PARSERS["python"] = Parser(py_lang)
    _TS_PARSERS["javascript"] = Parser(js_lang)
    _TS_PARSERS["javascript_react"] = Parser(js_lang)
    _TS_PARSERS["typescript"] = Parser(ts_lang)
    _TS_PARSERS["typescript_react"] = Parser(tsx_lang)
    _TREE_SITTER_AVAILABLE = True
    logger.info("Tree-sitter initialized successfully for Python, JavaScript, and TypeScript.")
except Exception as e:
    logger.warning(f"Tree-sitter initialization note: {e}. Falling back to standard AST and regex parsers.")


class BaseCodeParser(ABC):
    """
    Abstract parser interface for code intelligence.
    """

    @abstractmethod
    def supports(self, language: str) -> bool:
        """Return True if this parser supports the target language."""
        pass

    @abstractmethod
    def parse(self, file_path: str, content: str, language: str) -> ParsedFileIntelligence:
        """Parse source content and return structured file intelligence."""
        pass


class PythonAstCodeParser(BaseCodeParser):
    """
    Python AST Parser utilizing Python's built-in standard library `ast` module.
    Provides 100% accurate symbol positions, docstrings, parameters, and imports.
    """

    SUPPORTED_LANGUAGES = {"python", "py"}

    def supports(self, language: str) -> bool:
        return language.lower() in self.SUPPORTED_LANGUAGES

    def parse(self, file_path: str, content: str, language: str) -> ParsedFileIntelligence:
        lines = content.splitlines()
        line_count = len(lines)
        symbols: List[CodeSymbol] = []
        imports: List[CodeImport] = []
        exports: List[CodeExport] = []
        relationships: List[CodeRelationship] = []

        try:
            tree = ast.parse(content, filename=file_path)
        except SyntaxError as e:
            logger.warning(f"Syntax error parsing {file_path} with Python AST: {e}")
            return ParsedFileIntelligence(
                file_path=file_path,
                language=language,
                line_count=line_count,
                symbols=[],
                imports=[],
                exports=[],
                relationships=[],
            )

        def get_source_snippet(start_line: int, end_line: int, max_lines: int = 5) -> str:
            sub_lines = lines[start_line - 1 : min(end_line, start_line - 1 + max_lines)]
            return "\n".join(sub_lines)

        # Walk through top-level statements
        for node in tree.body:
            # 1. Imports
            if isinstance(node, ast.Import):
                for alias in node.names:
                    source_module = alias.name
                    as_name = alias.asname
                    imports.append(
                        CodeImport(
                            file_path=file_path,
                            source_module=source_module,
                            imported_symbols=[source_module],
                            alias=as_name,
                            is_relative=False,
                            line_number=node.lineno,
                        )
                    )
                    relationships.append(
                        CodeRelationship(
                            source=file_path,
                            target=source_module,
                            relationship_type=RelationshipType.IMPORTS,
                            file_path=file_path,
                            line_number=node.lineno,
                        )
                    )

            elif isinstance(node, ast.ImportFrom):
                source_module = ("." * node.level) + (node.module or "")
                imported_syms = [alias.name for alias in node.names]
                imports.append(
                    CodeImport(
                        file_path=file_path,
                        source_module=source_module,
                        imported_symbols=imported_syms,
                        alias=node.names[0].asname if len(node.names) == 1 else None,
                        is_relative=(node.level > 0),
                        line_number=node.lineno,
                    )
                )
                relationships.append(
                    CodeRelationship(
                        source=file_path,
                        target=source_module,
                        relationship_type=RelationshipType.IMPORTS,
                        file_path=file_path,
                        line_number=node.lineno,
                    )
                )

            # 2. Classes
            elif isinstance(node, ast.ClassDef):
                end_line = getattr(node, "end_lineno", node.lineno)
                docstring = ast.get_docstring(node)
                class_sym = CodeSymbol(
                    name=node.name,
                    symbol_type=SymbolType.CLASS,
                    file_path=file_path,
                    start_line=node.lineno,
                    end_line=end_line,
                    parent_symbol=None,
                    language=language,
                    docstring=docstring,
                    source_snippet=get_source_snippet(node.lineno, end_line),
                )
                symbols.append(class_sym)
                relationships.append(
                    CodeRelationship(
                        source=node.name,
                        target=file_path,
                        relationship_type=RelationshipType.LOCATED_IN,
                        file_path=file_path,
                        line_number=node.lineno,
                    )
                )

                # Class methods
                for item in node.body:
                    if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        method_end = getattr(item, "end_lineno", item.lineno)
                        method_doc = ast.get_docstring(item)
                        params = [arg.arg for arg in item.args.args]
                        method_sym = CodeSymbol(
                            name=item.name,
                            symbol_type=SymbolType.METHOD,
                            file_path=file_path,
                            start_line=item.lineno,
                            end_line=method_end,
                            parent_symbol=node.name,
                            language=language,
                            parameters=params,
                            docstring=method_doc,
                            source_snippet=get_source_snippet(item.lineno, method_end),
                        )
                        symbols.append(method_sym)
                        relationships.append(
                            CodeRelationship(
                                source=node.name,
                                target=item.name,
                                relationship_type=RelationshipType.CONTAINS,
                                file_path=file_path,
                                line_number=item.lineno,
                            )
                        )

            # 3. Top-Level Functions
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                func_end = getattr(node, "end_lineno", node.lineno)
                func_doc = ast.get_docstring(node)
                params = [arg.arg for arg in node.args.args]
                func_sym = CodeSymbol(
                    name=node.name,
                    symbol_type=SymbolType.FUNCTION,
                    file_path=file_path,
                    start_line=node.lineno,
                    end_line=func_end,
                    parent_symbol=None,
                    language=language,
                    parameters=params,
                    docstring=func_doc,
                    source_snippet=get_source_snippet(node.lineno, func_end),
                )
                symbols.append(func_sym)
                relationships.append(
                    CodeRelationship(
                        source=node.name,
                        target=file_path,
                        relationship_type=RelationshipType.LOCATED_IN,
                        file_path=file_path,
                        line_number=node.lineno,
                    )
                )

            # 4. Global Variables / Constants / __all__ exports
            elif isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        name = target.id
                        if name == "__all__" and isinstance(node.value, (ast.List, ast.Tuple)):
                            for elt in node.value.elts:
                                if isinstance(elt, ast.Constant) and isinstance(elt.value, str):
                                    exports.append(
                                        CodeExport(
                                            file_path=file_path,
                                            symbol_name=elt.value,
                                            is_default=False,
                                            line_number=node.lineno,
                                        )
                                    )
                        elif name.isupper():
                            # Constant
                            symbols.append(
                                CodeSymbol(
                                    name=name,
                                    symbol_type=SymbolType.CONSTANT,
                                    file_path=file_path,
                                    start_line=node.lineno,
                                    end_line=getattr(node, "end_lineno", node.lineno),
                                    language=language,
                                    source_snippet=get_source_snippet(node.lineno, getattr(node, "end_lineno", node.lineno)),
                                )
                            )

        return ParsedFileIntelligence(
            file_path=file_path,
            language=language,
            line_count=line_count,
            symbols=symbols,
            imports=imports,
            exports=exports,
            relationships=relationships,
        )


class TreeSitterCodeParser(BaseCodeParser):
    """
    Tree-sitter AST Parser for JavaScript, TypeScript, JSX, and TSX.
    Uses concrete syntax trees to extract functions, classes, methods, imports, and exports.
    """

    SUPPORTED_LANGUAGES = {
        "javascript", "js", "jsx", "javascript_react",
        "typescript", "ts", "tsx", "typescript_react",
    }

    def supports(self, language: str) -> bool:
        return _TREE_SITTER_AVAILABLE and language.lower() in self.SUPPORTED_LANGUAGES

    def parse(self, file_path: str, content: str, language: str) -> ParsedFileIntelligence:
        lines = content.splitlines()
        line_count = len(lines)
        symbols: List[CodeSymbol] = []
        imports: List[CodeImport] = []
        exports: List[CodeExport] = []
        relationships: List[CodeRelationship] = []

        norm_lang = language.lower()
        parser_lang = "javascript"
        if "typescript" in norm_lang or norm_lang in {"ts", "tsx"}:
            parser_lang = "typescript_react" if ("react" in norm_lang or norm_lang == "tsx") else "typescript"
        elif "react" in norm_lang or norm_lang == "jsx":
            parser_lang = "javascript_react"

        parser = _TS_PARSERS.get(parser_lang) or _TS_PARSERS.get("javascript")
        if not parser:
            return ParsedFileIntelligence(
                file_path=file_path,
                language=language,
                line_count=line_count,
                symbols=[],
                imports=[],
                exports=[],
                relationships=[],
            )

        try:
            tree = parser.parse(content.encode("utf-8"))
        except Exception as e:
            logger.warning(f"Error parsing {file_path} with Tree-sitter: {e}")
            return ParsedFileIntelligence(
                file_path=file_path,
                language=language,
                line_count=line_count,
                symbols=[],
                imports=[],
                exports=[],
                relationships=[],
            )

        def node_text(node) -> str:
            return content.encode("utf-8")[node.start_byte : node.end_byte].decode("utf-8", errors="replace")

        def get_source_snippet(start_line: int, end_line: int, max_lines: int = 5) -> str:
            sub_lines = lines[start_line - 1 : min(end_line, start_line - 1 + max_lines)]
            return "\n".join(sub_lines)

        def visit(node, parent_class: Optional[str] = None):
            ntype = node.type

            # 1. Imports
            if ntype in ("import_statement", "import_declaration"):
                start_l = node.start_point[0] + 1
                source_mod = ""
                imported_syms = []

                for child in node.children:
                    if child.type in ("string", "string_fragment"):
                        source_mod = node_text(child).strip("'\"")
                    elif child.type == "import_clause":
                        for sub in child.children:
                            if sub.type == "identifier":
                                imported_syms.append(node_text(sub))
                            elif sub.type in ("named_imports", "import_specifier"):
                                for spec in sub.children:
                                    if spec.type == "identifier":
                                        imported_syms.append(node_text(spec))

                if source_mod:
                    imports.append(
                        CodeImport(
                            file_path=file_path,
                            source_module=source_mod,
                            imported_symbols=imported_syms,
                            is_relative=source_mod.startswith("."),
                            line_number=start_l,
                        )
                    )
                    relationships.append(
                        CodeRelationship(
                            source=file_path,
                            target=source_mod,
                            relationship_type=RelationshipType.IMPORTS,
                            file_path=file_path,
                            line_number=start_l,
                        )
                    )

            # 2. Exports
            elif ntype in ("export_statement", "export_declaration"):
                start_l = node.start_point[0] + 1
                is_def = "default" in node_text(node).split()
                # Inspect exported declaration
                for child in node.children:
                    if child.type in ("function_declaration", "class_declaration"):
                        for sub in child.children:
                            if sub.type in ("identifier", "type_identifier"):
                                exports.append(
                                    CodeExport(
                                        file_path=file_path,
                                        symbol_name=node_text(sub),
                                        is_default=is_def,
                                        line_number=start_l,
                                    )
                                )
                                break

            # 3. Class Declarations
            elif ntype in ("class_declaration", "class"):
                start_l = node.start_point[0] + 1
                end_l = node.end_point[0] + 1
                class_name = ""
                for child in node.children:
                    if child.type in ("identifier", "type_identifier"):
                        class_name = node_text(child)
                        break

                if class_name:
                    symbols.append(
                        CodeSymbol(
                            name=class_name,
                            symbol_type=SymbolType.CLASS,
                            file_path=file_path,
                            start_line=start_l,
                            end_line=end_l,
                            parent_symbol=None,
                            language=language,
                            source_snippet=get_source_snippet(start_l, end_l),
                        )
                    )
                    relationships.append(
                        CodeRelationship(
                            source=class_name,
                            target=file_path,
                            relationship_type=RelationshipType.LOCATED_IN,
                            file_path=file_path,
                            line_number=start_l,
                        )
                    )
                    # Visit class body with parent_class set
                    for child in node.children:
                        if child.type in ("class_body", "declaration_list"):
                            for member in child.children:
                                visit(member, parent_class=class_name)
                    return

            # 4. Method Definitions
            elif ntype in ("method_definition", "public_field_definition") and parent_class:
                start_l = node.start_point[0] + 1
                end_l = node.end_point[0] + 1
                method_name = ""
                for child in node.children:
                    if child.type in ("property_identifier", "identifier"):
                        method_name = node_text(child)
                        break

                if method_name:
                    symbols.append(
                        CodeSymbol(
                            name=method_name,
                            symbol_type=SymbolType.METHOD,
                            file_path=file_path,
                            start_line=start_l,
                            end_line=end_l,
                            parent_symbol=parent_class,
                            language=language,
                            source_snippet=get_source_snippet(start_l, end_l),
                        )
                    )
                    relationships.append(
                        CodeRelationship(
                            source=parent_class,
                            target=method_name,
                            relationship_type=RelationshipType.CONTAINS,
                            file_path=file_path,
                            line_number=start_l,
                        )
                    )

            # 5. Functions & Arrow Functions
            elif ntype in ("function_declaration", "function_signature"):
                start_l = node.start_point[0] + 1
                end_l = node.end_point[0] + 1
                func_name = ""
                for child in node.children:
                    if child.type == "identifier":
                        func_name = node_text(child)
                        break

                if func_name:
                    symbols.append(
                        CodeSymbol(
                            name=func_name,
                            symbol_type=SymbolType.FUNCTION,
                            file_path=file_path,
                            start_line=start_l,
                            end_line=end_l,
                            parent_symbol=None,
                            language=language,
                            source_snippet=get_source_snippet(start_l, end_l),
                        )
                    )
                    relationships.append(
                        CodeRelationship(
                            source=func_name,
                            target=file_path,
                            relationship_type=RelationshipType.LOCATED_IN,
                            file_path=file_path,
                            line_number=start_l,
                        )
                    )

            # Arrow functions assigned to variables: const foo = () => ...
            elif ntype in ("lexical_declaration", "variable_declaration"):
                for child in node.children:
                    if child.type == "variable_declarator":
                        var_name = ""
                        is_func = False
                        start_l = node.start_point[0] + 1
                        end_l = node.end_point[0] + 1

                        for sub in child.children:
                            if sub.type == "identifier":
                                var_name = node_text(sub)
                            elif sub.type in ("arrow_function", "function"):
                                is_func = True

                        if var_name and is_func:
                            symbols.append(
                                CodeSymbol(
                                    name=var_name,
                                    symbol_type=SymbolType.FUNCTION,
                                    file_path=file_path,
                                    start_line=start_l,
                                    end_line=end_l,
                                    parent_symbol=None,
                                    language=language,
                                    source_snippet=get_source_snippet(start_l, end_l),
                                )
                            )
                            relationships.append(
                                CodeRelationship(
                                    source=var_name,
                                    target=file_path,
                                    relationship_type=RelationshipType.LOCATED_IN,
                                    file_path=file_path,
                                    line_number=start_l,
                                )
                            )

            # Recurse through children
            for child in node.children:
                visit(child, parent_class=parent_class)

        visit(tree.root_node)

        return ParsedFileIntelligence(
            file_path=file_path,
            language=language,
            line_count=line_count,
            symbols=symbols,
            imports=imports,
            exports=exports,
            relationships=relationships,
        )


class GenericRegexParser(BaseCodeParser):
    """
    Robust fallback parser for languages without specialized AST adapters
    (e.g., Java, Go, Rust, C++, C#, Kotlin, Swift).
    Uses conservative regex patterns to extract function, class, and import definitions.
    """

    CLASS_REGEX = re.compile(r"^\s*(?:export\s+|public\s+|private\s+|protected\s+|abstract\s+)*(?:class|struct|interface|trait|enum)\s+([A-Za-z0-9_]+)", re.MULTILINE)
    FUNC_REGEX = re.compile(
        r"^\s*(?:(?:export|public|private|protected|static|final|abstract|async|fn|func|def)\s+)+"
        r"(?:(?:[A-Za-z0-9_<>[\]]+)\s+)*"
        r"([A-Za-z0-9_]+)\s*\([^)]*\)",
        re.MULTILINE,
    )
    IMPORT_REGEX = re.compile(r"^\s*(?:import|using|include|package)\s+([A-Za-z0-9_\.\<\>\"\/\*]+)", re.MULTILINE)

    def supports(self, language: str) -> bool:
        return True  # Fallback supports all languages

    def parse(self, file_path: str, content: str, language: str) -> ParsedFileIntelligence:
        lines = content.splitlines()
        line_count = len(lines)
        symbols: List[CodeSymbol] = []
        imports: List[CodeImport] = []
        relationships: List[CodeRelationship] = []

        for idx, line in enumerate(lines, 1):
            line_str = line.strip()
            if not line_str or line_str.startswith("//") or line_str.startswith("#"):
                continue

            # Check for Class / Interface
            cmatch = self.CLASS_REGEX.match(line)
            if cmatch:
                name = cmatch.group(1)
                symbols.append(
                    CodeSymbol(
                        name=name,
                        symbol_type=SymbolType.CLASS,
                        file_path=file_path,
                        start_line=idx,
                        end_line=idx,
                        language=language,
                        source_snippet=line.strip(),
                    )
                )
                relationships.append(
                    CodeRelationship(
                        source=name,
                        target=file_path,
                        relationship_type=RelationshipType.LOCATED_IN,
                        file_path=file_path,
                        line_number=idx,
                    )
                )
                continue

            # Check for Function / Method
            fmatch = self.FUNC_REGEX.match(line)
            if fmatch:
                name = fmatch.group(1)
                if name not in {"if", "for", "while", "switch", "catch"}:
                    symbols.append(
                        CodeSymbol(
                            name=name,
                            symbol_type=SymbolType.FUNCTION,
                            file_path=file_path,
                            start_line=idx,
                            end_line=idx,
                            language=language,
                            source_snippet=line.strip(),
                        )
                    )
                    relationships.append(
                        CodeRelationship(
                            source=name,
                            target=file_path,
                            relationship_type=RelationshipType.LOCATED_IN,
                            file_path=file_path,
                            line_number=idx,
                        )
                    )
                continue

            # Check for Import
            imatch = self.IMPORT_REGEX.match(line)
            if imatch:
                mod = imatch.group(1).strip(";'\"")
                imports.append(
                    CodeImport(
                        file_path=file_path,
                        source_module=mod,
                        imported_symbols=[],
                        line_number=idx,
                    )
                )
                relationships.append(
                    CodeRelationship(
                        source=file_path,
                        target=mod,
                        relationship_type=RelationshipType.IMPORTS,
                        file_path=file_path,
                        line_number=idx,
                    )
                )

        return ParsedFileIntelligence(
            file_path=file_path,
            language=language,
            line_count=line_count,
            symbols=symbols,
            imports=imports,
            exports=[],
            relationships=relationships,
        )


class CodeParserService:
    """
    Central Parser Router and Orchestrator.
    Dispatches file parsing to the most specialized available parser,
    with automatic graceful fallbacks.
    """

    def __init__(self):
        self.python_parser = PythonAstCodeParser()
        self.tree_sitter_parser = TreeSitterCodeParser()
        self.generic_parser = GenericRegexParser()

    def parse_file(self, file_path: str, content: str, language: str) -> ParsedFileIntelligence:
        """
        Parse a single file using the best available parser.
        Never raises exceptions; returns empty intelligence on fatal failure.
        """
        try:
            lang_low = language.lower()
            if self.python_parser.supports(lang_low):
                return self.python_parser.parse(file_path, content, language)

            if self.tree_sitter_parser.supports(lang_low):
                return self.tree_sitter_parser.parse(file_path, content, language)

            return self.generic_parser.parse(file_path, content, language)

        except Exception as e:
            logger.error(f"Unexpected error in CodeParserService for {file_path}: {e}", exc_info=True)
            return ParsedFileIntelligence(
                file_path=file_path,
                language=language,
                line_count=len(content.splitlines()),
                symbols=[],
                imports=[],
                exports=[],
                relationships=[],
            )
