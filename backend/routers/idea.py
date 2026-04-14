from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.claude import generate_idea, generate_narrative_template

router = APIRouter(prefix="/idea", tags=["idea"])


class GenerateIdeaRequest(BaseModel):
    topic_title: str
    topic_summary: str
    sources: list[str] = []
    narrative_template: Optional[str] = None


class NarrativeTemplateRequest(BaseModel):
    user_input: str


@router.post("/narrative-template")
async def create_narrative_template(request: NarrativeTemplateRequest):
    """AI-generated narrative structure (JSON) from natural-language intent."""
    try:
        text = (request.user_input or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="user_input is required")
        return generate_narrative_template(text)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate")
async def create_idea(request: GenerateIdeaRequest):
    try:
        idea = generate_idea(
            topic_title=request.topic_title,
            topic_summary=request.topic_summary,
            sources=request.sources,
            narrative_template=request.narrative_template,
        )
        return idea
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
