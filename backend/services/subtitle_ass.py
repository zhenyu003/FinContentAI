"""ASS (Advanced SubStation Alpha) subtitle generation.

Industry-standard approach used by DaVinci Resolve, OBS, and major streaming
platforms. Libass renders each Dialogue line independently, which means a
bad line can't poison the whole burn like a monolithic drawtext chain can.

Generated files are consumed by ffmpeg's ``subtitles`` filter:

    ffmpeg -i in.mp4 -vf "subtitles=/tmp/sub.ass" out.mp4

Requires ffmpeg compiled with libass (e.g. the conda-forge build).
"""

from __future__ import annotations

from typing import Iterable


# ASS color format is &HAABBGGRR& with AA = 00 for opaque.
PRIMARY_WHITE = "&H00FFFFFF"
OUTLINE_BLACK = "&H00000000"
# Shadow uses alpha 50% (&H50 ≈ ~0x50 / 0xFF = ~31% opaque).
SHADOW_TRANS = "&H64000000"


def _fmt_time(seconds: float) -> str:
    """Format seconds as ASS timestamp h:MM:SS.cc (centiseconds, 2-digit)."""
    if seconds < 0:
        seconds = 0
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s_whole = int(seconds % 60)
    cs = int(round((seconds - int(seconds)) * 100))
    if cs >= 100:
        cs -= 100
        s_whole += 1
    return f"{h}:{m:02d}:{s_whole:02d}.{cs:02d}"


def _escape_dialogue(text: str) -> str:
    """Escape special ASS characters inside a Dialogue line's Text field.

    ASS reserves ``{...}`` for inline override blocks and uses ``\\`` for
    escape sequences (``\\N`` = hard newline, ``\\n`` = soft newline). We
    keep user text literal.
    """
    return (
        text.replace("\\", "\\\\")
        .replace("{", r"\{")
        .replace("}", r"\}")
        .replace("\r", "")
        # Collapse hard newlines in the source into ASS hard-newline marker.
        .replace("\n", r"\N")
    )


def build_ass(
    chunks: Iterable[dict],
    *,
    video_width: int,
    video_height: int,
    aspect_ratio: str,
    font_name: str = "Arial",
) -> str:
    """Return an ASS subtitle file as a single string.

    Args:
        chunks: iterable of ``{"start": float, "end": float, "text": str}``.
                ``text`` may already contain ``\\N`` hard breaks.
        video_width/height: target video dimensions (also used as PlayRes).
        aspect_ratio: "16:9" or "9:16" — determines font size and margins.
        font_name: system font family. Libass resolves via fontconfig.
    """
    is_vertical = aspect_ratio == "9:16"

    # Style defaults tuned for social / broadcast legibility.
    font_size = 54 if is_vertical else 42
    # Side margins: keep text inside 90% of width.
    margin_l = int(video_width * 0.05)
    margin_r = int(video_width * 0.05)
    margin_v = 90 if is_vertical else 60
    outline_w = 3  # px outline
    shadow_w = 1

    header = (
        "[Script Info]\n"
        "Title: fincontent\n"
        "ScriptType: v4.00+\n"
        f"PlayResX: {video_width}\n"
        f"PlayResY: {video_height}\n"
        "WrapStyle: 0\n"             # 0 = smart wrap (balanced lines)
        "ScaledBorderAndShadow: yes\n"
        "YCbCr Matrix: TV.709\n"
        "\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
        "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,{font_name},{font_size},"
        f"{PRIMARY_WHITE},&H000000FF,{OUTLINE_BLACK},{SHADOW_TRANS},"
        "1,0,0,0,100,100,0,0,"       # Bold, rest of flags/scales
        f"1,{outline_w},{shadow_w},"  # BorderStyle=1 (outline+shadow)
        "2,"                         # Alignment = 2 = bottom center
        f"{margin_l},{margin_r},{margin_v},1\n"
        "\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, "
        "MarginL, MarginR, MarginV, Effect, Text\n"
    )

    body_lines = []
    for c in chunks:
        start = _fmt_time(float(c["start"]))
        end = _fmt_time(float(c["end"]))
        if end <= start:
            # libass drops zero/negative-duration events; skip defensively.
            continue
        text = _escape_dialogue(str(c["text"]).strip())
        if not text:
            continue
        body_lines.append(
            f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}"
        )

    return header + "\n".join(body_lines) + "\n"


def escape_filter_path(path: str) -> str:
    """Escape a filesystem path for use as the ``subtitles=...`` filter arg.

    ffmpeg filter syntax uses ``:`` to separate options and ``\\`` to escape,
    and the whole filter string is typically wrapped in shell-style quoting.
    Single-quote, colon, and backslash in the path all need escaping.
    """
    return (
        path.replace("\\", "\\\\")
        .replace(":", "\\:")
        .replace("'", "\\'")
    )
