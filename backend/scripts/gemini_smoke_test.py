"""
Gemini API Connectivity & Smoke Test Script.

This standalone script verifies that your Gemini API key is properly configured
and that the LLM model endpoint is reachable and responsive.

Usage:
    From project root:
        .venv\\Scripts\\python backend\\scripts\\gemini_smoke_test.py
    From backend directory:
        ..\\.venv\\Scripts\\python scripts\\gemini_smoke_test.py
"""

import sys
from pathlib import Path

# Add backend directory to sys.path so 'app' imports work reliably
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.config.settings import get_settings
from app.services.llm_provider import GeminiProvider, MissingAPIKeyError, LLMProviderError


def run_smoke_test() -> int:
    """
    Executes the Gemini API smoke test and prints user-friendly diagnostic results.
    Returns 0 on success, 1 on failure.
    """
    settings = get_settings()

    print("=" * 65)
    print("        CodeRAG - Gemini API Verification Smoke Test        ")
    print("=" * 65)
    print(f"Application:        {settings.app_name} (v{settings.app_version})")
    print(f"Environment:        {settings.app_env}")
    print(f"Target LLM Model:   {settings.gemini_model}")
    print(f"Embedding Model:    {settings.gemini_embedding_model}")
    print(f"Key Configured:     {'YES' if settings.is_gemini_configured else 'NO (Missing or Placeholder)'}")
    print("-" * 65)

    if not settings.is_gemini_configured:
        print("[!] ERROR: Gemini API key is missing or set to placeholder.")
        print("\nTo fix this:")
        print("1. Copy `.env.example` to `.env` if you haven't already:")
        print("   copy .env.example .env")
        print("2. Obtain a free Gemini API key from Google AI Studio:")
        print("   https://aistudio.google.com/")
        print("3. Open `.env` and set:")
        print("   GEMINI_API_KEY=AIzaSyYourActualKeyHere")
        print("4. Re-run this smoke test script.")
        print("=" * 65)
        return 1

    print("[*] Contacting Google Gemini API...")
    provider = GeminiProvider(
        api_key=settings.gemini_api_key,
        model_name=settings.gemini_model,
    )

    result = provider.smoke_test()

    if result.get("status") == "success":
        print("[+] SUCCESS: Gemini API is online and responding!")
        print(f"    - Model:      {result.get('model')}")
        print(f"    - Latency:    {result.get('latency_ms')} ms")
        print(f"    - Response:   \"{result.get('response')}\"")
        print("=" * 65)
        print("[OK] Phase 0 Gemini verification PASSED.")
        print("=" * 65)
        return 0
    else:
        print("[-] FAILED: Could not complete Gemini API request.")
        print(f"    - Error:      {result.get('error')}")
        print(f"    - Latency:    {result.get('latency_ms')} ms")
        print("\nTroubleshooting tips:")
        print("- Verify your API key is active and has permissions in Google AI Studio.")
        print("- Check your internet connection or proxy settings.")
        print(f"- Confirm that the model '{settings.gemini_model}' is available for your key.")
        print("=" * 65)
        return 1


if __name__ == "__main__":
    exit_code = run_smoke_test()
    sys.exit(exit_code)
