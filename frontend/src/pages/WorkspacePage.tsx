import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../App";
import {
  generateImage,
  generateAudio,
  generateVideo,
  BACKEND,
} from "../api/client";

const VOICES = ["Kore", "Charon", "Fenrir", "Aoede", "Puck", "Leda"];

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

  if (scenes.length === 0) {
    navigate("/topic");
    return null;
  }

  const handleGenImage = async (index: number) => {
    setLoadingImg((s) => ({ ...s, [index]: true }));
    try {
      const data = await generateImage(scenes[index].description, aspectRatio);
      updateScene(index, { image_url: data.image_url });
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

  const allReady = scenes.every((s) => s.image_url && s.audio_url);

  const handleGenVideo = async () => {
    setLoadingVideo(true);
    setError("");
    try {
      const sceneInputs = scenes.map((s) => ({
        image_path: s.image_url!.replace(/^\//, ""),
        audio_path: s.audio_url!.replace(/^\//, ""),
        narration: s.narration,
      }));
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
      <div className="step-indicator">
        <span className="step">1. Topic Discovery</span>
        <span className="arrow">&rarr;</span>
        <span className="step">2. Idea & Opinion</span>
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
                <td className="media-cell">
                  {scene.image_url && (
                    <img
                      src={BACKEND + scene.image_url}
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
            Generate all images and audio before creating the video.
          </p>
        )}
      </div>
    </div>
  );
}
