import os
import json
import re
import time
from google import genai
from google.genai import types


def _get_client():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")
    return genai.Client(api_key=api_key)


MODEL = "gemini-2.5-flash"


def _parse_json_response(text: str):
    """Parse JSON from LLM response, stripping markdown code fences if present."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", cleaned)
    cleaned = re.sub(r"\n?```\s*$", "", cleaned)
    return json.loads(cleaned)


def _call_llm(system_prompt: str, user_prompt: str, max_retries: int = 3) -> str:
    """Make a call to Gemini with automatic retry on transient errors."""
    client = _get_client()
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.7,
                ),
            )
            return response.text
        except Exception as e:
            err_str = str(e)
            is_transient = any(code in err_str for code in ["503", "429", "UNAVAILABLE", "RESOURCE_EXHAUSTED"])
            if is_transient and attempt < max_retries - 1:
                time.sleep(2 ** attempt)
                continue
            raise


def _build_context_block(profile_context: str, knowledge_context: str) -> str:
    """Build an additional context section for system prompts."""
    parts = []
    if profile_context:
        parts.append(f"USER STYLE & PROFILE:\n{profile_context}")
    if knowledge_context:
        parts.append(f"USER KNOWLEDGE BASE:\n{knowledge_context}")
    if not parts:
        return ""
    return "\n\n" + "\n\n".join(parts) + "\n"


def generate_social_idea(
    topic_title: str,
    topic_summary: str,
    sources: list[str],
    profile_context: str = "",
    knowledge_context: str = "",
    narrative_template: str | None = None,
    social_template: dict | None = None,
) -> dict:
    """Generate a content idea optimized for social media posts."""
    context_block = _build_context_block(profile_context, knowledge_context)

    system_prompt = f"""You are an expert financial social media content strategist.
You specialize in creating engaging social media posts about finance and markets.
Always respond with valid JSON only, no other text.{context_block}"""

    sources_text = "\n".join(sources) if sources else "No sources provided"

    template_instruction = ""
    narrative_name_hint = narrative_template
    if social_template and isinstance(social_template, dict):
        tpl_name = str(social_template.get("name") or "Custom").strip()
        narrative_name_hint = narrative_name_hint or tpl_name
        template_instruction = f"""
IMPORTANT: The user defined a CUSTOM SOCIAL POST TEMPLATE (single post — not a video script).
You MUST shape core_argument, angle, hook, and template_reason to follow this arc and tone.

Custom template (JSON):
{json.dumps(social_template, ensure_ascii=False)}

Rules:
- Set narrative_template to exactly: "{tpl_name}"
- template_reason should reference the template's tone and platform_style.
- core_argument, angle, and hook must align with the structure sections in order (hook-style opening through CTA intent).
- suggested_platforms should prefer platforms implied by platform_style when possible (linkedin / instagram / x lowercase).
"""
    elif narrative_template:
        narrative_name_hint = narrative_name_hint or narrative_template
        template_instruction = (
            f'\nIMPORTANT: The user has chosen the "{narrative_template}" narrative template. '
            f"You MUST use this template and tailor the core argument, angle, and hook to fit "
            f'the "{narrative_template}" style. Set narrative_template to exactly "{narrative_template}".'
        )

    if not narrative_name_hint:
        narrative_name_hint = "A short name for the content approach"

    user_prompt = f"""Given this financial topic:
Title: {topic_title}
Summary: {topic_summary}
Sources: {sources_text}
{template_instruction}
Generate a compelling content idea for social media posts about this topic. The idea should work across LinkedIn, Instagram, and X (Twitter).

Return JSON with this exact format:
{{
  "narrative_template": "{narrative_name_hint}",
  "template_reason": "1 sentence explaining why this template fits the topic",
  "core_argument": "The central thesis in 1-2 sentences",
  "angle": "The unique perspective or hook that differentiates this from other coverage",
  "hook": "An attention-grabbing opening line for the post",
  "suggested_platforms": ["linkedin", "instagram", "x"]
}}"""

    response_text = _call_llm(system_prompt, user_prompt)
    return _parse_json_response(response_text)


def generate_social_content(
    topic_title: str,
    topic_summary: str,
    idea: dict,
    user_opinion: str = "",
    config: dict | None = None,
    profile_context: str = "",
    knowledge_context: str = "",
) -> dict:
    """Generate platform-specific social media content with image prompts."""
    if config is None:
        config = {}

    num_images = max(1, min(10, config.get("num_images", 1)))
    text_length = config.get("text_length", "medium")
    style = config.get("style", "professional")
    platforms = config.get("platforms", ["linkedin", "instagram", "x"])

    context_block = _build_context_block(profile_context, knowledge_context)

    system_prompt = f"""You are an expert financial social media content creator.
You write high-performing social media posts about finance and markets.
You adapt your writing perfectly for each platform's audience and format.
Always respond with valid JSON only, no other text.{context_block}"""

    length_guide = {
        "short": {
            "linkedin": "300-500 words",
            "instagram": "100-200 words",
            "x": "under 200 characters",
        },
        "medium": {
            "linkedin": "500-1000 words",
            "instagram": "200-400 words",
            "x": "under 280 characters",
        },
        "long": {
            "linkedin": "1000-1500 words",
            "instagram": "400-500 words",
            "x": "under 280 characters",
        },
    }
    lengths = length_guide.get(text_length, length_guide["medium"])

    platform_instructions = []
    for p in platforms:
        length = lengths.get(p, "appropriate length")
        if p == "linkedin":
            platform_instructions.append(
                f'- LinkedIn: Professional, long-form post ({length}). Use line breaks for readability. Include a strong hook and call-to-action.'
            )
        elif p == "instagram":
            platform_instructions.append(
                f'- Instagram: Engaging caption ({length}). Visual storytelling tone. Use emojis sparingly. End with a question or CTA.'
            )
        elif p == "x":
            platform_instructions.append(
                f'- X (Twitter): Concise and punchy ({length}). Must fit character limit. Make it shareable and quotable.'
            )

    platform_json_examples = []
    for p in platforms:
        platform_json_examples.append(f'    "{p}": {{"text": "...", "hashtags": ["..."]}}')

    opinion_section = f"\nCreator's Opinion: {user_opinion}" if user_opinion else ""

    template_extra = ""
    st = idea.get("social_post_template") if isinstance(idea, dict) else None
    if st:
        template_extra = (
            "\nThe creator used a CUSTOM SOCIAL POST TEMPLATE — keep the same narrative arc, "
            "tone, and platform emphasis when writing each platform's post:\n"
            f"{json.dumps(st, ensure_ascii=False)}\n"
        )

    user_prompt = f"""Create social media content for this financial topic:

Topic: {topic_title}
Summary: {topic_summary}
Content Idea: {json.dumps(idea)}
Style: {style}{opinion_section}{template_extra}

Platform requirements:
{chr(10).join(platform_instructions)}

Also generate {num_images} image prompt(s) for visuals to accompany the posts. Each image prompt should be detailed enough for AI image generation, describing composition, style, mood, and relevant financial imagery. Do NOT include any text, letters, numbers, words, or typography in the image prompts - images should be purely visual without any written content.

Return JSON with this exact format:
{{
  "platforms": {{
{chr(10).join(platform_json_examples)}
  }},
  "image_prompts": [
    {{"index": 1, "prompt": "detailed image generation prompt", "description": "what this image shows"}}
  ]
}}"""

    response_text = _call_llm(system_prompt, user_prompt)
    return _parse_json_response(response_text)


def refine_social_content(platform: str, current_text: str, feedback: str) -> dict:
    """Refine a specific platform's text based on user feedback."""
    system_prompt = """You are an expert financial social media content editor.
You refine and improve social media posts based on feedback while maintaining platform best practices.
Always respond with valid JSON only, no other text."""

    platform_context = {
        "linkedin": "LinkedIn (professional, long-form, line breaks for readability)",
        "instagram": "Instagram (engaging caption, visual storytelling, emojis OK)",
        "x": "X/Twitter (under 280 characters, punchy, shareable)",
    }
    platform_desc = platform_context.get(platform, platform)

    user_prompt = f"""Refine this social media post based on the feedback provided.

Platform: {platform_desc}
Current Text:
{current_text}

Feedback: {feedback}

Apply the feedback while keeping the post optimized for {platform}. If the platform is X/Twitter, ensure the text stays under 280 characters.

Return JSON with this exact format:
{{
  "text": "the refined post text",
  "hashtags": ["relevant", "hashtags"]
}}"""

    response_text = _call_llm(system_prompt, user_prompt)
    return _parse_json_response(response_text)
