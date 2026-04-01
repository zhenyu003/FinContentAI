from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.claude import generate_idea

router = APIRouter(prefix="/idea", tags=["idea"])


class GenerateIdeaRequest(BaseModel):
    topic_title: str
    topic_summary: str
    sources: list[str] = []


@router.post("/generate")
async def create_idea(request: GenerateIdeaRequest):
    try:
        idea = generate_idea(
            topic_title=request.topic_title,
            topic_summary=request.topic_summary,
            sources=request.sources,
        )
        return idea
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
