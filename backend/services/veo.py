"""
Google Veo video generation (Gemini API) for Motion clips.
"""

import os
import time
import uuid

from google import genai
from google.genai import types

VEO_MODEL = "veo-2.0-generate-001"
MOTIONS_DIR = os.path.join("assets", "video", "motions")
_POLL_INTERVAL_SEC = 10
_MAX_POLL_SEC = 600


def _get_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")
    return genai.Client(api_key=api_key)


def build_veo_prompt(scene: dict) -> str:
    """Combine scene fields with cinematic instructions for Veo."""
    description = (scene.get("description") or "").strip()
    narration = (scene.get("narration") or "").strip()
    parts = [
        "Create a short 5-second cinematic video.",
        "Requirements: one clear subject, a strong opening frame, smooth camera motion, "
        "high production value, no subtitles, no on-screen text, no captions.",
        "",
        "Visual / setting (primary):",
        description or "(no visual description)",
        "",
        "Mood and story context from narration (do not render spoken words as text on screen):",
        narration or "(no narration context)",
    ]
    return "\n".join(parts).strip()


def generate_motion_video(
    prompt: str,
    *,
    aspect_ratio: str = "16:9",
) -> str:
    """
    Generate one MP4 via Veo, poll until complete, save under assets/video/motions/.

    Returns:
        Relative path like assets/video/motions/<id>.mp4
    """
    text = (prompt or "").strip()
    if not text:
        raise ValueError("prompt is required")

    if aspect_ratio not in ("16:9", "9:16"):
        aspect_ratio = "16:9"

    os.makedirs(MOTIONS_DIR, exist_ok=True)
    client = _get_client()

    operation = client.models.generate_videos(
        model=VEO_MODEL,
        prompt=text,
        config=types.GenerateVideosConfig(
            duration_seconds=5,
            aspect_ratio=aspect_ratio,
            resolution="720p",
            person_generation="dont_allow",
            number_of_videos=1,
        ),
    )

    deadline = time.monotonic() + _MAX_POLL_SEC
    while not operation.done:
        if time.monotonic() >= deadline:
            raise TimeoutError(
                f"Veo generation did not finish within {_MAX_POLL_SEC} seconds"
            )
        time.sleep(_POLL_INTERVAL_SEC)
        operation = client.operations.get(operation)

    err = getattr(operation, "error", None)
    if err:
        raise RuntimeError(f"Veo operation failed: {err}")

    response = operation.response or operation.result

    if not response or not response.generated_videos:
        raise ValueError("Veo returned no generated_videos")

    video_part = response.generated_videos[0].video
    raw = client.files.download(file=video_part)
    if not raw:
        raise ValueError("Empty video bytes from Veo download")

    filename = f"{uuid.uuid4().hex}.mp4"
    rel_path = os.path.join(MOTIONS_DIR, filename).replace("\\", "/")
    abs_path = os.path.abspath(rel_path)
    with open(abs_path, "wb") as f:
        f.write(raw)

    return rel_path
