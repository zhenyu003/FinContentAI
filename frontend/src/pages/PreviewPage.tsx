import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../App";
import {
  generateTitles,
  generateDescription,
  generateThumbnail,
  BACKEND,
} from "../api/client";

export default function PreviewPage() {
  const navigate = useNavigate();
  const { state, setMetadata } = useProject();
  const { topic, idea, scenes, videoUrl, aspectRatio, metadata } = state;

  const [loadingTitles, setLoadingTitles] = useState(false);
  const [loadingDesc, setLoadingDesc] = useState(false);
  const [loadingThumb, setLoadingThumb] = useState(false);
  const [error, setError] = useState("");

  if (!videoUrl) {
    navigate("/workspace");
    return null;
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
    } catch (e: any) {
      setError("Title generation failed: " + e.message);
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
    } catch (e: any) {
      setError("Description generation failed: " + e.message);
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
    } catch (e: any) {
      setError("Thumbnail generation failed: " + e.message);
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
          <video
            className="video-preview"
            controls
            src={BACKEND + videoUrl}
          />
          <div className="mt-16">
            <a
              href={BACKEND + videoUrl}
              download
              className="btn btn-primary"
            >
              Download Video
            </a>
          </div>
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
                  <a
                    href={BACKEND + metadata.thumbnailUrl}
                    download
                    className="btn btn-sm btn-secondary"
                  >
                    Download Thumbnail
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
