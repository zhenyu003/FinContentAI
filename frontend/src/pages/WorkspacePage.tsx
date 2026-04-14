import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../App";
import {
  generateImage,
  generateAudio,
  generateVideo,
  generateMotionVeo,
  uploadChartImage,
  BACKEND,
} from "../api/client";
import type { SceneMode, ChartConfig } from "../types";
import ChartConfigPanel from "../components/ChartConfigPanel";

const VOICES = ["Kore", "Charon", "Fenrir", "Aoede", "Puck", "Leda"];
const SCENE_MODES: { value: SceneMode; label: string }[] = [
  { value: "image", label: "Image" },
  { value: "chart", label: "Chart" },
  { value: "motion", label: "Motion" },
];
export default function WorkspacePage() {
  const navigate = useNavigate();
  const { state, updateScene, setVideoUrl } = useProject();
  const { scenes, aspectRatio } = state;

  const [voice, setVoice] = useState("Kore");
  const [loadingImg, setLoadingImg] = useState<Record<number, boolean>>({});
  const [loadingAudio, setLoadingAudio] = useState<Record<number, boolean>>({});
  const [loadingAllImg, setLoadingAllImg] = useState(false);
  const [loadingAllAudio, setLoadingAllAudio] = useState(false);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [error, setError] = useState("");
  const [sceneModes, setSceneModes] = useState<Record<number, SceneMode>>({});
  const [chartDataUrls, setChartDataUrls] = useState<Record<number, string>>({});
  const [loadingMotion, setLoadingMotion] = useState<Record<number, boolean>>({});

  const getSceneMode = (i: number): SceneMode => sceneModes[i] ?? "image";

  const setSceneModeFor = (i: number, mode: SceneMode) => {
    setSceneModes((prev) => ({ ...prev, [i]: mode }));
    updateScene(i, { mode, type: mode });
  };

  const handleChartImage = useCallback(
    async (index: number, dataUrl: string, config: ChartConfig) => {
      setChartDataUrls((prev) => ({ ...prev, [index]: dataUrl }));
      try {
        const { image_url } = await uploadChartImage(dataUrl);
        updateScene(index, { image_url, chartConfig: config, mode: "chart", type: "chart" });
      } catch {
        updateScene(index, { image_url: dataUrl, chartConfig: config, mode: "chart", type: "chart" });
      }
    },
    [updateScene],
  );

  const handleGenMotion = async (index: number) => {
    setLoadingMotion((s) => ({ ...s, [index]: true }));
    try {
      const scene = scenes[index];
      const { video_url } = await generateMotionVeo({
        description: scene.description,
        narration: scene.narration,
        aspect_ratio: aspectRatio,
      });
      updateScene(index, {
        motion_url: video_url,
        mode: "motion",
        type: "motion",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Motion (Veo) failed for scene ${index + 1}: ${msg}`);
    } finally {
      setLoadingMotion((s) => ({ ...s, [index]: false }));
    }
  };

  if (scenes.length === 0) {
    navigate("/topic");
    return null;
  }

  const handleGenImage = async (index: number) => {
    setLoadingImg((s) => ({ ...s, [index]: true }));
    try {
      const data = await generateImage(scenes[index].description, aspectRatio);
      updateScene(index, { image_url: data.image_url, type: "image", mode: "image" });
    } catch (e: any) {
      setError(`Image gen failed for scene ${index + 1}: ${e.message}`);
    } finally {
      setLoadingImg((s) => ({ ...s, [index]: false }));
    }
  };

  const handleGenAudio = async (index: number) => {
    setLoadingAudio((s) => ({ ...s, [index]: true }));
    try {
      const data = await generateAudio(scenes[index].narration, voice);
      updateScene(index, { audio_url: data.audio_url });
    } catch (e: any) {
      setError(`Audio gen failed for scene ${index + 1}: ${e.message}`);
    } finally {
      setLoadingAudio((s) => ({ ...s, [index]: false }));
    }
  };

  const handleGenAllImages = async () => {
    setLoadingAllImg(true);
    for (let i = 0; i < scenes.length; i++) {
      if (getSceneMode(i) === "motion") continue;
      if (!scenes[i].image_url) {
        await handleGenImage(i);
      }
    }
    setLoadingAllImg(false);
  };

  const handleGenAllAudio = async () => {
    setLoadingAllAudio(true);
    for (let i = 0; i < scenes.length; i++) {
      if (!scenes[i].audio_url) {
        await handleGenAudio(i);
      }
    }
    setLoadingAllAudio(false);
  };

  const allReady = scenes.every((s, i) => {
    if (!s.audio_url) return false;
    if (getSceneMode(i) === "motion") return !!s.motion_url;
    return !!s.image_url;
  });

  const handleGenVideo = async () => {
    setLoadingVideo(true);
    setError("");
    try {
      const sceneInputs = scenes.map((s, i) => {
        const audio_path = s.audio_url!.replace(/^\//, "");
        if (getSceneMode(i) === "motion") {
          return {
            video_clip_path: s.motion_url!.replace(/^\//, ""),
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
      const data = await generateVideo(sceneInputs, aspectRatio);
      setVideoUrl(data.video_url);
      navigate("/preview");
    } catch (e: any) {
      setError("Video generation failed: " + e.message);
    } finally {
      setLoadingVideo(false);
    }
  };

  return (
    <div>
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
        <span className="step">4. Preview & Export</span>
      </div>

      {error && (
        <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
      )}

      <div className="toolbar">
        <label className="text-sm text-dim">Voice:</label>
        <select
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          style={{ width: 140 }}
        >
          {VOICES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
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
        <div style={{ flex: 1 }} />
        <span className="badge">{aspectRatio}</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table className="scene-table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th style={{ width: "30%" }}>Description</th>
              <th style={{ width: "30%" }}>Narration</th>
              <th className="media-cell">Image</th>
              <th className="media-cell">Audio</th>
            </tr>
          </thead>
          <tbody>
            {scenes.map((scene, i) => (
              <tr key={i}>
                <td className="num">{scene.scene_number}</td>
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
                <td className="media-cell" style={{ width: getSceneMode(i) === "chart" ? 520 : 180 }}>
                  {/* 3-mode segmented control */}
                  <div className="scene-mode-toggle">
                    {SCENE_MODES.map((m) => (
                      <button
                        key={m.value}
                        onClick={() => setSceneModeFor(i, m.value)}
                        className={`scene-mode-btn ${getSceneMode(i) === m.value ? "active" : ""}`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* === Image mode === */}
                  {getSceneMode(i) === "image" && (
                    <>
                      {scene.image_url && (
                        <img
                          src={scene.image_url.startsWith("data:") ? scene.image_url : BACKEND + scene.image_url}
                          alt={`Scene ${scene.scene_number}`}
                        />
                      )}
                      <br />
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleGenImage(i)}
                        disabled={loadingImg[i]}
                      >
                        {loadingImg[i] ? (
                          <span className="spinner" />
                        ) : scene.image_url ? (
                          "Regen"
                        ) : (
                          "Generate"
                        )}
                      </button>
                    </>
                  )}

                  {/* === Chart mode === */}
                  {getSceneMode(i) === "chart" && (
                    <>
                      {chartDataUrls[i] && (
                        <>
                          <img src={chartDataUrls[i]} alt={`Scene ${scene.scene_number} chart`} />
                          <span style={{ display: "block", fontSize: 10, color: "var(--text-dim)", marginBottom: 4 }}>
                            Generated Chart (Data Visualization)
                          </span>
                        </>
                      )}
                      <ChartConfigPanel
                        description={scene.description}
                        onChartImage={(dataUrl, config) => handleChartImage(i, dataUrl, config)}
                      />
                    </>
                  )}

                  {/* === Motion mode === */}
                  {getSceneMode(i) === "motion" && (
                    <>
                      {loadingMotion[i] && (
                        <p className="text-sm text-dim" style={{ margin: "8px 0", display: "flex", alignItems: "center", gap: 8 }}>
                          <span className="spinner" />
                          Generating AI video...
                        </p>
                      )}
                      {!loadingMotion[i] && scene.motion_url && (
                        <video
                          controls
                          autoPlay
                          loop
                          playsInline
                          style={{ width: "100%", maxHeight: 220, borderRadius: 6 }}
                          src={BACKEND + scene.motion_url}
                        />
                      )}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleGenMotion(i)}
                          disabled={loadingMotion[i] || !!scene.motion_url}
                        >
                          Generate Motion
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleGenMotion(i)}
                          disabled={loadingMotion[i] || !scene.motion_url}
                        >
                          Regenerate Motion
                        </button>
                      </div>
                    </>
                  )}
                </td>
                <td className="media-cell">
                  {scene.audio_url && (
                    <audio controls src={BACKEND + scene.audio_url} />
                  )}
                  <br />
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleGenAudio(i)}
                    disabled={loadingAudio[i]}
                  >
                    {loadingAudio[i] ? (
                      <span className="spinner" />
                    ) : scene.audio_url ? (
                      "Regen"
                    ) : (
                      "Generate"
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-24" style={{ textAlign: "center" }}>
        <button
          className="btn btn-success"
          style={{ padding: "14px 40px", fontSize: 16 }}
          onClick={handleGenVideo}
          disabled={!allReady || loadingVideo}
        >
          {loadingVideo ? (
            <><span className="spinner" /> Synthesizing Video...</>
          ) : (
            "Generate Video"
          )}
        </button>
        {!allReady && (
          <p className="text-sm text-dim mt-16">
            Generate all scene visuals (image, chart, or motion) and audio before creating the video.
          </p>
        )}
      </div>
    </div>
  );
}
