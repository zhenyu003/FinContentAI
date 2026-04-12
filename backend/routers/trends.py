import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, Literal

from middleware.auth import get_optional_user
from services.trend_data import fetch_enriched_trends

logger = logging.getLogger(__name__)

router = APIRouter(tags=["trends"])

FALLBACK_TRENDS = [
    {
        "id": "trend-1",
        "title": "Fed Rate Decision Impact on Tech Stocks",
        "summary": "The Federal Reserve's latest rate decision is sending ripples through the tech sector, with growth stocks seeing increased volatility.",
        "category": "Macro",
        "engagement": 94,
        "youtube_views": 1_450_000,
        "twitter_likes": 38_200,
        "twitter_retweets": 12_400,
        "ai_summary": "Investors are repricing growth stocks after the Fed signaled a slower pace of rate cuts, creating short-term volatility but potential entry points for long-term holders.",
    },
    {
        "id": "trend-2",
        "title": "AI Chip Shortage Drives Semiconductor Rally",
        "summary": "Surging demand for AI training and inference chips has created a global semiconductor shortage, pushing NVIDIA and AMD to all-time highs.",
        "category": "Tech",
        "engagement": 91,
        "youtube_views": 2_300_000,
        "twitter_likes": 45_100,
        "twitter_retweets": 18_700,
        "ai_summary": "AI chip demand is far outpacing supply as hyperscalers race to build out data centers, making semiconductor stocks the top-performing sector this quarter.",
    },
    {
        "id": "trend-3",
        "title": "Bitcoin ETF Inflows Hit Record Levels",
        "summary": "Spot Bitcoin ETFs are attracting unprecedented capital inflows as institutional investors increase crypto allocations.",
        "category": "Crypto",
        "engagement": 88,
        "youtube_views": 980_000,
        "twitter_likes": 42_000,
        "twitter_retweets": 15_300,
        "ai_summary": "Institutional money is flooding into spot Bitcoin ETFs ahead of the halving cycle, signaling a maturing asset class and potential price catalyst.",
    },
    {
        "id": "trend-4",
        "title": "Commercial Real Estate Debt Crisis Deepens",
        "summary": "Regional banks face mounting pressure as commercial real estate loan defaults accelerate, raising concerns about systemic risk.",
        "category": "Real Estate",
        "engagement": 82,
        "youtube_views": 650_000,
        "twitter_likes": 28_500,
        "twitter_retweets": 9_200,
        "ai_summary": "Rising office vacancies and refinancing walls are forcing regional banks to write down CRE loans, reigniting fears of a 2008-style credit crunch in the sector.",
    },
    {
        "id": "trend-5",
        "title": "Green Energy Subsidies Reshape Utility Sector",
        "summary": "New government subsidies are accelerating the transition to renewable energy, creating winners and losers among traditional utilities.",
        "category": "Energy",
        "engagement": 76,
        "youtube_views": 420_000,
        "twitter_likes": 19_800,
        "twitter_retweets": 7_100,
        "ai_summary": "Generous IRA subsidies are making solar and wind projects economically irresistible, driving a rotation from fossil-fuel utilities into clean-energy plays.",
    },
    {
        "id": "trend-6",
        "title": "Consumer Spending Resilience Surprises Analysts",
        "summary": "Despite inflation concerns, retail sales data shows consumers continue to spend, defying recession predictions.",
        "category": "Consumer",
        "engagement": 73,
        "youtube_views": 310_000,
        "twitter_likes": 15_600,
        "twitter_retweets": 5_400,
        "ai_summary": "Strong labor markets and excess savings are sustaining consumer spending even as prices remain elevated, pushing recession timelines further out.",
    },
]


class GenerateRequest(BaseModel):
    trend: dict
    content_type: Literal["text", "video"]


@router.get("/trends")
async def get_trends():
    """Fetch enriched trending financial topics with YouTube, Twitter, and AI data."""
    try:
        trends = fetch_enriched_trends()
        if trends:
            return {"trends": trends}
    except Exception as e:
        logger.error("Trend pipeline failed, using fallback: %s", e)

    return {"trends": FALLBACK_TRENDS}


@router.post("/generate")
async def generate_content(
    body: GenerateRequest,
    request: Request,
    user: Optional[dict] = Depends(get_optional_user),
):
    """Generate content (text post or video) for a selected trend."""
    try:
        trend = body.trend
        content_type = body.content_type

        if content_type == "text":
            return {
                "status": "success",
                "content_type": "text",
                "trend_title": trend.get("title", ""),
                "result": {
                    "headline": f"Breaking Down: {trend.get('title', '')}",
                    "body": (
                        f"Here's what you need to know about {trend.get('title', '')}.\n\n"
                        f"{trend.get('summary', '')}\n\n"
                        "Key takeaways:\n"
                        "1. Market implications are significant for both retail and institutional investors\n"
                        "2. Historical patterns suggest this trend may accelerate in the coming weeks\n"
                        "3. Position sizing and risk management remain critical in this environment\n\n"
                        "#Finance #Markets #Investing"
                    ),
                    "platforms": ["LinkedIn", "X", "Instagram"],
                },
            }
        else:
            return {
                "status": "success",
                "content_type": "video",
                "trend_title": trend.get("title", ""),
                "result": {
                    "script_outline": [
                        f"Hook: Why {trend.get('title', '')} matters right now",
                        f"Context: {trend.get('summary', '')}",
                        "Analysis: Key data points and expert perspectives",
                        "Impact: What this means for your portfolio",
                        "Call to action: Subscribe for more financial insights",
                    ],
                    "estimated_duration": "3-5 minutes",
                    "suggested_format": "Vertical (9:16) for Shorts/Reels",
                },
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
