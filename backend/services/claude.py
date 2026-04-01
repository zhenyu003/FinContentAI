import os
import json
import re
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


def _call_llm(system_prompt: str, user_prompt: str) -> str:
    """Make a call to Gemini and return the text response."""
    client = _get_client()
    response = client.models.generate_content(
        model=MODEL,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.7,
        ),
    )
    return response.text


def generate_idea(topic_title: str, topic_summary: str, sources: list[str]) -> dict:
    """Generate a content idea with narrative template recommendation."""
    system_prompt = """You are an expert financial content strategist for YouTube.
You specialize in creating viral financial video concepts.
Always respond with valid JSON only, no other text."""

    sources_text = "\n".join(sources) if sources else "No sources provided"

    user_prompt = f"""Given this financial topic:
Title: {topic_title}
Summary: {topic_summary}
Sources: {sources_text}

Generate a compelling content idea for a YouTube financial video. Choose the most fitting narrative template from these 5 options:
1. Counterintuitive - Challenges common wisdom with surprising data
2. Anxiety-Driven - Addresses financial fears with actionable solutions
3. Company Breakdown - Deep dive into a company's strategy, financials, or pivot
4. Trend Forecast - Predicts where a market or industry is heading
5. Data Reveal - Uses surprising data or statistics to tell a story

Return JSON with this exact format:
{{
  "narrative_template": "one of the 5 template names",
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

    user_prompt = f"""Create a scene-by-scene breakdown for a financial YouTube video.

Topic: {topic_title}
Summary: {topic_summary}
Content Idea: {json.dumps(idea)}
Narrative Template: {narrative_template}
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
