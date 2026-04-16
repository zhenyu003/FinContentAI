import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, model_validator

from services.ffmpeg import synthesize_video
from services.veo import build_veo_prompt, generate_motion_video, RateLimitError

router = APIRouter(prefix="/video", tags=["video"])


class SceneInput(BaseModel):
    audio_path: str
    narration: str
    image_path: str | None = None
    video_clip_path: str | None = None

    @model_validator(mode="after")
    def require_visual(self) -> "SceneInput":
        if not self.image_path and not self.video_clip_path:
            raise ValueError("Each scene needs image_path or video_clip_path")
        return self


class GenerateVideoRequest(BaseModel):
    scenes: list[SceneInput]
    aspect_ratio: str = "16:9"
    include_transcript: bool = True


class MotionVeoRequest(BaseModel):
    """Either send a ready-made `prompt` or `description` + `narration` to build one."""

    prompt: str | None = None
    description: str | None = None
    narration: str | None = None
    aspect_ratio: str = "16:9"

    def resolved_prompt(self) -> str:
        if self.prompt and self.prompt.strip():
            return self.prompt.strip()
        scene = {
            "description": (self.description or "").strip(),
            "narration": (self.narration or "").strip(),
        }
        if not scene["description"] and not scene["narration"]:
            raise ValueError("Provide prompt or description/narration")
        return build_veo_prompt(scene)


@router.post("/generate")
async def create_video(request: GenerateVideoRequest):
    try:
        scenes_data = [scene.model_dump(exclude_none=True) for scene in request.scenes]
        file_path = synthesize_video(
            scenes=scenes_data,
            aspect_ratio=request.aspect_ratio,
            include_transcript=request.include_transcript,
        )
        url = "/" + file_path.replace("\\", "/")
        return {"video_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/motion-veo")
async def create_motion_veo(request: MotionVeoRequest):
    """AI motion clip via Google Veo (no image pipeline, no FFmpeg animation)."""
    try:
        prompt = request.resolved_prompt()
        ar = request.aspect_ratio
        rel = await asyncio.to_thread(
            lambda: generate_motion_video(prompt, aspect_ratio=ar),
        )
        url = "/" + rel.replace("\\", "/")
        return {"video_url": url}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
