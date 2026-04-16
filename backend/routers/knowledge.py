import asyncio
import os
import uuid

from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
from pydantic import BaseModel

from middleware.auth import get_current_user
from services.knowledge import add_knowledge_item, search_knowledge
from services.content_parser import fetch_url_content, extract_pdf_text, summarize_content
from services.supabase_client import get_supabase_client

MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5 MB
UPLOADS_DIR = os.path.join("assets", "uploads")


router = APIRouter(prefix="/knowledge", tags=["knowledge"])


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class AddKnowledgeRequest(BaseModel):
    title: str
    content: str
    source_type: str = "text"
    source_url: str | None = None


class AddUrlRequest(BaseModel):
    title: str
    url: str


class UpdateKnowledgeRequest(BaseModel):
    title: str | None = None
    content: str | None = None


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
            "item_id", item_id
        ).execute()
        supabase.table("knowledge_items").delete().eq("id", item_id).execute()

        return {"deleted": True, "id": item_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{item_id}")
async def update_knowledge_item(
    item_id: str,
    request: UpdateKnowledgeRequest,
    user: dict = Depends(get_current_user),
):
    """Update a knowledge item's title or content (and re-embed if content changed)."""
    try:
        supabase = get_supabase_client()
        check = (
            supabase.table("knowledge_items")
            .select("id")
            .eq("id", item_id)
            .eq("user_id", user["id"])
            .execute()
        )
        if not check.data:
            raise HTTPException(status_code=404, detail="Knowledge item not found")

        updates = {}
        if request.title is not None:
            updates["title"] = request.title
        if request.content is not None:
            updates["content"] = request.content

        if not updates:
            raise HTTPException(status_code=400, detail="Nothing to update")

        supabase.table("knowledge_items").update(updates).eq("id", item_id).execute()

        # If content changed, re-chunk and re-embed
        if request.content is not None:
            from services.knowledge import chunk_text, generate_embedding

            supabase.table("knowledge_chunks").delete().eq("item_id", item_id).execute()
            chunks = chunk_text(request.content)
            for i, chunk_text_content in enumerate(chunks):
                embedding = generate_embedding(chunk_text_content)
                chunk_record = {
                    "id": str(uuid.uuid4()),
                    "item_id": item_id,
                    "user_id": user["id"],
                    "chunk_index": i,
                    "chunk_text": chunk_text_content,
                    "embedding": embedding,
                }
                supabase.table("knowledge_chunks").insert(chunk_record).execute()

        result = (
            supabase.table("knowledge_items")
            .select("*")
            .eq("id", item_id)
            .execute()
        )
        return result.data[0] if result.data else {"id": item_id, **updates}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/add-url")
async def create_knowledge_from_url(
    request: AddUrlRequest,
    user: dict = Depends(get_current_user),
):
    """Fetch a URL, extract text, summarize with LLM, and store."""
    try:
        try:
            raw_text = await asyncio.to_thread(fetch_url_content, request.url)
        except Exception as fetch_err:
            err_str = str(fetch_err).lower()
            if "timeout" in err_str or "timed out" in err_str:
                raise HTTPException(
                    status_code=400,
                    detail="Website took too long to respond. Some sites block automated access. Try pasting the article text directly instead.",
                )
            raise
        if not raw_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from URL")

        summary = await asyncio.to_thread(summarize_content, raw_text, request.title)
        content = summary or raw_text[:2000]

        item = await add_knowledge_item(
            user_id=user["id"],
            title=request.title,
            content=content,
            source_type="url",
            source_url=request.url,
        )
        return item
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-file")
async def create_knowledge_from_file(
    title: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload a PDF/text file, extract text, summarize with LLM, and store."""
    try:
        file_bytes = await file.read()
        filename = file.filename or "uploaded_file"

        if len(file_bytes) > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=400, detail="File too large (max 5 MB)")

        if filename.lower().endswith(".pdf"):
            raw_text = await asyncio.to_thread(extract_pdf_text, file_bytes)
        else:
            raw_text = file_bytes.decode("utf-8", errors="ignore")

        if not raw_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from file")

        # Save original file to assets/uploads/ (keep original name for display)
        ext = os.path.splitext(filename)[1] or ".pdf"
        saved_name = f"{uuid.uuid4().hex}{ext}"
        saved_path = os.path.join(UPLOADS_DIR, saved_name)
        os.makedirs(UPLOADS_DIR, exist_ok=True)
        with open(saved_path, "wb") as f:
            f.write(file_bytes)
        # URL path the frontend can use to download the file
        file_url = f"/assets/uploads/{saved_name}"

        summary = await asyncio.to_thread(summarize_content, raw_text, title)
        content = summary or raw_text[:2000]

        item = await add_knowledge_item(
            user_id=user["id"],
            title=title,
            content=content,
            source_type="pdf" if filename.lower().endswith(".pdf") else "file",
            source_url=file_url,
            metadata={"original_filename": filename},
        )
        return item
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
