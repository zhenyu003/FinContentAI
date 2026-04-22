"""
Google Veo video generation (Gemini API) for Motion clips.
"""

import os
import re
import subprocess
import time
import uuid

from google.genai import types

from services.utils import get_gemini_client

VEO_MODEL = "veo-3.1-lite-generate-preview"
MOTIONS_DIR = os.path.join("assets", "video", "motions")
_POLL_INTERVAL_SEC = 10
_MAX_POLL_SEC = 600


# Brand names / trademarks that Veo rejects – mapped to generic stand-ins.
_BRAND_MAP: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bNVIDIA\b", re.IGNORECASE), "a leading chip company"),
    (re.compile(r"\bGoogle\b", re.IGNORECASE), "a major tech company"),
    (re.compile(r"\bMicrosoft\b", re.IGNORECASE), "a major software company"),
    (re.compile(r"\bApple\b", re.IGNORECASE), "a premium tech company"),
    (re.compile(r"\bMeta\b", re.IGNORECASE), "a social media company"),
    (re.compile(r"\bAmazon\b", re.IGNORECASE), "an e-commerce giant"),
    (re.compile(r"\bTesla\b", re.IGNORECASE), "an electric vehicle company"),
    (re.compile(r"\bOpenAI\b", re.IGNORECASE), "an AI research lab"),
    (re.compile(r"\bSamsung\b", re.IGNORECASE), "a consumer electronics firm"),
    (re.compile(r"\bIntel\b", re.IGNORECASE), "a chip manufacturer"),
    (re.compile(r"\bAMD\b"), "a semiconductor company"),
    (re.compile(r"\bTSMC\b", re.IGNORECASE), "a chip foundry"),
    (re.compile(r"\bQualcomm\b", re.IGNORECASE), "a mobile chip maker"),
    (re.compile(r"\bNetflix\b", re.IGNORECASE), "a streaming platform"),
    (re.compile(r"\bSpotify\b", re.IGNORECASE), "a music streaming service"),
    (re.compile(r"\bTwitter\b", re.IGNORECASE), "a social platform"),
    (re.compile(r"\b[Xx]\.com\b"), "a social platform"),
    (re.compile(r"\bFacebook\b", re.IGNORECASE), "a social network"),
    (re.compile(r"\bYouTube\b", re.IGNORECASE), "a video platform"),
    (re.compile(r"\bTikTok\b", re.IGNORECASE), "a short-video platform"),
    (re.compile(r"\bBitcoin\b", re.IGNORECASE), "a cryptocurrency"),
    (re.compile(r"\bEthereum\b", re.IGNORECASE), "a cryptocurrency"),
    (re.compile(r"\bS&P\s*500\b", re.IGNORECASE), "a major stock index"),
    (re.compile(r"\bNASDAQ\b", re.IGNORECASE), "a stock exchange"),
    (re.compile(r"\bDow\s*Jones\b", re.IGNORECASE), "a stock index"),
]


def _sanitize_for_veo(text: str) -> str:
    """Replace brand names with generic descriptions so Veo doesn't reject the prompt."""
    for pattern, replacement in _BRAND_MAP:
        text = pattern.sub(replacement, text)
    return text


def build_veo_prompt(scene: dict) -> str:
    """Combine scene fields with cinematic instructions for Veo.

    Note: orientation guidance is added later in `generate_motion_video`
    based on `aspect_ratio` so it applies to both this wrapper and to
    raw shot prompts coming from the multi-shot pipeline.
    """
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
    return _sanitize_for_veo("\n".join(parts).strip())


def _orientation_directive(aspect_ratio: str) -> str:
    """Strong, explicit orientation instruction prepended to every Veo prompt.

    Veo's `aspect_ratio` config field controls the output canvas, but the
    model still composes the SCENE based on the text prompt — so without an
    explicit orientation directive it tends to plan horizontally and end up
    rendering subjects sideways in a 9:16 canvas. Repeating the constraint
    in the prompt itself fixes this.
    """
    if aspect_ratio == "9:16":
        return (
            "OUTPUT FORMAT: 9:16 VERTICAL / PORTRAIT video (mobile / TikTok / Reels / Shorts).\n"
            "Compose the entire scene for a TALL vertical frame: subjects MUST be oriented "
            "upright (head at top, feet at bottom), framed head-to-toe vertically. "
            "Camera in portrait orientation. The longest dimension of every subject "
            "(a standing person, a building, a tree) MUST align with the vertical axis.\n"
            "Strictly forbidden: groups of 3+ people side-by-side, wide horizon panoramas, "
            "conference tables shot from the side, any composition wider than tall — "
            "those will render rotated/sideways in a 9:16 canvas.\n"
            "ONE CONTINUOUS SHOT for the full 8 seconds. NO cuts, NO scene transitions, "
            "NO jumping to a different angle or different subject mid-clip. The camera "
            "may pan, tilt, dolly, or push-in smoothly, but it stays on the SAME subject "
            "and the SAME framing logic from frame 0 to frame 240.\n\n"
        )
    return (
        "OUTPUT FORMAT: 16:9 HORIZONTAL / LANDSCAPE widescreen video. "
        "Compose for a wide cinematic frame.\n"
        "ONE CONTINUOUS SHOT for the full 8 seconds. NO cuts, NO scene transitions, "
        "NO jumping to a different angle mid-clip.\n\n"
    )


class RateLimitError(Exception):
    """Raised when the Veo API returns 429 RESOURCE_EXHAUSTED."""
    pass


_VEO_MAX_RETRIES = 4
_VEO_BASE_DELAY = 30  # seconds — Veo rate limits need longer waits


def _person_generation_candidates(image_to_video: bool) -> list[str]:
    """Order matches Gemini docs; API also varies by region (EU vs US), so we fall back."""
    if image_to_video:
        return ["allow_adult", "allow_all", "dont_allow"]
    return ["allow_all", "allow_adult", "dont_allow"]


def _is_person_generation_rejected(err_str: str) -> bool:
    low = err_str.lower()
    if "persongeneration" not in low:
        return False
    return "not supported" in low or "invalid_argument" in low


def _strip_veo_model_audio(video_path: str) -> None:
    """Drop Veo's baked-in model audio so clips use scene TTS in stitch/synthesis."""
    tmp = video_path + ".noaudio.mp4"
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                video_path,
                "-map",
                "0:v:0",
                "-c:v",
                "copy",
                "-an",
                tmp,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        os.replace(tmp, video_path)
    except subprocess.CalledProcessError as e:
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except OSError:
                pass
        tail = (e.stderr or "")[-800:]
        print(f"[Veo] Could not strip model audio (using file as-is): {tail}")


def _load_reference_image(path: str) -> types.Image:
    """Load a local image file into a types.Image for Veo image-to-video."""
    ext = os.path.splitext(path)[1].lower()
    if ext in (".jpg", ".jpeg"):
        mime = "image/jpeg"
    elif ext == ".png":
        mime = "image/png"
    else:
        raise ValueError(f"Unsupported reference image type: {ext}")
    with open(path, "rb") as f:
        data = f.read()
    return types.Image(image_bytes=data, mime_type=mime)


def generate_motion_video(
    prompt: str,
    *,
    aspect_ratio: str = "16:9",
    reference_image_path: str | None = None,
) -> str:
    """
    Generate one MP4 via Veo, poll until complete, save under assets/video/motions/.
    Retries automatically on 429 rate-limit errors with exponential backoff.

    If `reference_image_path` is provided, uses Veo's image-to-video mode
    (the image becomes the first frame / anchor).

    Returns:
        Relative path like assets/video/motions/<id>.mp4
    """
    text = (prompt or "").strip()
    if not text:
        raise ValueError("prompt is required")

    if aspect_ratio not in ("16:9", "9:16"):
        aspect_ratio = "16:9"

    # Prepend a strong orientation directive so Veo composes the SCENE for
    # the correct aspect ratio (the config field alone only sets the output
    # canvas; without prompt-level guidance the model often plans
    # horizontally and the result looks rotated in a 9:16 canvas).
    text = _orientation_directive(aspect_ratio) + text

    os.makedirs(MOTIONS_DIR, exist_ok=True)
    client = get_gemini_client()

    reference_image = None
    if reference_image_path:
        if not os.path.exists(reference_image_path):
            raise FileNotFoundError(
                f"Reference image not found: {reference_image_path}"
            )
        reference_image = _load_reference_image(reference_image_path)

    image_to_video = reference_image is not None
    candidates = _person_generation_candidates(image_to_video)
    operation = None
    last_error: Exception | None = None

    for person_gen in candidates:
        for attempt in range(_VEO_MAX_RETRIES):
            try:
                kwargs = dict(
                    model=VEO_MODEL,
                    prompt=text,
                    config=types.GenerateVideosConfig(
                        duration_seconds=8,
                        aspect_ratio=aspect_ratio,
                        resolution="720p",
                        person_generation=person_gen,
                        number_of_videos=1,
                    ),
                )
                if reference_image is not None:
                    kwargs["image"] = reference_image
                operation = client.models.generate_videos(**kwargs)
                last_error = None
                break
            except Exception as e:
                err_str = str(e)
                last_error = e
                if _is_person_generation_rejected(err_str):
                    snippet = err_str[:220] + ("..." if len(err_str) > 220 else "")
                    print(
                        f"[Veo] person_generation={person_gen!r} rejected "
                        f"({snippet}); trying next option."
                    )
                    operation = None
                    break
                is_rate_limit = any(
                    s in err_str for s in ["429", "RESOURCE_EXHAUSTED", "quota"]
                )
                if is_rate_limit and attempt < _VEO_MAX_RETRIES - 1:
                    wait = _VEO_BASE_DELAY * (2 ** attempt)
                    print(
                        f"[Veo] Rate limited (attempt {attempt + 1}), "
                        f"retrying in {wait}s…"
                    )
                    time.sleep(wait)
                    continue
                if is_rate_limit:
                    raise RateLimitError(
                        "Veo API rate limit exceeded. Please wait a minute and try again."
                    ) from e
                raise
        if operation is not None:
            break

    if operation is None:
        msg = "Failed to start Veo generation"
        if last_error is not None:
            msg = f"{msg}: {last_error}"
        raise RuntimeError(msg)

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
        # Surface API RAI / safety hints (GenerateVideosResponse has these fields).
        detail_parts: list[str] = []
        if response:
            rai_n = getattr(response, "rai_media_filtered_count", None)
            rai_reasons = getattr(response, "rai_media_filtered_reasons", None)
            if rai_n is not None:
                detail_parts.append(f"filtered_count={rai_n}")
            if rai_reasons:
                detail_parts.append(f"reasons={rai_reasons}")
            for attr in ("prompt_feedback", "filters", "block_reason", "blocked_reason"):
                val = getattr(response, attr, None)
                if val:
                    detail_parts.append(f"{attr}={val}")
            if hasattr(response, "generated_videos") and response.generated_videos is not None:
                for gv in response.generated_videos:
                    reason = getattr(gv, "finish_reason", None) or getattr(gv, "block_reason", None)
                    if reason:
                        detail_parts.append(f"video_reason={reason}")
        extra = (" Details: " + "; ".join(detail_parts)) if detail_parts else ""
        print(f"[Veo] Full response object: {response}")
        raise ValueError(
            "Veo returned no video output. This is usually a safety / content-policy block "
            f"on the prompt or reference image.{extra}"
        )

    video_part = response.generated_videos[0].video
    raw = client.files.download(file=video_part)
    if not raw:
        raise ValueError("Empty video bytes from Veo download")

    filename = f"{uuid.uuid4().hex}.mp4"
    rel_path = os.path.join(MOTIONS_DIR, filename).replace("\\", "/")
    abs_path = os.path.abspath(rel_path)
    with open(abs_path, "wb") as f:
        f.write(raw)

    _strip_veo_model_audio(abs_path)

    return rel_path
