import os
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.gemini import search_trending_topics, search_custom_topic
from services.trend_data import enrich_topics_with_insights

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/topics", tags=["topics"])

FALLBACK_TOPICS = [
    {
        "title": "Fed Rate Decision Impact on Tech Stocks",
        "summary": "The Federal Reserve's latest rate decision is sending ripples through the tech sector, with growth stocks seeing increased volatility as investors reassess valuations in a shifting monetary policy landscape.",
        "sources": [],
    },
    {
        "title": "AI Chip Shortage Drives Semiconductor Rally",
        "summary": "Surging demand for AI training and inference chips has created a global semiconductor shortage, pushing major chipmakers to all-time highs as data-center buildouts accelerate worldwide.",
        "sources": [],
    },
    {
        "title": "Bitcoin ETF Inflows Hit Record Levels",
        "summary": "Spot Bitcoin ETFs are attracting unprecedented capital inflows as institutional investors increase crypto allocations ahead of the next halving cycle.",
        "sources": [],
    },
    {
        "title": "Commercial Real Estate Debt Crisis Deepens",
        "summary": "Regional banks face mounting pressure as commercial real estate loan defaults accelerate, raising concerns about systemic risk in the banking sector.",
        "sources": [],
    },
    {
        "title": "Green Energy Subsidies Reshape Utility Sector",
        "summary": "New government subsidies are accelerating the transition to renewable energy, creating both winners and losers among traditional utility companies.",
        "sources": [],
    },
    {
        "title": "Consumer Spending Resilience Surprises Analysts",
        "summary": "Despite inflation concerns, retail sales data shows consumers continue to spend, defying recession predictions and boosting consumer discretionary stocks.",
        "sources": [],
    },
    {
        "title": "NVIDIA Earnings Beat Expectations on AI Demand",
        "summary": "NVIDIA reported record quarterly revenue driven by data-center GPU sales, as hyperscalers and enterprises ramp up spending on AI infrastructure.",
        "sources": [],
    },
    {
        "title": "US-China Trade Tensions Escalate with New Tariffs",
        "summary": "Fresh tariff announcements on semiconductors and EV batteries have reignited trade-war fears, weighing on global supply chains and multinational equities.",
        "sources": [],
    },
    {
        "title": "Oil Prices Surge on OPEC Production Cuts",
        "summary": "Crude oil prices jumped after OPEC+ announced deeper-than-expected output reductions, raising energy costs and inflation concerns worldwide.",
        "sources": [],
    },
    {
        "title": "Treasury Yields Hit Multi-Year Highs",
        "summary": "The 10-year Treasury yield crossed key thresholds as strong economic data pushed back expectations for rate cuts, pressuring equity valuations.",
        "sources": [],
    },
    {
        "title": "Ethereum Staking Yields Attract Institutional Capital",
        "summary": "Growing staking yields on Ethereum are drawing institutional allocators, positioning ETH as a yield-bearing digital asset alongside traditional fixed income.",
        "sources": [],
    },
    {
        "title": "Meta Platforms Pivots to AI-First Revenue Model",
        "summary": "Meta reported a major shift in ad-revenue strategy powered by generative AI, boosting margins and signaling a new phase of growth for the social media giant.",
        "sources": [],
    },
    {
        "title": "Regional Bank Mergers Accelerate Amid Deposit Flight",
        "summary": "A wave of regional bank consolidation is underway as smaller lenders struggle with deposit outflows and tighter capital requirements.",
        "sources": [],
    },
    {
        "title": "Japan Yen Weakness Fuels Global Carry Trade",
        "summary": "The yen's slide to multi-decade lows is fueling global carry trades, with implications for emerging market currencies and cross-border capital flows.",
        "sources": [],
    },
    {
        "title": "Pharmaceutical Stocks Rally on Weight-Loss Drug Demand",
        "summary": "GLP-1 drug makers are seeing explosive revenue growth as demand for weight-loss treatments outstrips supply, reshaping the healthcare investment landscape.",
        "sources": [],
    },
    {
        "title": "Apple Vision Pro Sales Disappoint, AR Sector Cools",
        "summary": "Slower-than-expected Vision Pro adoption has dampened enthusiasm for AR/VR hardware, pulling down valuations across the spatial computing supply chain.",
        "sources": [],
    },
    {
        "title": "Global Copper Shortage Signals Infrastructure Boom",
        "summary": "Rising copper prices reflect surging demand from EV manufacturing and grid modernization, creating investment opportunities across the mining sector.",
        "sources": [],
    },
    {
        "title": "Student Loan Repayments Resume, Hitting Retail Spending",
        "summary": "The restart of federal student loan payments is expected to redirect billions from consumer spending, with retailers and discretionary stocks bracing for impact.",
        "sources": [],
    },
    {
        "title": "Cybersecurity Spending Surges After Major Data Breaches",
        "summary": "A string of high-profile data breaches is accelerating enterprise cybersecurity budgets, benefiting pure-play security firms and cloud security platforms.",
        "sources": [],
    },
    {
        "title": "India Emerges as Top Destination for Foreign Investment",
        "summary": "Record FDI inflows into India reflect growing confidence in its domestic market and manufacturing capabilities as global supply chains diversify away from China.",
        "sources": [],
    },
]


def _gemini_available() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY"))


class CustomTopicRequest(BaseModel):
    query: str


class EnrichRequest(BaseModel):
    topics: list[dict]


@router.get("")
async def get_trending_topics():
    if not _gemini_available():
        logger.warning("GEMINI_API_KEY not set — returning fallback topics")
        return {"topics": FALLBACK_TOPICS}
    try:
        topics = search_trending_topics()
        return {"topics": topics}
    except Exception as e:
        logger.error("Gemini trending topics failed, using fallback: %s", e)
        return {"topics": FALLBACK_TOPICS}


@router.post("/enrich")
async def enrich_topics(body: EnrichRequest):
    """Enrich a list of topics with YouTube views, Twitter views, and AI summaries."""
    try:
        enriched = enrich_topics_with_insights(body.topics)
        return {"topics": enriched}
    except Exception as e:
        logger.error("Topic enrichment failed: %s", e)
        for t in body.topics:
            t.setdefault("youtube_views", 0)
            t.setdefault("twitter_views", 0)
            t.setdefault("ai_summary", "")
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
