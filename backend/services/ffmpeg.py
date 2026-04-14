import os
import uuid
import subprocess


def _ensure_dir(path: str):
    """Ensure the directory exists."""
    os.makedirs(path, exist_ok=True)


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
    _ensure_dir(save_dir)

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


def synthesize_video(scenes: list[dict], aspect_ratio: str = "16:9") -> str:
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
    _ensure_dir(save_dir)

    output_id = uuid.uuid4()
    segment_paths = []

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

            if video_clip_path:
                cmd = [
                    "ffmpeg", "-y",
                    "-stream_loop", "-1",
                    "-i", video_clip_path,
                    "-i", audio_path,
                    "-c:v", "libx264",
                    "-c:a", "aac",
                    "-b:a", "192k",
                    "-pix_fmt", "yuv420p",
                    "-r", "30",
                    "-shortest",
                    segment_path,
                ]
            else:
                cmd = [
                    "ffmpeg", "-y",
                    "-loop", "1",
                    "-i", image_path,
                    "-i", audio_path,
                    "-c:v", "libx264",
                    "-tune", "stillimage",
                    "-c:a", "aac",
                    "-b:a", "192k",
                    "-pix_fmt", "yuv420p",
                    "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2",
                    "-r", "30",
                    "-shortest",
                    segment_path,
                ]

            subprocess.run(cmd, capture_output=True, text=True, check=True)

        if not segment_paths:
            raise ValueError("No valid segments were created")

        # Step 2: Create concat file
        concat_file_path = os.path.join(save_dir, f"concat_{output_id}.txt")
        with open(concat_file_path, "w") as f:
            for seg_path in segment_paths:
                f.write(f"file '{os.path.abspath(seg_path)}'\n")

        # Step 3: Concatenate all segments
        concat_output = os.path.join(save_dir, f"concat_{output_id}.mp4")
        concat_cmd = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_file_path,
            "-c", "copy",
            concat_output,
        ]
        subprocess.run(concat_cmd, capture_output=True, text=True, check=True)

        # Step 4: Generate SRT subtitles (saved alongside video for reference)
        scenes_with_duration = []
        for i, scene in enumerate(scenes):
            audio_path = scene.get("audio_path", "")
            duration = _get_audio_duration(audio_path) if audio_path else 5.0
            scenes_with_duration.append({
                "narration": scene.get("narration", ""),
                "audio_duration": duration,
            })

        srt_path = generate_srt(scenes_with_duration)

        # Step 5: Try to burn subtitles; fall back to plain concat if filter unavailable
        final_output = os.path.join(save_dir, f"final_{output_id}.mp4")
        srt_abs_path = os.path.abspath(srt_path)
        srt_escaped = srt_abs_path.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")

        subtitle_cmd = [
            "ffmpeg", "-y",
            "-i", concat_output,
            "-vf", f"subtitles='{srt_escaped}'",
            "-c:v", "libx264",
            "-c:a", "copy",
            final_output,
        ]
        result = subprocess.run(subtitle_cmd, capture_output=True, text=True)

        if result.returncode != 0:
            # subtitles filter not available — just use the concat output directly
            print(f"Subtitle burn-in failed (likely no libass), using video without subtitles")
            os.rename(concat_output, final_output)

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
