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
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
