import axios from "axios";

const API = axios.create({ baseURL: "http://localhost:8000/api", timeout: 120000 });
export const BACKEND = "http://localhost:8000";

export async function fetchTopics() {
  const res = await API.get("/topics");
  return res.data;
}

export async function searchTopic(query: string) {
  const res = await API.post("/topics/search", { query });
  return res.data;
}

export async function generateIdea(
  topic_title: string,
  topic_summary: string,
  sources: string[]
) {
  const res = await API.post("/idea/generate", {
    topic_title,
    topic_summary,
    sources,
  });
  return res.data;
}

export async function refineOpinion(
  topic_title: string,
  topic_summary: string,
  idea: object,
  user_opinion: string
) {
  const res = await API.post("/opinion/refine", {
    topic_title,
    topic_summary,
    idea,
    user_opinion,
  });
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

export async function generateThumbnail(
  prompt: string,
  aspect_ratio: string
) {
  const res = await API.post("/metadata/thumbnail", { prompt, aspect_ratio });
  return res.data;
}
