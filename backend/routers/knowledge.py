from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from middleware.auth import get_current_user
from services.knowledge import add_knowledge_item, search_knowledge
from services.supabase_client import get_supabase_client


router = APIRouter(prefix="/knowledge", tags=["knowledge"])


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class AddKnowledgeRequest(BaseModel):
    title: str
    content: str
    source_type: str = "text"
    source_url: str | None = None


class SearchKnowledgeRequest(BaseModel):
    query: str
    match_count: int = 5


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def list_knowledge_items(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
):
    """List the current user's knowledge items."""
    try:
        supabase = get_supabase_client()
        result = (
            supabase.table("knowledge_items")
            .select("*")
            .eq("user_id", user["id"])
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return {"items": result.data or [], "limit": limit, "offset": offset}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_knowledge_item(
    request: AddKnowledgeRequest,
    user: dict = Depends(get_current_user),
):
    """Add a new knowledge item, chunk it, and generate embeddings."""
    try:
        item = await add_knowledge_item(
            user_id=user["id"],
            title=request.title,
            content=request.content,
            source_type=request.source_type,
            source_url=request.source_url,
        )
        return item
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{item_id}")
async def delete_knowledge_item(
    item_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a knowledge item and all associated chunks."""
    try:
        supabase = get_supabase_client()

        # Verify the item belongs to the user
        check = (
            supabase.table("knowledge_items")
            .select("id")
            .eq("id", item_id)
            .eq("user_id", user["id"])
            .execute()
        )
        if not check.data:
            raise HTTPException(status_code=404, detail="Knowledge item not found")

        # Delete chunks first, then the item
        supabase.table("knowledge_chunks").delete().eq(
            "knowledge_item_id", item_id
        ).execute()
        supabase.table("knowledge_items").delete().eq("id", item_id).execute()

        return {"deleted": True, "id": item_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search")
async def search_knowledge_items(
    request: SearchKnowledgeRequest,
    user: dict = Depends(get_current_user),
):
    """Search the knowledge base using semantic similarity."""
    try:
        results = await search_knowledge(
            user_id=user["id"],
            query=request.query,
            match_count=request.match_count,
        )
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
