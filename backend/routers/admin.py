from fastapi import APIRouter
from pydantic import BaseModel

from services.cleanup import cleanup_old_assets, get_asset_stats

router = APIRouter(prefix="/admin", tags=["admin"])


class CleanupRequest(BaseModel):
    max_age_hours: int = 24


@router.get("/assets")
async def asset_stats():
    """Return current asset directory statistics."""
    return get_asset_stats()


@router.post("/cleanup")
async def trigger_cleanup(request: CleanupRequest):
    """Delete asset files older than the given threshold."""
    result = cleanup_old_assets(max_age_hours=request.max_age_hours)
    return result
