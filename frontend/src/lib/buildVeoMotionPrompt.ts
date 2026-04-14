/**
 * Builds the same Veo prompt shape as `backend/services/veo.build_veo_prompt`
 * (for previews, logging, or sending as `prompt` to the API).
 */
export function buildVeoMotionPrompt(description: string, narration: string): string {
  const d = description.trim();
  const n = narration.trim();
  return [
    "Create a short 5-second cinematic video.",
    "Requirements: one clear subject, a strong opening frame, smooth camera motion, high production value, no subtitles, no on-screen text, no captions.",
    "",
    "Visual / setting (primary):",
    d || "(no visual description)",
    "",
    "Mood and story context from narration (do not render spoken words as text on screen):",
    n || "(no narration context)",
  ].join("\n");
}
