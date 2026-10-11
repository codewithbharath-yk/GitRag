import time
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.config.settings import get_settings
from google import genai
from google.genai import types

settings = get_settings()
client = genai.Client(api_key=settings.gemini_api_key)

candidate_models = [
    "gemini-2.5-flash",
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
]

for m in candidate_models:
    print(f"\nEvaluating: '{m}'...", flush=True)
    t0 = time.perf_counter()
    try:
        resp = client.models.generate_content(
            model=m,
            contents="Say 'OK' in one word.",
            config=types.GenerateContentConfig(temperature=0.0),
        )
        latency = round((time.perf_counter() - t0) * 1000, 2)
        print(f"  -> SUCCESS ({latency}ms): {resp.text.strip()}", flush=True)
    except Exception as e:
        latency = round((time.perf_counter() - t0) * 1000, 2)
        print(f"  -> ERROR ({latency}ms): {e}", flush=True)
