import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useProject } from "../App";
import {
  generateTitles,
  generateDescription,
  generateThumbnail,
  BACKEND,
} from "../api/client";

/** Cross-origin safe download via fetch + blob. */
async function downloadFile(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export default function PreviewPage() {
  const navigate = useNavigate();
  const { state, setMetadata } = useProject();
  const { topic, idea, scenes, videoUrl, aspectRatio, metadata } = state;
  const isVertical = aspectRatio === "9:16";

  const [loadingTitles, setLoadingTitles] = useState(false);
  const [loadingDesc, setLoadingDesc] = useState(false);
  const [loadingThumb, setLoadingThumb] = useState(false);
  const [error, setError] = useState("");
  const [videoError, setVideoError] = useState(false);

  if (!videoUrl) {
    return <Navigate to="/workspace" replace />;
  }

  const handleGenTitles = async () => {
    setLoadingTitles(true);
    setError("");
    try {
      const data = await generateTitles({
        topic_title: topic!.title,
        topic_summary: topic!.summary,
        idea: idea!,
        narrative_template: idea!.narrative_template,
      });
      setMetadata({
        titles: data.titles || [],
        selectedTitle: data.titles?.[0] || "",
      });
    } catch (e: unknown) {
      setError("Title generation failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoadingTitles(false);
    }
  };

  const handleGenDesc = async () => {
    setLoadingDesc(true);
    setError("");
    try {
      const data = await generateDescription({
        topic_title: topic!.title,
        topic_summary: topic!.summary,
        idea: idea!,
        narration_texts: scenes.map((s) => s.narration),
      });
      setMetadata({ description: data.description || "" });
    } catch (e: unknown) {
      setError("Description generation failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoadingDesc(false);
    }
  };

  const handleGenThumb = async () => {
    setLoadingThumb(true);
    setError("");
    try {
      const prompt = `YouTube thumbnail for financial video: "${metadata.selectedTitle || topic!.title}". Bold, eye-catching, professional financial style with strong contrast.`;
      const data = await generateThumbnail(prompt, aspectRatio);
      setMetadata({ thumbnailUrl: data.thumbnail_url });
    } catch (e: unknown) {
      setError("Thumbnail generation failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoadingThumb(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <button
          className="btn btn-sm btn-secondary"
          onClick={() => navigate("/workspace")}
        >
          &larr; Back to Asset Workstation
        </button>
      </div>
      <div className="step-indicator">
        <span className="step">1. Topic Discovery</span>
        <span className="arrow">&rarr;</span>
        <span className="step">2. Idea & Opinion</span>
        <span className="arrow">&rarr;</span>
        <span className="step">3. Asset Workstation</span>
        <span className="arrow">&rarr;</span>
        <span className="step active">4. Preview & Export</span>
      </div>

      {error && (
        <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
      )}

      {/* Video Preview */}
      <div className="section">
        <h2 className="section-title">Video Preview</h2>
        <div className="card" style={{ textAlign: "center" }}>
          {videoError ? (
            <div style={{ padding: "40px 20px", color: "var(--text-dim)" }}>
              <p style={{ fontSize: 16, marginBottom: 12 }}>Video file is no longer available.</p>
              <button className="btn btn-primary" onClick={() => navigate("/workspace")}>
                &larr; Back to Workstation to re-generate
              </button>
            </div>
          ) : (
            <>
              <video
                className="video-preview"
                style={isVertical ? { maxWidth: 320, width: "auto", maxHeight: "70vh" } : undefined}
                controls
                src={BACKEND + videoUrl}
                onError={() => setVideoError(true)}
              />
              <div className="mt-16">
                <button
                  className="btn btn-primary"
                  onClick={() => downloadFile(BACKEND + videoUrl, "video.mp4")}
                >
                  Download Video
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* YouTube Metadata */}
      <div className="section">
        <h2 className="section-title">YouTube Metadata</h2>

        <div className="metadata-section">
          {/* Titles */}
          <div className="card">
            <div className="flex-between mb-16">
              <h3>Video Title</h3>
              <button
                className="btn btn-sm btn-secondary"
                onClick={handleGenTitles}
                disabled={loadingTitles}
              >
                {loadingTitles ? (
                  <span className="spinner" />
                ) : metadata.titles.length > 0 ? (
                  "Regenerate"
                ) : (
                  "Generate Titles"
                )}
              </button>
            </div>
            {metadata.titles.length > 0 && (
              <div className="title-options">
                {metadata.titles.map((t, i) => (
                  <label
                    key={i}
                    className={`title-option ${
                      metadata.selectedTitle === t ? "selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="title"
                      checked={metadata.selectedTitle === t}
                      onChange={() => setMetadata({ selectedTitle: t })}
                    />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
            )}
            {metadata.selectedTitle && (
              <input
                className="mt-16"
                value={metadata.selectedTitle}
                onChange={(e) =>
                  setMetadata({ selectedTitle: e.target.value })
                }
                placeholder="Edit title..."
              />
            )}
          </div>

          {/* Description */}
          <div className="card">
            <div className="flex-between mb-16">
              <h3>Video Description</h3>
              <button
                className="btn btn-sm btn-secondary"
                onClick={handleGenDesc}
                disabled={loadingDesc}
              >
                {loadingDesc ? (
                  <span className="spinner" />
                ) : metadata.description ? (
                  "Regenerate"
                ) : (
                  "Generate Description"
                )}
              </button>
            </div>
            {metadata.description && (
              <textarea
                rows={8}
                value={metadata.description}
                onChange={(e) =>
                  setMetadata({ description: e.target.value })
                }
              />
            )}
          </div>

          {/* Thumbnail */}
          <div className="card">
            <div className="flex-between mb-16">
              <h3>Thumbnail</h3>
              <button
                className="btn btn-sm btn-secondary"
                onClick={handleGenThumb}
                disabled={loadingThumb}
              >
                {loadingThumb ? (
                  <span className="spinner" />
                ) : metadata.thumbnailUrl ? (
                  "Regenerate"
                ) : (
                  "Generate Thumbnail"
                )}
              </button>
            </div>
            {metadata.thumbnailUrl && (
              <div>
                <img
                  className="thumbnail-preview"
                  src={BACKEND + metadata.thumbnailUrl}
                  alt="Thumbnail"
                />
                <div className="mt-16">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => downloadFile(BACKEND + metadata.thumbnailUrl!, "thumbnail.png")}
                  >
                    Download Thumbnail
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
