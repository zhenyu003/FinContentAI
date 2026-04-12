from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.claude import refine_opinion

router = APIRouter(prefix="/opinion", tags=["opinion"])


class RefineOpinionRequest(BaseModel):
    topic_title: str
    topic_summary: str
    idea: dict
    user_opinion: str


@router.post("/refine")
async def refine_user_opinion(request: RefineOpinionRequest):
    try:
        result = refine_opinion(
            topic_title=request.topic_title,
            topic_summary=request.topic_summary,
            idea=request.idea,
            user_opinion=request.user_opinion,
        )
        # Flatten questions to just strings for frontend
        questions = result.get("questions", [])
        return {"questions": [q["question"] if isinstance(q, dict) else q for q in questions]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
