from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.gemini import search_trending_topics, search_custom_topic

router = APIRouter(prefix="/topics", tags=["topics"])


class CustomTopicRequest(BaseModel):
    query: str


@router.get("")
async def get_trending_topics():
    try:
        topics = search_trending_topics()
        return {"topics": topics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search")
async def search_topic(request: CustomTopicRequest):
    try:
        topics = search_custom_topic(request.query)
        if topics:
            return topics[0]
        return {"title": request.query, "summary": "", "sources": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
