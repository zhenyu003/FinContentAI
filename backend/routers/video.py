from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.ffmpeg import synthesize_video

router = APIRouter(prefix="/video", tags=["video"])


class SceneInput(BaseModel):
    image_path: str
    audio_path: str
    narration: str


class GenerateVideoRequest(BaseModel):
    scenes: list[SceneInput]
    aspect_ratio: str = "16:9"


@router.post("/generate")
async def create_video(request: GenerateVideoRequest):
    try:
        scenes_data = [scene.model_dump() for scene in request.scenes]
        file_path = synthesize_video(
            scenes=scenes_data,
            aspect_ratio=request.aspect_ratio,
        )
        url = "/" + file_path.replace("\\", "/")
        return {"video_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
