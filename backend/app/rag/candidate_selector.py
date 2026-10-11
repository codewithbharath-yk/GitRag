"""
Candidate File Selector Module for Question-Driven / Lazy RAG.

Ranks files from the lightweight repository manifest using hybrid multi-signal scoring:
filename matching, directory relevance, keyword overlap, symbol targeting, and architecture priorities.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Set
from pathlib import Path

from app.rag.question_analyzer import QuestionAnalysis, QuestionCategory
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Low-priority non-code asset extensions
NON_CODE_EXTENSIONS = {
    ".svg", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".pdf",
    ".mp4", ".mp3", ".woff", ".woff2", ".ttf", ".eot", ".lock",
    ".map", ".min.js", ".min.css", ".bundle.js",
}

# Documentation and styling files
STYLING_AND_DOC_EXTENSIONS = {
    ".css", ".scss", ".sass", ".less", ".html", ".md", ".rst", ".txt",
}


@dataclass
class CandidateFile:
    """
    Candidate file evaluated from repository manifest.
    """
    path: str
    score: float
    match_reasons: List[str] = field(default_factory=list)
    language: str = "text"
    size_bytes: int = 0
    sha: Optional[str] = None


class CandidateSelector:
    """
    Fast, multi-signal candidate selector.
    """

    @classmethod
    def select_candidates(
        cls,
        manifest_files: List[Dict[str, Any]],
        analysis: QuestionAnalysis,
        existing_qdrant_scores: Optional[Dict[str, float]] = None,
        top_k: int = 20,
    ) -> List[CandidateFile]:
        """
        Rank manifest files according to question analysis and return top candidates.
        """
        if not manifest_files:
            return []

        existing_scores = existing_qdrant_scores or {}
        candidates: List[CandidateFile] = []

        keywords_set = set(analysis.keywords)
        symbols_lower = [s.lower() for s in analysis.extracted_symbols]
        likely_dirs = [d.lower() for d in analysis.likely_directories]
        likely_files = [f.lower() for f in analysis.likely_filenames]

        for item in manifest_files:
            file_path = item.get("path", "")
            if not file_path:
                continue

            lang = item.get("language", "text")
            size_bytes = item.get("size_bytes", 0)
            sha = item.get("sha")

            path_obj = Path(file_path)
            filename = path_obj.name.lower()
            filename_stem = path_obj.stem.lower()
            ext = path_obj.suffix.lower()
            path_lower = file_path.lower()
            parts_lower = [p.lower() for p in path_obj.parts]

            score = 0.0
            reasons: List[str] = []

            # 1. Non-code asset penalty
            if ext in NON_CODE_EXTENSIONS or filename.endswith(".lock"):
                score -= 50.0
                reasons.append("non-code asset penalty")

            # 2. Broad Architecture & Overview queries
            if analysis.is_broad_architecture:
                if filename in ("readme.md", "readme", "readme.rst", "readme.txt"):
                    score += 60.0
                    reasons.append("primary project README")
                elif filename in ("package.json", "pyproject.toml", "cargo.toml", "go.mod", "requirements.txt", "pom.xml", "build.gradle"):
                    score += 45.0
                    reasons.append("package manifest/dependency definition")
                elif filename_stem in ("main", "app", "index", "server", "mod", "lib"):
                    score += 35.0
                    reasons.append("main entrypoint file")
                elif any(d in parts_lower for d in ("routes", "api", "controllers", "src", "core", "pkg")):
                    score += 20.0
                    reasons.append("core architecture module")
                elif filename.startswith(("dockerfile", "docker-compose")):
                    score += 15.0
                    reasons.append("container configuration")

            # 3. Exact or stem filename matching
            for target_file in likely_files:
                if filename == target_file or file_path.lower().endswith(target_file):
                    score += 35.0
                    reasons.append(f"exact filename match: {target_file}")
                    break
                elif target_file in filename_stem or filename_stem in target_file:
                    score += 25.0
                    reasons.append(f"stem filename match: {target_file}")
                    break

            # 4. Directory relevance
            for d in likely_dirs:
                if d in parts_lower or any(d in p for p in parts_lower[:-1]):
                    score += 20.0
                    reasons.append(f"likely directory: {d}")
                    break

            # 5. Keyword overlap in path & filename
            matched_keywords = []
            for kw in keywords_set:
                if kw in filename_stem:
                    score += 12.0
                    matched_keywords.append(kw)
                elif kw in path_lower:
                    score += 6.0
                    matched_keywords.append(kw)

            if matched_keywords:
                reasons.append(f"path keywords: {', '.join(matched_keywords[:3])}")

            # 6. Symbol targeting
            for sym in symbols_lower:
                if sym in filename_stem:
                    score += 30.0
                    reasons.append(f"symbol in filename: {sym}")
                elif sym in path_lower:
                    score += 15.0
                    reasons.append(f"symbol in path: {sym}")

            # 7. Testing file deprioritization for non-testing queries
            is_test_file = (
                any(p in ("tests", "test", "__tests__", "spec", "specs") for p in parts_lower)
                or filename_stem.startswith("test_")
                or filename_stem.endswith(("_test", ".spec", ".test"))
            )
            if is_test_file:
                if analysis.category == QuestionCategory.TESTING_QA:
                    score += 25.0
                    reasons.append("test suite target")
                elif not analysis.is_broad_architecture:
                    score -= 10.0
                    reasons.append("test file deprioritized")

            # 8. Markdown / Styling deprioritization for specific code queries
            if not analysis.is_broad_architecture:
                if ext in STYLING_AND_DOC_EXTENSIONS:
                    # Check if question explicitly asked for styles/docs
                    if not any(k in ("style", "css", "html", "doc", "docs", "readme") for k in keywords_set):
                        score -= 15.0
                        reasons.append("doc/style deprioritized for code query")

            # 9. Existing Qdrant vector similarity boost
            if file_path in existing_scores:
                vec_score = existing_scores[file_path]
                boost = round(vec_score * 25.0, 2)
                score += boost
                reasons.append(f"existing vector similarity ({vec_score:.2f})")

            # Only retain candidates with positive score or priority
            if score > 0:
                candidates.append(
                    CandidateFile(
                        path=file_path,
                        score=round(score, 2),
                        match_reasons=reasons,
                        language=lang,
                        size_bytes=size_bytes,
                        sha=sha,
                    )
                )

        # Sort descending by score
        ranked = sorted(candidates, key=lambda c: c.score, reverse=True)

        # If broad architecture and top files is small, ensure README / entry files are present
        if analysis.is_broad_architecture and len(ranked) < top_k:
            for item in manifest_files:
                p = item.get("path", "")
                if p not in [r.path for r in ranked]:
                    p_lower = p.lower()
                    if "readme" in p_lower or p_lower in ("package.json", "pyproject.toml", "cargo.toml", "go.mod"):
                        ranked.append(
                            CandidateFile(
                                path=p,
                                score=10.0,
                                match_reasons=["fallback overview file"],
                                language=item.get("language", "text"),
                                size_bytes=item.get("size_bytes", 0),
                                sha=item.get("sha"),
                            )
                        )

        # Fallback if no files scored positively: take first few source files
        if not ranked and manifest_files:
            for item in manifest_files[:top_k]:
                p = item.get("path", "")
                ext = Path(p).suffix.lower()
                if ext not in NON_CODE_EXTENSIONS:
                    ranked.append(
                        CandidateFile(
                            path=p,
                            score=1.0,
                            match_reasons=["manifest fallback"],
                            language=item.get("language", "text"),
                            size_bytes=item.get("size_bytes", 0),
                            sha=item.get("sha"),
                        )
                    )

        result = ranked[:top_k]
        logger.info(
            f"CandidateSelector selected {len(result)} candidate files for query "
            f"(category={analysis.category.value}, top={result[0].path if result else 'none'} [score={result[0].score if result else 0}])."
        )
        return result
