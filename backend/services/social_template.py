"""LLM-generated structured templates for social posts (single-post narrative)."""

from services.utils import call_llm, parse_json_response


def _normalize_template(data: dict, user_input: str) -> dict:
    name = str(data.get("name") or "Custom social template").strip() or "Custom social template"
    tone = str(data.get("tone") or "professional").strip() or "professional"
    platform_style = str(data.get("platform_style") or "general").strip() or "general"

    raw = data.get("structure")
    structure: list[dict] = []
    if isinstance(raw, list):
        for i, row in enumerate(raw):
            if not isinstance(row, dict):
                continue
            section = str(row.get("section") or f"Section {i + 1}").strip()
            purpose = str(row.get("purpose") or "").strip() or section
            instruction = str(row.get("instruction") or purpose).strip()
            structure.append(
                {"section": section, "purpose": purpose, "instruction": instruction}
            )

    snippet = (user_input or "").strip()[:240]
    if not structure:
        structure = [
            {
                "section": "Hook",
                "purpose": "Stop the scroll",
                "instruction": f"Open with tension or curiosity tied to: {snippet or 'the topic'}",
            },
            {
                "section": "Conflict",
                "purpose": "Frame the tension",
                "instruction": "State what is at stake or what most people misunderstand.",
            },
            {
                "section": "Insight",
                "purpose": "Deliver the payoff",
                "instruction": "Share the clearest takeaway or reframe for the reader.",
            },
            {
                "section": "CTA",
                "purpose": "Drive engagement",
                "instruction": "Invite a comment, save, follow, or next step—platform appropriate.",
            },
        ]

    return {
        "name": name,
        "structure": structure,
        "tone": tone,
        "platform_style": platform_style,
    }


def generate_social_post_template(user_input: str) -> dict:
    """Return name, structure[], tone, platform_style as JSON dict."""
    text = (user_input or "").strip()
    if not text:
        raise ValueError("input is required")

    system_prompt = """You are a social media content strategist.
Convert the user's description into a structured social post template for ONE cohesive post (not a multi-scene video).
Always respond with valid JSON only — no markdown fences, no other text."""

    user_prompt = f"""Convert this into a structured social post template.

Output JSON with exactly these keys:
- name: short memorable template name
- structure: array of 4–7 objects, each with:
  - section: short label (e.g. Hook, Context, Conflict, Insight, CTA)
  - purpose: one line why this block exists
  - instruction: concrete guidance for writing that block
- tone: e.g. authoritative, warm, provocative, educational
- platform_style: one of: linkedin, twitter, instagram, general

Focus on engagement, clarity, and strong hooks. Sections should flow as a single narrative arc.

User input:
{text}"""

    try:
        raw = parse_json_response(call_llm(system_prompt, user_prompt))
        if not isinstance(raw, dict):
            raise ValueError("Expected JSON object")
        return _normalize_template(raw, text)
    except Exception:
        return _normalize_template({}, text)
