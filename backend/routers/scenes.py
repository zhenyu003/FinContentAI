import asyncio
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from middleware.auth import get_optional_user
from services.claude import generate_scenes, generate_single_scene, split_long_scene
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
    aspect_ratio: str = "16:9"


class SplitSceneRequest(BaseModel):
    scene_number: int
    description: str
    narration: str
    audio_duration: float
    aspect_ratio: str = "16:9"


class SceneContext(BaseModel):
    description: str = ""
    narration: str = ""


class GenerateOneSceneRequest(BaseModel):
    prev_scene: Optional[SceneContext] = None
    next_scene: Optional[SceneContext] = None
    topic_title: str
    topic_summary: str = ""
    idea: dict = {}
    aspect_ratio: str = "16:9"


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
            aspect_ratio=body.aspect_ratio,
        )
        # Attach knowledge usage flag so the frontend can show feedback
        if isinstance(result, dict):
            result["knowledge_used"] = bool(knowledge)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-one")
async def create_one_scene(body: GenerateOneSceneRequest):
    """Generate a single scene to insert between two existing scenes (or after the last)."""
    try:
        prev = body.prev_scene.model_dump() if body.prev_scene else None
        nxt = body.next_scene.model_dump() if body.next_scene else None
        result = await asyncio.to_thread(
            generate_single_scene,
            prev_scene=prev,
            next_scene=nxt,
            topic_title=body.topic_title,
            topic_summary=body.topic_summary,
            idea=body.idea,
            aspect_ratio=body.aspect_ratio,
        )
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
            aspect_ratio=request.aspect_ratio,
        )
        return {"sub_scenes": sub_scenes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
