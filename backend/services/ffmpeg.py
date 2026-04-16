import os
import re
import uuid
import shutil
import subprocess
import tempfile

from services.utils import ensure_dir


def _parse_srt_time(ts: str) -> float:
    """Parse SRT timestamp like '00:01:05,476' to seconds."""
    m = re.match(r"(\d+):(\d+):(\d+)[,.](\d+)", ts.strip())
    if not m:
        return 0.0
    h, mn, s, ms = int(m[1]), int(m[2]), int(m[3]), int(m[4])
    return h * 3600 + mn * 60 + s + ms / 1000.0


def _find_font() -> str:
    """Find a usable TTF font on the system."""
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",  # macOS
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  # Linux
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return ""


def _srt_to_drawtext_filter(srt_path: str, font_size: int = 36) -> str:
    """Convert an SRT file into an FFmpeg drawtext filter chain.

    Uses the built-in drawtext filter (requires libfreetype, NOT libass)
    so it works with minimal FFmpeg builds.
    """
    font_path = _find_font()
    if not font_path:
        print("[subtitles] WARNING: no font found, subtitles will be skipped")
        return ""

    with open(srt_path, "r", encoding="utf-8") as f:
        content = f.read()

    blocks = re.split(r"\n\s*\n", content.strip())
    parts: list[str] = []

    # Copy font to /tmp to avoid path-with-spaces issues
    temp_font = os.path.join(tempfile.gettempdir(), "subtitle_font.ttf")
    if not os.path.exists(temp_font):
        shutil.copy(font_path, temp_font)
    font_escaped = temp_font.replace(":", "\\:")

    for block in blocks:
        lines = block.strip().split("\n")
        if len(lines) < 3:
            continue
        times = lines[1].split("-->")
        if len(times) != 2:
            continue
        start = _parse_srt_time(times[0])
        end = _parse_srt_time(times[1])
        text = " ".join(l.strip() for l in lines[2:])

        # Escape for drawtext filter
        escaped = (
            text
            .replace("\\", "\\\\")
            .replace("'", "\u2019")
            .replace("%", "%%")
            .replace(":", "\\:")
        )

        parts.append(
            f"drawtext=fontfile='{font_escaped}'"
            f":text='{escaped}'"
            f":fontsize={font_size}:fontcolor=white"
            f":borderw=2:bordercolor=black"
            f":x=(w-text_w)/2:y=h-th-50"
            f":enable='between(t\\,{start:.3f}\\,{end:.3f})'"
        )

    return ",".join(parts) if parts else ""


def _format_srt_time(seconds: float) -> str:
    """Convert seconds to SRT time format (HH:MM:SS,mmm)."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def generate_srt(scenes: list[dict]) -> str:
    """Generate an SRT subtitle file from scenes.

    Each scene should have 'narration' and 'audio_duration' keys.

    Args:
        scenes: List of scene dicts with narration and audio_duration.

    Returns:
        The file path of the generated SRT file.
    """
    save_dir = os.path.join("assets", "video")
    ensure_dir(save_dir)

    filename = f"{uuid.uuid4()}.srt"
    save_path = os.path.join(save_dir, filename)

    srt_content = ""
    current_time = 0.0

    for i, scene in enumerate(scenes, start=1):
        narration = scene.get("narration", "")
        duration = scene.get("audio_duration", 5.0)

        if not narration:
            current_time += duration
            continue

        start_time = _format_srt_time(current_time)
        end_time = _format_srt_time(current_time + duration)

        srt_content += f"{i}\n"
        srt_content += f"{start_time} --> {end_time}\n"
        srt_content += f"{narration}\n\n"

        current_time += duration

    with open(save_path, "w", encoding="utf-8") as f:
        f.write(srt_content)

    return save_path


def _get_audio_duration(audio_path: str) -> float:
    """Get the duration of an audio file using ffprobe."""
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                audio_path,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        return float(result.stdout.strip())
    except (subprocess.CalledProcessError, ValueError):
        return 5.0


def synthesize_video(scenes: list[dict], aspect_ratio: str = "16:9", include_transcript: bool = True) -> str:
    """Synthesize a video from scenes with images, audio, and subtitles.

    Each scene needs 'audio_path', 'narration', and either 'image_path' or
    'video_clip_path' (a short MP4 to loop for the length of the narration audio).

    Args:
        scenes: List of scene dicts with paths and narration.
        aspect_ratio: Either "16:9" or "9:16".

    Returns:
        The file path of the final output video.
    """
    resolution_map = {
        "16:9": "1920x1080",
        "9:16": "1080x1920",
    }
    resolution = resolution_map.get(aspect_ratio, "1920x1080")
    width, height = resolution.split("x")

    save_dir = os.path.join("assets", "video")
    ensure_dir(save_dir)

    output_id = uuid.uuid4()
    segment_paths = []
    segment_audio_paths = []   # parallel list: audio file for each segment
    segment_narrations = []    # parallel list: narration text for each segment

    try:
        # Step 1: Create a video segment for each scene
        for i, scene in enumerate(scenes):
            image_path = scene.get("image_path") or ""
            video_clip_path = scene.get("video_clip_path") or ""
            audio_path = scene.get("audio_path", "")

            if not audio_path or (not image_path and not video_clip_path):
                print(f"Skipping scene {i + 1}: missing visual or audio path")
                continue

            segment_path = os.path.join(save_dir, f"segment_{output_id}_{i}.mp4")
            segment_paths.append(segment_path)
            segment_audio_paths.append(audio_path)
            segment_narrations.append(scene.get("narration", ""))

            if video_clip_path:
                # Motion clips: scale to target resolution so all segments
                # share the same dimensions (consistent subtitle rendering).
                audio_dur = _get_audio_duration(audio_path) if audio_path else 5.0
                vf_scale = (
                    f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
                    f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black"
                )
                cmd = [
                    "ffmpeg", "-y",
                    "-i", video_clip_path,
                    "-i", audio_path,
                    "-t", str(audio_dur),
                    "-vf", vf_scale,
                    "-c:v", "libx264",
                    "-c:a", "aac",
                    "-b:a", "192k",
                    "-pix_fmt", "yuv420p",
                    "-r", "30",
                    segment_path,
                ]
            else:
                # Gentle zoom-in on still images (5% total).
                # Render zoompan at 2x resolution then downscale to eliminate
                # the sub-pixel jitter that zoompan is known for.
                audio_dur = _get_audio_duration(audio_path) if audio_path else 5.0
                total_frames = int(audio_dur * 30) + 30
                zoom_step = 0.05 / max(total_frames, 1)
                w2 = int(width) * 2
                h2 = int(height) * 2

                vf_zoom = (
                    f"scale={w2}:{h2}:force_original_aspect_ratio=decrease,"
                    f"pad={w2}:{h2}:(ow-iw)/2:(oh-ih)/2:color=black,"
                    f"zoompan=z='min(zoom+{zoom_step:.8f},1.05)'"
                    f":x='trunc((iw-iw/zoom)/2)':y='trunc((ih-ih/zoom)/2)'"
                    f":d={total_frames}:s={w2}x{h2}:fps=30,"
                    f"scale={width}:{height}"
                )

                cmd = [
                    "ffmpeg", "-y",
                    "-loop", "1",
                    "-i", image_path,
                    "-i", audio_path,
                    "-c:v", "libx264",
                    "-c:a", "aac",
                    "-b:a", "192k",
                    "-pix_fmt", "yuv420p",
                    "-vf", vf_zoom,
                    "-shortest",
                    segment_path,
                ]

            subprocess.run(cmd, capture_output=True, text=True, check=True)

        if not segment_paths:
            raise ValueError("No valid segments were created")

        # Step 2: Concatenate all segments (re-encode to ensure perfect
        # audio/video sync — stream-copy concat accumulates per-segment
        # A/V duration mismatches that cause subtitle drift).
        concat_file_path = os.path.join(save_dir, f"concat_{output_id}.txt")
        with open(concat_file_path, "w") as f:
            for seg_path in segment_paths:
                f.write(f"file '{os.path.abspath(seg_path)}'\n")

        concat_raw = os.path.join(save_dir, f"concat_{output_id}.mp4")
        segment_paths.append(concat_raw)  # track for cleanup
        concat_cmd = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_file_path,
            "-c:v", "libx264",
            "-c:a", "aac",
            "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-r", "30",
            "-movflags", "+faststart",
            concat_raw,
        ]
        subprocess.run(concat_cmd, capture_output=True, text=True, check=True)

        # Step 3: Burn subtitles onto the concatenated video.
        # Extract the FULL audio from the concat video and run forced
        # alignment with the complete narration text.  This gives
        # timestamps directly on the final video's timeline — no
        # cumulative offset calculation needed, eliminating drift.
        if include_transcript:
            from services.whisper_align import align_words, _chunk_words

            # 3a. Extract audio from concatenated video
            extracted_audio = os.path.join(save_dir, f"audio_{output_id}.wav")
            segment_paths.append(extracted_audio)  # track for cleanup
            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-i", concat_raw,
                    "-vn", "-acodec", "pcm_s16le",
                    "-ar", "16000", "-ac", "1",
                    extracted_audio,
                ],
                capture_output=True, text=True, check=True,
            )

            # 3b. Join all narration texts with spaces
            full_text = " ".join(n.strip() for n in segment_narrations if n.strip())

            # 3c. Forced-align the full text against extracted audio
            words = align_words(extracted_audio, full_text) if full_text else []
            chunks = _chunk_words(words) if words else []

            all_drawtext_parts: list[str] = []
            font_path = _find_font()
            temp_font = os.path.join(tempfile.gettempdir(), "subtitle_font.ttf")
            if font_path and not os.path.exists(temp_font):
                shutil.copy(font_path, temp_font)
            font_escaped = temp_font.replace(":", "\\:")

            for ci, chunk in enumerate(chunks):
                start = chunk[0]["start"]
                end = chunk[-1]["end"]
                text = " ".join(w["word"] for w in chunk)
                escaped = (
                    text
                    .replace("\\", "\\\\")
                    .replace("'", "\u2019")
                    .replace("%", "%%")
                    .replace(":", "\\:")
                )
                all_drawtext_parts.append(
                    f"drawtext=fontfile='{font_escaped}'"
                    f":text='{escaped}'"
                    f":fontsize=36:fontcolor=white"
                    f":borderw=2:bordercolor=black"
                    f":x=(w-text_w)/2:y=h-th-50"
                    f":enable='between(t\\,{start:.3f}\\,{end:.3f})'"
                )

            final_output = os.path.join(save_dir, f"final_{output_id}.mp4")

            if all_drawtext_parts:
                sub_cmd = [
                    "ffmpeg", "-y",
                    "-i", concat_raw,
                    "-vf", ",".join(all_drawtext_parts),
                    "-c:v", "libx264",
                    "-c:a", "copy",
                    "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart",
                    final_output,
                ]
                result = subprocess.run(sub_cmd, capture_output=True, text=True)
                if result.returncode != 0:
                    print(f"[subtitles] drawtext failed: {result.stderr[:500]}")
                    shutil.copy(concat_raw, final_output)
                else:
                    print(f"[subtitles] burned {len(all_drawtext_parts)} subtitle chunks onto final video")
            else:
                shutil.copy(concat_raw, final_output)
        else:
            final_output = os.path.join(save_dir, f"final_{output_id}.mp4")
            shutil.copy(concat_raw, final_output)

        return final_output

    except subprocess.CalledProcessError as e:
        raise ValueError(f"FFmpeg error: {e.stderr}")
    except Exception as e:
        raise ValueError(f"Failed to synthesize video: {e}")
    finally:
        # Clean up temporary files
        for seg_path in segment_paths:
            try:
                os.remove(seg_path)
            except OSError:
                pass
        concat_file = os.path.join(save_dir, f"concat_{output_id}.txt")
        try:
            os.remove(concat_file)
        except OSError:
            pass
        concat_vid = os.path.join(save_dir, f"concat_{output_id}.mp4")
        if os.path.exists(concat_vid):
            try:
                os.remove(concat_vid)
            except OSError:
                pass


def _get_video_duration(video_path: str) -> float:
    """Get the duration of a video file using ffprobe."""
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                video_path,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        return float(result.stdout.strip())
    except (subprocess.CalledProcessError, ValueError):
        return 0.0


def stitch_motion_shots(
    shot_video_paths: list[str],
    audio_path: str,
    audio_duration: float,
    tail_strategy: str = "freeze",
) -> str:
    """Stitch multiple Veo motion shots with an audio track.

    Concatenates shot videos, adjusts total length to match audio_duration
    (trim if too long, extend via freeze-frame or fade-to-black if short
    by <= 2 seconds), and overlays the audio.

    Args:
        shot_video_paths: Ordered list of shot video file paths.
        audio_path: Path to the audio file (narration).
        audio_duration: Target duration in seconds.
        tail_strategy: "freeze" to hold last frame, or "fade_black" to fade out.

    Returns:
        Relative path to the final stitched video.
    """
    save_dir = os.path.join("assets", "video", "motions")
    ensure_dir(save_dir)
    job_id = uuid.uuid4()
    temp_files: list[str] = []

    try:
        # --- Step 1: Concatenate all shot videos --------------------------
        concat_list_path = os.path.join(save_dir, f"concat_{job_id}.txt")
        temp_files.append(concat_list_path)

        with open(concat_list_path, "w") as f:
            for vp in shot_video_paths:
                f.write(f"file '{os.path.abspath(vp)}'\n")

        concat_raw_path = os.path.join(save_dir, f"concat_raw_{job_id}.mp4")
        temp_files.append(concat_raw_path)

        subprocess.run(
            [
                "ffmpeg", "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", concat_list_path,
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p",
                "-r", "30",
                concat_raw_path,
            ],
            capture_output=True,
            text=True,
            check=True,
        )

        video_duration = _get_video_duration(concat_raw_path)
        diff = audio_duration - video_duration

        # --- Step 2: Adjust duration if needed ----------------------------
        adjusted_video_path = concat_raw_path

        if diff < -0.1:
            # Video is longer than audio -- trim to audio_duration
            trimmed_path = os.path.join(save_dir, f"trimmed_{job_id}.mp4")
            temp_files.append(trimmed_path)
            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-i", concat_raw_path,
                    "-t", str(audio_duration),
                    "-c:v", "libx264",
                    "-pix_fmt", "yuv420p",
                    "-c:a", "copy",
                    trimmed_path,
                ],
                capture_output=True,
                text=True,
                check=True,
            )
            adjusted_video_path = trimmed_path

        elif diff > 0.1 and diff <= 2.0:
            # Video is shorter by up to 2 seconds -- extend tail
            if tail_strategy == "fade_black":
                faded_path = os.path.join(save_dir, f"faded_{job_id}.mp4")
                temp_files.append(faded_path)
                fade_start = max(video_duration - 1.0, 0)
                subprocess.run(
                    [
                        "ffmpeg", "-y",
                        "-i", concat_raw_path,
                        "-vf", (
                            f"tpad=stop_mode=clone:stop_duration={diff:.2f},"
                            f"fade=t=out:st={fade_start:.2f}:d={diff + 1.0:.2f}"
                        ),
                        "-c:v", "libx264",
                        "-pix_fmt", "yuv420p",
                        "-r", "30",
                        faded_path,
                    ],
                    capture_output=True,
                    text=True,
                    check=True,
                )
                adjusted_video_path = faded_path
            else:
                # "freeze" strategy: clone last frame to extend
                frozen_path = os.path.join(save_dir, f"frozen_{job_id}.mp4")
                temp_files.append(frozen_path)
                subprocess.run(
                    [
                        "ffmpeg", "-y",
                        "-i", concat_raw_path,
                        "-vf", f"tpad=stop_mode=clone:stop_duration={diff:.2f}",
                        "-c:v", "libx264",
                        "-pix_fmt", "yuv420p",
                        "-r", "30",
                        frozen_path,
                    ],
                    capture_output=True,
                    text=True,
                    check=True,
                )
                adjusted_video_path = frozen_path

        # --- Step 3: Mux audio onto the video -----------------------------
        final_path = os.path.join(save_dir, f"stitched_{job_id}.mp4")

        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", adjusted_video_path,
                "-i", audio_path,
                "-c:v", "libx264",
                "-c:a", "aac",
                "-b:a", "192k",
                "-pix_fmt", "yuv420p",
                "-shortest",
                final_path,
            ],
            capture_output=True,
            text=True,
            check=True,
        )

        return final_path

    except subprocess.CalledProcessError as e:
        raise ValueError(f"FFmpeg stitch error: {e.stderr}")
    except Exception as e:
        raise ValueError(f"Failed to stitch motion shots: {e}")
    finally:
        keep = os.path.join(save_dir, f"stitched_{job_id}.mp4")
        for tmp in temp_files:
            if tmp != keep:
                try:
                    os.remove(tmp)
                except OSError:
                    pass
