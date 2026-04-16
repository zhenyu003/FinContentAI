import json
from math import floor

from services.utils import call_llm, parse_json_response


def recommend_template(topic_title: str, topic_summary: str, templates: list[str]) -> dict:
    """Pick the single best narrative template for a topic. Returns {template, reason}."""
    system = "You are a content-strategy expert. Given a financial topic, pick the ONE best narrative template from the list. Reply with JSON only: {\"template\": \"<exact name>\", \"reason\": \"<one sentence why>\"}"
    user = (
        f"Topic: {topic_title}\n"
        f"Summary: {topic_summary}\n\n"
        f"Available templates: {json.dumps(templates)}\n\n"
        "Pick the best one."
    )
    raw = call_llm(system, user, max_retries=2)
    result = parse_json_response(raw)
    # Validate the template name is in the list
    if result.get("template") not in templates:
        result["template"] = templates[0]
    return result


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
        response_text = call_llm(system_prompt, user_prompt)
        parsed = parse_json_response(response_text)
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
    knowledge_context: str = "",
) -> dict:
    """Generate a content idea with narrative template recommendation."""
    system_prompt = """You are an expert financial content strategist for YouTube.
You specialize in creating viral financial video concepts.
Always respond with valid JSON only, no other text."""

    sources_text = "\n".join(sources) if sources else "No sources provided"

    knowledge_note = ""
    if knowledge_context:
        knowledge_note = f"\nCreator's Knowledge Base (use relevant facts/data if applicable):\n{knowledge_context}\n"

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
{knowledge_note}{template_instruction}
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

    response_text = call_llm(system_prompt, user_prompt)
    return parse_json_response(response_text)


def refine_opinion(topic_title: str, topic_summary: str, idea: dict, user_opinion: str) -> dict:
    """Generate targeted questions with suggested answers to sharpen user's judgment."""

    # Step 1: generate short punchy questions
    q_system = "You are an expert financial content strategist. Return valid JSON only."
    q_prompt = f"""Topic: {topic_title}
Summary: {topic_summary}
Content Idea: {json.dumps(idea)}
Creator's Opinion: {user_opinion}

Generate exactly 3 follow-up questions to sharpen this creator's take.
Each question: one punchy sentence, under 15 words, direct and confrontational.

Return: {{"questions": ["question1", "question2", "question3"]}}"""

    q_text = call_llm(q_system, q_prompt)
    q_data = parse_json_response(q_text)
    questions = q_data.get("questions", [])[:3]

    # Step 2: generate 2-3 suggested answers per question
    numbered = "\n".join(f"Q{i+1}: {q}" for i, q in enumerate(questions))
    s_system = "You are an expert financial content strategist. Return valid JSON only, no markdown."
    s_prompt = f"""Topic: {topic_title}
Creator's Opinion: {user_opinion}

For each numbered question, generate 2-3 suggested answers.
Each answer: ONE sentence only, max 20 words. Be opinionated, concrete, punchy. No hedging.

{numbered}

Return a JSON object where keys are "Q1", "Q2", "Q3" and values are arrays of answer strings.
Example: {{"Q1": ["answer a", "answer b", "answer c"], "Q2": ["answer a", "answer b"], "Q3": ["answer a", "answer b", "answer c"]}}"""

    try:
        s_text = call_llm(s_system, s_prompt)
        s_data = parse_json_response(s_text)
        all_suggestions = [s_data.get(f"Q{i+1}", []) for i in range(len(questions))]
    except Exception:
        all_suggestions = [[] for _ in questions]

    # Combine into final format
    result = {"questions": []}
    for i, q in enumerate(questions):
        suggestions = all_suggestions[i] if i < len(all_suggestions) else []
        result["questions"].append({
            "question": q if isinstance(q, str) else str(q),
            "suggestions": suggestions if isinstance(suggestions, list) else [],
        })
    return result


def generate_scenes(
    topic_title: str,
    topic_summary: str,
    idea: dict,
    user_opinion: str,
    qa_answers: list,
    duration: str,
    narrative_template: str,
    knowledge_context: str = "",
) -> dict:
    """Generate scene breakdown for the video."""
    system_prompt = """You are an expert financial video scriptwriter.
You create detailed scene breakdowns with image prompts and narration text.
Always respond with valid JSON only, no other text."""

    # TTS speaks ~2 words/sec (≈120 WPM). Budget total words accordingly.
    duration_map = {
        "90s":  {"scenes": "3-4", "words": "~180",  "per_scene": "45-55", "secs": 90},
        "3min": {"scenes": "6-8", "words": "~360",  "per_scene": "45-55", "secs": 180},
        "5min": {"scenes": "10-12", "words": "~600", "per_scene": "50-60", "secs": 300},
        "8min": {"scenes": "16-18", "words": "~960", "per_scene": "50-60", "secs": 480},
    }
    duration_config = duration_map.get(duration, duration_map["5min"])

    qa_text = ""
    if qa_answers:
        for i, qa in enumerate(qa_answers):
            if isinstance(qa, dict):
                qa_text += f"Q: {qa.get('question', '')}\nA: {qa.get('answer', '')}\n\n"
            elif isinstance(qa, str) and qa.strip():
                qa_text += f"Answer {i+1}: {qa}\n\n"

    knowledge_note = ""
    if knowledge_context:
        knowledge_note = f"\nCreator's Knowledge Base (use relevant facts/data if applicable):\n{knowledge_context}\n"

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
{knowledge_note}
Target Duration: {duration} ({duration_config['secs']} seconds)
Number of Scenes: {duration_config['scenes']}
Total word budget for ALL narration combined: {duration_config['words']} words

Duration guidelines (TTS audio speed ≈ 2 words per second):
- Aim for {duration_config['per_scene']} words per scene narration.
- Total narration across all scenes should be close to {duration_config['words']} words so the video lands near {duration_config['secs']}s.
- Prefer punchy, concise sentences. Every word must earn its place.

For each scene, provide:
- scene_number: sequential number
- scene_type: "image" (always use "image" for now)
- description: A detailed image prompt in English that describes the visual for this scene. This will be used to generate an AI image, so be specific about composition, style, and mood.
- narration: The voiceover text for this scene (aim for {duration_config['per_scene']} words).

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

    response_text = call_llm(system_prompt, user_prompt)
    return parse_json_response(response_text)


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

    response_text = call_llm(system_prompt, user_prompt)
    return parse_json_response(response_text)


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

    response_text = call_llm(system_prompt, user_prompt)
    return parse_json_response(response_text)


def split_long_scene(
    scene_number: int,
    description: str,
    narration: str,
    audio_duration: float,
    max_chart_duration: float = 12.0,
) -> list[dict]:
    """Split a long scene into sub-scenes, keeping chart-relevant narration short.

    Returns a list of scene dicts with keys:
        scene_number, scene_type, description, narration, is_chart
    The sub-scene marked is_chart=True contains only the data-focused narration
    and should be ≤ max_chart_duration seconds.
    """
    system_prompt = (
        "You are a video scriptwriter. A scene's narration is too long for a chart visual. "
        "Split it into 2-3 shorter sub-scenes. Exactly ONE sub-scene should contain "
        "the data/chart-relevant narration (numbers, comparisons, statistics) — mark it "
        'is_chart: true. Other sub-scenes provide context and should use regular images.\n'
        "The chart sub-scene narration should be concise (under 30 words ideally) "
        "so it fits ~8-12 seconds of audio.\n"
        "Return valid JSON only — no markdown fences."
    )

    user_prompt = f"""Split this scene narration into 2-3 sub-scenes:

Original narration ({audio_duration:.1f}s):
"{narration}"

Scene description: {description}

Return a JSON array. Each object has:
  "description": image prompt for this sub-scene
  "narration": voiceover text for this sub-scene
  "is_chart": true for the ONE data-focused sub-scene, false for others

Example:
[
  {{"description": "...", "narration": "...", "is_chart": false}},
  {{"description": "...", "narration": "...", "is_chart": true}},
  {{"description": "...", "narration": "...", "is_chart": false}}
]"""

    try:
        raw = call_llm(system_prompt, user_prompt)
        parsed = parse_json_response(raw)
        if not isinstance(parsed, list) or len(parsed) < 2:
            raise ValueError("Expected array of 2+ sub-scenes")

        result = []
        for i, sub in enumerate(parsed):
            result.append({
                "scene_number": scene_number + i * 0.1,  # e.g. 3, 3.1, 3.2
                "scene_type": "image",
                "description": sub.get("description", description),
                "narration": sub.get("narration", ""),
                "is_chart": bool(sub.get("is_chart", False)),
            })
        return result
    except Exception:
        # Fallback: simple split in half
        words = narration.split()
        mid = len(words) // 2
        return [
            {
                "scene_number": scene_number,
                "scene_type": "image",
                "description": description,
                "narration": " ".join(words[:mid]),
                "is_chart": False,
            },
            {
                "scene_number": scene_number + 0.1,
                "scene_type": "image",
                "description": f"Data visualization: {description}",
                "narration": " ".join(words[mid:]),
                "is_chart": True,
            },
        ]


def split_scene_to_shots(
    scene_description: str,
    narration: str,
    audio_duration: float,
    aspect_ratio: str = "16:9",
) -> list[dict]:
    """Split a scene into multiple ~8-second shots for Veo video generation.

    Each shot gets a visual prompt generated by the LLM so the resulting clips
    form a coherent visual narrative arc.

    Returns a list of shot dicts with keys:
        shot_index, visual_prompt, start, end, freeze_tail
    """
    shot_duration = 8
    num_full = floor(audio_duration / shot_duration)
    remainder = audio_duration - (num_full * shot_duration)

    if remainder > 2:
        total_shots = num_full + 1
        has_freeze_tail = False
    else:
        total_shots = max(num_full, 1)
        has_freeze_tail = remainder > 0

    system_prompt = (
        "You are a cinematographer planning shots for an AI-generated video "
        "(Google Veo). Each shot is approximately 8 seconds of footage. "
        "You must output valid JSON only -- no markdown fences, no other text."
    )

    user_prompt = f"""Plan {total_shots} consecutive shots for this scene.

Scene description: {scene_description}
Narration: {narration}
Total audio duration: {audio_duration:.1f}s
Aspect ratio: {aspect_ratio}

Requirements:
- Each shot is ~8 seconds of AI-generated video via Veo.
- The shots must form a coherent visual narrative arc for this scene.
- Ensure continuity between shots: same setting, consistent lighting, progressive camera movement.
- Each visual prompt should describe: camera angle, camera movement, subject/action, mood/lighting.
- Prompts should be vivid and specific enough for an AI video model.

Return a JSON array of objects with exactly these keys:
  "shot_index" (integer starting at 1)
  "visual_prompt" (string - the detailed visual prompt for Veo)

Example format:
[
  {{"shot_index": 1, "visual_prompt": "Wide establishing shot, slow dolly forward..."}},
  {{"shot_index": 2, "visual_prompt": "Medium close-up, gentle pan right..."}}
]"""

    raw = call_llm(system_prompt, user_prompt)
    parsed = parse_json_response(raw)

    if not isinstance(parsed, list):
        raise ValueError("Expected JSON array of shot objects from LLM")

    shots = []
    for i in range(total_shots):
        if i < len(parsed):
            visual_prompt = parsed[i].get("visual_prompt", "")
        else:
            visual_prompt = f"Continuation of the scene: {scene_description}"

        start = i * shot_duration
        if i == total_shots - 1:
            end = audio_duration
            freeze_tail = has_freeze_tail
        else:
            end = (i + 1) * shot_duration
            freeze_tail = False

        shots.append({
            "shot_index": i + 1,
            "visual_prompt": visual_prompt,
            "start": round(start, 2),
            "end": round(end, 2),
            "freeze_tail": freeze_tail,
        })

    return shots
