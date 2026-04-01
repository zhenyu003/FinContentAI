from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.tts import generate_speech

router = APIRouter(prefix="/audio", tags=["audio"])


class GenerateAudioRequest(BaseModel):
    text: str
    voice: str = "Kore"


@router.post("/generate")
async def create_audio(request: GenerateAudioRequest):
    try:
        file_path = generate_speech(
            text=request.text,
            voice=request.voice,
        )
        url = "/" + file_path.replace("\\", "/")
        return {"audio_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
