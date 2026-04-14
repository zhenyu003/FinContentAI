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


def _normalize_narrative_template(data: dict, user_input: str) -> dict:
    """Ensure required keys and beat shape; fill gaps from user_input."""
    name = str(data.get("name") or "Untitled template").strip() or "Untitled template"
    tone = str(data.get("tone") or "professional").strip() or "professional"
    tags = data.get("style_tags")
    if not isinstance(tags, list):
        tags = []
    style_tags = [str(t).strip() for t in tags if str(t).strip()][:12]
    if not style_tags:
        style_tags = ["financial", "story-driven"]

    beats_raw = data.get("beats")
    beats = []
    if isinstance(beats_raw, list):
        for i, b in enumerate(beats_raw):
            if not isinstance(b, dict):
                continue
            bid = str(b.get("id") or str(i + 1)).strip() or str(i + 1)
            purpose = str(b.get("purpose") or f"Beat {i + 1}").strip() or f"Beat {i + 1}"
            instruction = str(b.get("instruction") or purpose).strip() or purpose
            beats.append({"id": bid, "purpose": purpose, "instruction": instruction})

    if not beats:
        snippet = (user_input or "the topic").strip()[:120]
        beats = [
            {
                "id": "1",
                "purpose": "Hook",
                "instruction": f"Open with tension or a question grounded in: {snippet}",
            },
            {
                "id": "2",
                "purpose": "Context",
                "instruction": "Establish what the audience needs to know before the payoff.",
            },
            {
                "id": "3",
                "purpose": "Insight",
                "instruction": "Deliver the core insight the viewer should remember.",
            },
            {
                "id": "4",
                "purpose": "CTA",
                "instruction": "Close with a clear next step or reflection prompt.",
            },
        ]
    return {"name": name, "tone": tone, "style_tags": style_tags, "beats": beats}


def _fallback_narrative_template(user_input: str) -> dict:
    return _normalize_narrative_template({}, user_input)


def generate_narrative_template(user_input: str) -> dict:
    """Generate a structured narrative template from natural-language intent."""
    system_prompt = """You are a narrative architect for financial and business video content.
Generate a structured storytelling template based on the user's description.
Always respond with valid JSON only — no markdown fences, no other text."""

    user_prompt = f"""User's storytelling intent:
{user_input.strip()}

Output JSON with exactly this shape:
{{
  "name": "Short memorable template name",
  "tone": "e.g. urgent, analytical, conversational",
  "style_tags": ["tag1", "tag2"],
  "beats": [
    {{ "id": "1", "purpose": "Hook — introduce conflict", "instruction": "What to cover in this beat" }}
  ]
}}

Use 4–8 beats in order. Each beat needs id (string), purpose (short label + dash + one line), and instruction (concrete guidance for the writer)."""

    try:
        response_text = _call_llm(system_prompt, user_prompt)
        parsed = _parse_json_response(response_text)
        if not isinstance(parsed, dict):
            raise ValueError("Expected object")
        return _normalize_narrative_template(parsed, user_input)
    except Exception:
        return _fallback_narrative_template(user_input)


def generate_idea(
    topic_title: str,
    topic_summary: str,
    sources: list[str],
    narrative_template: str | None = None,
) -> dict:
    """Generate a content idea with narrative template recommendation."""
    system_prompt = """You are an expert financial content strategist for YouTube.
You specialize in creating viral financial video concepts.
Always respond with valid JSON only, no other text."""

    sources_text = "\n".join(sources) if sources else "No sources provided"

    template_instruction = ""
    if narrative_template:
        template_instruction = (
            f'\nIMPORTANT: The user has chosen the "{narrative_template}" narrative template. '
            f"You MUST use this template and tailor the core argument, angle, and hook to fit "
            f'the "{narrative_template}" style. Set narrative_template to exactly "{narrative_template}".\n'
        )

    user_prompt = f"""Given this financial topic:
Title: {topic_title}
Summary: {topic_summary}
Sources: {sources_text}
{template_instruction}
Generate a compelling content idea for a YouTube financial video. The 5 possible narrative templates are:
1. Counterintuitive - Challenges common wisdom with surprising data
2. Anxiety-Driven - Addresses financial fears with actionable solutions
3. Company Breakdown - Deep dive into a company's strategy, financials, or pivot
4. Trend Forecast - Predicts where a market or industry is heading
5. Data Reveal - Uses surprising data or statistics to tell a story

Return JSON with this exact format:
{{
  "narrative_template": "{narrative_template or "one of the 5 template names"}",
  "template_reason": "Brief explanation of why this template fits best",
  "core_argument": "The central thesis of the video in 1-2 sentences",
  "angle": "The unique perspective or hook that differentiates this from other coverage",
  "hook": "An attention-grabbing opening line for the video"
}}"""

    response_text = _call_llm(system_prompt, user_prompt)
    return _parse_json_response(response_text)


def refine_opinion(topic_title: str, topic_summary: str, idea: dict, user_opinion: str) -> dict:
    """Generate targeted questions to sharpen user's judgment on the topic."""
    system_prompt = """You are an expert financial content strategist helping a creator sharpen their opinion.
Generate probing questions that help the creator develop a stronger, more nuanced take.
Always respond with valid JSON only, no other text."""

    user_prompt = f"""Topic: {topic_title}
Summary: {topic_summary}
Content Idea: {json.dumps(idea)}
Creator's Initial Opinion: {user_opinion}

Generate 2-3 targeted questions that will help the creator sharpen their judgment and develop a stronger take on this topic. The questions should:
- Challenge assumptions in their initial opinion
- Push them to consider angles they might have missed
- Help them articulate their unique perspective more clearly

Return JSON with this exact format:
{{
  "questions": [
    {{
      "question": "The question text",
      "purpose": "Why this question helps sharpen their take"
    }}
  ]
}}"""

    response_text = _call_llm(system_prompt, user_prompt)
    return _parse_json_response(response_text)


def generate_scenes(
    topic_title: str,
    topic_summary: str,
    idea: dict,
    user_opinion: str,
    qa_answers: list,
    duration: str,
    narrative_template: str,
) -> dict:
    """Generate scene breakdown for the video."""
    system_prompt = """You are an expert financial video scriptwriter.
You create detailed scene breakdowns with image prompts and narration text.
Always respond with valid JSON only, no other text."""

    duration_map = {
        "3min": {"scenes": "6-8", "words": "~450"},
        "5min": {"scenes": "10-12", "words": "~750"},
        "8min": {"scenes": "16-18", "words": "~1200"},
    }
    duration_config = duration_map.get(duration, duration_map["5min"])

    qa_text = ""
    if qa_answers:
        for i, qa in enumerate(qa_answers):
            if isinstance(qa, dict):
                qa_text += f"Q: {qa.get('question', '')}\nA: {qa.get('answer', '')}\n\n"
            elif isinstance(qa, str) and qa.strip():
                qa_text += f"Answer {i+1}: {qa}\n\n"

    structure_note = ""
    if isinstance(idea, dict) and idea.get("narrative_structure"):
        structure_note = (
            "\nThe idea includes narrative_structure with ordered beats — follow that spine for "
            "scene order, emphasis, and pacing (you may merge beats into one scene when needed).\n"
        )

    user_prompt = f"""Create a scene-by-scene breakdown for a financial YouTube video.

Topic: {topic_title}
Summary: {topic_summary}
Content Idea: {json.dumps(idea)}
Narrative Template: {narrative_template}
{structure_note}
Creator's Opinion: {user_opinion}
Q&A Refinement:
{qa_text}

Target Duration: {duration}
Number of Scenes: {duration_config['scenes']}
Target Word Count for all narration combined: {duration_config['words']} words

For each scene, provide:
- scene_number: sequential number
- scene_type: "image" (always use "image" for now)
- description: A detailed image prompt in English that describes the visual for this scene. This will be used to generate an AI image, so be specific about composition, style, and mood.
- narration: The voiceover text for this scene. Should be conversational and engaging.

Return JSON with this exact format:
{{
  "scenes": [
    {{
      "scene_number": 1,
      "scene_type": "image",
      "description": "Detailed image prompt in English",
      "narration": "Voiceover narration text"
    }}
  ]
}}"""

    response_text = _call_llm(system_prompt, user_prompt)
    return _parse_json_response(response_text)


def generate_titles(
    topic_title: str,
    topic_summary: str,
    idea: dict,
    narrative_template: str,
) -> dict:
    """Generate YouTube title candidates."""
    system_prompt = """You are a YouTube title optimization expert specializing in financial content.
You create clickable, accurate titles that drive views while maintaining credibility.
Always respond with valid JSON only, no other text."""

    user_prompt = f"""Generate 3 compelling YouTube title candidates for this financial video:

Topic: {topic_title}
Summary: {topic_summary}
Content Idea: {json.dumps(idea)}
Narrative Template: {narrative_template}

The titles should:
- Be under 60 characters when possible
- Use proven YouTube title patterns (numbers, questions, strong verbs)
- Be accurate and not misleading
- Match the tone of the narrative template

Return JSON with this exact format:
{{
  "titles": [
    {{
      "title": "The YouTube title",
      "rationale": "Brief explanation of why this title works"
    }}
  ]
}}"""

    response_text = _call_llm(system_prompt, user_prompt)
    return _parse_json_response(response_text)


def generate_description(
    topic_title: str,
    topic_summary: str,
    idea: dict,
    narration_texts: list[str],
) -> dict:
    """Generate YouTube video description."""
    system_prompt = """You are a YouTube SEO and description expert for financial content.
You create descriptions that are informative, well-structured, and optimized for search.
Always respond with valid JSON only, no other text."""

    narration_combined = "\n".join(narration_texts)

    user_prompt = f"""Generate a YouTube description for this financial video:

Topic: {topic_title}
Summary: {topic_summary}
Content Idea: {json.dumps(idea)}
Full Narration:
{narration_combined}

The description should include:
- A compelling summary paragraph (2-3 sentences)
- Key data points or takeaways mentioned in the video (bullet points)
- Relevant hashtags for discoverability

Return JSON with this exact format:
{{
  "summary": "2-3 sentence summary paragraph",
  "key_points": ["data point 1", "data point 2", "data point 3"],
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"],
  "full_description": "The complete formatted YouTube description ready to paste"
}}"""

    response_text = _call_llm(system_prompt, user_prompt)
    return _parse_json_response(response_text)
