import axios from "axios";
import { supabase } from "../lib/supabase";

const API = axios.create({ baseURL: "http://localhost:8000/api", timeout: 120000 });
export const BACKEND = "http://localhost:8000";

// Automatically attach auth token to requests
API.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// ============ Topics ============
export async function fetchTopics() {
  const res = await API.get("/topics");
  return res.data;
}

export async function searchTopic(query: string) {
  const res = await API.post("/topics/search", { query });
  return res.data;
}

// ============ Video Pipeline ============
export async function generateIdea(
  topic_title: string,
  topic_summary: string,
  sources: string[]
) {
  const res = await API.post("/idea/generate", { topic_title, topic_summary, sources });
  return res.data;
}

export async function refineOpinion(
  topic_title: string,
  topic_summary: string,
  idea: object,
  user_opinion: string
) {
  const res = await API.post("/opinion/refine", { topic_title, topic_summary, idea, user_opinion });
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
}) {
  const res = await API.post("/scenes/generate", params);
  return res.data;
}

export async function generateImage(prompt: string, aspect_ratio: string) {
  const res = await API.post("/image/generate", { prompt, aspect_ratio });
  return res.data;
}

export async function generateAudio(text: string, voice: string) {
  const res = await API.post("/audio/generate", { text, voice });
  return res.data;
}

export async function generateVideo(
  scenes: { image_path: string; audio_path: string; narration: string }[],
  aspect_ratio: string
) {
  const res = await API.post("/video/generate", { scenes, aspect_ratio });
  return res.data;
}

export async function generateTitles(params: {
  topic_title: string;
  topic_summary: string;
  idea: object;
  narrative_template: string;
}) {
  const res = await API.post("/metadata/title", params);
  return res.data;
}

export async function generateDescription(params: {
  topic_title: string;
  topic_summary: string;
  idea: object;
  narration_texts: string[];
}) {
  const res = await API.post("/metadata/description", params);
  return res.data;
}

export async function generateThumbnail(prompt: string, aspect_ratio: string) {
  const res = await API.post("/metadata/thumbnail", { prompt, aspect_ratio });
  return res.data;
}

// ============ Social Post ============
export async function generateSocialIdea(params: {
  topic_title: string;
  topic_summary: string;
  sources: string[];
}) {
  const res = await API.post("/social/idea", params);
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
  const res = await API.post("/social/generate", params);
  return res.data;
}

export async function refineSocialContent(params: {
  platform: string;
  current_text: string;
  feedback: string;
}) {
  const res = await API.post("/social/refine", params);
  return res.data;
}

export async function generateSocialImage(prompt: string, aspect_ratio: string) {
  const res = await API.post("/social/image", { prompt, aspect_ratio });
  return res.data;
}

// ============ Profile ============
export async function getProfile() {
  const res = await API.get("/profile");
  return res.data;
}

export async function updateProfile(data: Record<string, unknown>) {
  const res = await API.put("/profile", data);
  return res.data;
}

export async function getProfileStyles() {
  const res = await API.get("/profile/styles");
  return res.data;
}

// ============ Credits ============
export async function getCredits() {
  const res = await API.get("/credits");
  return res.data;
}

export async function getCreditTransactions(limit = 20) {
  const res = await API.get("/credits/transactions", { params: { limit } });
  return res.data;
}

export async function purchaseCredits(amount: number) {
  const res = await API.post("/credits/purchase", { amount, payment_method: "mock" });
  return res.data;
}

// ============ History ============
export async function getHistory(params?: { content_type?: string; limit?: number; offset?: number }) {
  const res = await API.get("/history", { params });
  return res.data;
}

export async function createHistoryRecord(data: Record<string, unknown>) {
  const res = await API.post("/history", data);
  return res.data;
}

// ============ Knowledge Base ============
export async function getKnowledgeItems(limit = 50, offset = 0) {
  const res = await API.get("/knowledge", { params: { limit, offset } });
  return res.data;
}

export async function addKnowledgeItem(data: {
  title: string;
  content: string;
  source_type?: string;
  source_url?: string;
}) {
  const res = await API.post("/knowledge", data);
  return res.data;
}

export async function deleteKnowledgeItem(itemId: string) {
  const res = await API.delete(`/knowledge/${itemId}`);
  return res.data;
}

export async function searchKnowledge(query: string, match_count = 5) {
  const res = await API.post("/knowledge/search", { query, match_count });
  return res.data;
}
