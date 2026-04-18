-- FinContentAI Voice Clones (ElevenLabs IVC)
-- Run this in Supabase SQL Editor after 002_narrative_templates.sql

-- ============================================
-- Voice Clones (ElevenLabs IVC voices owned by a user)
-- ============================================
CREATE TABLE voice_clones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- The voice_id returned by ElevenLabs Add Voice API
  elevenlabs_voice_id TEXT NOT NULL,
  -- Human-readable label the user chose (e.g. "My Studio Voice")
  name TEXT NOT NULL,
  -- Original sample filename (for display only)
  sample_filename TEXT,
  -- Sample duration in seconds (for quality hints)
  sample_duration_sec REAL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (user_id, name),
  UNIQUE (elevenlabs_voice_id)
);

CREATE INDEX idx_voice_clones_user ON voice_clones(user_id);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE voice_clones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own voice clones" ON voice_clones
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own voice clones" ON voice_clones
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own voice clones" ON voice_clones
  FOR DELETE USING (auth.uid() = user_id);
