-- FinContentAI Narrative Templates
-- Run this in Supabase SQL Editor after 001_init.sql

-- ============================================
-- Narrative Templates (user-saved story structures)
-- ============================================
CREATE TABLE narrative_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'professional',
  beats JSONB NOT NULL DEFAULT '[]',

  -- Origin tracking: helps surface AI-generated vs hand-crafted templates
  source TEXT NOT NULL DEFAULT 'custom' CHECK (source IN ('custom', 'ai_generated')),
  -- The user prompt that generated the template (for AI-generated templates)
  prompt TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Per-user uniqueness on name (case-insensitive) so we can do "overwrite if exists"
  UNIQUE (user_id, name)
);

CREATE INDEX idx_narrative_templates_user ON narrative_templates(user_id);
CREATE INDEX idx_narrative_templates_updated ON narrative_templates(updated_at DESC);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE narrative_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own templates" ON narrative_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates" ON narrative_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates" ON narrative_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates" ON narrative_templates
  FOR DELETE USING (auth.uid() = user_id);
