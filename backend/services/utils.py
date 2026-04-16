"""Shared utility functions used across service modules."""

import json
import os
import re
import time

from google import genai
from google.genai import types


def get_gemini_client() -> genai.Client:
    """Return a Google GenAI client using the GEMINI_API_KEY env var."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")
    return genai.Client(api_key=api_key)


def parse_json_response(text: str):
    """Parse JSON from LLM response, stripping markdown code fences if present."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", cleaned)
    cleaned = re.sub(r"\n?```\s*$", "", cleaned)
    return json.loads(cleaned)


def call_llm(
    system_prompt: str,
    user_prompt: str,
    max_retries: int = 3,
    model: str = "gemini-2.5-flash",
) -> str:
    """Make a call to Gemini with automatic retry on transient errors."""
    client = get_gemini_client()
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=model,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.7,
                ),
            )
            return response.text
        except Exception as e:
            err_str = str(e)
            is_transient = any(
                code in err_str
                for code in ["503", "429", "UNAVAILABLE", "RESOURCE_EXHAUSTED"]
            )
            if is_transient and attempt < max_retries - 1:
                time.sleep(2 ** attempt)
                continue
            raise


def ensure_dir(path: str):
    """Ensure the directory exists, creating it if necessary."""
    os.makedirs(path, exist_ok=True)
