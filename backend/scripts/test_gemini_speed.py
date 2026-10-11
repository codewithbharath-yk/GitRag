import time
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.config.settings import get_settings

settings = get_settings()
print(f"API Key present: {bool(settings.gemini_api_key)} (length: {len(settings.gemini_api_key)})", flush=True)
print(f"Configured model: {settings.gemini_model}", flush=True)

from google import genai
from google.genai import types

client = genai.Client(api_key=settings.gemini_api_key)

models_to_test = [
    settings.gemini_model,
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]

for m in models_to_test:
    print(f"\nTesting model: '{m}'...", flush=True)
    t0 = time.perf_counter()
    try:
        resp = client.models.generate_content(
            model=m,
            contents="Say 'Hello from CodeRAG' in 5 words.",
            config=types.GenerateContentConfig(temperature=0.2),
        )
        latency = round((time.perf_counter() - t0) * 1000, 2)
        print(f"  -> SUCCESS ({latency}ms): {resp.text.strip()}", flush=True)
    except Exception as e:
        latency = round((time.perf_counter() - t0) * 1000, 2)
        print(f"  -> FAILED ({latency}ms): {e}", flush=True)
