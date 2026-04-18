from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from middleware.auth import get_current_user
from services.social_template import generate_social_post_template
from services.supabase_client import get_supabase_client

router = APIRouter(prefix="/template", tags=["template"])


# ---------------------------------------------------------------------------
# Social post template (existing)
# ---------------------------------------------------------------------------

class SocialTemplateGenerateRequest(BaseModel):
    input: str = Field(..., min_length=1)


@router.post("/social-generate")
async def social_template_generate(body: SocialTemplateGenerateRequest):
    """Generate a structured single-post social template from natural language."""
    try:
        return generate_social_post_template(body.input)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Narrative template CRUD (per-user, persisted in Supabase)
# ---------------------------------------------------------------------------

class NarrativeBeatModel(BaseModel):
    id: str
    purpose: str
    instruction: str


class NarrativeTemplateCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    tone: str = Field(default="professional", max_length=200)
    beats: list[NarrativeBeatModel] = Field(default_factory=list)
    source: str = Field(default="custom")  # "custom" | "ai_generated"
    prompt: str | None = None
    overwrite: bool = False  # if True and a template with the same name exists, replace it


class NarrativeTemplateUpdateRequest(BaseModel):
    name: str | None = None
    tone: str | None = None
    beats: list[NarrativeBeatModel] | None = None
    prompt: str | None = None


def _serialize_beats(beats: list[NarrativeBeatModel]) -> list[dict]:
    return [{"id": b.id, "purpose": b.purpose, "instruction": b.instruction} for b in beats]


@router.get("/narrative")
async def list_narrative_templates(
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(get_current_user),
):
    """List the current user's saved narrative templates (newest first)."""
    try:
        supabase = get_supabase_client()
        result = (
            supabase.table("narrative_templates")
            .select("*")
            .eq("user_id", user["id"])
            .order("updated_at", desc=True)
            .limit(limit)
            .execute()
        )
        return {"templates": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/narrative")
async def create_narrative_template(
    body: NarrativeTemplateCreateRequest,
    user: dict = Depends(get_current_user),
):
    """Create a new narrative template for the current user.

    If `overwrite=True` and a template with the same name already exists, it is
    replaced in place (same row, fresh content). If `overwrite=False` and the
    name conflicts, a 409 is returned so the frontend can prompt the user.
    """
    try:
        supabase = get_supabase_client()
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="name is required")

        existing = (
            supabase.table("narrative_templates")
            .select("id")
            .eq("user_id", user["id"])
            .eq("name", name)
            .execute()
        )
        existing_id = existing.data[0]["id"] if existing.data else None

        if existing_id and not body.overwrite:
            raise HTTPException(
                status_code=409,
                detail={"code": "name_exists", "message": "A template with that name already exists"},
            )

        payload = {
            "user_id": user["id"],
            "name": name,
            "tone": body.tone.strip() or "professional",
            "beats": _serialize_beats(body.beats),
            "source": body.source if body.source in ("custom", "ai_generated") else "custom",
            "prompt": body.prompt,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        if existing_id:
            supabase.table("narrative_templates").update(payload).eq(
                "id", existing_id
            ).execute()
            row = (
                supabase.table("narrative_templates")
                .select("*")
                .eq("id", existing_id)
                .execute()
            )
            return row.data[0] if row.data else {"id": existing_id, **payload}

        result = supabase.table("narrative_templates").insert(payload).execute()
        return result.data[0] if result.data else payload
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/narrative/{template_id}")
async def update_narrative_template(
    template_id: str,
    body: NarrativeTemplateUpdateRequest,
    user: dict = Depends(get_current_user),
):
    """Update fields on an owned narrative template."""
    try:
        supabase = get_supabase_client()
        check = (
            supabase.table("narrative_templates")
            .select("id")
            .eq("id", template_id)
            .eq("user_id", user["id"])
            .execute()
        )
        if not check.data:
            raise HTTPException(status_code=404, detail="Template not found")

        updates: dict = {}
        if body.name is not None:
            new_name = body.name.strip()
            if not new_name:
                raise HTTPException(status_code=400, detail="name cannot be empty")
            # Check for name collision with another template
            collision = (
                supabase.table("narrative_templates")
                .select("id")
                .eq("user_id", user["id"])
                .eq("name", new_name)
                .neq("id", template_id)
                .execute()
            )
            if collision.data:
                raise HTTPException(
                    status_code=409,
                    detail={"code": "name_exists", "message": "Another template already uses that name"},
                )
            updates["name"] = new_name
        if body.tone is not None:
            updates["tone"] = body.tone.strip() or "professional"
        if body.beats is not None:
            updates["beats"] = _serialize_beats(body.beats)
        if body.prompt is not None:
            updates["prompt"] = body.prompt.strip() or None

        if not updates:
            raise HTTPException(status_code=400, detail="Nothing to update")

        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        supabase.table("narrative_templates").update(updates).eq(
            "id", template_id
        ).execute()

        row = (
            supabase.table("narrative_templates")
            .select("*")
            .eq("id", template_id)
            .execute()
        )
        return row.data[0] if row.data else {"id": template_id, **updates}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/narrative/{template_id}")
async def delete_narrative_template(
    template_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete an owned narrative template."""
    try:
        supabase = get_supabase_client()
        check = (
            supabase.table("narrative_templates")
            .select("id")
            .eq("id", template_id)
            .eq("user_id", user["id"])
            .execute()
        )
        if not check.data:
            raise HTTPException(status_code=404, detail="Template not found")

        supabase.table("narrative_templates").delete().eq("id", template_id).execute()
        return {"deleted": True, "id": template_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
