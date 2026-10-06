"""
Unit tests for PromptBuilder module.
"""

from app.rag.prompt_builder import PromptBuilder, SYSTEM_INSTRUCTION
from app.rag.retriever import RetrievedChunk


def test_prompt_builder_empty_chunks():
    """
    Verify prompt builder handles empty chunks list.
    """
    sys_inst, user_prompt = PromptBuilder.build_prompt("How does auth work?", [])

    assert "STRICT GROUNDING & CITATION RULES" in sys_inst
    assert "No relevant code chunks were retrieved" in user_prompt
    assert "How does auth work?" in user_prompt


def test_prompt_builder_with_chunks_includes_citations_and_isolation():
    """
    Verify prompt contains demarcated evidence blocks and file metadata.
    """
    chunks = [
        RetrievedChunk(
            chunk_id="chunk_1",
            repository_id="repo1",
            file_path="src/auth.py",
            language="python",
            start_line=10,
            end_line=25,
            content="def create_token(user):\n    return 'jwt_xyz'\n",
            score=0.9234,
        )
    ]

    sys_inst, user_prompt = PromptBuilder.build_prompt("Where is token generated?", chunks)

    # Security check: prompt system instructions emphasize untrusted data
    assert "UNTRUSTED DATA" in sys_inst

    # Format verification
    assert "EVIDENCE CHUNK 1" in user_prompt
    assert "File: src/auth.py" in user_prompt
    assert "Lines: 10 to 25" in user_prompt
    assert "Language: python" in user_prompt
    assert "def create_token(user):" in user_prompt
    assert "Where is token generated?" in user_prompt
