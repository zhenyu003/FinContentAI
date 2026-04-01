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
    allow_origins=["http://localhost:5173"],
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
(ASSETS_DIR / "thumbnails").mkdir(exist_ok=True)

app.mount("/assets", StaticFiles(directory="assets"), name="assets")

from routers import topics, idea, opinion, scenes, image, audio, video, metadata

app.include_router(topics.router, prefix="/api")
app.include_router(idea.router, prefix="/api")
app.include_router(opinion.router, prefix="/api")
app.include_router(scenes.router, prefix="/api")
app.include_router(image.router, prefix="/api")
app.include_router(audio.router, prefix="/api")
app.include_router(video.router, prefix="/api")
app.include_router(metadata.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
