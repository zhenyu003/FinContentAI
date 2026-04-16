"""Word-level subtitle alignment using stable-ts forced alignment.

Uses stable-ts model.align() with the KNOWN narration text to get
precise word boundaries — much more accurate than transcription-based
timestamps since the text is already known (TTS-generated).
"""

import os
import uuid

from services.utils import ensure_dir

# Lazy-loaded model singleton
_model = None


def _get_model():
    global _model
    if _model is None:
        import stable_whisper
        # "base" is sufficient for forced alignment (not transcribing).
        _model = stable_whisper.load_model("base")
    return _model


def _format_srt_time(seconds: float) -> str:
    """Convert seconds to SRT time format (HH:MM:SS,mmm)."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def align_words(audio_path: str, text: str) -> list[dict]:
    """Force-align known text to audio and return word-level timestamps.

    Args:
        audio_path: Path to the audio file.
        text: The exact narration text (from TTS).

    Returns:
        List of dicts with keys: word (str), start (float), end (float).
    """
    if not audio_path or not os.path.exists(audio_path) or not text.strip():
        return []

    model = _get_model()
    try:
        result = model.align(audio_path, text, language="en")
    except Exception as e:
        print(f"[align] forced alignment failed: {e}")
        return []

    words = []
    for w in result.all_words():
        if w.word.strip():
            words.append({
                "word": w.word.strip(),
                "start": w.start,
                "end": w.end,
            })
    return words


def _chunk_words(words: list[dict], target_size: int = 10) -> list[list[dict]]:
    """Split words into chunks of roughly target_size for subtitle display."""
    if not words:
        return []
    chunks = []
    for i in range(0, len(words), target_size):
        chunks.append(words[i : i + target_size])
    return chunks
