import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, model_validator

from services.dalle import generate_image
from services.ffmpeg import create_motion_clip_from_still, synthesize_video

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


class GenerateMotionRequest(BaseModel):
    description: str
    aspect_ratio: str = "16:9"
    motion_style: str = "cinematic"


@router.post("/generate")
async def create_video(request: GenerateVideoRequest):
    try:
        scenes_data = [scene.model_dump(exclude_none=True) for scene in request.scenes]
        file_path = synthesize_video(
            scenes=scenes_data,
            aspect_ratio=request.aspect_ratio,
        )
        url = "/" + file_path.replace("\\", "/")
        return {"video_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/motion-clip")
async def create_motion_clip(request: GenerateMotionRequest):
    """Generate a playable motion clip (MP4). Uses one internal keyframe then FFmpeg motion."""
    try:
        style = request.motion_style or "cinematic"
        keyframe_prompt = (
            f"Cinematic keyframe for a short animated clip ({style}): "
            f"high detail, coherent composition, suitable for subtle camera motion. "
            f"{request.description}"
        )
        image_rel = generate_image(
            prompt=keyframe_prompt,
            aspect_ratio=request.aspect_ratio,
        )
        image_abs = (
            image_rel
            if os.path.isabs(image_rel)
            else os.path.abspath(image_rel)
        )
        clip_rel = create_motion_clip_from_still(
            image_abs,
            aspect_ratio=request.aspect_ratio,
            motion_style=style,
            duration_sec=10.0,
        )
        try:
            if os.path.isfile(image_abs):
                os.remove(image_abs)
        except OSError:
            pass
        url = "/" + clip_rel.replace("\\", "/")
        return {"video_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
