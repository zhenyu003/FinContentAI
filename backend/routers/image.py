import base64
import os
import subprocess
import tempfile
import uuid

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from services.dalle import generate_image

router = APIRouter(prefix="/image", tags=["image"])

MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_CHART_VIDEO_SIZE = 20 * 1024 * 1024  # 20 MB (webm animation)
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png"}
ALLOWED_CHART_VIDEO_PREFIXES = ("video/", "application/octet-stream")
MOTIONS_DIR = os.path.join("assets", "video", "motions")


class GenerateImageRequest(BaseModel):
    prompt: str
    aspect_ratio: str = "16:9"


class UploadChartRequest(BaseModel):
    data_url: str


@router.post("/generate")
async def create_image(request: GenerateImageRequest):
    try:
        file_path = generate_image(
            prompt=request.prompt,
            aspect_ratio=request.aspect_ratio,
        )
        # Return URL path relative to server root
        url = "/" + file_path.replace("\\", "/")
        return {"image_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    """Upload a user-provided image (JPG/PNG, max 5 MB).

    Saves to the same assets/images/ directory as AI-generated images
    so the video synthesis pipeline works without changes.
    """
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Only JPEG and PNG files are allowed (got {file.content_type})",
        )

    img_bytes = await file.read()
    if len(img_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(img_bytes) / 1024 / 1024:.1f} MB). Max is 5 MB.",
        )

    ext = ".jpg" if file.content_type == "image/jpeg" else ".png"
    filename = f"{uuid.uuid4().hex}{ext}"
    out_path = os.path.join("assets", "images", filename)
    with open(out_path, "wb") as f:
        f.write(img_bytes)

    return {"image_url": f"/assets/images/{filename}"}


@router.post("/upload-chart")
async def upload_chart_image(request: UploadChartRequest):
    """Save a base64-encoded chart PNG so the video pipeline can reference it."""
    try:
        header, encoded = request.data_url.split(",", 1)
        img_bytes = base64.b64decode(encoded)
        filename = f"{uuid.uuid4().hex}.png"
        out_path = os.path.join("assets", "images", filename)
        with open(out_path, "wb") as f:
            f.write(img_bytes)
        return {"image_url": f"/assets/images/{filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-chart-video")
async def upload_chart_video(file: UploadFile = File(...)):
    """Accept a recorded Recharts animation (webm) and transcode to mp4.

    The resulting mp4 is stored in the same motions directory as Veo clips,
    so it can be consumed by the existing `video_clip_path` branch of the
    video synthesis pipeline (which handles freeze-tail when the clip is
    shorter than the scene audio).
    """
    # MediaRecorder sets Blob.type to e.g. "video/webm;codecs=vp9" — so we match
    # by prefix instead of against an exact whitelist.
    ctype = (file.content_type or "").lower()
    if not ctype.startswith(ALLOWED_CHART_VIDEO_PREFIXES):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported content type for chart video: {file.content_type}",
        )

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty upload")
    if len(raw) > MAX_CHART_VIDEO_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Chart video too large ({len(raw) / 1024 / 1024:.1f} MB). Max is 20 MB.",
        )

    os.makedirs(MOTIONS_DIR, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.mp4"
    out_rel = os.path.join(MOTIONS_DIR, filename).replace("\\", "/")
    out_abs = os.path.abspath(out_rel)

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp.write(raw)
        tmp_path = tmp.name

    try:
        # Transcode webm → mp4 (H.264 + yuv420p for broad compatibility).
        # -an drops audio (chart recording is silent).
        # -vf ensures even dimensions (required by libx264).
        # -movflags +faststart so the browser preview can start immediately.
        cmd = [
            "ffmpeg", "-y",
            "-i", tmp_path,
            "-an",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-movflags", "+faststart",
            out_abs,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(
                f"ffmpeg transcode failed: {result.stderr[-400:]}"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    return {"video_url": f"/{out_rel}"}
