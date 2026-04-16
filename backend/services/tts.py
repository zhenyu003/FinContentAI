import os
import uuid
import wave
import struct
from google.genai import types

from services.utils import get_gemini_client, ensure_dir


def generate_speech(text: str, voice: str = "Kore") -> dict:
    """Generate speech audio using Gemini TTS.

    Args:
        text: The text to convert to speech.
        voice: The voice name to use (default: "Kore").

    Returns:
        dict with "file_path" (str) and "duration_sec" (float).
    """
    client = get_gemini_client()

    save_dir = os.path.join("assets", "audio")
    ensure_dir(save_dir)

    filename = f"{uuid.uuid4()}.wav"
    save_path = os.path.join(save_dir, filename)

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-preview-tts",
            contents=text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice
                        )
                    )
                ),
            ),
        )

        audio_data = response.candidates[0].content.parts[0].inline_data.data

        # Gemini TTS returns raw PCM (24kHz, 16-bit, mono).
        # Wrap it in a proper WAV header so browsers can play it.
        sample_rate = 24000
        num_channels = 1
        sample_width = 2  # 16-bit

        with wave.open(save_path, "wb") as wf:
            wf.setnchannels(num_channels)
            wf.setsampwidth(sample_width)
            wf.setframerate(sample_rate)
            wf.writeframes(audio_data)

        # Calculate duration from PCM data length
        num_frames = len(audio_data) // (sample_width * num_channels)
        duration_sec = round(num_frames / sample_rate, 2)

        return {"file_path": save_path, "duration_sec": duration_sec}

    except Exception as e:
        raise ValueError(f"Failed to generate speech: {e}")
