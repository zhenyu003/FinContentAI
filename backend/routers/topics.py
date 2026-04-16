import os
import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.gemini import (
    generate_trending_topics_fast,
    search_trending_topics,
    search_custom_topic,
    TOPIC_CATEGORIES,
)
from services.trend_data import enrich_topics_with_insights, apply_topic_metric_fallbacks

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/topics", tags=["topics"])

FALLBACK_TOPICS = [
    {"title": "Fed Rate Decision Impact on Tech Stocks", "summary": "The Federal Reserve's latest rate decision is sending ripples through the tech sector, with growth stocks seeing increased volatility as investors reassess valuations in a shifting monetary policy landscape.", "sources": [], "category": "macro"},
    {"title": "AI Chip Shortage Drives Semiconductor Rally", "summary": "Surging demand for AI training and inference chips has created a global semiconductor shortage, pushing major chipmakers to all-time highs as data-center buildouts accelerate worldwide.", "sources": [], "category": "tech"},
    {"title": "Bitcoin ETF Inflows Hit Record Levels", "summary": "Spot Bitcoin ETFs are attracting unprecedented capital inflows as institutional investors increase crypto allocations ahead of the next halving cycle.", "sources": [], "category": "crypto"},
    {"title": "Commercial Real Estate Debt Crisis Deepens", "summary": "Regional banks face mounting pressure as commercial real estate loan defaults accelerate, raising concerns about systemic risk in the banking sector.", "sources": [], "category": "real_estate"},
    {"title": "Green Energy Subsidies Reshape Utility Sector", "summary": "New government subsidies are accelerating the transition to renewable energy, creating both winners and losers among traditional utility companies.", "sources": [], "category": "commodities"},
    {"title": "Consumer Spending Resilience Surprises Analysts", "summary": "Despite inflation concerns, retail sales data shows consumers continue to spend, defying recession predictions and boosting consumer discretionary stocks.", "sources": [], "category": "macro"},
    {"title": "NVIDIA Earnings Beat Expectations on AI Demand", "summary": "NVIDIA reported record quarterly revenue driven by data-center GPU sales, as hyperscalers and enterprises ramp up spending on AI infrastructure.", "sources": [], "category": "companies"},
    {"title": "US-China Trade Tensions Escalate with New Tariffs", "summary": "Fresh tariff announcements on semiconductors and EV batteries have reignited trade-war fears, weighing on global supply chains and multinational equities.", "sources": [], "category": "macro"},
    {"title": "Oil Prices Surge on OPEC Production Cuts", "summary": "Crude oil prices jumped after OPEC+ announced deeper-than-expected output reductions, raising energy costs and inflation concerns worldwide.", "sources": [], "category": "commodities"},
    {"title": "Treasury Yields Hit Multi-Year Highs", "summary": "The 10-year Treasury yield crossed key thresholds as strong economic data pushed back expectations for rate cuts, pressuring equity valuations.", "sources": [], "category": "macro"},
    {"title": "Ethereum Staking Yields Attract Institutional Capital", "summary": "Growing staking yields on Ethereum are drawing institutional allocators, positioning ETH as a yield-bearing digital asset alongside traditional fixed income.", "sources": [], "category": "crypto"},
    {"title": "Meta Platforms Pivots to AI-First Revenue Model", "summary": "Meta reported a major shift in ad-revenue strategy powered by generative AI, boosting margins and signaling a new phase of growth for the social media giant.", "sources": [], "category": "companies"},
    {"title": "Regional Bank Mergers Accelerate Amid Deposit Flight", "summary": "A wave of regional bank consolidation is underway as smaller lenders struggle with deposit outflows and tighter capital requirements.", "sources": [], "category": "companies"},
    {"title": "Japan Yen Weakness Fuels Global Carry Trade", "summary": "The yen's slide to multi-decade lows is fueling global carry trades, with implications for emerging market currencies and cross-border capital flows.", "sources": [], "category": "macro"},
    {"title": "Pharmaceutical Stocks Rally on Weight-Loss Drug Demand", "summary": "GLP-1 drug makers are seeing explosive revenue growth as demand for weight-loss treatments outstrips supply, reshaping the healthcare investment landscape.", "sources": [], "category": "companies"},
    {"title": "Apple Vision Pro Sales Disappoint, AR Sector Cools", "summary": "Slower-than-expected Vision Pro adoption has dampened enthusiasm for AR/VR hardware, pulling down valuations across the spatial computing supply chain.", "sources": [], "category": "tech"},
    {"title": "Global Copper Shortage Signals Infrastructure Boom", "summary": "Rising copper prices reflect surging demand from EV manufacturing and grid modernization, creating investment opportunities across the mining sector.", "sources": [], "category": "commodities"},
    {"title": "Student Loan Repayments Resume, Hitting Retail Spending", "summary": "The restart of federal student loan payments is expected to redirect billions from consumer spending, with retailers and discretionary stocks bracing for impact.", "sources": [], "category": "macro"},
    {"title": "Cybersecurity Spending Surges After Major Data Breaches", "summary": "A string of high-profile data breaches is accelerating enterprise cybersecurity budgets, benefiting pure-play security firms and cloud security platforms.", "sources": [], "category": "tech"},
    {"title": "India Emerges as Top Destination for Foreign Investment", "summary": "Record FDI inflows into India reflect growing confidence in its domestic market and manufacturing capabilities as global supply chains diversify away from China.", "sources": [], "category": "macro"},
]


def _filter_fallback(category: str | None) -> list[dict]:
    """Return fallback topics, optionally filtered by category."""
    if not category:
        return FALLBACK_TOPICS
    return [t for t in FALLBACK_TOPICS if t.get("category") == category]


def _gemini_available() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY"))


class CustomTopicRequest(BaseModel):
    query: str


class EnrichRequest(BaseModel):
    topics: list[dict]


# Fast path: plain Gemini JSON (seconds). Slow path: Google Search grounding (can hang the worker).
_TRENDING_FAST_DEADLINE_SEC = 28.0
_TRENDING_GROUNDED_DEADLINE_SEC = 42.0


@router.get("/categories")
async def get_topic_categories():
    """Return the ordered list of topic category keys."""
    return {"categories": TOPIC_CATEGORIES}


@router.get("")
async def get_trending_topics(
    live_search: bool = Query(
        False,
        description="If true, use Google Search grounding (slow); default is fast generation.",
    ),
    category: Optional[str] = Query(
        None,
        description="Filter by category (e.g. 'macro', 'crypto'). None returns a broad mix.",
    ),
):
    if not _gemini_available():
        logger.warning("GEMINI_API_KEY not set — returning fallback topics")
        return {"topics": _filter_fallback(category)}

    if live_search:
        try:
            topics = await asyncio.wait_for(
                asyncio.to_thread(search_trending_topics),
                timeout=_TRENDING_GROUNDED_DEADLINE_SEC,
            )
            if not topics:
                return {"topics": _filter_fallback(category)}
            return {"topics": topics}
        except asyncio.TimeoutError:
            logger.warning("Grounded trending topics timed out — using static fallback")
            return {"topics": _filter_fallback(category)}
        except Exception as e:
            logger.error("Grounded trending topics failed: %s", e)
            return {"topics": _filter_fallback(category)}

    try:
        topics = await asyncio.wait_for(
            asyncio.to_thread(generate_trending_topics_fast, category),
            timeout=_TRENDING_FAST_DEADLINE_SEC,
        )
        if not topics:
            return {"topics": _filter_fallback(category)}
        return {"topics": topics}
    except asyncio.TimeoutError:
        logger.warning("Fast trending topics timed out — returning static fallback")
        return {"topics": _filter_fallback(category)}
    except Exception as e:
        logger.error("Fast trending topics failed, using fallback: %s", e)
        return {"topics": _filter_fallback(category)}


_ENRICH_DEADLINE_SEC = 55.0


@router.post("/enrich")
async def enrich_topics(body: EnrichRequest):
    """Enrich a list of topics with YouTube views, Twitter views, and AI summaries."""
    try:
        enriched = await asyncio.wait_for(
            asyncio.to_thread(enrich_topics_with_insights, body.topics),
            timeout=_ENRICH_DEADLINE_SEC,
        )
        return {"topics": enriched}
    except asyncio.TimeoutError:
        logger.warning(
            "Topic enrichment exceeded %.0fs — returning partially enriched list",
            _ENRICH_DEADLINE_SEC,
        )
        apply_topic_metric_fallbacks(body.topics)
        return {"topics": body.topics}
    except Exception as e:
        logger.error("Topic enrichment failed: %s", e)
        apply_topic_metric_fallbacks(body.topics)
        return {"topics": body.topics}


@router.post("/search")
async def search_topic(request: CustomTopicRequest):
    if not _gemini_available():
        return {
            "title": request.query,
            "summary": f"You searched for: {request.query}. Configure GEMINI_API_KEY for AI-powered research.",
            "sources": [],
        }
    try:
        topics = search_custom_topic(request.query)
        if topics:
            return topics[0]
        return {"title": request.query, "summary": "", "sources": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
