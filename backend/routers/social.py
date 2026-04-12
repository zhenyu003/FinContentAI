from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional

from middleware.auth import get_optional_user
from services.supabase_client import get_supabase_client
from services.social_post import (
    generate_social_idea,
    generate_social_content,
    refine_social_content,
)
from services.dalle import generate_image
from services.knowledge import get_knowledge_context

router = APIRouter(prefix="/social", tags=["social"])


# --------------- Helpers ---------------


async def _build_profile_context(user_id: str) -> str:
    """Fetch user profile from Supabase and format as context string."""
    try:
        supabase = get_supabase_client()
        result = (
            supabase.table("profiles")
            .select("*")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        if not result.data:
            return ""

        p = result.data
        parts = []
        if p.get("display_name"):
            parts.append(f"Creator name: {p['display_name']}")
        if p.get("bio"):
            parts.append(f"Bio: {p['bio']}")
        if p.get("writing_style"):
            parts.append(f"Preferred writing style: {p['writing_style']}")
        if p.get("tone"):
            parts.append(f"Preferred tone: {p['tone']}")
        if p.get("target_audience"):
            parts.append(f"Target audience: {p['target_audience']}")
        if p.get("focus_areas"):
            parts.append(f"Focus areas: {', '.join(p['focus_areas'])}")
        if p.get("persona_notes"):
            parts.append(f"Persona notes: {p['persona_notes']}")

        return "\n".join(parts) if parts else ""
    except Exception:
        return ""


async def _build_knowledge_context(user_id: str, topic: str) -> str:
    """Search user's knowledge base for relevant context."""
    try:
        return await get_knowledge_context(user_id, topic)
    except Exception:
        return ""


# --------------- Request Models ---------------


class SocialIdeaRequest(BaseModel):
    topic_title: str
    topic_summary: str
    sources: list[str] = []
    narrative_template: Optional[str] = None


class SocialGenerateRequest(BaseModel):
    topic_title: str
    topic_summary: str
    idea: dict
    user_opinion: str = ""
    config: dict = {}


class SocialRefineRequest(BaseModel):
    platform: str
    current_text: str
    feedback: str


class SocialImageRequest(BaseModel):
    prompt: str
    aspect_ratio: str = "1:1"


# --------------- Endpoints ---------------


@router.post("/idea")
async def create_social_idea(
    body: SocialIdeaRequest,
    request: Request,
    user: Optional[dict] = Depends(get_optional_user),
):
    """Generate a social media content idea for a financial topic."""
    try:
        profile_context = ""
        knowledge_context = ""

        if user:
            profile_context = await _build_profile_context(user["id"])
            knowledge_context = await _build_knowledge_context(
                user["id"], body.topic_title
            )

        idea = generate_social_idea(
            topic_title=body.topic_title,
            topic_summary=body.topic_summary,
            sources=body.sources,
            profile_context=profile_context,
            knowledge_context=knowledge_context,
            narrative_template=body.narrative_template,
        )
        return idea
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate")
async def create_social_content(
    body: SocialGenerateRequest,
    request: Request,
    user: Optional[dict] = Depends(get_optional_user),
):
    """Generate platform-specific social media content."""
    try:
        profile_context = ""
        knowledge_context = ""

        if user:
            profile_context = await _build_profile_context(user["id"])
            knowledge_context = await _build_knowledge_context(
                user["id"], body.topic_title
            )

        content = generate_social_content(
            topic_title=body.topic_title,
            topic_summary=body.topic_summary,
            idea=body.idea,
            user_opinion=body.user_opinion,
            config=body.config,
            profile_context=profile_context,
            knowledge_context=knowledge_context,
        )
        return content
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refine")
async def refine_content(body: SocialRefineRequest):
    """Refine a specific platform's social media text based on feedback."""
    try:
        result = refine_social_content(
            platform=body.platform,
            current_text=body.current_text,
            feedback=body.feedback,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/image")
async def create_social_image(body: SocialImageRequest):
    """Generate an image for a social media post using Imagen."""
    try:
        file_path = generate_image(
            prompt=body.prompt,
            aspect_ratio=body.aspect_ratio,
        )
        url = "/" + file_path.replace("\\", "/")
        return {"image_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
