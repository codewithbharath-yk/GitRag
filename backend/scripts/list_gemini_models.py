import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.config.settings import get_settings
from google import genai

settings = get_settings()
client = genai.Client(api_key=settings.gemini_api_key)

print("Listing all available Gemini models on this API key...", flush=True)
try:
    models = list(client.models.list())
    for m in models:
        methods = getattr(m, 'supported_generation_methods', [])
        print(f"  - {m.name} (display: {getattr(m, 'display_name', '')})", flush=True)
except Exception as e:
    print(f"Error listing models: {e}", flush=True)
