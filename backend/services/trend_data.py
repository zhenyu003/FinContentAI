"""
Data aggregation pipeline for Trend Explorer.

1. YouTube Data API v3  → top finance videos with view counts
2. Twitter/X            → mock engagement (real API requires paid access)
3. Gemini LLM           → summarise *why* each topic is trending
"""

import os
import logging
import json
import re
import random
from typing import Optional

from google import genai
from google.genai import types as genai_types

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"

# ──────────────────────────────────────────────
# 1.  YouTube Data API
# ──────────────────────────────────────────────

def _get_youtube_service():
    """Build the YouTube v3 service using the same Gemini key (works for public data)."""
    from googleapiclient.discovery import build

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    return build("youtube", "v3", developerKey=api_key)


def fetch_youtube_finance_videos(max_results: int = 10) -> list[dict]:
    """
    Search YouTube for trending finance videos and return title + viewCount.
    Falls back to empty list on any error.
    """
    try:
        yt = _get_youtube_service()
        if yt is None:
            return []

        search_resp = (
            yt.search()
            .list(
                q="finance stock market investing 2026",
                part="snippet",
                type="video",
                order="viewCount",
                maxResults=max_results,
                relevanceLanguage="en",
                publishedAfter="2026-01-01T00:00:00Z",
            )
            .execute()
        )

        video_ids = [item["id"]["videoId"] for item in search_resp.get("items", [])]
        if not video_ids:
            return []

        stats_resp = (
            yt.videos()
            .list(part="snippet,statistics", id=",".join(video_ids))
            .execute()
        )

        results = []
        for item in stats_resp.get("items", []):
            stats = item.get("statistics", {})
            results.append(
                {
                    "title": item["snippet"]["title"],
                    "youtube_views": int(stats.get("viewCount", 0)),
                    "youtube_likes": int(stats.get("likeCount", 0)),
                }
            )
        return results
    except Exception as e:
        logger.warning("YouTube API call failed: %s", e)
        return []


# ──────────────────────────────────────────────
# 2.  Twitter / X  (mock — real API requires paid tier)
# ──────────────────────────────────────────────

def _mock_twitter_engagement(topic_title: str) -> dict:
    """
    Generate plausible Twitter engagement numbers seeded by the topic title
    so values are stable across requests.
    """
    seed = sum(ord(c) for c in topic_title)
    rng = random.Random(seed)
    likes = rng.randint(3_000, 50_000)
    retweets = rng.randint(1_000, int(likes * 0.6))
    return {"twitter_likes": likes, "twitter_retweets": retweets}


# ──────────────────────────────────────────────
# 3.  LLM Summarisation  (Gemini)
# ──────────────────────────────────────────────

def _get_gemini_client():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    return genai.Client(api_key=api_key)


def _parse_json(text: str):
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", cleaned)
    cleaned = re.sub(r"\n?```\s*$", "", cleaned)
    return json.loads(cleaned)


def generate_trend_summaries(topics: list[dict], need_yt_estimates: bool = False) -> list[dict]:
    """
    Given a list of {"title", "youtube_views", "twitter_likes", ...},
    call Gemini once to batch-generate:
      - a 1-2 sentence AI summary for each
      - estimated YouTube view counts (when the real API is unavailable)
    Returns the same list with "ai_summary" (and optionally "youtube_views") filled in.
    """
    client = _get_gemini_client()
    if client is None or not topics:
        for t in topics:
            t.setdefault("ai_summary", t.get("summary", ""))
        return topics

    bullet_list = "\n".join(
        f'- "{t["title"]}" (Twitter likes: {t.get("twitter_likes", "N/A")})'
        for t in topics
    )

    yt_instruction = ""
    yt_field = ""
    if need_yt_estimates:
        yt_instruction = (
            '\nAlso estimate a realistic "youtube_views" number (integer) for each topic '
            "based on how popular similar finance videos typically get on YouTube."
        )
        yt_field = ', "youtube_views": <integer>'

    prompt = f"""You are a financial analyst. For each trending topic below, write a concise
1-2 sentence explanation of *why* it is trending and what it means for investors.{yt_instruction}

Topics:
{bullet_list}

Return ONLY valid JSON — an array of objects:
[
  {{"title": "...", "ai_summary": "..."{yt_field}}},
  ...
]
"""

    try:
        resp = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=genai_types.GenerateContentConfig(temperature=0.4),
        )
        summaries = _parse_json(resp.text)
        summary_map = {s["title"]: s for s in summaries}
        for t in topics:
            match = summary_map.get(t["title"], {})
            t["ai_summary"] = match.get("ai_summary", t.get("summary", ""))
            if need_yt_estimates and t.get("youtube_views", 0) == 0:
                t["youtube_views"] = match.get("youtube_views", 0)
    except Exception as e:
        logger.warning("Gemini trend-summary call failed: %s", e)
        for t in topics:
            t.setdefault("ai_summary", t.get("summary", ""))

    return topics


# ──────────────────────────────────────────────
# 4.  Orchestrator — full pipeline
# ──────────────────────────────────────────────

def fetch_enriched_trends() -> list[dict]:
    """
    End-to-end pipeline:
      Gemini Search → YouTube stats → Twitter mock → LLM summary
    Returns fully enriched trend objects.
    """
    # Step A: get trending topics via Gemini Search grounding
    raw_topics = _fetch_topics_from_gemini()

    # Step B: fetch YouTube view counts for matching topics
    yt_videos = fetch_youtube_finance_videos(max_results=10)
    yt_map = {v["title"].lower(): v for v in yt_videos}
    yt_available = len(yt_videos) > 0

    enriched: list[dict] = []
    for i, topic in enumerate(raw_topics):
        title = topic["title"]
        summary = topic.get("summary", "")

        yt_match = _best_youtube_match(title, yt_map) if yt_available else None
        twitter = _mock_twitter_engagement(title)

        enriched.append(
            {
                "id": f"trend-{i + 1}",
                "title": title,
                "summary": summary,
                "category": topic.get("category", _infer_category(title)),
                "youtube_views": yt_match.get("youtube_views", 0) if yt_match else 0,
                "twitter_likes": twitter["twitter_likes"],
                "twitter_retweets": twitter["twitter_retweets"],
                "ai_summary": "",
            }
        )

    # Step C: batch LLM summaries (+ YT estimates when API unavailable)
    enriched = generate_trend_summaries(enriched, need_yt_estimates=not yt_available)

    # Compute composite engagement score (0-100) for sorting
    for t in enriched:
        t["engagement"] = _compute_engagement_score(t)

    enriched.sort(key=lambda t: t["engagement"], reverse=True)
    return enriched


def _fetch_topics_from_gemini() -> list[dict]:
    """Grab trending finance topics using Gemini + Google Search grounding."""
    client = _get_gemini_client()
    if client is None:
        return []

    google_search_tool = genai_types.Tool(google_search=genai_types.GoogleSearch())
    resp = client.models.generate_content(
        model=GEMINI_MODEL,
        contents="""Search for today's most important financial news across these categories:
- Top financial and business headlines
- Stock market movers
- Earnings and company news
- Breaking economic news
- Cryptocurrency updates

Return the results as JSON:
{
  "topics": [
    {"title": "Short descriptive title", "summary": "2-3 sentence summary", "category": "one of: Macro, Tech, Crypto, Earnings, Energy, Real Estate, Consumer, Markets"}
  ]
}

Return 8-10 results. Only valid JSON, no other text.""",
        config=genai_types.GenerateContentConfig(
            tools=[google_search_tool],
            temperature=0.3,
        ),
    )
    parsed = _parse_json(resp.text)
    return parsed.get("topics", [])


def _best_youtube_match(topic_title: str, yt_map: dict) -> Optional[dict]:
    """Simple keyword overlap match between a topic title and YouTube titles."""
    topic_words = set(topic_title.lower().split())
    best, best_score = None, 0
    for yt_title_lower, data in yt_map.items():
        yt_words = set(yt_title_lower.split())
        overlap = len(topic_words & yt_words)
        if overlap > best_score:
            best_score = overlap
            best = data
    return best if best_score >= 2 else None


CATEGORY_KEYWORDS = {
    "Crypto": ["bitcoin", "crypto", "ethereum", "btc", "eth", "blockchain", "token"],
    "Tech": ["ai", "chip", "semiconductor", "nvidia", "tech", "software", "apple", "google", "microsoft"],
    "Macro": ["fed", "rate", "inflation", "gdp", "treasury", "monetary", "fiscal", "tariff"],
    "Energy": ["oil", "energy", "gas", "solar", "renewable", "utility"],
    "Real Estate": ["real estate", "housing", "mortgage", "reit"],
    "Earnings": ["earnings", "revenue", "profit", "quarterly", "q1", "q2", "q3", "q4"],
    "Consumer": ["retail", "consumer", "spending", "walmart", "amazon"],
}


def _infer_category(title: str) -> str:
    lower = title.lower()
    for cat, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return cat
    return "Markets"


def _compute_engagement_score(t: dict) -> int:
    """Normalise raw metrics into a 0-100 composite score."""
    yt = min(t.get("youtube_views", 0) / 2_000_000, 1.0) * 40
    tl = min(t.get("twitter_likes", 0) / 50_000, 1.0) * 35
    tr = min(t.get("twitter_retweets", 0) / 20_000, 1.0) * 25
    return min(int(yt + tl + tr), 100)


# ──────────────────────────────────────────────
# 5.  Topic enrichment (for HomePage cards)
# ──────────────────────────────────────────────

def _mock_twitter_views(topic_title: str) -> int:
    """Seeded mock Twitter/X impression count."""
    seed = sum(ord(c) for c in topic_title) + 7
    rng = random.Random(seed)
    return rng.randint(200_000, 3_000_000)


def enrich_topics_with_insights(topics: list[dict]) -> list[dict]:
    """
    Take a list of existing topic dicts (title, summary, sources) and bolt on:
      - youtube_views  (real from YT API, or LLM-estimated)
      - twitter_views  (mock impressions)
      - ai_summary     (1-2 sentence LLM explanation)
    Returns the same list, mutated in place.
    """
    if not topics:
        return topics

    # YouTube
    yt_videos = fetch_youtube_finance_videos(max_results=10)
    yt_map = {v["title"].lower(): v for v in yt_videos}
    yt_available = len(yt_videos) > 0

    for t in topics:
        title = t.get("title", "")
        yt_match = _best_youtube_match(title, yt_map) if yt_available else None
        t["youtube_views"] = yt_match.get("youtube_views", 0) if yt_match else 0
        t["twitter_views"] = _mock_twitter_views(title)

    # LLM summaries (+ YT estimates when API unavailable)
    client = _get_gemini_client()
    if client is None:
        for t in topics:
            t.setdefault("ai_summary", "")
        return topics

    bullet_list = "\n".join(
        f'- "{t["title"]}" (Twitter views: {t.get("twitter_views", "N/A")})'
        for t in topics
    )

    yt_instruction = ""
    yt_field = ""
    if not yt_available:
        yt_instruction = (
            '\nAlso estimate a realistic "youtube_views" number (integer) for each topic '
            "based on how popular similar finance videos typically get on YouTube."
        )
        yt_field = ', "youtube_views": <integer>'

    prompt = f"""You are a financial analyst. For each trending topic below, write a concise
1-2 sentence explanation of *why* it is trending and what it means for investors.{yt_instruction}

Topics:
{bullet_list}

Return ONLY valid JSON — an array of objects:
[
  {{"title": "...", "ai_summary": "..."{yt_field}}},
  ...
]
"""

    try:
        resp = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=genai_types.GenerateContentConfig(temperature=0.4),
        )
        summaries = _parse_json(resp.text)
        summary_map = {s["title"]: s for s in summaries}
        for t in topics:
            match = summary_map.get(t["title"], {})
            t["ai_summary"] = match.get("ai_summary", "")
            if not yt_available and t.get("youtube_views", 0) == 0:
                t["youtube_views"] = match.get("youtube_views", 0)
    except Exception as e:
        logger.warning("Topic enrichment LLM call failed: %s", e)
        for t in topics:
            t.setdefault("ai_summary", "")

    return topics
