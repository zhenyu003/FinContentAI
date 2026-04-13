import os
import json
import re
from google import genai
from google.genai import types


def _get_client():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")
    return genai.Client(api_key=api_key)


MODEL = "gemini-2.5-flash"


def _parse_json_response(text: str):
    """Parse JSON from LLM response, stripping markdown code fences if present."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", cleaned)
    cleaned = re.sub(r"\n?```\s*$", "", cleaned)
    return json.loads(cleaned)


def _extract_sources(candidate) -> list[str]:
    """Extract source URLs from grounding metadata."""
    sources = []
    try:
        grounding_metadata = candidate.grounding_metadata
        if grounding_metadata and grounding_metadata.grounding_chunks:
            for chunk in grounding_metadata.grounding_chunks:
                if chunk.web and chunk.web.uri:
                    sources.append(chunk.web.uri)
    except (AttributeError, TypeError):
        pass
    return sources


def search_trending_topics() -> list[dict]:
    """Search for trending financial news topics using Gemini with Google Search grounding."""
    client = _get_client()
    google_search_tool = types.Tool(google_search=types.GoogleSearch())

    # Single call covering all categories for speed
    response = client.models.generate_content(
        model=MODEL,
        contents="""Search for today's most important financial news across these categories:
- Top financial and business headlines
- Stock market movers
- Earnings and company news
- Breaking economic news

Return the results as JSON with this exact format:
{
  "topics": [
    {
      "title": "Short descriptive title of the news",
      "summary": "2-3 sentence summary of the news story"
    }
  ]
}

Return 18-20 of the most important and recent results. Only return valid JSON, no other text.""",
        config=types.GenerateContentConfig(
            tools=[google_search_tool],
            temperature=0.3,
        ),
    )

    sources = []
    if response.candidates:
        sources = _extract_sources(response.candidates[0])

    parsed = _parse_json_response(response.text)
    topics = parsed.get("topics", [])

    for topic in topics:
        topic["sources"] = sources

    return topics


def search_custom_topic(query: str) -> list[dict]:
    """Search a custom topic using Gemini with Google Search grounding."""
    client = _get_client()
    google_search_tool = types.Tool(google_search=types.GoogleSearch())

    response = client.models.generate_content(
        model=MODEL,
        contents=f"""Search for the latest information about: {query}

Return the results as JSON with this exact format:
{{
  "topics": [
    {{
      "title": "Short descriptive title of the news or information",
      "summary": "2-3 sentence summary of the topic"
    }}
  ]
}}

Return the top 5 most relevant and recent results. Only return valid JSON, no other text.""",
        config=types.GenerateContentConfig(
            tools=[google_search_tool],
            temperature=0.3,
        ),
    )

    sources = []
    if response.candidates:
        sources = _extract_sources(response.candidates[0])

    parsed = _parse_json_response(response.text)
    topics = parsed.get("topics", [])

    for topic in topics:
        topic["sources"] = sources

    return topics
