from google.genai import types

from services.utils import get_gemini_client, parse_json_response

MODEL = "gemini-2.5-flash"


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


# Canonical category list — order matters (broadest first).
TOPIC_CATEGORIES = [
    "macro",        # Macro-economics, Fed, rates, GDP, inflation
    "companies",    # Company earnings, strategy, M&A
    "tech",         # Tech sector, AI, semiconductors, software
    "crypto",       # Crypto, Bitcoin, Ethereum, DeFi
    "commodities",  # Oil, gold, copper, agriculture
    "real_estate",  # Real estate, REITs, housing
    "etfs_funds",   # ETFs, mutual funds, index investing
]

_CATEGORY_DESCRIPTIONS = {
    "macro":       "macroeconomics, central bank policy, interest rates, inflation, GDP, employment, treasury yields, global trade",
    "companies":   "company earnings, corporate strategy, M&A activity, IPOs, executive moves, business performance",
    "tech":        "technology sector, AI and semiconductors, software platforms, cloud computing, cybersecurity, social media companies",
    "crypto":      "cryptocurrency, Bitcoin, Ethereum, DeFi, stablecoins, crypto regulation, blockchain, digital assets, NFTs",
    "commodities": "oil and energy, gold, copper, agriculture, OPEC, commodity trading, natural resources",
    "real_estate": "commercial and residential real estate, REITs, housing market, mortgage rates, property investment",
    "etfs_funds":  "ETFs, index funds, passive investing, fund flows, asset allocation, portfolio strategy",
}


def generate_trending_topics_fast(category: str | None = None) -> list[dict]:
    """Generate plausible finance episode topics without Google Search (seconds, reliable).

    When category is given, all 20 topics focus on that category.
    When category is None, return a broad mix with category tags.
    """
    client = get_gemini_client()

    if category and category in _CATEGORY_DESCRIPTIONS:
        focus = _CATEGORY_DESCRIPTIONS[category]
        prompt = f"""You help finance YouTubers choose episode topics. Propose plausible, timely-feeling financial story ideas focused on: {focus}.

Return JSON only with this exact shape:
{{
  "topics": [
    {{"title": "Short headline-style title", "summary": "2-3 sentence summary for the creator", "category": "{category}"}}
  ]
}}

Return exactly 20 topics with distinct titles. All topics must be about {focus}. Valid JSON only, no markdown fences."""
    else:
        cat_list = ", ".join(f'"{c}"' for c in TOPIC_CATEGORIES)
        prompt = f"""You help finance YouTubers choose episode topics. Propose plausible, timely-feeling financial story ideas (themes may reflect real markets; you are not browsing the web).

Cover variety across these categories: {", ".join(f"{k}: {v}" for k, v in _CATEGORY_DESCRIPTIONS.items())}

Return JSON only with this exact shape:
{{
  "topics": [
    {{"title": "Short headline-style title", "summary": "2-3 sentence summary for the creator", "category": "<one of {cat_list}>"}}
  ]
}}

Return exactly 20 topics with distinct titles (home UI shows top 9 plus ranks 10–20). Each topic must have exactly one category from the list above. Valid JSON only, no markdown fences."""

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.45),
    )
    parsed = parse_json_response(response.text)
    topics = parsed.get("topics", [])
    for topic in topics:
        topic.setdefault("sources", [])
        topic.setdefault("category", "macro")
    return topics


def search_trending_topics() -> list[dict]:
    """Search for trending financial news topics using Gemini with Google Search grounding."""
    client = get_gemini_client()
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

Return 12–15 of the most important and recent results (fewer is better than incomplete JSON). Only return valid JSON, no other text.""",
        config=types.GenerateContentConfig(
            tools=[google_search_tool],
            temperature=0.3,
        ),
    )

    sources = []
    if response.candidates:
        sources = _extract_sources(response.candidates[0])

    parsed = parse_json_response(response.text)
    topics = parsed.get("topics", [])

    for topic in topics:
        topic["sources"] = sources

    return topics


def search_custom_topic(query: str) -> list[dict]:
    """Search a custom topic using Gemini with Google Search grounding."""
    client = get_gemini_client()
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

    parsed = parse_json_response(response.text)
    topics = parsed.get("topics", [])

    for topic in topics:
        topic["sources"] = sources

    return topics
