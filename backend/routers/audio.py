import asyncio

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from middleware.auth import get_optional_user
from services import elevenlabs as eleven
from services.supabase_client import get_supabase_client
from services.tts import generate_speech

router = APIRouter(prefix="/audio", tags=["audio"])


class GenerateAudioRequest(BaseModel):
    text: str
    voice: str = "Kore"
    # When set, route through ElevenLabs using the user's cloned voice.
    # `voice` is ignored in that case.
    voice_clone_id: str | None = None


@router.post("/generate")
async def create_audio(
    request: GenerateAudioRequest,
    user: dict | None = Depends(get_optional_user),
):
    try:
        if request.voice_clone_id:
            if not user:
                raise HTTPException(
                    status_code=401,
                    detail="Sign in to use a cloned voice",
                )
            # Look up the clone and verify ownership in one query.
            supabase = get_supabase_client()
            row = (
                supabase.table("voice_clones")
                .select("elevenlabs_voice_id, user_id")
                .eq("id", request.voice_clone_id)
                .eq("user_id", user["id"])
                .execute()
            )
            if not row.data:
                raise HTTPException(status_code=404, detail="Voice clone not found")
            eleven_voice_id = row.data[0]["elevenlabs_voice_id"]

            try:
                result = await asyncio.to_thread(
                    eleven.generate_tts_to_wav, request.text, eleven_voice_id
                )
            except RuntimeError as e:
                raise HTTPException(status_code=502, detail=str(e))
        else:
            result = generate_speech(text=request.text, voice=request.voice)

        url = "/" + result["file_path"].replace("\\", "/")
        return {"audio_url": url, "duration_sec": result["duration_sec"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
