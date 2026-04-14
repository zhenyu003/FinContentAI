from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.social_template import generate_social_post_template

router = APIRouter(prefix="/template", tags=["template"])


class SocialTemplateGenerateRequest(BaseModel):
    input: str = Field(..., min_length=1)


@router.post("/social-generate")
async def social_template_generate(body: SocialTemplateGenerateRequest):
    """Generate a structured single-post social template from natural language."""
    try:
        return generate_social_post_template(body.input)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
