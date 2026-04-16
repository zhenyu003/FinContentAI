# FinContent AI

AI-Powered Financial Content Production Platform — from trending topic discovery to publish-ready video and social posts.

## What It Does

FinContent AI is a full-stack application that automates the creation of financial video content and social media posts. The workflow:

1. **Topic Discovery** — AI researches trending financial topics using real-time data
2. **Idea & Opinion** — Generates content angles with narrative templates; user adds their unique perspective
3. **Asset Workstation** — Generates visuals (AI images, data charts, motion video clips), narration audio (TTS), and assembles everything per scene
4. **Motion Studio** — Optional: generates short video clips per scene using Google Veo, with shot-level control and timeline editing
5. **Video Synthesis** — Concatenates all scenes, burns word-level subtitles (via forced alignment), and exports the final video
6. **Preview & Export** — Video preview with YouTube metadata generation (titles, description, thumbnail)
7. **Social Post Branch** — Separate flow to generate platform-specific text posts (LinkedIn, Instagram, X) with AI-generated images

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript, Vite, Recharts, React Router |
| Backend | FastAPI (Python 3.11+), Uvicorn |
| AI Models | Google Gemini 2.5 (text), Google Imagen 3 (images), Google Veo (video), Google TTS |
| Subtitles | stable-ts forced alignment (Whisper-based) + FFmpeg drawtext |
| Video | FFmpeg (libx264, AAC, zoompan, drawtext) |
| Auth & DB | Supabase (PostgreSQL + Auth + Row Level Security) |
| Charts | Recharts (rendered in-browser, captured via html2canvas) |

## Project Structure

```
.
├── backend/
│   ├── main.py                 # FastAPI app entry point
│   ├── requirements.txt        # Python dependencies
│   ├── routers/                # API route handlers
│   │   ├── topics.py           # Trending topic research
│   │   ├── idea.py             # Content idea generation
│   │   ├── opinion.py          # Q&A for user opinion injection
│   │   ├── scenes.py           # Scene breakdown & splitting
│   │   ├── image.py            # AI image generation (Imagen 3)
│   │   ├── audio.py            # Text-to-speech (Google TTS)
│   │   ├── video.py            # Video synthesis (FFmpeg)
│   │   ├── motion.py           # Motion Studio (Veo video gen)
│   │   ├── metadata.py         # YouTube title/description/thumbnail
│   │   ├── social.py           # Social post generation
│   │   ├── template.py         # Narrative templates
│   │   ├── knowledge.py        # Knowledge base (RAG)
│   │   ├── auth.py             # Authentication
│   │   ├── profile.py          # User profiles
│   │   ├── credits.py          # Usage credits
│   │   └── admin.py            # Admin endpoints
│   ├── services/               # Core business logic
│   │   ├── gemini.py           # Gemini API wrapper
│   │   ├── dalle.py            # Image generation (Imagen 3)
│   │   ├── tts.py              # Google Cloud TTS
│   │   ├── veo.py              # Google Veo video generation
│   │   ├── ffmpeg.py           # Video synthesis & subtitle burning
│   │   ├── whisper_align.py    # Word-level forced alignment (stable-ts)
│   │   ├── claude.py           # Claude API (narrative generation)
│   │   ├── social_post.py      # Social post content generation
│   │   ├── knowledge.py        # Knowledge base service
│   │   ├── supabase_client.py  # Supabase client setup
│   │   └── ...
│   └── assets/                 # Generated files (gitignored)
│       ├── images/
│       ├── audio/
│       ├── video/
│       └── thumbnails/
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # Root component, routing, state management
│   │   ├── pages/
│   │   │   ├── HomePage.tsx          # Landing / create flow entry
│   │   │   ├── TopicPage.tsx         # Topic discovery & idea selection
│   │   │   ├── WorkspacePage.tsx     # Asset workstation (scenes table)
│   │   │   ├── MotionStudioPage.tsx  # Motion video editing
│   │   │   ├── PreviewPage.tsx       # Video preview & export
│   │   │   ├── SocialIdeaPage.tsx    # Social post idea & config
│   │   │   ├── SocialStudioPage.tsx  # Social post editing & export
│   │   │   └── ...
│   │   ├── components/
│   │   │   ├── ChartConfigPanel.tsx  # Chart data editor & capture
│   │   │   ├── ChartRenderer.tsx     # Recharts-based chart rendering
│   │   │   └── ...
│   │   ├── api/client.ts       # Backend API client (axios)
│   │   ├── types/index.ts      # TypeScript type definitions
│   │   └── lib/                # Chart templates, Supabase client
│   └── package.json
│
└── README.md
```

## Prerequisites

- **Python 3.11+**
- **Node.js 18+** (with npm)
- **FFmpeg** — must be installed and available in PATH
  - Required codecs: libx264, AAC
  - macOS: `brew install ffmpeg`
  - Ubuntu: `sudo apt install ffmpeg`
- **Google Cloud API Key** — with access to Gemini, Imagen 3, Veo, and Cloud TTS
- **Supabase Project** — for authentication and database

## Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd "AI video"
```

### 2. Backend setup

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with your API keys (see .env.example)
cp .env.example .env
# Edit .env and fill in your keys

# Start the backend server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The backend will be available at `http://localhost:8000`.

### 3. Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend will be available at `http://localhost:5173`.

### 4. Verify

Open `http://localhost:5173` in your browser. The app should load and connect to the backend automatically.

You can also check `http://localhost:8000/api/health` to verify the backend is running.

## Environment Variables

See `backend/.env.example` for all required environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google AI API key (Gemini, Imagen, Veo, TTS) |
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |

## Key Features

### Video Production Pipeline
- **AI Topic Research** — Discovers trending financial topics with real-time data
- **Scene-by-Scene Editing** — Full control over narration text, visuals, and audio per scene
- **Multiple Visual Modes** — AI-generated images, interactive data charts, or motion video clips
- **Motion Studio** — Generate and edit short video clips per scene using Google Veo
- **Accurate Subtitles** — Word-level subtitle alignment using stable-ts forced alignment (not transcription)
- **One-Click Video Synthesis** — Combines all assets into a final MP4 with burned-in subtitles
- **YouTube Metadata** — AI-generated titles, descriptions, and thumbnails

### Social Post Generation
- **Multi-Platform** — Generates tailored content for LinkedIn, Instagram, and X (Twitter)
- **Configurable Length** — Short (~50-80 words), Medium (~120-180 words), Long (~250-400 words)
- **AI Image Generation** — Platform-appropriate images with suggested prompts
- **Template System** — Customizable narrative templates for consistent branding

### Data Charts
- **Live Chart Editor** — Edit chart data as JSON, preview in real-time
- **Multiple Chart Types** — Line, Bar, and Pie charts with dark theme
- **Financial Templates** — Pre-built templates for earnings trends, sector comparisons, market share
- **Auto-Capture** — Charts are rendered in-browser and captured as images for video

## Notes

- Generated assets (images, audio, video) are stored in `backend/assets/` and auto-cleaned after 72 hours
- The `assets/` directory is gitignored — files are generated at runtime
- Session state is persisted in the browser's sessionStorage, so refreshing won't lose your work
- Video files use `faststart` for instant browser playback (moov atom at file start)
- Subtitle alignment uses the "base" Whisper model — sufficient for forced alignment of known text
