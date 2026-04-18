import { useState, useCallback, useEffect } from "react";
import { useNavigate, Navigate, useLocation } from "react-router-dom";
import { useProject } from "../App";
import {
  generateImage,
  generateAudio,
  generateVideo,
  uploadChartImage,
  uploadSceneImage,
  splitScene,
  generateOneScene,
  listVoiceClones,
  type VoiceClone,
  BACKEND,
} from "../api/client";
import type { SceneMode, ChartConfig } from "../types";
import ChartConfigPanel from "../components/ChartConfigPanel";

const VOICES = ["Kore", "Charon", "Fenrir", "Aoede", "Puck", "Leda"];
const VISUAL_MODES: { value: SceneMode; label: string }[] = [
  { value: "image", label: "Image" },
  { value: "chart", label: "Chart" },
];

export default function WorkspacePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, updateScene, setScenes, setVideoUrl } = useProject();
  const { scenes, aspectRatio, videoUrl, topic, idea } = state;
  const isVertical = aspectRatio === "9:16";

  const [voice, setVoice] = useState("Kore");
  // When set (format: "clone:<id>"), routes TTS to the user's ElevenLabs clone.
  const [voiceCloneId, setVoiceCloneId] = useState<string | null>(null);
  const [voiceClones, setVoiceClones] = useState<VoiceClone[]>([]);
  const [loadingImg, setLoadingImg] = useState<Record<number, boolean>>({});
  const [loadingAudio, setLoadingAudio] = useState<Record<number, boolean>>({});
  const [loadingAllImg, setLoadingAllImg] = useState(false);
  const [loadingAllAudio, setLoadingAllAudio] = useState(false);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [error, setError] = useState("");
  const [sceneModes, setSceneModes] = useState<Record<number, SceneMode>>({});
  const [chartDataUrls, setChartDataUrls] = useState<Record<number, string>>({});
  const [loadingSplit, setLoadingSplit] = useState<Record<number, boolean>>({});

  const [loadingUpload, setLoadingUpload] = useState<Record<number, boolean>>({});
  const [loadingAddScene, setLoadingAddScene] = useState<Record<number, boolean>>({});

  // Custom delete confirmation dialog state
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Error tracking for individual scenes
  const [imgErrors, setImgErrors] = useState<Record<number, string>>({});
  const [audioErrors, setAudioErrors] = useState<Record<number, string>>({});

  // Video synthesis progress
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoProgressLabel, setVideoProgressLabel] = useState("");

  // Transcript toggle (default ON)
  const [includeTranscript, setIncludeTranscript] = useState(true);

  // Knowledge Base feedback (passed via navigation state from TopicPage)
  const knowledgeUsed = !!(location.state as { knowledgeUsed?: boolean } | null)?.knowledgeUsed;

  // Load the user's cloned voices once so the Voice picker can offer them.
  // Silent failure (e.g. unauthenticated): user just sees the Gemini presets.
  useEffect(() => {
    listVoiceClones()
      .then((d) => setVoiceClones(d.voices || []))
      .catch(() => setVoiceClones([]));
  }, []);

  const getSceneMode = (i: number): SceneMode => sceneModes[i] ?? scenes[i]?.mode ?? "image";

  // Estimate scene duration from word count (~2 words/sec) or use actual audio_duration
  const estimateSceneSec = (s: typeof scenes[number]) => {
    if (s.audio_duration) return s.audio_duration;
    const words = (s.narration || "").split(/\s+/).filter(Boolean).length;
    return words / 2;
  };

  const setSceneModeFor = (i: number, mode: SceneMode) => {
    setSceneModes((prev) => ({ ...prev, [i]: mode }));
    updateScene(i, { mode, type: mode });
  };

  const handleChartImage = useCallback(
    async (index: number, dataUrl: string, config: ChartConfig, videoUrl?: string) => {
      setChartDataUrls((prev) => ({ ...prev, [index]: dataUrl }));
      // Keep chart animation separate from Motion Studio asset (`motion_url`).
      // The synthesis step will prefer chart_motion_url for chart scenes.
      try {
        const { image_url } = await uploadChartImage(dataUrl);
        updateScene(index, {
          image_url,
          chartConfig: config,
          mode: "chart",
          type: "chart",
          chart_motion_url: videoUrl ?? undefined,
        });
      } catch {
        updateScene(index, {
          image_url: dataUrl,
          chartConfig: config,
          mode: "chart",
          type: "chart",
          chart_motion_url: videoUrl ?? undefined,
        });
      }
    },
    [updateScene],
  );

  const handleSplitScene = async (index: number) => {
    const scene = scenes[index];
    const dur = scene.audio_duration || estimateSceneSec(scene);
    if (dur <= 0) return;
    setLoadingSplit((s) => ({ ...s, [index]: true }));
    setError("");
    try {
      const data = await splitScene({
        scene_number: scene.scene_number,
        description: scene.description,
        narration: scene.narration,
        audio_duration: dur,
        aspect_ratio: aspectRatio,
      });
      const subs = data.sub_scenes;
      // Build new scenes array: replace scene[index] with sub-scenes
      // Audio is cleared for all sub-scenes since narration has changed
      const newScenes = [...scenes];
      const replacements = subs.map((sub, si) => ({
        scene_number: index + 1 + si * 0.1,
        scene_type: "image" as const,
        description: sub.description,
        narration: sub.narration,
      }));
      newScenes.splice(index, 1, ...replacements);
      // Re-number scenes sequentially
      const renumbered = newScenes.map((s, i) => ({ ...s, scene_number: i + 1 }));
      setScenes(renumbered);
      // Set the chart sub-scene mode
      const chartIdx = subs.findIndex((s) => s.is_chart);
      if (chartIdx >= 0) {
        setSceneModes((prev) => ({ ...prev, [index + chartIdx]: "chart" }));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Split failed: ${msg}`);
    } finally {
      setLoadingSplit((s) => ({ ...s, [index]: false }));
    }
  };

  // Shift keyed-by-index state when a scene is inserted/removed.
  const remapIndexState = <T,>(
    obj: Record<number, T>,
    op: "insert" | "delete",
    at: number,
  ): Record<number, T> => {
    const result: Record<number, T> = {};
    for (const [k, v] of Object.entries(obj)) {
      const idx = Number(k);
      if (op === "delete" && idx === at) continue;
      const shift = op === "insert" ? (idx > at ? 1 : 0) : (idx > at ? -1 : 0);
      result[idx + shift] = v;
    }
    return result;
  };

  const handleAddScene = async (afterIndex: number) => {
    if (loadingAllImg || loadingAllAudio) return;
    setLoadingAddScene((s) => ({ ...s, [afterIndex]: true }));
    setError("");
    try {
      const prev = scenes[afterIndex];
      const next = scenes[afterIndex + 1] || null;
      const result = await generateOneScene({
        prev_scene: prev
          ? { description: prev.description, narration: prev.narration }
          : null,
        next_scene: next
          ? { description: next.description, narration: next.narration }
          : null,
        topic_title: topic?.title || "",
        topic_summary: topic?.summary || "",
        idea: (idea as object) || {},
        aspect_ratio: aspectRatio,
      });

      const newScene = {
        scene_number: 0, // will be renumbered below
        scene_type: "image",
        description: result.description,
        narration: result.narration,
      } as typeof scenes[number];

      const next2 = [...scenes];
      next2.splice(afterIndex + 1, 0, newScene);
      const renumbered = next2.map((s, i) => ({ ...s, scene_number: i + 1 }));
      setScenes(renumbered);

      // Shift all per-index state maps
      setSceneModes((m) => remapIndexState(m, "insert", afterIndex));
      setChartDataUrls((m) => remapIndexState(m, "insert", afterIndex));
      setLoadingImg((m) => remapIndexState(m, "insert", afterIndex));
      setLoadingAudio((m) => remapIndexState(m, "insert", afterIndex));
      setLoadingSplit((m) => remapIndexState(m, "insert", afterIndex));
      setLoadingUpload((m) => remapIndexState(m, "insert", afterIndex));
      setImgErrors((m) => remapIndexState(m, "insert", afterIndex));
      setAudioErrors((m) => remapIndexState(m, "insert", afterIndex));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Add scene failed: ${msg}`);
    } finally {
      setLoadingAddScene((s) => ({ ...s, [afterIndex]: false }));
    }
  };

  const handleDeleteScene = (index: number) => {
    if (scenes.length <= 1) return;
    setDeleteConfirm(index);
  };

  const confirmDeleteScene = (index: number) => {
    setDeleteConfirm(null);
    const next = scenes.filter((_, i) => i !== index);
    const renumbered = next.map((s, i) => ({ ...s, scene_number: i + 1 }));
    setScenes(renumbered);

    setSceneModes((m) => remapIndexState(m, "delete", index));
    setChartDataUrls((m) => remapIndexState(m, "delete", index));
    setLoadingImg((m) => remapIndexState(m, "delete", index));
    setLoadingAudio((m) => remapIndexState(m, "delete", index));
    setLoadingSplit((m) => remapIndexState(m, "delete", index));
    setLoadingUpload((m) => remapIndexState(m, "delete", index));
    setLoadingAddScene((m) => remapIndexState(m, "delete", index));
    setImgErrors((m) => remapIndexState(m, "delete", index));
    setAudioErrors((m) => remapIndexState(m, "delete", index));
  };

  if (scenes.length === 0) {
    return <Navigate to="/topic" replace />;
  }

  const handleGenImage = async (index: number) => {
    setLoadingImg((s) => ({ ...s, [index]: true }));
    setImgErrors((s) => ({ ...s, [index]: "" }));
    try {
      const data = await generateImage(scenes[index].description, aspectRatio);
      updateScene(index, { image_url: data.image_url, type: "image", mode: "image" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setImgErrors((s) => ({ ...s, [index]: msg }));
    } finally {
      setLoadingImg((s) => ({ ...s, [index]: false }));
    }
  };

  const handleUploadImage = async (index: number, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setImgErrors((s) => ({ ...s, [index]: "File too large (max 5 MB)" }));
      return;
    }
    setLoadingUpload((s) => ({ ...s, [index]: true }));
    setImgErrors((s) => ({ ...s, [index]: "" }));
    try {
      const data = await uploadSceneImage(file);
      updateScene(index, { image_url: data.image_url, type: "image", mode: "image" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setImgErrors((s) => ({ ...s, [index]: msg }));
    } finally {
      setLoadingUpload((s) => ({ ...s, [index]: false }));
    }
  };

  const handleGenAudio = async (index: number) => {
    setLoadingAudio((s) => ({ ...s, [index]: true }));
    setAudioErrors((s) => ({ ...s, [index]: "" }));
    try {
      const data = await generateAudio(scenes[index].narration, voice, voiceCloneId);
      updateScene(index, { audio_url: data.audio_url, audio_duration: data.duration_sec });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setAudioErrors((s) => ({ ...s, [index]: msg }));
    } finally {
      setLoadingAudio((s) => ({ ...s, [index]: false }));
    }
  };

  const handleGenAllImages = async () => {
    setLoadingAllImg(true);
    setError("");
    let failed = 0;
    let done = 0;
    for (let i = 0; i < scenes.length; i++) {
      if (getSceneMode(i) !== "image") continue;
      if (!scenes[i].image_url) {
        await handleGenImage(i);
        // Check if it failed (imgErrors is set asynchronously, check scene state)
        done++;
      }
    }
    setLoadingAllImg(false);
    // Count failures from error state
    setTimeout(() => {
      setImgErrors((errs) => {
        failed = Object.values(errs).filter(Boolean).length;
        if (failed > 0) {
          setError(`Image generation: ${failed} scene(s) failed — click Retry on failed scenes`);
        }
        return errs;
      });
    }, 100);
  };

  const handleGenAllAudio = async () => {
    setLoadingAllAudio(true);
    setError("");
    for (let i = 0; i < scenes.length; i++) {
      if (!scenes[i].audio_url) {
        await handleGenAudio(i);
      }
    }
    setLoadingAllAudio(false);
    setTimeout(() => {
      setAudioErrors((errs) => {
        const failed = Object.values(errs).filter(Boolean).length;
        if (failed > 0) {
          setError(`Audio generation: ${failed} scene(s) failed — click Retry on failed scenes`);
        }
        return errs;
      });
    }, 100);
  };

  const allReady = scenes.every((s) => {
    if (!s.audio_url) return false;
    // Scene needs at least one visual: a motion video, an image, or a chart
    return !!(s.motion_url || s.chart_motion_url || s.image_url);
  });

  const handleGenVideo = async () => {
    // Clear old video so user can't navigate to stale Preview during generation
    setVideoUrl("");
    setLoadingVideo(true);
    setVideoProgress(0);
    setVideoProgressLabel("Preparing scenes...");
    setError("");

    // Simulate progress based on scene count (transcript adds Whisper time)
    const totalEstSec = scenes.length * (includeTranscript ? 12 : 8);
    const steps = includeTranscript
      ? [
          { at: 0.05, label: "Rendering scene segments..." },
          { at: 0.35, label: "Concatenating clips..." },
          { at: 0.55, label: "Aligning subtitles with Whisper..." },
          { at: 0.85, label: "Burning subtitles & finalizing..." },
        ]
      : [
          { at: 0.05, label: "Rendering scene segments..." },
          { at: 0.5, label: "Concatenating clips..." },
          { at: 0.85, label: "Finalizing video..." },
        ];
    let stepIdx = 0;
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const pct = Math.min(elapsed / totalEstSec, 0.95);
      setVideoProgress(pct);
      while (stepIdx < steps.length && pct >= steps[stepIdx].at) {
        setVideoProgressLabel(steps[stepIdx].label);
        stepIdx++;
      }
    }, 500);

    try {
      const sceneInputs = scenes.map((s) => {
        const audio_path = s.audio_url!.replace(/^\//, "");
        // Prefer Motion Studio asset; for chart scenes, fall back to chart animation clip.
        const chartMode = (s.mode ?? s.type) === "chart";
        const chartClip = chartMode ? s.chart_motion_url : undefined;
        const legacyChartClip = chartMode && !s.chart_motion_url && !s.shots?.length ? s.motion_url : undefined;
        const visualClip = s.motion_url ?? chartClip ?? legacyChartClip;
        if (visualClip) {
          return {
            video_clip_path: visualClip.replace(/^\//, ""),
            audio_path,
            narration: s.narration,
          };
        }
        return {
          image_path: s.image_url!.replace(/^\//, ""),
          audio_path,
          narration: s.narration,
        };
      });
      const data = await generateVideo(sceneInputs, aspectRatio, includeTranscript);
      clearInterval(interval);
      setVideoProgress(1);
      setVideoProgressLabel("Done!");
      setVideoUrl(data.video_url);
      navigate("/preview");
    } catch (e: unknown) {
      clearInterval(interval);
      const msg = e instanceof Error ? e.message : String(e);
      setError("Video generation failed: " + msg);
    } finally {
      setLoadingVideo(false);
      setVideoProgress(0);
      setVideoProgressLabel("");
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const totalEstDuration = scenes.reduce((sum, s) => sum + estimateSceneSec(s), 0);
  const allAudioReady = scenes.every((s) => s.audio_duration != null);

  return (
    <div>
      {/* ── Custom delete confirmation dialog ── */}
      {deleteConfirm !== null && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "28px 32px",
              maxWidth: 380,
              width: "90%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 600 }}>
              Delete Scene {deleteConfirm + 1}?
            </h3>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5 }}>
              This scene's audio, image, and motion assets will be removed. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                className="btn btn-secondary"
                style={{ padding: "8px 20px" }}
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                className="btn"
                style={{ padding: "8px 20px", background: "var(--red)", color: "#fff", border: "none" }}
                onClick={() => confirmDeleteScene(deleteConfirm)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <button className="btn btn-sm" onClick={() => navigate("/topic")} style={{ background: "var(--bg-input)", color: "var(--text-dim)" }}>&larr; Back to Idea</button>
      </div>
      <div className="step-indicator">
        <span className="step" style={{ cursor: "pointer" }} onClick={() => navigate("/")}>1. Topic Discovery</span>
        <span className="arrow">&rarr;</span>
        <span className="step" style={{ cursor: "pointer" }} onClick={() => navigate("/topic")}>2. Idea & Opinion</span>
        <span className="arrow">&rarr;</span>
        <span className="step active">3. Asset Workstation</span>
        <span className="arrow">&rarr;</span>
        <span
          className="step"
          style={videoUrl ? { cursor: "pointer", color: "var(--accent)" } : undefined}
          onClick={videoUrl ? () => navigate("/preview") : undefined}
          title={videoUrl ? "View last generated video" : undefined}
        >
          4. Preview & Export {videoUrl && "✓"}
        </span>
      </div>

      {error && (
        <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
      )}

      {/* Summary bar: duration estimate + KB feedback */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginBottom: 12,
        fontSize: 13,
        flexWrap: "wrap",
      }}>
        <span className="text-dim">
          {scenes.length} scenes
          {" · "}
          {allAudioReady ? "" : "~"}{formatDuration(totalEstDuration)}
          {!allAudioReady && <span style={{ fontSize: 11, marginLeft: 4 }}>(estimated from word count)</span>}
        </span>
        {knowledgeUsed && (
          <span style={{ color: "var(--accent)", fontSize: 12 }}>
            ✦ Enhanced with your Knowledge Base
          </span>
        )}
      </div>

      <div className="toolbar">
        <label className="text-sm text-dim">Voice:</label>
        <select
          value={voiceCloneId ? `clone:${voiceCloneId}` : voice}
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith("clone:")) {
              setVoiceCloneId(v.slice("clone:".length));
            } else {
              setVoiceCloneId(null);
              setVoice(v);
            }
          }}
          style={{ width: voiceClones.length > 0 ? 200 : 140 }}
        >
          <optgroup label="Default voices">
            {VOICES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </optgroup>
          {voiceClones.length > 0 && (
            <optgroup label="My cloned voices">
              {voiceClones.map((c) => (
                <option key={c.id} value={`clone:${c.id}`}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleGenAllAudio}
          disabled={loadingAllAudio}
        >
          {loadingAllAudio ? (
            <><span className="spinner" /> Generating...</>
          ) : (
            "Generate All Audio"
          )}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleGenAllImages}
          disabled={loadingAllImg}
        >
          {loadingAllImg ? (
            <><span className="spinner" /> Generating...</>
          ) : (
            "Generate All Images"
          )}
        </button>
        <div style={{ flex: 1 }} />
        <span className="badge">{aspectRatio}</span>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto", overflowY: "visible" }}>
        <table className="scene-table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th style={{ width: "25%" }}>Description</th>
              <th style={{ width: "25%" }}>Narration</th>
              <th style={{ width: 120 }}>Audio</th>
              <th className="media-cell">Image</th>
              <th style={{ width: 110 }}>Motion</th>
            </tr>
          </thead>
          <tbody>
            {scenes.map((scene, i) => (
              <tr key={i}>
                <td className="num">
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span>{scene.scene_number}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        title="Insert a new scene after this one"
                        onClick={() => handleAddScene(i)}
                        disabled={loadingAddScene[i] || loadingAllImg || loadingAllAudio}
                        style={{
                          width: 22,
                          height: 22,
                          padding: 0,
                          lineHeight: 1,
                          fontSize: 14,
                          fontWeight: 600,
                          borderRadius: 4,
                          border: "1px solid var(--border)",
                          background: "var(--bg-input)",
                          color: "var(--text)",
                          cursor: loadingAddScene[i] || loadingAllImg || loadingAllAudio ? "not-allowed" : "pointer",
                          opacity: loadingAddScene[i] || loadingAllImg || loadingAllAudio ? 0.5 : 1,
                        }}
                      >
                        {loadingAddScene[i] ? <span className="spinner" style={{ width: 10, height: 10 }} /> : "+"}
                      </button>
                      {scenes.length > 1 && (
                        <button
                          type="button"
                          title="Delete this scene"
                          onClick={() => handleDeleteScene(i)}
                          style={{
                            width: 22,
                            height: 22,
                            padding: 0,
                            lineHeight: 1,
                            fontSize: 14,
                            fontWeight: 600,
                            borderRadius: 4,
                            border: "1px solid var(--border)",
                            background: "var(--bg-input)",
                            color: "var(--red)",
                            cursor: "pointer",
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <textarea
                    value={scene.description}
                    onChange={(e) =>
                      updateScene(i, { description: e.target.value })
                    }
                  />
                </td>
                <td>
                  <textarea
                    value={scene.narration}
                    onChange={(e) =>
                      updateScene(i, { narration: e.target.value })
                    }
                  />
                </td>

                {/* ── Audio column (narrow) ── */}
                <td style={{ width: 120, textAlign: "center", verticalAlign: "middle" }}>
                  {scene.audio_url && (
                    <audio
                      controls
                      src={BACKEND + scene.audio_url}
                      style={{ width: 100, height: 32 }}
                    />
                  )}
                  {scene.audio_duration != null ? (
                    <span className="badge" style={{ display: "inline-block", marginTop: 4, fontSize: 11 }}>
                      {formatDuration(scene.audio_duration)}
                    </span>
                  ) : (
                    <span className="text-dim" style={{ display: "inline-block", marginTop: 4, fontSize: 10 }}>
                      ~{formatDuration(estimateSceneSec(scene))}
                    </span>
                  )}
                  {audioErrors[i] && (
                    <div style={{ color: "var(--red)", fontSize: 10, marginTop: 2 }}>Failed — retry below</div>
                  )}
                  <br />
                  <button
                    className={`btn btn-sm ${audioErrors[i] ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => handleGenAudio(i)}
                    disabled={loadingAudio[i]}
                  >
                    {loadingAudio[i] ? (
                      <span className="spinner" />
                    ) : audioErrors[i] ? (
                      "Retry"
                    ) : scene.audio_url ? (
                      "Regen"
                    ) : (
                      "Generate"
                    )}
                  </button>
                </td>

                {/* ── Visual column (Image / Chart) ── */}
                <td className="media-cell" style={{ width: isVertical ? 220 : 520 }}>
                  <div className="scene-mode-toggle">
                    {VISUAL_MODES.map((m) => (
                      <button
                        key={m.value}
                        onClick={() => setSceneModeFor(i, m.value)}
                        className={`scene-mode-btn ${getSceneMode(i) === m.value ? "active" : ""}`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Image mode */}
                  {getSceneMode(i) === "image" && (
                    <>
                      {scene.image_url && (
                        <img
                          src={scene.image_url.startsWith("data:") ? scene.image_url : BACKEND + scene.image_url}
                          alt={`Scene ${scene.scene_number}`}
                          style={isVertical
                            ? { marginTop: 8, width: "auto", height: 280, maxWidth: "100%" }
                            : { marginTop: 8 }
                          }
                        />
                      )}
                      {imgErrors[i] && (
                        <div style={{ color: "var(--red)", fontSize: 10, marginTop: 4 }}>Failed — retry below</div>
                      )}
                      <div style={{ marginTop: 8, display: "flex", gap: 6, justifyContent: "center" }}>
                        <button
                          className={`btn btn-sm ${imgErrors[i] ? "btn-primary" : "btn-secondary"}`}
                          onClick={() => handleGenImage(i)}
                          disabled={loadingImg[i] || loadingUpload[i]}
                        >
                          {loadingImg[i] ? (
                            <span className="spinner" />
                          ) : imgErrors[i] ? (
                            "Retry"
                          ) : scene.image_url ? (
                            "Regen"
                          ) : (
                            "Generate"
                          )}
                        </button>
                        <label
                          className="btn btn-sm btn-secondary"
                          title={isVertical ? "Upload image — 9:16 ratio recommended" : "Upload image — 16:9 ratio recommended"}
                          style={{ cursor: loadingImg[i] || loadingUpload[i] ? "not-allowed" : "pointer", opacity: loadingImg[i] || loadingUpload[i] ? 0.5 : 1 }}
                        >
                          {loadingUpload[i] ? <span className="spinner" /> : "Upload"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png"
                            style={{ display: "none" }}
                            disabled={loadingImg[i] || loadingUpload[i]}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadImage(i, file);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    </>
                  )}

                  {/* Long scene tip — static images work best under 12s */}
                  {estimateSceneSec(scene) > 12 && !scene.motion_url && !scene.chart_motion_url && (getSceneMode(i) === "image" || getSceneMode(i) === "chart") && (
                    <div style={{
                      borderTop: "1px solid var(--border)",
                      marginTop: 8,
                      paddingTop: 8,
                      fontSize: 11,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap",
                    }}>
                      <span className="text-dim">
                        Static images work best under 12s — split into shorter scenes or use Motion
                      </span>
                      <button
                        className="btn btn-sm"
                        style={{ fontSize: 10, padding: "2px 8px", background: "var(--bg-input)", color: "var(--text)" }}
                        onClick={() => handleSplitScene(i)}
                        disabled={loadingSplit[i]}
                      >
                        {loadingSplit[i] ? <><span className="spinner" style={{ width: 10, height: 10 }} /> Splitting...</> : "Split"}
                      </button>
                    </div>
                  )}

                  {/* Chart mode */}
                  {getSceneMode(i) === "chart" && (
                    <ChartConfigPanel
                      description={scene.description}
                      onChartImage={(dataUrl, config, videoUrl) =>
                        handleChartImage(i, dataUrl, config, videoUrl)
                      }
                      savedConfig={scene.chartConfig}
                    />
                  )}
                </td>

                {/* ── Motion Studio entry ── */}
                <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                  {scene.motion_url && (
                    <div style={{ marginBottom: 6, display: "flex", justifyContent: "center" }}>
                      {/* Match the project's chosen aspect ratio so the thumbnail
                          previews the actual frame the user will see. */}
                      <video
                        muted
                        playsInline
                        preload="metadata"
                        style={{
                          width: isVertical ? 45 : 80,
                          height: isVertical ? 80 : 45,
                          objectFit: "cover",
                          borderRadius: 4,
                        }}
                        src={BACKEND + scene.motion_url}
                      />
                    </div>
                  )}
                  <button
                    className="btn btn-sm"
                    style={{
                      background: scene.audio_url ? "var(--accent)" : "var(--surface2)",
                      color: scene.audio_url ? "#fff" : "var(--text-dim)",
                      fontSize: 11,
                      whiteSpace: "nowrap",
                    }}
                    disabled={!scene.audio_url}
                    onClick={() => navigate(`/workspace/motion/${i}`)}
                    title={scene.audio_url ? "Open Motion Studio" : "Generate audio first"}
                  >
                    {scene.motion_url ? "Edit Motion" : "🎬 Motion"}
                  </button>
                  {!scene.audio_url && (
                    <span className="text-dim" style={{ display: "block", fontSize: 10, marginTop: 4 }}>
                      Audio required
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-24" style={{ textAlign: "center" }}>
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <label style={{ fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={includeTranscript}
              onChange={(e) => setIncludeTranscript(e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            Show Transcript
          </label>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <button
            className="btn btn-success"
            style={{ padding: "14px 40px", fontSize: 16 }}
            onClick={handleGenVideo}
            disabled={!allReady || loadingVideo}
          >
            {loadingVideo ? (
              <><span className="spinner" /> Synthesizing...</>
            ) : videoUrl ? (
              "Re-generate Video"
            ) : (
              "Generate Video"
            )}
          </button>
          {videoUrl && !loadingVideo && (
            <button
              className="btn btn-primary"
              style={{ padding: "14px 28px", fontSize: 16 }}
              onClick={() => navigate("/preview")}
            >
              View Last Video &rarr;
            </button>
          )}
        </div>

        {/* Video synthesis progress bar */}
        {loadingVideo && (
          <div style={{ maxWidth: 420, margin: "16px auto 0" }}>
            <div style={{
              background: "var(--bg-input)",
              borderRadius: 6,
              height: 8,
              overflow: "hidden",
            }}>
              <div style={{
                width: `${Math.round(videoProgress * 100)}%`,
                height: "100%",
                background: "var(--accent)",
                borderRadius: 6,
                transition: "width 0.5s ease",
              }} />
            </div>
            <p className="text-sm text-dim" style={{ marginTop: 6 }}>
              {videoProgressLabel} ({Math.round(videoProgress * 100)}%)
            </p>
          </div>
        )}

        {!allReady && !loadingVideo && (
          <p className="text-sm text-dim mt-16">
            Generate all scene audio and visuals (image, chart, or motion) before creating the video.
          </p>
        )}
      </div>
    </div>
  );
}
