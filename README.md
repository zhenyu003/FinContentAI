# FinContent AI

AI-Powered Financial Content Production Platform — from trending topic discovery to publish-ready video and social posts.

## What It Does

FinContent AI is a full-stack application that automates the creation of financial video content and social media posts. The workflow:

1. **Topic Discovery** — AI researches trending financial topics using real-time data
2. **Idea & Opinion** — Generates content angles with **preset or custom narrative templates** (AI-generated beats from your description); user adds their unique perspective
3. **Asset Workstation** — Generates visuals (AI images, **animated data charts**, **Motion Studio clips**), narration audio (**Google TTS or ElevenLabs**, including **cloned voices**), and assembles everything per scene
4. **Motion Studio** — Optional: generates short video clips per scene using **Google Veo 3.1 Lite**, with shot-level control and stitching
5. **Video Synthesis** — Concatenates all scenes, burns word-level subtitles (via forced alignment), and exports the final video
6. **Preview & Export** — Video preview with YouTube metadata generation (titles, description, thumbnail)
7. **Social Post Branch** — Separate flow to generate platform-specific text posts (LinkedIn, Instagram, X) with AI-generated images

**Account page** — User profile, **saved narrative templates**, **voice clones** (ElevenLabs), credits reference, and plans.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript, Vite, Recharts, React Router |
| Backend | FastAPI (Python 3.11+), Uvicorn |
| AI — Google | Gemini (text), **Imagen** (images), **Veo 3.1 Lite** (`veo-3.1-lite-generate-preview`) for Motion, Gemini TTS for default narration |
| AI — Optional | **ElevenLabs** — Instant Voice Clone (IVC) + TTS (**Flash v2.5**) when a clone is selected |
| Subtitles | stable-ts forced alignment (Whisper-based) + FFmpeg / libass |
| Video | FFmpeg (libx264, AAC, zoompan, concat, chart upload transcode) |
| Auth & DB | Supabase (PostgreSQL + Auth + Row Level Security) |
| Charts | Recharts (in-browser); optional **recorded animation** (WebM → MP4) for final video |

## Project Structure

```
.
├── backend/
│   ├── main.py                 # FastAPI app entry point
│   ├── requirements.txt
│   ├── migrations/             # Supabase SQL — run in order in SQL Editor
│   │   ├── 001_init.sql
│   │   ├── 002_narrative_templates.sql
│   │   └── 003_voice_clones.sql
│   ├── routers/
│   │   ├── topics.py, idea.py, opinion.py, scenes.py
│   │   ├── image.py            # Imagen + chart/chart-video upload
│   │   ├── audio.py            # TTS (Gemini / ElevenLabs clone)
│   │   ├── video.py            # Final synthesis + motion-veo route
│   │   ├── motion.py           # Motion Studio (stitch, split shots)
│   │   ├── template.py         # Saved narrative templates CRUD
│   │   ├── voice.py            # ElevenLabs voice clones
│   │   ├── metadata.py, social.py, knowledge.py
│   │   ├── auth.py, profile.py, credits.py, admin.py
│   │   └── ...
│   ├── services/
│   │   ├── gemini.py, dalle.py, tts.py, veo.py, ffmpeg.py
│   │   ├── elevenlabs.py       # Cloning + ElevenLabs TTS
│   │   ├── whisper_align.py, subtitle_ass.py
│   │   └── ...
│   └── assets/                 # Generated files (gitignored)
│
├── frontend/
│   ├── src/
│   │   ├── pages/              # Topic, Workspace, Motion Studio, Preview, Account, Social, …
│   │   ├── components/
│   │   │   ├── ChartConfigPanel.tsx, NarrativeBuilder.tsx
│   │   │   ├── NarrativeTemplatesManager.tsx, VoiceCloneManager.tsx
│   │   │   └── ...
│   │   └── api/client.ts
│   └── package.json
│
└── README.md
```

## Prerequisites

- **Python 3.11+**
- **Node.js 18+** (npm)
- **FFmpeg** + **ffprobe** on `PATH` (video synthesis, chart WebM→MP4, voice sample WebM→WAV)
  - macOS: `brew install ffmpeg`
  - Ubuntu: `sudo apt install ffmpeg`
- **Google AI API key** — Gemini, Imagen, Veo, Gemini TTS ([Google AI Studio](https://aistudio.google.com/apikey))
- **Supabase project** — Auth + database ([Supabase](https://supabase.com))
- **Optional: ElevenLabs API key** — voice cloning + clone-based TTS ([ElevenLabs](https://elevenlabs.io)); see [Voice cloning & ElevenLabs](#voice-cloning--elevenlabs) below

## Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd "AI video"
```

### 2. Database (Supabase)

Create a project, then in **SQL Editor** run the migration files **in order**:

1. `backend/migrations/001_init.sql`
2. `backend/migrations/002_narrative_templates.sql`
3. `backend/migrations/003_voice_clones.sql`

This creates tables and RLS policies for profiles, narrative templates, voice clones, etc.

### 3. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — see Environment Variables

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Backend: `http://localhost:8000` — health: `http://localhost:8000/api/health`

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google AI key (Gemini, Imagen, Veo, Gemini TTS) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (server only; never expose to frontend) |
| `ELEVENLABS_API_KEY` | No | Enables **voice cloning** and **TTS with cloned voices**. Omit to use only Gemini TTS. |

## Key Features

### Video production pipeline

- **Topic & idea** — Preset narrative styles, **saved custom templates**, or **Custom Template** (title + description → AI-generated beats).
- **Scene editing** — Narration, AI image, **chart** (static PNG + optional **recorded chart animation**), or **Motion** (Veo).
- **Chart vs Motion** — Chart animation is stored separately from Motion Studio (`chart_motion_url` vs `motion_url`) so the Motion column only reflects Veo/stitched clips.
- **Motion Studio** — **Veo 3.1 Lite** for per-scene clips; stitch with narration audio.
- **Subtitles** — Word-level alignment (stable-ts), burned with ASS/libass in final export.
- **Synthesis** — One MP4 with optional transcript overlay.

### Narrative templates

- **Topic / Idea flow** — Custom template: enter a **template title**, describe the arc; AI returns tone and beats. Save to account or use for script generation.
- **Account** — List, edit, delete saved templates; same AI-first flow as Idea page.

### Voice cloning & ElevenLabs

- **Account → Voice Cloning** — Record a sample (~15s target, WebM) or upload audio; backend normalizes (e.g. WebM → WAV) before ElevenLabs IVC.
- **Limits** — Up to **3** clones per user (MVP); TTS with clones uses **ElevenLabs Flash v2.5** when a clone is selected in the workstation.
- **Billing / API access** — ElevenLabs **free tiers often do not include full API access** for cloning or may be heavily limited. Teammates may need a **paid plan** or a **shared project key** from someone with API enabled. Do **not** commit real keys; share `.env` values through a secure channel.

### Data charts

- JSON editor, templates, **Generate Chart** with optional **animation recording** for the final video.

### Social posts

- LinkedIn / Instagram / X text + images; separate from the video pipeline.

## Notes

- Generated media lives under `backend/assets/` (gitignored); startup cleanup removes files older than **72 hours**.
- App state for the video flow is stored in **sessionStorage** (refresh keeps the session).
- Final MP4s use **faststart** for web playback.
- Subtitle alignment uses the **base** Whisper model — tuned for **forced alignment** of known text, not open-ended transcription.

---

## Contributing / team testing

- Each developer needs their own `backend/.env` (never commit `.env`).
- **Google + Supabase** keys are required for core flows.
- **ElevenLabs** is optional; if the team shares one key, all usage counts against that account — prefer individual keys or a dedicated dev key when possible.
