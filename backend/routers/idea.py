from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from middleware.auth import get_optional_user
from services.claude import generate_idea, generate_narrative_template, recommend_template
from services.knowledge import get_knowledge_context

router = APIRouter(prefix="/idea", tags=["idea"])


class RecommendTemplateRequest(BaseModel):
    topic_title: str
    topic_summary: str
    templates: list[str]


class GenerateIdeaRequest(BaseModel):
    topic_title: str
    topic_summary: str
    sources: list[str] = []
    narrative_template: Optional[str] = None


class NarrativeTemplateRequest(BaseModel):
    user_input: str


@router.post("/recommend-template")
async def api_recommend_template(request: RecommendTemplateRequest):
    """Return the best narrative template for a given topic."""
    try:
        return recommend_template(
            topic_title=request.topic_title,
            topic_summary=request.topic_summary,
            templates=request.templates,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
async def create_idea(
    body: GenerateIdeaRequest,
    request: Request,
    user: Optional[dict] = Depends(get_optional_user),
):
    try:
        knowledge = ""
        if user:
            try:
                query = f"{body.topic_title}. {body.topic_summary}"
                knowledge = await get_knowledge_context(user["id"], query)
            except Exception:
                knowledge = ""

        idea = generate_idea(
            topic_title=body.topic_title,
            topic_summary=body.topic_summary,
            sources=body.sources,
            narrative_template=body.narrative_template,
            knowledge_context=knowledge,
        )
        # Attach knowledge usage flag so the frontend can show feedback
        if isinstance(idea, dict):
            idea["knowledge_used"] = bool(knowledge)
        return idea
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
