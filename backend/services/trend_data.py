"""
Data helpers for topic enrichment (YouTube stats, mock metrics, LLM summaries).
"""

import os
import logging
import random
from typing import Optional

from google.genai import types as genai_types

from services.utils import get_gemini_client, parse_json_response

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"

# ──────────────────────────────────────────────
# YouTube Data API
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
# Helpers
# ──────────────────────────────────────────────


def _get_gemini_client_optional():
    """Return a Gemini client or None if GEMINI_API_KEY is not set."""
    try:
        return get_gemini_client()
    except ValueError:
        return None


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


# ──────────────────────────────────────────────
# Topic enrichment (for HomePage cards)
# ──────────────────────────────────────────────

def _mock_twitter_views(topic_title: str) -> int:
    """Seeded mock Twitter/X impression count."""
    seed = sum(ord(c) for c in topic_title) + 7
    rng = random.Random(seed)
    return rng.randint(200_000, 3_000_000)


def apply_topic_metric_fallbacks(topics: list[dict]) -> None:
    """Fill missing engagement fields when enrichment times out or fails."""
    for t in topics:
        title = t.get("title", "")
        if not t.get("youtube_views"):
            t["youtube_views"] = _mock_youtube_views(title)
        if not t.get("twitter_views"):
            t["twitter_views"] = _mock_twitter_views(title)
        if not t.get("ai_summary"):
            t["ai_summary"] = (t.get("summary") or "")[:400]


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
    client = _get_gemini_client_optional()
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
        summaries = parse_json_response(resp.text)
        summary_map_exact = {s["title"]: s for s in summaries}
        summary_map_lower = {s["title"].lower(): s for s in summaries}
        for t in topics:
            match = summary_map_exact.get(t["title"])
            if not match:
                match = summary_map_lower.get(t["title"].lower(), {})
            t["ai_summary"] = match.get("ai_summary", "")
            if not yt_available and t.get("youtube_views", 0) == 0:
                t["youtube_views"] = match.get("youtube_views", 0)
    except Exception as e:
        logger.warning("Topic enrichment LLM call failed: %s", e)
        for t in topics:
            t.setdefault("ai_summary", "")

    # Ensure youtube_views is never 0 — use a seeded mock as last resort
    for t in topics:
        if not t.get("youtube_views"):
            t["youtube_views"] = _mock_youtube_views(t.get("title", ""))

    return topics


def _mock_youtube_views(topic_title: str) -> int:
    """Seeded mock YouTube view count when real API and LLM estimates fail."""
    seed = sum(ord(c) for c in topic_title) + 42
    rng = random.Random(seed)
    return rng.randint(150_000, 4_000_000)
