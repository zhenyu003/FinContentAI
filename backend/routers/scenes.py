import asyncio
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from middleware.auth import get_optional_user
from services.claude import generate_scenes, split_long_scene
from services.knowledge import get_knowledge_context

router = APIRouter(prefix="/scenes", tags=["scenes"])


class GenerateScenesRequest(BaseModel):
    topic_title: str
    topic_summary: str
    idea: dict
    user_opinion: str
    qa_answers: list = []
    duration: str = "5min"
    narrative_template: str = ""


class SplitSceneRequest(BaseModel):
    scene_number: int
    description: str
    narration: str
    audio_duration: float


@router.post("/generate")
async def create_scenes(
    body: GenerateScenesRequest,
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

        result = generate_scenes(
            topic_title=body.topic_title,
            topic_summary=body.topic_summary,
            idea=body.idea,
            user_opinion=body.user_opinion,
            qa_answers=body.qa_answers,
            duration=body.duration,
            narrative_template=body.narrative_template,
            knowledge_context=knowledge,
        )
        # Attach knowledge usage flag so the frontend can show feedback
        if isinstance(result, dict):
            result["knowledge_used"] = bool(knowledge)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/split")
async def split_scene(request: SplitSceneRequest):
    """Split a long scene into shorter sub-scenes (one chart, rest image)."""
    try:
        sub_scenes = await asyncio.to_thread(
            split_long_scene,
            scene_number=request.scene_number,
            description=request.description,
            narration=request.narration,
            audio_duration=request.audio_duration,
        )
        return {"sub_scenes": sub_scenes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
