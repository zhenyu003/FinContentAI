import axios from "axios";
import { supabase } from "../lib/supabase";
import type { SocialPostTemplate } from "../types";

/** Prefer FastAPI `detail` over generic Axios messages like "Request failed with status code 500". */
export function formatApiError(e: unknown): string {
  if (axios.isAxiosError(e) && e.response?.data != null) {
    const data = e.response.data as { detail?: unknown };
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) {
      const parts = data.detail.map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return JSON.stringify(item);
      });
      return parts.join("; ");
    }
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Shared axios instance (auth interceptors). Use from `utils/` when avoiding circular imports. */
export const api = axios.create({ baseURL: "http://localhost:8000/api", timeout: 120000 });
export const BACKEND = "http://localhost:8000";

// Automatically attach auth token to requests
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// On 401, refresh session and retry once
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retried) {
      original._retried = true;
      const { data: { session } } = await supabase.auth.refreshSession();
      if (session?.access_token) {
        original.headers.Authorization = `Bearer ${session.access_token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

// ============ Topics ============
export async function fetchTopics(options?: { liveSearch?: boolean; category?: string }) {
  const params: Record<string, string> = {};
  if (options?.liveSearch) params.live_search = "true";
  if (options?.category) params.category = options.category;
  const res = await api.get("/topics", {
    params: Object.keys(params).length > 0 ? params : undefined,
    timeout: 45_000,
  });
  return res.data;
}

export async function searchTopic(query: string) {
  const res = await api.post("/topics/search", { query });
  return res.data;
}

export async function enrichTopics(topics: Record<string, unknown>[]) {
  const res = await api.post("/topics/enrich", { topics }, { timeout: 65_000 });
  return res.data;
}

// ============ Video Pipeline ============
export async function generateIdea(
  topic_title: string,
  topic_summary: string,
  sources: string[],
  narrative_template?: string
) {
  const res = await api.post("/idea/generate", { topic_title, topic_summary, sources, narrative_template });
  return res.data;
}

export async function refineOpinion(
  topic_title: string,
  topic_summary: string,
  idea: object,
  user_opinion: string
) {
  const res = await api.post("/opinion/refine", { topic_title, topic_summary, idea, user_opinion });
  return res.data;
}

export async function generateScenes(params: {
  topic_title: string;
  topic_summary: string;
  idea: object;
  user_opinion: string;
  qa_answers: string[];
  duration: string;
  narrative_template: string;
  aspect_ratio: string;
}) {
  const res = await api.post("/scenes/generate", params);
  return res.data;
}

export async function generateOneScene(params: {
  prev_scene?: { description: string; narration: string } | null;
  next_scene?: { description: string; narration: string } | null;
  topic_title: string;
  topic_summary: string;
  idea: object;
  aspect_ratio: string;
}) {
  const res = await api.post("/scenes/generate-one", params, { timeout: 60_000 });
  return res.data as { description: string; narration: string };
}

export async function splitScene(params: {
  scene_number: number;
  description: string;
  narration: string;
  audio_duration: number;
  aspect_ratio: string;
}) {
  const res = await api.post("/scenes/split", params);
  return res.data as {
    sub_scenes: {
      scene_number: number;
      scene_type: string;
      description: string;
      narration: string;
      is_chart: boolean;
    }[];
  };
}

export async function generateImage(prompt: string, aspect_ratio: string) {
  const res = await api.post("/image/generate", { prompt, aspect_ratio });
  return res.data;
}

export async function uploadChartImage(dataUrl: string) {
  const res = await api.post("/image/upload-chart", { data_url: dataUrl });
  return res.data as { image_url: string };
}

/** Upload a recorded Recharts animation (webm). Backend transcodes to mp4. */
export async function uploadChartVideo(blob: Blob) {
  const form = new FormData();
  // Give it a filename so FastAPI accepts the UploadFile.
  form.append("file", blob, "chart.webm");
  const res = await api.post("/image/upload-chart-video", form, {
    timeout: 60_000,
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data as { video_url: string };
}

export async function uploadSceneImage(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post("/image/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data as { image_url: string };
}

export async function generateAudio(
  text: string,
  voice: string,
  voiceCloneId?: string | null,
) {
  const res = await api.post("/audio/generate", {
    text,
    voice,
    voice_clone_id: voiceCloneId || undefined,
  });
  return res.data as { audio_url: string; duration_sec: number };
}

/** Google Veo motion clip (long-running; default 10 min client timeout). */
export async function generateMotionVeo(params: {
  aspect_ratio: string;
  prompt?: string;
  description?: string;
  narration?: string;
  reference_image_url?: string;
}) {
  const res = await api.post("/video/motion-veo", params, {
    timeout: 600_000,
  });
  return res.data as { video_url: string };
}

export async function generateVideo(
  scenes: (
    | { image_path: string; audio_path: string; narration: string }
    | { video_clip_path: string; audio_path: string; narration: string }
  )[],
  aspect_ratio: string,
  include_transcript: boolean = true,
) {
  const res = await api.post("/video/generate", { scenes, aspect_ratio, include_transcript }, {
    timeout: 600_000, // Whisper alignment + FFmpeg synthesis can take several minutes
  });
  return res.data;
}

export async function generateTitles(params: {
  topic_title: string;
  topic_summary: string;
  idea: object;
  narrative_template: string;
}) {
  const res = await api.post("/metadata/title", params);
  return res.data;
}

export async function generateDescription(params: {
  topic_title: string;
  topic_summary: string;
  idea: object;
  narration_texts: string[];
}) {
  const res = await api.post("/metadata/description", params);
  return res.data;
}

export async function generateThumbnail(prompt: string, aspect_ratio: string) {
  const res = await api.post("/metadata/thumbnail", { prompt, aspect_ratio });
  return res.data;
}

// ============ Motion Studio ============
export async function splitSceneToShots(params: {
  scene_description: string;
  narration: string;
  audio_duration: number;
  aspect_ratio: string;
}) {
  const res = await api.post("/motion/split-shots", params);
  return res.data as {
    shots: {
      shot_index: number;
      visual_prompt: string;
      start: number;
      end: number;
      freeze_tail: boolean;
    }[];
  };
}

export async function stitchMotionShots(params: {
  shot_videos: string[];
  audio_url: string;
  audio_duration: number;
  tail_strategy?: string;
}) {
  const res = await api.post("/motion/stitch", params, { timeout: 120_000 });
  return res.data as { video_url: string };
}

// ============ Template Recommendation ============
export async function recommendTemplate(
  topic_title: string,
  topic_summary: string,
  templates: string[]
) {
  const res = await api.post("/idea/recommend-template", { topic_title, topic_summary, templates });
  return res.data as { template: string; reason: string };
}

// ============ Narrative Template ============
export async function generateNarrativeTemplate(userInput: string) {
  const res = await api.post("/idea/narrative-template", { user_input: userInput });
  return res.data;
}

export interface SavedNarrativeTemplate {
  id: string;
  user_id: string;
  name: string;
  tone: string;
  beats: { id: string; purpose: string; instruction: string }[];
  source: "custom" | "ai_generated";
  prompt: string | null;
  created_at: string;
  updated_at: string;
}

export async function listNarrativeTemplates() {
  const res = await api.get("/template/narrative");
  return res.data as { templates: SavedNarrativeTemplate[] };
}

export async function createNarrativeTemplate(data: {
  name: string;
  tone: string;
  beats: { id: string; purpose: string; instruction: string }[];
  source?: "custom" | "ai_generated";
  prompt?: string | null;
  overwrite?: boolean;
}) {
  const res = await api.post("/template/narrative", data);
  return res.data as SavedNarrativeTemplate;
}

export async function updateNarrativeTemplate(
  templateId: string,
  data: {
    name?: string;
    tone?: string;
    beats?: { id: string; purpose: string; instruction: string }[];
    prompt?: string | null;
  }
) {
  const res = await api.patch(`/template/narrative/${templateId}`, data);
  return res.data as SavedNarrativeTemplate;
}

export async function deleteNarrativeTemplate(templateId: string) {
  const res = await api.delete(`/template/narrative/${templateId}`);
  return res.data as { deleted: boolean; id: string };
}

// ============ Social Post ============
export async function generateSocialPostTemplate(input: string) {
  const res = await api.post("/template/social-generate", { input });
  return res.data as SocialPostTemplate;
}

export async function generateSocialIdea(params: {
  topic_title: string;
  topic_summary: string;
  sources: string[];
  narrative_template?: string;
  social_template?: SocialPostTemplate;
}) {
  const res = await api.post("/social/idea", params);
  return res.data;
}

export async function generateSocialContent(params: {
  topic_title: string;
  topic_summary: string;
  idea: object;
  user_opinion?: string;
  config: {
    num_images: number;
    text_length: string;
    style: string;
    platforms: string[];
  };
}) {
  const res = await api.post("/social/generate", params);
  return res.data;
}

export async function refineSocialContent(params: {
  platform: string;
  current_text: string;
  feedback: string;
}) {
  const res = await api.post("/social/refine", params);
  return res.data;
}

export async function generateSocialImage(prompt: string, aspect_ratio: string) {
  const res = await api.post("/social/image", { prompt, aspect_ratio });
  return res.data;
}

// ============ Profile ============
export async function getProfile() {
  const res = await api.get("/profile");
  return res.data;
}

export async function updateProfile(data: Record<string, unknown>) {
  const res = await api.put("/profile", data);
  return res.data;
}


// ============ Credits ============
export async function getCredits() {
  const res = await api.get("/credits");
  return res.data;
}

export async function getCreditTransactions(limit = 20) {
  const res = await api.get("/credits/transactions", { params: { limit } });
  return res.data;
}

export async function purchaseCredits(amount: number) {
  const res = await api.post("/credits/purchase", { amount, payment_method: "mock" });
  return res.data;
}


// ============ Voice Clones (ElevenLabs) ============
export interface VoiceClone {
  id: string;
  user_id: string;
  elevenlabs_voice_id: string;
  name: string;
  sample_filename: string | null;
  sample_duration_sec: number | null;
  created_at: string;
}

export async function listVoiceClones() {
  const res = await api.get("/voice");
  return res.data as { voices: VoiceClone[] };
}

export async function cloneVoice(name: string, file: File) {
  const form = new FormData();
  form.append("name", name);
  form.append("file", file);
  const res = await api.post("/voice/clone", form, {
    timeout: 120_000, // ElevenLabs IVC takes 5-30s
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data as VoiceClone;
}

export async function deleteVoiceClone(cloneId: string) {
  const res = await api.delete(`/voice/${cloneId}`);
  return res.data as { deleted: boolean; id: string };
}


// ============ Knowledge Base ============
export async function getKnowledgeItems(limit = 50, offset = 0) {
  const res = await api.get("/knowledge", { params: { limit, offset } });
  return res.data;
}

export async function addKnowledgeItem(data: {
  title: string;
  content: string;
  source_type?: string;
  source_url?: string;
}) {
  const res = await api.post("/knowledge", data);
  return res.data;
}

export async function addKnowledgeFromUrl(title: string, url: string) {
  const res = await api.post("/knowledge/add-url", { title, url }, { timeout: 60_000 });
  return res.data;
}

export async function addKnowledgeFromFile(title: string, file: File) {
  const form = new FormData();
  form.append("title", title);
  form.append("file", file);
  const res = await api.post("/knowledge/upload-file", form, {
    timeout: 120_000,
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function updateKnowledgeItem(itemId: string, data: { title?: string; content?: string }) {
  const res = await api.put(`/knowledge/${itemId}`, data);
  return res.data;
}

export async function deleteKnowledgeItem(itemId: string) {
  const res = await api.delete(`/knowledge/${itemId}`);
  return res.data;
}

export async function searchKnowledge(query: string, match_count = 5) {
  const res = await api.post("/knowledge/search", { query, match_count });
  return res.data;
}
