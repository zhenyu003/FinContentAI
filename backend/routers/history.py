from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from middleware.auth import get_current_user
from services.supabase_client import get_supabase_client

router = APIRouter(prefix="/history", tags=["history"])


class ContentCreate(BaseModel):
    content_type: str
    topic_title: str
    topic_summary: Optional[str] = None
    narrative_template: Optional[str] = None
    core_argument: Optional[str] = None
    scenes: Optional[dict] = None
    post_data: Optional[dict] = None
    platform: Optional[str] = None
    status: str = "draft"
    credits_used: int = 0


class ContentUpdate(BaseModel):
    content_type: Optional[str] = None
    topic_title: Optional[str] = None
    topic_summary: Optional[str] = None
    narrative_template: Optional[str] = None
    core_argument: Optional[str] = None
    scenes: Optional[dict] = None
    post_data: Optional[dict] = None
    platform: Optional[str] = None
    status: Optional[str] = None
    credits_used: Optional[int] = None


@router.get("")
async def list_content_history(
    content_type: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(get_current_user),
):
    """List the current user's content history."""
    try:
        supabase = get_supabase_client()

        query = (
            supabase.table("content_history")
            .select("*")
            .eq("user_id", user["id"])
        )

        if content_type:
            query = query.eq("content_type", content_type)

        result = (
            query.order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )

        return {"items": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{content_id}")
async def get_content_record(
    content_id: str, user: dict = Depends(get_current_user)
):
    """Get a single content record by ID. Verifies ownership."""
    try:
        supabase = get_supabase_client()

        result = (
            supabase.table("content_history")
            .select("*")
            .eq("id", content_id)
            .eq("user_id", user["id"])
            .single()
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail="Content not found")

        return result.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_content_record(
    request: ContentCreate, user: dict = Depends(get_current_user)
):
    """Create a new content history record."""
    try:
        supabase = get_supabase_client()

        record = {
            "user_id": user["id"],
            **request.model_dump(exclude_none=True),
        }

        result = (
            supabase.table("content_history").insert(record).execute()
        )

        return result.data[0] if result.data else {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{content_id}")
async def update_content_record(
    content_id: str,
    request: ContentUpdate,
    user: dict = Depends(get_current_user),
):
    """Update an existing content record. Accepts partial updates."""
    try:
        supabase = get_supabase_client()

        # Verify ownership
        existing = (
            supabase.table("content_history")
            .select("id")
            .eq("id", content_id)
            .eq("user_id", user["id"])
            .single()
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Content not found")

        updates = request.model_dump(exclude_none=True)
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        result = (
            supabase.table("content_history")
            .update(updates)
            .eq("id", content_id)
            .eq("user_id", user["id"])
            .execute()
        )

        return result.data[0] if result.data else {}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{content_id}")
async def delete_content_record(
    content_id: str, user: dict = Depends(get_current_user)
):
    """Delete a content record. Verifies ownership."""
    try:
        supabase = get_supabase_client()

        # Verify ownership
        existing = (
            supabase.table("content_history")
            .select("id")
            .eq("id", content_id)
            .eq("user_id", user["id"])
            .single()
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Content not found")

        supabase.table("content_history").delete().eq("id", content_id).eq(
            "user_id", user["id"]
        ).execute()

        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
