"""
LLM Provider Adapter Module.

Isolates all Google Gemini model interactions behind a clean interface.
This ensures the underlying LLM provider can be mocked in tests or swapped
in the future without rewriting the RAG pipeline or API routes.
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
import time

from app.config.settings import Settings, get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)


class LLMProviderError(Exception):
    """Base exception for LLM provider errors."""
    pass


class MissingAPIKeyError(LLMProviderError):
    """Raised when an operation requires an API key that is not configured."""
    pass


class BaseLLMProvider(ABC):
    """
    Abstract interface for LLM providers.
    Any provider (Gemini, OpenAI, Anthropic, Local) must implement these methods.
    """

    @abstractmethod
    def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.2,
    ) -> str:
        """
        Generate a text response given a user prompt and optional system instructions.
        """
        pass

    @abstractmethod
    def smoke_test(self) -> Dict[str, Any]:
        """
        Perform a lightweight connectivity test to verify credentials and model availability.
        """
        pass


class GeminiProvider(BaseLLMProvider):
    """
    Google Gemini implementation of the BaseLLMProvider interface
    using the official google-genai SDK.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
    ):
        settings = get_settings()
        self.api_key = api_key if api_key is not None else settings.gemini_api_key
        self.model_name = model_name or settings.gemini_model
        self._client = None

    def _get_client(self):
        """
        Lazily initialize and return the Google GenAI client.
        """
        if not self.api_key or self.api_key == "your_gemini_api_key_here":
            raise MissingAPIKeyError(
                "Gemini API key is not configured. "
                "Please set GEMINI_API_KEY in your .env file or environment variables. "
                "You can generate a free key at https://aistudio.google.com/"
            )

        if self._client is None:
            try:
                from google import genai
                self._client = genai.Client(api_key=self.api_key)
            except ImportError as e:
                logger.error(f"Failed to import google-genai package: {e}")
                raise LLMProviderError(
                    "The 'google-genai' SDK is not installed in your Python environment. "
                    "Run: pip install -r backend/requirements.txt"
                ) from e
            except Exception as e:
                logger.error(f"Failed to initialize Gemini client: {e}")
                raise LLMProviderError(f"Error initializing Gemini client: {e}") from e

        return self._client

    def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.2,
    ) -> str:
        """
        Generate text response using the configured Gemini model.
        """
        client = self._get_client()

        from google.genai import types

        config = types.GenerateContentConfig(
            temperature=temperature,
            system_instruction=system_instruction,
        )

        models_to_try = [self.model_name]
        for fallback in ["gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-flash-latest", "gemini-pro-latest"]:
            if fallback not in models_to_try:
                models_to_try.append(fallback)

        last_error = None
        for current_model in models_to_try:
            logger.info(f"Sending prompt to Gemini model '{current_model}'...")
            max_retries = 3
            for attempt in range(1, max_retries + 1):
                try:
                    response = client.models.generate_content(
                        model=current_model,
                        contents=prompt,
                        config=config,
                    )

                    if not response or not response.text:
                        raise LLMProviderError("Received an empty response from Gemini API.")

                    return response.text.strip()

                except Exception as e:
                    if isinstance(e, LLMProviderError):
                        last_error = e
                        break
                    err_str = str(e).lower()
                    is_quota = any(c in err_str for c in ["quota", "resource_exhausted", "perday", "exceeded your current quota"])
                    if is_quota:
                        logger.warning(f"Quota reached for model '{current_model}'. Trying next fallback model...")
                        last_error = e
                        break  # Break retry loop to try next candidate model

                    is_transient = any(code in err_str for code in ["503", "unavailable", "high demand", "overloaded"])
                    if is_transient and attempt < max_retries:
                        wait_sec = attempt * 2
                        logger.warning(
                            f"Gemini API transient error on attempt {attempt}/{max_retries} for {current_model}: {e}. "
                            f"Retrying in {wait_sec}s..."
                        )
                        time.sleep(wait_sec)
                        continue

                    last_error = e
                    break

        logger.error(f"Gemini generation error across all candidate models: {last_error}")
        raise LLMProviderError(f"Gemini API error during generation: {str(last_error)}") from last_error

    def smoke_test(self) -> Dict[str, Any]:
        """
        Run a simple smoke test query against Gemini.
        Returns a dictionary with status, model name, response text, and latency.
        """
        start_time = time.perf_counter()
        test_prompt = "Reply with exactly: 'CodeRAG Gemini Smoke Test Successful.'"

        try:
            response_text = self.generate_text(
                prompt=test_prompt,
                system_instruction="You are a smoke test verifier. Respond strictly as requested.",
                temperature=0.0,
            )
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            return {
                "status": "success",
                "model": self.model_name,
                "response": response_text,
                "latency_ms": elapsed_ms,
                "message": "Gemini API connection verified successfully.",
            }
        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "status": "failed",
                "model": self.model_name,
                "error": str(e),
                "latency_ms": elapsed_ms,
                "message": "Gemini API smoke test failed.",
            }



class OpenRouterLLMProvider(BaseLLMProvider):
    """
    OpenRouter LLM provider using the standard OpenAI client SDK.
    Supports models such as 'nvidia/nemotron-3.5-lightning:free'
    and other OpenRouter chat completion models.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model_name: Optional[str] = None,
    ):
        settings = get_settings()
        self.api_key = api_key if api_key is not None else settings.openrouter_api_key
        self.base_url = base_url or settings.openrouter_base_url
        self.model_name = model_name or settings.openrouter_model
        self._client = None

    def _get_client(self):
        """
        Lazily initialize and return the OpenAI client configured for OpenRouter.
        """
        if not self.api_key or self.api_key == "your_openrouter_api_key_here":
            raise MissingAPIKeyError(
                "OpenRouter API key is not configured for LLM generation. "
                "Please set OPENROUTER_API_KEY in your .env file or environment variables."
            )

        if self._client is None:
            try:
                from openai import OpenAI
                self._client = OpenAI(
                    base_url=self.base_url,
                    api_key=self.api_key,
                )
            except ImportError as e:
                logger.error(f"Failed to import openai package: {e}")
                raise LLMProviderError(
                    "The 'openai' SDK is not installed in your Python environment. "
                    "Run: pip install -r backend/requirements.txt"
                ) from e
            except Exception as e:
                logger.error(f"Failed to initialize OpenRouter client: {e}")
                raise LLMProviderError(f"Error initializing OpenRouter client: {e}") from e

        return self._client

    def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.2,
    ) -> str:
        """
        Generate text response using OpenRouter chat completions.
        """
        client = self._get_client()

        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        models_to_try = [self.model_name]
        for fallback in [
            "nvidia/nemotron-3.5-lightning:free",
            "stepfun/step-2-16k:free",
            "meta-llama/llama-3.2-3b-instruct:free",
        ]:
            if fallback not in models_to_try:
                models_to_try.append(fallback)

        last_error = None
        for current_model in models_to_try:
            logger.info(f"Sending prompt to OpenRouter model '{current_model}'...")
            max_retries = 3
            for attempt in range(1, max_retries + 1):
                try:
                    response = client.chat.completions.create(
                        extra_headers={
                            "HTTP-Referer": "https://coderag.dev",
                            "X-OpenRouter-Title": "CodeRAG",
                        },
                        model=current_model,
                        messages=messages,
                        temperature=temperature,
                    )

                    if not response or not response.choices:
                        raise LLMProviderError("Received an empty response from OpenRouter API.")

                    message_content = response.choices[0].message.content
                    if not message_content:
                        raise LLMProviderError("Received empty text content from OpenRouter API.")

                    return message_content.strip()

                except Exception as e:
                    if isinstance(e, LLMProviderError):
                        last_error = e
                        break
                    err_str = str(e).lower()
                    is_transient = any(
                        code in err_str for code in ["503", "429", "unavailable", "rate limit", "overloaded", "timeout"]
                    )
                    if is_transient and attempt < max_retries:
                        wait_sec = attempt * 2
                        logger.warning(
                            f"OpenRouter transient error on attempt {attempt}/{max_retries} for {current_model}: {e}. "
                            f"Retrying in {wait_sec}s..."
                        )
                        time.sleep(wait_sec)
                        continue

                    last_error = e
                    break

        logger.error(f"OpenRouter generation error across candidate models: {last_error}")
        raise LLMProviderError(f"OpenRouter API error during generation: {str(last_error)}") from last_error

    def smoke_test(self) -> Dict[str, Any]:
        """
        Run a simple smoke test query against OpenRouter.
        Returns a dictionary with status, model name, response text, and latency.
        """
        start_time = time.perf_counter()
        test_prompt = "Reply with exactly: 'CodeRAG OpenRouter Smoke Test Successful.'"

        try:
            response_text = self.generate_text(
                prompt=test_prompt,
                system_instruction="You are a smoke test verifier. Respond strictly as requested.",
                temperature=0.0,
            )
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            return {
                "status": "success",
                "model": self.model_name,
                "response": response_text,
                "latency_ms": elapsed_ms,
                "message": "OpenRouter API connection verified successfully.",
            }
        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "status": "failed",
                "model": self.model_name,
                "error": str(e),
                "latency_ms": elapsed_ms,
                "message": "OpenRouter API smoke test failed.",
            }


def get_llm_provider(
    settings: Optional[Settings] = None,
    provider_name: Optional[str] = None,
) -> BaseLLMProvider:
    """
    Factory function to retrieve the configured LLM provider instance.
    Defaults to Gemini for chat and answer generation (or OpenRouter if explicitly selected).
    """
    cfg = settings or get_settings()
    selected = (provider_name or cfg.llm_provider or "gemini").lower()

    if selected == "gemini":
        return GeminiProvider(
            api_key=cfg.gemini_api_key,
            model_name=cfg.gemini_model,
        )

    return OpenRouterLLMProvider(
        api_key=cfg.openrouter_api_key,
        base_url=cfg.openrouter_base_url,
        model_name=cfg.openrouter_model,
    )
