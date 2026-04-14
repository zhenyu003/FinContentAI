import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../App";
import {
  generateSocialIdea,
  generateSocialContent,
  generateSocialPostTemplate,
} from "../api/client";
import type { Idea, SocialPostTemplate } from "../types";
import SocialCustomTemplatePanel from "../components/SocialCustomTemplatePanel";

const TEMPLATES = [
  { value: "Counterintuitive", desc: "Challenge conventional wisdom with a surprising take" },
  { value: "Anxiety-Driven", desc: "Address fears and provide actionable solutions" },
  { value: "Company Breakdown", desc: "Deep-dive analysis of a specific company or stock" },
  { value: "Trend Forecast", desc: "Predict where this trend is heading and why it matters" },
  { value: "Data Reveal", desc: "Lead with compelling data points and statistics" },
];

const PLATFORMS = ["LinkedIn", "Instagram", "X"];

type SocialTemplateMode = "preset" | "custom";

export default function SocialIdeaPage() {
  const navigate = useNavigate();
  const { state, setIdea } = useProject();
  const { topic, idea } = state;

  const [templateMode, setTemplateMode] = useState<SocialTemplateMode>("preset");
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].value);
  const [socialInput, setSocialInput] = useState("");
  const [socialPostTemplate, setSocialPostTemplate] = useState<SocialPostTemplate | null>(null);
  const [loadingSocialTemplate, setLoadingSocialTemplate] = useState(false);
  const [templateApiError, setTemplateApiError] = useState("");

  const [loadingIdea, setLoadingIdea] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [opinionText, setOpinionText] = useState("");
  const [error, setError] = useState("");

  const [platforms, setPlatforms] = useState<string[]>(["LinkedIn", "Instagram", "X"]);
  const [numImages, setNumImages] = useState(3);
  const [textLength, setTextLength] = useState("Medium");
  const [style, setStyle] = useState("Professional");
  const [loadingContent, setLoadingContent] = useState(false);

  if (!topic) {
    navigate("/");
    return null;
  }

  const handleSelectPreset = (value: string) => {
    setTemplateMode("preset");
    setSelectedTemplate(value);
    setSocialPostTemplate(null);
    setTemplateApiError("");
  };

  const handleSelectCustom = () => {
    setTemplateMode("custom");
    setTemplateApiError("");
  };

  const handleGenerateSocialTemplate = async () => {
    const text = socialInput.trim();
    if (!text) return;
    setLoadingSocialTemplate(true);
    setTemplateApiError("");
    try {
      const data = await generateSocialPostTemplate(text);
      setSocialPostTemplate(data);
    } catch (e: unknown) {
      setTemplateApiError(
        e instanceof Error ? e.message : "Failed to generate social template"
      );
    } finally {
      setLoadingSocialTemplate(false);
    }
  };

  const handleGenerateIdea = async () => {
    if (templateMode === "custom" && !socialPostTemplate) {
      setError("Generate a custom template first, or switch to a preset style.");
      return;
    }
    setLoadingIdea(true);
    setError("");
    try {
      const data = (await generateSocialIdea({
        topic_title: topic.title,
        topic_summary: topic.summary,
        sources: topic.sources,
        narrative_template:
          templateMode === "custom"
            ? socialPostTemplate!.name
            : selectedTemplate,
        social_template:
          templateMode === "custom" ? socialPostTemplate! : undefined,
      })) as Idea;
      setIdea(data);
    } catch (e: unknown) {
      setError(
        "Failed to generate idea: " + (e instanceof Error ? e.message : String(e))
      );
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
    } catch (e: unknown) {
      setError(
        "Failed to generate content: " + (e instanceof Error ? e.message : String(e))
      );
    } finally {
      setLoadingContent(false);
    }
  };

  const ideaNeedsCustomTemplate = templateMode === "custom" && !socialPostTemplate;

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <button
          className="btn btn-sm"
          onClick={() => navigate("/")}
          style={{ background: "var(--bg-input)", color: "var(--text-dim)" }}
        >
          &larr; Back to Topics
        </button>
      </div>
      <div className="step-indicator">
        <span className="step" style={{ cursor: "pointer" }} onClick={() => navigate("/")}>
          1. Topic Discovery
        </span>
        <span className="arrow">&rarr;</span>
        <span className="step active">2. Social Post Idea</span>
        <span className="arrow">&rarr;</span>
        <span className="step">3. Content Studio</span>
      </div>

      <div className="card mb-16">
        <h3 style={{ marginBottom: 8 }}>{topic.title}</h3>
        <p className="text-dim text-sm">{topic.summary}</p>
      </div>

      {error && (
        <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
      )}

      <div className="section">
        <h2 className="section-title">Narrative Template</h2>
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="text-dim text-sm" style={{ marginBottom: 14 }}>
            Choose a preset style or <strong>+ Custom Template</strong> to describe your own
            single-post arc, then generate the content idea.
          </p>
          <div className="template-grid">
            {TEMPLATES.map((t) => (
              <label
                key={t.value}
                className={`template-option ${templateMode === "preset" && selectedTemplate === t.value ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="social-template"
                  checked={templateMode === "preset" && selectedTemplate === t.value}
                  onChange={() => handleSelectPreset(t.value)}
                />
                <div>
                  <div className="template-option-name">{t.value}</div>
                  <div className="text-dim" style={{ fontSize: 12, lineHeight: 1.4 }}>
                    {t.desc}
                  </div>
                </div>
              </label>
            ))}

            <label
              className={`template-option template-option--custom ${templateMode === "custom" ? "selected" : ""}`}
              style={{
                borderStyle: templateMode === "custom" ? "solid" : "dashed",
              }}
            >
              <input
                type="radio"
                name="social-template"
                checked={templateMode === "custom"}
                onChange={handleSelectCustom}
              />
              <div>
                <div className="template-option-name">+ Custom Template</div>
                <div className="text-dim" style={{ fontSize: 12, lineHeight: 1.4 }}>
                  AI-built structure for one social post (hook &rarr; CTA)
                </div>
              </div>
            </label>
          </div>

          {templateMode === "custom" && (
            <SocialCustomTemplatePanel
              userInput={socialInput}
              onUserInputChange={setSocialInput}
              template={socialPostTemplate}
              onTemplateChange={setSocialPostTemplate}
              loading={loadingSocialTemplate}
              apiError={templateApiError}
              onGenerate={handleGenerateSocialTemplate}
            />
          )}

          <button
            className="btn btn-primary mt-24"
            onClick={handleGenerateIdea}
            disabled={loadingIdea || ideaNeedsCustomTemplate}
            style={{ padding: "12px 32px" }}
            title={
              ideaNeedsCustomTemplate
                ? "Generate a custom template first"
                : undefined
            }
          >
            {loadingIdea ? (
              <>
                <span className="spinner" /> Generating...
              </>
            ) : idea ? (
              "Regenerate Idea"
            ) : (
              "Generate Idea"
            )}
          </button>
        </div>
      </div>

      {idea && (
        <div className="section">
          <h2 className="section-title">Content Idea</h2>
          <div className="card idea-box">
            <div className="idea-field">
              <label>Narrative Template</label>
              <div className="value">
                <span style={{ fontWeight: 600 }}>{idea.narrative_template}</span>
                {idea.template_reason && (
                  <span className="text-sm text-dim" style={{ marginLeft: 10 }}>
                    — {idea.template_reason}
                  </span>
                )}
              </div>
            </div>
            {idea.social_post_template && (
              <div className="idea-field">
                <label>Custom post structure</label>
                <div className="value text-sm text-dim" style={{ marginTop: 6 }}>
                  <div>
                    <strong>Tone:</strong> {idea.social_post_template.tone} ·{" "}
                    <strong>Platform style:</strong> {idea.social_post_template.platform_style}
                  </div>
                  <ol style={{ marginTop: 8, paddingLeft: "1.2rem" }}>
                    {idea.social_post_template.structure.map((row, i) => (
                      <li key={`${row.section}-${i}`} style={{ marginBottom: 6 }}>
                        <strong>{row.section}</strong> — {row.purpose}
                        <div className="text-dim" style={{ marginTop: 2 }}>
                          {row.instruction}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
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
                &ldquo;{idea.hook}&rdquo;
              </div>
            </div>
            {idea.suggested_platforms && idea.suggested_platforms.length > 0 && (
              <div className="idea-field">
                <label>Suggested Platforms</label>
                <div className="value">{idea.suggested_platforms.join(", ")}</div>
              </div>
            )}
            {step === 1 && (
              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button className="btn btn-success" onClick={() => setStep(2)}>
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
        </div>
      )}

      {step >= 2 && idea && (
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

      {step >= 3 && idea && (
        <div className="section">
          <h2 className="section-title">Content Settings</h2>
          <div className="card">
            <div style={{ marginBottom: 20 }}>
              <label className="text-sm text-dim" style={{ display: "block", marginBottom: 8 }}>
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
                      border: platforms.includes(p) ? "1px solid var(--accent)" : "1px solid var(--border)",
                      background: platforms.includes(p) ? "rgba(99, 102, 241, 0.15)" : "var(--surface2)",
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

            <div style={{ marginBottom: 20 }}>
              <label className="text-sm text-dim" style={{ display: "block", marginBottom: 8 }}>
                Number of Images
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={numImages}
                onChange={(e) =>
                  setNumImages(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))
                }
                style={{ width: 80 }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="text-sm text-dim" style={{ display: "block", marginBottom: 8 }}>
                Text Length
              </label>
              <div className="radio-group">
                {["Short", "Medium", "Long"].map((len) => (
                  <label key={len} className={`radio-option ${textLength === len ? "selected" : ""}`}>
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

            <div style={{ marginBottom: 20 }}>
              <label className="text-sm text-dim" style={{ display: "block", marginBottom: 8 }}>
                Style
              </label>
              <div className="radio-group">
                {["Professional", "Casual", "Provocative", "Educational"].map((s) => (
                  <label key={s} className={`radio-option ${style === s ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="style"
                      checked={style === s}
                      onChange={() => setStyle(s)}
                    />
                    {s}
                  </label>
                ))}
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
