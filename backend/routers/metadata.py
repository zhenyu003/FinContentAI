from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.claude import generate_titles, generate_description
from services.dalle import generate_thumbnail

router = APIRouter(prefix="/metadata", tags=["metadata"])


class GenerateTitlesRequest(BaseModel):
    topic_title: str
    topic_summary: str
    idea: dict
    narrative_template: str


class GenerateDescriptionRequest(BaseModel):
    topic_title: str
    topic_summary: str
    idea: dict
    narration_texts: list[str]


class GenerateThumbnailRequest(BaseModel):
    prompt: str
    aspect_ratio: str = "16:9"


@router.post("/title")
async def create_titles(request: GenerateTitlesRequest):
    try:
        result = generate_titles(
            topic_title=request.topic_title,
            topic_summary=request.topic_summary,
            idea=request.idea,
            narrative_template=request.narrative_template,
        )
        # Flatten titles to just strings for frontend
        titles = result.get("titles", [])
        return {"titles": [t["title"] if isinstance(t, dict) else t for t in titles]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/description")
async def create_description(request: GenerateDescriptionRequest):
    try:
        result = generate_description(
            topic_title=request.topic_title,
            topic_summary=request.topic_summary,
            idea=request.idea,
            narration_texts=request.narration_texts,
        )
        return {"description": result.get("full_description", "")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/thumbnail")
async def create_thumbnail(request: GenerateThumbnailRequest):
    try:
        file_path = generate_thumbnail(
            prompt=request.prompt,
            aspect_ratio=request.aspect_ratio,
        )
        url = "/" + file_path.replace("\\", "/")
        return {"thumbnail_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
