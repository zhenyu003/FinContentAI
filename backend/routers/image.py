import base64
import os
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.dalle import generate_image

router = APIRouter(prefix="/image", tags=["image"])


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
