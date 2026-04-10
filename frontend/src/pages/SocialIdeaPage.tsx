import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../App";
import { generateSocialIdea, generateSocialContent } from "../api/client";

const TEMPLATES = [
  "Counterintuitive",
  "Anxiety-Driven",
  "Company Breakdown",
  "Trend Forecast",
  "Data Reveal",
];

const PLATFORMS = ["LinkedIn", "Instagram", "X"];

export default function SocialIdeaPage() {
  const navigate = useNavigate();
  const { state, setIdea } = useProject();
  const { topic, idea } = state;

  const [loadingIdea, setLoadingIdea] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [opinionText, setOpinionText] = useState("");
  const [error, setError] = useState("");

  // Content settings
  const [platforms, setPlatforms] = useState<string[]>(["LinkedIn", "Instagram", "X"]);
  const [numImages, setNumImages] = useState(3);
  const [textLength, setTextLength] = useState("Medium");
  const [style, setStyle] = useState("Professional");
  const [loadingContent, setLoadingContent] = useState(false);

  if (!topic) {
    navigate("/");
    return null;
  }

  const handleGenerateIdea = async () => {
    setLoadingIdea(true);
    setError("");
    try {
      const data = await generateSocialIdea({
        topic_title: topic.title,
        topic_summary: topic.summary,
        sources: topic.sources,
      });
      setIdea(data);
    } catch (e: any) {
      setError("Failed to generate idea: " + e.message);
    } finally {
      setLoadingIdea(false);
    }
  };

  const togglePlatform = (p: string) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleGenerateContent = async () => {
    if (platforms.length === 0) {
      setError("Please select at least one platform.");
      return;
    }
    setLoadingContent(true);
    setError("");
    try {
      const data = await generateSocialContent({
        topic_title: topic.title,
        topic_summary: topic.summary,
        idea: idea!,
        user_opinion: opinionText || undefined,
        config: {
          num_images: numImages,
          text_length: textLength,
          style,
          platforms,
        },
      });
      sessionStorage.setItem("social_content", JSON.stringify(data));
      sessionStorage.setItem("social_platforms", JSON.stringify(platforms));
      sessionStorage.setItem("social_topic", JSON.stringify({ title: topic.title, summary: topic.summary }));
      navigate("/social/studio");
    } catch (e: any) {
      setError("Failed to generate content: " + e.message);
    } finally {
      setLoadingContent(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <button className="btn btn-sm" onClick={() => navigate("/")} style={{ background: "var(--bg-input)", color: "var(--text-dim)" }}>&larr; Back to Topics</button>
      </div>
      <div className="step-indicator">
        <span className="step" style={{ cursor: "pointer" }} onClick={() => navigate("/")}>1. Topic Discovery</span>
        <span className="arrow">&rarr;</span>
        <span className="step active">2. Social Post Idea</span>
        <span className="arrow">&rarr;</span>
        <span className="step">3. Content Studio</span>
      </div>

      {/* Topic Info */}
      <div className="card mb-16">
        <h3 style={{ marginBottom: 8 }}>{topic.title}</h3>
        <p className="text-dim text-sm">{topic.summary}</p>
      </div>

      {error && (
        <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
      )}

      {/* Section 1: Idea Generation */}
      <div className="section">
        <div className="flex-between mb-16">
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            Content Idea
          </h2>
          <button
            className="btn btn-primary"
            onClick={handleGenerateIdea}
            disabled={loadingIdea}
          >
            {loadingIdea ? (
              <span className="spinner" />
            ) : idea ? (
              "Regenerate"
            ) : (
              "Generate Idea"
            )}
          </button>
        </div>

        {idea && (
          <div className="card idea-box">
            <div className="idea-field">
              <label>Narrative Template</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <select
                  value={idea.narrative_template}
                  onChange={(e) =>
                    setIdea({ ...idea, narrative_template: e.target.value })
                  }
                  style={{ width: "auto", minWidth: 200 }}
                >
                  {TEMPLATES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-dim">
                  {idea.template_reason}
                </span>
              </div>
            </div>
            <div className="idea-field">
              <label>Core Argument</label>
              <div className="value">{idea.core_argument}</div>
            </div>
            <div className="idea-field">
              <label>Angle</label>
              <div className="value">{idea.angle}</div>
            </div>
            <div className="idea-field">
              <label>Hook</label>
              <div className="value" style={{ fontStyle: "italic" }}>
                "{idea.hook}"
              </div>
            </div>
            {(idea as any).suggested_platforms && (
              <div className="idea-field">
                <label>Suggested Platforms</label>
                <div className="value">
                  {(idea as any).suggested_platforms.join(", ")}
                </div>
              </div>
            )}
            {step === 1 && (
              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button
                  className="btn btn-success"
                  onClick={() => setStep(2)}
                >
                  Accept & Add Opinion
                </button>
                <button
                  className="btn"
                  style={{ background: "var(--surface2)", color: "var(--text)" }}
                  onClick={() => setStep(3)}
                >
                  Skip to Content Settings
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 2: Opinion Input */}
      {step >= 2 && (
        <div className="section">
          <h2 className="section-title">Your Expert Opinion</h2>
          <div className="card">
            <textarea
              rows={5}
              placeholder="Share your professional perspective on this topic. What unique insight do you want to convey in your social posts?"
              value={opinionText}
              onChange={(e) => setOpinionText(e.target.value)}
            />
            {step === 2 && (
              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => setStep(3)}
                  disabled={!opinionText.trim()}
                >
                  Continue to Settings
                </button>
                <button
                  className="btn"
                  style={{ background: "var(--surface2)", color: "var(--text)" }}
                  onClick={() => setStep(3)}
                >
                  Skip to Content Settings
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 3: Content Settings */}
      {step >= 3 && (
        <div className="section">
          <h2 className="section-title">Content Settings</h2>
          <div className="card">
            {/* Platforms */}
            <div style={{ marginBottom: 20 }}>
              <label
                className="text-sm text-dim"
                style={{ display: "block", marginBottom: 8 }}
              >
                Platforms
              </label>
              <div style={{ display: "flex", gap: 12 }}>
                {PLATFORMS.map((p) => (
                  <label
                    key={p}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: platforms.includes(p)
                        ? "1px solid var(--accent)"
                        : "1px solid var(--border)",
                      background: platforms.includes(p)
                        ? "rgba(99, 102, 241, 0.15)"
                        : "var(--surface2)",
                      transition: "all 0.2s",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={platforms.includes(p)}
                      onChange={() => togglePlatform(p)}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>

            {/* Number of Images */}
            <div style={{ marginBottom: 20 }}>
              <label
                className="text-sm text-dim"
                style={{ display: "block", marginBottom: 8 }}
              >
                Number of Images
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={numImages}
                onChange={(e) =>
                  setNumImages(
                    Math.max(1, Math.min(10, parseInt(e.target.value) || 1))
                  )
                }
                style={{ width: 80 }}
              />
            </div>

            {/* Text Length */}
            <div style={{ marginBottom: 20 }}>
              <label
                className="text-sm text-dim"
                style={{ display: "block", marginBottom: 8 }}
              >
                Text Length
              </label>
              <div className="radio-group">
                {["Short", "Medium", "Long"].map((len) => (
                  <label
                    key={len}
                    className={`radio-option ${textLength === len ? "selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="textLength"
                      checked={textLength === len}
                      onChange={() => setTextLength(len)}
                    />
                    {len}
                  </label>
                ))}
              </div>
            </div>

            {/* Style */}
            <div style={{ marginBottom: 20 }}>
              <label
                className="text-sm text-dim"
                style={{ display: "block", marginBottom: 8 }}
              >
                Style
              </label>
              <div className="radio-group">
                {["Professional", "Casual", "Provocative", "Educational"].map(
                  (s) => (
                    <label
                      key={s}
                      className={`radio-option ${style === s ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="style"
                        checked={style === s}
                        onChange={() => setStyle(s)}
                      />
                      {s}
                    </label>
                  )
                )}
              </div>
            </div>

            <button
              className="btn btn-success mt-16"
              onClick={handleGenerateContent}
              disabled={loadingContent || !idea || platforms.length === 0}
              style={{ padding: "14px 40px", fontSize: 16 }}
            >
              {loadingContent ? (
                <>
                  <span className="spinner" /> Generating Content...
                </>
              ) : (
                "Generate Content"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
