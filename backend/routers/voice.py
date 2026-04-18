"""Voice clone management (ElevenLabs IVC).

Endpoints:
  POST   /voice/clone           multipart upload of a sample → returns voice clone row
  GET    /voice                  list current user's clones
  DELETE /voice/{clone_id}       delete on ElevenLabs + Supabase

The DB row is the source of truth for "voices that belong to a user". The
ElevenLabs voice_id is stored on each row so /audio/generate can route TTS
through ElevenLabs when this id is selected.
"""

import asyncio
import logging
import os
import subprocess
import tempfile

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from middleware.auth import get_current_user
from services import elevenlabs as eleven
from services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["voice"])

# MVP: max cloned voices per user (UI also enforces).
MAX_CLONES_PER_USER = 3

# Browser MediaRecorder typically yields WebM/Opus ~15s; we normalize to WAV before ElevenLabs.
MIN_SAMPLE_DURATION_SEC = 12.0
MAX_SAMPLE_DURATION_SEC = 120.0
MIN_SAMPLE_BYTES = 8_000  # sanity floor after conversion
MAX_SAMPLE_BYTES = 25 * 1024 * 1024  # 25 MB hard cap

ALLOWED_CONTENT_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/m4a",
    "audio/mp4",
    "audio/x-m4a",
    "audio/webm",
    "audio/ogg",
}


def _primary_mime(ctype: str | None) -> str:
    """Strip codec params — browsers send e.g. audio/webm;codecs=opus for MediaRecorder."""
    if not ctype:
        return ""
    return ctype.split(";")[0].strip().lower()


def _ffprobe_duration_sec(path: str) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            path,
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(result.stdout.strip())


def _bytes_to_tempfile(data: bytes, suffix: str) -> str:
    fd, path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
    except Exception:
        try:
            os.unlink(path)
        except OSError:
            pass
        raise
    return path


def _convert_to_wav_16k_mono(audio_bytes: bytes, input_suffix: str) -> bytes:
    """Decode arbitrary browser/upload audio to 16 kHz mono WAV for IVC."""
    in_path = _bytes_to_tempfile(audio_bytes, input_suffix)
    out_path = tempfile.mktemp(suffix=".wav")
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                in_path,
                "-ac",
                "1",
                "-ar",
                "16000",
                "-c:a",
                "pcm_s16le",
                out_path,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        with open(out_path, "rb") as f:
            return f.read()
    except subprocess.CalledProcessError as e:
        raise ValueError(f"Audio conversion failed: {e.stderr[-400:] if e.stderr else e}") from e
    finally:
        for p in (in_path, out_path):
            try:
                if os.path.exists(p):
                    os.unlink(p)
            except OSError:
                pass


def _prepare_clone_audio(
    audio_bytes: bytes,
    *,
    content_type: str | None,
    filename: str | None,
) -> tuple[bytes, str]:
    """Return bytes + filename for ElevenLabs `files=[(name, bytes)]`.

    Browser recordings are WebM/Opus — normalize to WAV before cloning.
    """
    name = (filename or "sample").strip()
    lower_name = name.lower()
    ctype = (content_type or "").lower()
    is_webm = "webm" in ctype or lower_name.endswith(".webm")

    if is_webm:
        wav = _convert_to_wav_16k_mono(audio_bytes, ".webm")
        return wav, "sample.wav"

    # Other allowed types: pass through; ElevenLabs accepts common formats.
    ext = os.path.splitext(lower_name)[1] or ".mp3"
    if ext not in (".mp3", ".mpeg", ".wav", ".wave", ".m4a", ".mp4", ".ogg"):
        ext = ".mp3"
    return audio_bytes, f"sample{ext}"


def _duration_from_bytes(audio_bytes: bytes, filename: str) -> float:
    """Best-effort duration using ffprobe on a temp file."""
    ext = os.path.splitext(filename)[1] or ".bin"
    path = _bytes_to_tempfile(audio_bytes, ext)
    try:
        return _ffprobe_duration_sec(path)
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


@router.get("")
async def list_voice_clones(user: dict = Depends(get_current_user)):
    try:
        supabase = get_supabase_client()
        result = (
            supabase.table("voice_clones")
            .select("*")
            .eq("user_id", user["id"])
            .order("created_at", desc=True)
            .execute()
        )
        return {"voices": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clone")
async def clone_voice_endpoint(
    name: str = Form(..., min_length=1, max_length=80),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload an audio sample → register it as a cloned voice on ElevenLabs."""
    try:
        clean_name = name.strip()
        if not clean_name:
            raise HTTPException(status_code=400, detail="Voice name is required")

        primary = _primary_mime(file.content_type)
        if primary and primary not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported audio type {file.content_type}. Use MP3, WAV, M4A, or WebM.",
            )

        audio_bytes = await file.read()
        if len(audio_bytes) > MAX_SAMPLE_BYTES:
            raise HTTPException(
                status_code=400,
                detail="Audio sample is too large (max 25 MB).",
            )

        supabase = get_supabase_client()

        existing_list = (
            supabase.table("voice_clones")
            .select("id")
            .eq("user_id", user["id"])
            .execute()
        )
        if len(existing_list.data or []) >= MAX_CLONES_PER_USER:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "max_clones",
                    "message": f"You can have at most {MAX_CLONES_PER_USER} voice clones. Delete one to add another.",
                },
            )

        # Reject duplicate names per-user up front (DB also enforces this).
        existing = (
            supabase.table("voice_clones")
            .select("id")
            .eq("user_id", user["id"])
            .eq("name", clean_name)
            .execute()
        )
        if existing.data:
            raise HTTPException(
                status_code=409,
                detail={"code": "name_exists", "message": "You already have a voice clone with that name"},
            )

        try:
            prepared_bytes, upload_name = _prepare_clone_audio(
                audio_bytes,
                content_type=file.content_type,
                filename=file.filename,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

        if len(prepared_bytes) < MIN_SAMPLE_BYTES:
            raise HTTPException(
                status_code=400,
                detail="Audio sample is too short or could not be decoded.",
            )

        duration_sec = _duration_from_bytes(prepared_bytes, upload_name)
        if duration_sec < MIN_SAMPLE_DURATION_SEC:
            raise HTTPException(
                status_code=400,
                detail=f"Recording is too short ({duration_sec:.1f}s). Aim for about 15 seconds of clear speech (minimum {MIN_SAMPLE_DURATION_SEC:.0f}s).",
            )
        if duration_sec > MAX_SAMPLE_DURATION_SEC:
            raise HTTPException(
                status_code=400,
                detail=f"Sample is too long ({duration_sec:.0f}s). Trim to under {MAX_SAMPLE_DURATION_SEC:.0f} seconds.",
            )

        # Run the blocking SDK call in a worker thread. No DB write until ElevenLabs succeeds.
        try:
            voice_id = await asyncio.to_thread(
                eleven.clone_voice,
                prepared_bytes,
                clean_name,
                filename=upload_name,
                description=f"FinContentAI clone for user {user['id']}",
            )
        except RuntimeError as e:
            # Full text is needed to tell quota vs plan vs bad sample — always log server-side.
            err_raw = str(e)
            logger.warning("[voice/clone] ElevenLabs clone_voice failed: %s", err_raw)
            err_s = err_raw.lower()
            if (
                "429" in err_s
                or "rate" in err_s
                or "quota" in err_s
                or "too many requests" in err_s
                or "resource_exhausted" in err_s
            ):
                raise HTTPException(
                    status_code=429,
                    detail="ElevenLabs rate limit or quota reached. Try again in a few minutes.",
                ) from e
            raise HTTPException(status_code=502, detail=err_raw) from e

        record = {
            "user_id": user["id"],
            "elevenlabs_voice_id": voice_id,
            "name": clean_name,
            "sample_filename": file.filename,
            "sample_duration_sec": round(duration_sec, 1),
        }
        result = supabase.table("voice_clones").insert(record).execute()
        return result.data[0] if result.data else record
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{clone_id}")
async def delete_voice_clone(
    clone_id: str,
    user: dict = Depends(get_current_user),
):
    try:
        supabase = get_supabase_client()
        check = (
            supabase.table("voice_clones")
            .select("id, elevenlabs_voice_id")
            .eq("id", clone_id)
            .eq("user_id", user["id"])
            .execute()
        )
        if not check.data:
            raise HTTPException(status_code=404, detail="Voice clone not found")

        row = check.data[0]
        # Try to remove from ElevenLabs first; if that fails, surface the error
        # but still allow the user to free up the local row by retrying — we
        # delete the DB row on success only.
        try:
            await asyncio.to_thread(eleven.delete_voice, row["elevenlabs_voice_id"])
        except RuntimeError as e:
            # ElevenLabs returns 404 if the voice was already removed on their side
            # — in that case it's safe to drop our row too.
            err_lower = str(e).lower()
            if "404" not in err_lower and "not found" not in err_lower:
                raise HTTPException(status_code=502, detail=str(e))

        supabase.table("voice_clones").delete().eq("id", clone_id).execute()
        return {"deleted": True, "id": clone_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
