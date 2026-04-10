from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from services.supabase_client import get_supabase_client
from middleware.auth import get_current_user

router = APIRouter(prefix="/profile", tags=["profile"])


# --------------- Constants ---------------

WRITING_STYLES = [
    "professional",
    "casual",
    "data-driven",
    "storytelling",
    "academic",
    "conversational",
]

TONES = [
    "neutral",
    "bullish",
    "bearish",
    "contrarian",
    "cautiously-optimistic",
    "analytical",
]

TARGET_AUDIENCES = [
    "general",
    "retail_investors",
    "professionals",
    "institutions",
    "beginners",
]

FOCUS_AREAS_OPTIONS = [
    "macro_economics",
    "tech_stocks",
    "crypto",
    "commodities",
    "real_estate",
    "etfs",
    "options",
    "emerging_markets",
    "esg",
    "fixed_income",
]


# --------------- Request Models ---------------

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    writing_style: Optional[str] = None
    tone: Optional[str] = None
    focus_areas: Optional[list[str]] = None
    target_audience: Optional[str] = None
    default_language: Optional[str] = None
    persona_notes: Optional[str] = None


# --------------- Endpoints ---------------

@router.get("")
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Get the current user's profile."""
    try:
        supabase = get_supabase_client()
        result = (
            supabase.table("profiles")
            .select("*")
            .eq("id", current_user["id"])
            .maybe_single()
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail="Profile not found")

        return {"profile": result.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("")
async def update_profile(
    body: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update the current user's profile with partial data."""
    try:
        # Build update payload from non-None fields only
        updates = body.model_dump(exclude_none=True)
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        supabase = get_supabase_client()
        result = (
            supabase.table("profiles")
            .update(updates)
            .eq("id", current_user["id"])
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail="Profile not found")

        return {"profile": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/styles")
async def get_style_options():
    """Return available options for profile dropdowns."""
    return {
        "writing_styles": WRITING_STYLES,
        "tones": TONES,
        "target_audiences": TARGET_AUDIENCES,
        "focus_areas_options": FOCUS_AREAS_OPTIONS,
    }
