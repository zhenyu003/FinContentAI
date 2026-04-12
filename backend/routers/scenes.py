from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.claude import generate_scenes

router = APIRouter(prefix="/scenes", tags=["scenes"])


class GenerateScenesRequest(BaseModel):
    topic_title: str
    topic_summary: str
    idea: dict
    user_opinion: str
    qa_answers: list = []
    duration: str = "5min"
    narrative_template: str = ""


@router.post("/generate")
async def create_scenes(request: GenerateScenesRequest):
    try:
        result = generate_scenes(
            topic_title=request.topic_title,
            topic_summary=request.topic_summary,
            idea=request.idea,
            user_opinion=request.user_opinion,
            qa_answers=request.qa_answers,
            duration=request.duration,
            narrative_template=request.narrative_template,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
