import logging
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="FinContent AI API")

app.add_middleware(
    CORSMiddleware,
    # Match any localhost / 127.0.0.1 port so Vite can use 5173, 5174, etc.
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create temp directories for generated assets
ASSETS_DIR = Path("assets")
ASSETS_DIR.mkdir(exist_ok=True)
(ASSETS_DIR / "images").mkdir(exist_ok=True)
(ASSETS_DIR / "audio").mkdir(exist_ok=True)
(ASSETS_DIR / "video").mkdir(exist_ok=True)
(ASSETS_DIR / "video" / "motions").mkdir(exist_ok=True)
(ASSETS_DIR / "thumbnails").mkdir(exist_ok=True)
(ASSETS_DIR / "uploads").mkdir(exist_ok=True)

app.mount("/assets", StaticFiles(directory="assets"), name="assets")

from routers import (
    topics, idea, opinion, scenes, image, audio, video, metadata,
    auth, profile, credits, knowledge, social, template,
    motion, admin, voice,
)

# Original content pipeline
app.include_router(topics.router, prefix="/api")
app.include_router(idea.router, prefix="/api")
app.include_router(opinion.router, prefix="/api")
app.include_router(scenes.router, prefix="/api")
app.include_router(image.router, prefix="/api")
app.include_router(audio.router, prefix="/api")
app.include_router(video.router, prefix="/api")
app.include_router(metadata.router, prefix="/api")
app.include_router(template.router, prefix="/api")

# Account system
app.include_router(auth.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(credits.router, prefix="/api")
app.include_router(knowledge.router, prefix="/api")
app.include_router(voice.router, prefix="/api")

# Social post generation
app.include_router(social.router, prefix="/api")

# Motion studio
app.include_router(motion.router, prefix="/api")

# Admin / maintenance
app.include_router(admin.router, prefix="/api")


# ---------------------------------------------------------------------------
# Startup: light cleanup of stale assets (older than 72 hours)
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def _startup_asset_cleanup():
    from services.cleanup import cleanup_old_assets

    logger = logging.getLogger("startup")
    logger.info("Running startup asset cleanup (max_age_hours=72)...")
    result = cleanup_old_assets(max_age_hours=72)
    logger.info("Startup cleanup result: %s", result)


@app.get("/api/health")
def health():
    return {"status": "ok"}
