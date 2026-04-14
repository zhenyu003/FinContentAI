import { api } from "../api/client";
import type { NarrativeStructure } from "../types";

/**
 * Calls the narrative-template API (LLM returns JSON; server normalizes / fallbacks).
 */
export async function generateNarrativeTemplate(
  userInput: string
): Promise<NarrativeStructure> {
  const trimmed = userInput.trim();
  if (!trimmed) {
    throw new Error("Describe how you want to tell the story first.");
  }
  const res = await api.post("/idea/narrative-template", {
    user_input: trimmed,
  });
  return res.data as NarrativeStructure;
}
