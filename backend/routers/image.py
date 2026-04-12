from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.dalle import generate_image

router = APIRouter(prefix="/image", tags=["image"])


class GenerateImageRequest(BaseModel):
    prompt: str
    aspect_ratio: str = "16:9"


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
