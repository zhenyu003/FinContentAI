"""ElevenLabs voice cloning + TTS wrappers.

The product is English-focused, so we default to Flash v2.5 (lowest latency,
best price). Switch the model id below if you need Multilingual v2 quality.
"""

import io
import os
import uuid
import wave
from typing import Optional

from elevenlabs.client import ElevenLabs

from services.utils import ensure_dir

# Flash v2.5 is fast + cheap and English-grade for our target market.
DEFAULT_MODEL_ID = "eleven_flash_v2_5"
# 24 kHz mono PCM matches what the rest of the pipeline (Whisper alignment,
# ffmpeg synthesis) already expects from Gemini TTS.
DEFAULT_OUTPUT_FORMAT = "pcm_24000"
PCM_SAMPLE_RATE = 24000
PCM_SAMPLE_WIDTH = 2  # 16-bit
PCM_NUM_CHANNELS = 1


def _client() -> ElevenLabs:
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ELEVENLABS_API_KEY is not set. Add it to backend/.env to enable voice cloning."
        )
    return ElevenLabs(api_key=api_key)


def clone_voice(
    audio_bytes: bytes,
    name: str,
    *,
    filename: str = "sample.mp3",
    description: Optional[str] = None,
) -> str:
    """Create an Instant Voice Clone from a single audio sample.

    Returns the ElevenLabs voice_id. Raises on failure.
    """
    client = _client()
    # The SDK accepts a tuple of (filename, bytes) for in-memory uploads.
    try:
        result = client.voices.ivc.create(
            name=name,
            files=[(filename, audio_bytes)],
            description=description,
            remove_background_noise=True,
        )
    except Exception as e:
        raise RuntimeError(f"ElevenLabs clone failed: {e}") from e

    voice_id = getattr(result, "voice_id", None) or getattr(result, "id", None)
    if not voice_id:
        raise RuntimeError("ElevenLabs did not return a voice_id")
    return voice_id


def delete_voice(voice_id: str) -> None:
    """Best-effort delete on ElevenLabs side. Raises on hard failures."""
    client = _client()
    try:
        client.voices.delete(voice_id=voice_id)
    except Exception as e:
        # Re-raise so the caller can decide whether to keep the DB row.
        raise RuntimeError(f"ElevenLabs delete failed: {e}") from e


def generate_tts_to_wav(
    text: str,
    voice_id: str,
    *,
    model_id: str = DEFAULT_MODEL_ID,
) -> dict:
    """Generate speech with a cloned voice and write a 24kHz mono WAV.

    Returns {"file_path": "assets/audio/<uuid>.wav", "duration_sec": float}
    matching the shape that `services.tts.generate_speech` returns so the
    /audio/generate router can swap providers transparently.
    """
    client = _client()
    save_dir = os.path.join("assets", "audio")
    ensure_dir(save_dir)

    filename = f"{uuid.uuid4()}.wav"
    save_path = os.path.join(save_dir, filename)

    try:
        # `convert` returns an iterator of PCM byte chunks when output_format is pcm_*
        chunks = client.text_to_speech.convert(
            voice_id=voice_id,
            text=text,
            model_id=model_id,
            output_format=DEFAULT_OUTPUT_FORMAT,
        )
        pcm = b"".join(chunks)
    except Exception as e:
        raise RuntimeError(f"ElevenLabs TTS failed: {e}") from e

    if not pcm:
        raise RuntimeError("ElevenLabs returned empty audio")

    # Wrap PCM in a WAV header so the browser <audio> tag can play it directly.
    with wave.open(save_path, "wb") as wf:
        wf.setnchannels(PCM_NUM_CHANNELS)
        wf.setsampwidth(PCM_SAMPLE_WIDTH)
        wf.setframerate(PCM_SAMPLE_RATE)
        wf.writeframes(pcm)

    num_frames = len(pcm) // (PCM_SAMPLE_WIDTH * PCM_NUM_CHANNELS)
    duration_sec = round(num_frames / PCM_SAMPLE_RATE, 2)

    return {"file_path": save_path, "duration_sec": duration_sec}


def estimate_audio_duration(audio_bytes: bytes) -> float:
    """Rough duration estimate for the uploaded sample (UI quality hint).

    Tries WAV first via `wave`. For MP3/M4A we fall back to a 32 kbps mono
    estimate (~4 KB/sec) which is good enough for a UI nudge.
    """
    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate() or 1
            return round(frames / rate, 1)
    except Exception:
        # Fallback: assume ~32 kbps -> ~4096 bytes/sec
        return round(len(audio_bytes) / 4096, 1)
