import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.claude import split_scene_to_shots
from services.ffmpeg import stitch_motion_shots

router = APIRouter(prefix="/motion", tags=["motion"])


# ── Request / Response models ────────────────────────────────────────────


class SplitShotsRequest(BaseModel):
    scene_description: str
    narration: str
    audio_duration: float
    aspect_ratio: str = "16:9"


class SplitShotsResponse(BaseModel):
    shots: list[dict]


class StitchRequest(BaseModel):
    shot_videos: list[str]
    audio_url: str
    audio_duration: float
    tail_strategy: str = "freeze"


class StitchResponse(BaseModel):
    video_url: str


# ── Endpoints ────────────────────────────────────────────────────────────


@router.post("/split-shots", response_model=SplitShotsResponse)
async def split_shots(request: SplitShotsRequest):
    """Split a scene into multiple ~8s shot prompts for Veo generation."""
    try:
        shots = await asyncio.to_thread(
            split_scene_to_shots,
            scene_description=request.scene_description,
            narration=request.narration,
            audio_duration=request.audio_duration,
            aspect_ratio=request.aspect_ratio,
        )
        return SplitShotsResponse(shots=shots)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stitch", response_model=StitchResponse)
async def stitch(request: StitchRequest):
    """Stitch multiple shot videos with an audio track into one clip."""
    try:
        rel_path = await asyncio.to_thread(
            stitch_motion_shots,
            shot_video_paths=request.shot_videos,
            audio_path=request.audio_url,
            audio_duration=request.audio_duration,
            tail_strategy=request.tail_strategy,
        )
        url = "/" + rel_path.replace("\\", "/")
        return StitchResponse(video_url=url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
