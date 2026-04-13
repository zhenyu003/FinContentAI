import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../App";
import { generateIdea, refineOpinion, generateScenes } from "../api/client";
import type { Idea } from "../types";

const TEMPLATES = [
  { value: "Counterintuitive", desc: "Challenge conventional wisdom with a surprising take" },
  { value: "Anxiety-Driven", desc: "Address fears and provide actionable solutions" },
  { value: "Company Breakdown", desc: "Deep-dive analysis of a specific company or stock" },
  { value: "Trend Forecast", desc: "Predict where this trend is heading and why it matters" },
  { value: "Data Reveal", desc: "Lead with compelling data points and statistics" },
];

type TemplateType = "preset" | "custom";

export default function TopicPage() {
  const navigate = useNavigate();
  const {
    state,
    setIdea,
    setUserOpinion,
    setQA,
    setDuration,
    setAspectRatio,
    setScenes,
  } = useProject();
  const { topic, idea, qaQuestions, qaAnswers, duration, aspectRatio } = state;

  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].value);
  const [templateType, setTemplateType] = useState<TemplateType>("preset");
  const [customFields, setCustomFields] = useState({
    coreArgument: "",
    angle: "",
    hook: "",
    cta: "",
  });
  const [loadingIdea, setLoadingIdea] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [opinionText, setOpinionText] = useState("");
  const [loadingRefine, setLoadingRefine] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const [loadingScenes, setLoadingScenes] = useState(false);
  const [error, setError] = useState("");

  if (!topic) {
    navigate("/");
    return null;
  }

  const handleGenerateIdea = async () => {
    setLoadingIdea(true);
    setError("");
    try {
      if (templateType === "custom") {
        const customIdea: Idea = {
          narrative_template: "Custom",
          template_reason: "User-defined narrative structure",
          core_argument: customFields.coreArgument,
          angle: customFields.angle,
          hook: customFields.hook,
        };
        setIdea(customIdea);
      } else {
        const data = await generateIdea(
          topic.title,
          topic.summary,
          topic.sources,
          selectedTemplate
        );
        setIdea(data as Idea);
      }
    } catch (e: any) {
      setError("Failed to generate idea: " + e.message);
    } finally {
      setLoadingIdea(false);
    }
  };

  const handleSelectPreset = (value: string) => {
    setTemplateType("preset");
    setSelectedTemplate(value);
  };

  const handleSelectCustom = () => {
    setTemplateType("custom");
  };

  const customReady =
    customFields.coreArgument.trim() !== "" &&
    customFields.angle.trim() !== "" &&
    customFields.hook.trim() !== "";

  const handleRefine = async () => {
    if (!opinionText.trim()) return;
    setLoadingRefine(true);
    setError("");
    setUserOpinion(opinionText);
    try {
      const data = await refineOpinion(
        topic.title,
        topic.summary,
        idea!,
        opinionText
      );
      const questions = data.questions || [];
      setQA(questions, new Array(questions.length).fill(""));
      setAnswers(new Array(questions.length).fill(""));
      setStep(3);
    } catch (e: any) {
      setError("Failed to refine opinion: " + e.message);
    } finally {
      setLoadingRefine(false);
    }
  };

  const handleGenerateScript = async () => {
    setLoadingScenes(true);
    setError("");
    setQA(qaQuestions, answers);
    try {
      const data = await generateScenes({
        topic_title: topic.title,
        topic_summary: topic.summary,
        idea: idea!,
        user_opinion: state.userOpinion || opinionText,
        qa_answers: answers,
        duration,
        narrative_template: idea!.narrative_template,
      });
      setScenes(data.scenes || []);
      navigate("/workspace");
    } catch (e: any) {
      setError("Failed to generate scenes: " + e.message);
    } finally {
      setLoadingScenes(false);
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
        <span className="step active">2. Idea & Opinion</span>
        <span className="arrow">&rarr;</span>
        <span className="step">3. Asset Workstation</span>
        <span className="arrow">&rarr;</span>
        <span className="step">4. Preview & Export</span>
      </div>

      {/* Topic Info */}
      <div className="card mb-16">
        <h3 style={{ marginBottom: 8 }}>{topic.title}</h3>
        <p className="text-dim text-sm">{topic.summary}</p>
      </div>

      {error && (
        <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
      )}

      {/* Narrative Template Selection + Generate */}
      <div className="section">
        <h2 className="section-title">Narrative Template</h2>
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="text-dim text-sm" style={{ marginBottom: 14 }}>
            Choose a narrative style, then generate the content idea.<br />
            The system will adapt the content based on your selected narrative template.
          </p>
          <div className="template-grid">
            {TEMPLATES.map((t) => (
              <label
                key={t.value}
                className={`template-option ${templateType === "preset" && selectedTemplate === t.value ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="template"
                  checked={templateType === "preset" && selectedTemplate === t.value}
                  onChange={() => handleSelectPreset(t.value)}
                />
                <div>
                  <div className="template-option-name">{t.value}</div>
                  <div className="text-dim" style={{ fontSize: 12, lineHeight: 1.4 }}>{t.desc}</div>
                </div>
              </label>
            ))}

            {/* Custom Template Card */}
            <label
              className={`template-option template-option--custom ${templateType === "custom" ? "selected" : ""}`}
              style={{
                borderStyle: templateType === "custom" ? "solid" : "dashed",
              }}
            >
              <input
                type="radio"
                name="template"
                checked={templateType === "custom"}
                onChange={handleSelectCustom}
              />
              <div>
                <div className="template-option-name">+ Custom Template</div>
                <div className="text-dim" style={{ fontSize: 12, lineHeight: 1.4 }}>
                  Create your own narrative structure
                </div>
              </div>
            </label>
          </div>

          {/* Custom Template Panel */}
          {templateType === "custom" && (
            <div className="custom-template-panel">
              <div className="custom-template-fields">
                <div>
                  <label className="text-sm text-dim" style={{ display: "block", marginBottom: 4 }}>
                    Core Argument *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="What's the main claim or insight?"
                    value={customFields.coreArgument}
                    onChange={(e) =>
                      setCustomFields((f) => ({ ...f, coreArgument: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm text-dim" style={{ display: "block", marginBottom: 4 }}>
                    Angle *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="What unique perspective are you taking?"
                    value={customFields.angle}
                    onChange={(e) =>
                      setCustomFields((f) => ({ ...f, angle: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm text-dim" style={{ display: "block", marginBottom: 4 }}>
                    Hook *
                  </label>
                  <textarea
                    rows={2}
                    placeholder="What's the first sentence to grab attention?"
                    value={customFields.hook}
                    onChange={(e) =>
                      setCustomFields((f) => ({ ...f, hook: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm text-dim" style={{ display: "block", marginBottom: 4 }}>
                    CTA (optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="What action should the audience take?"
                    value={customFields.cta}
                    onChange={(e) =>
                      setCustomFields((f) => ({ ...f, cta: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          )}

          <button
            className="btn btn-primary mt-24"
            onClick={handleGenerateIdea}
            disabled={loadingIdea || (templateType === "custom" && !customReady)}
            style={{ padding: "12px 32px" }}
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

      {/* Generated Idea */}
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
            <div className="idea-field">
              <label>Core Argument</label>
              <div className="value">{idea.core_argument}</div>
            </div>
            <div className="idea-field">
              <label>Angle</label>
              <div className="value">{idea.angle}</div>
            </div>
            <div className="idea-field">
              <label>Hook (First 15 seconds)</label>
              <div className="value" style={{ fontStyle: "italic" }}>
                "{idea.hook}"
              </div>
            </div>
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
                  Skip to Script Settings
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 2: Opinion Input */}
      {step >= 2 && idea && (
        <div className="section">
          <h2 className="section-title">Your Expert Opinion</h2>
          <div className="card">
            <textarea
              rows={5}
              placeholder="Share your professional judgment on this topic. What's your unique perspective? What do most people get wrong?"
              value={opinionText}
              onChange={(e) => setOpinionText(e.target.value)}
            />
            {step === 2 && (
              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleRefine}
                  disabled={loadingRefine || !opinionText.trim()}
                >
                  {loadingRefine ? <span className="spinner" /> : "Submit & Get AI Feedback"}
                </button>
                <button
                  className="btn"
                  style={{ background: "var(--surface2)", color: "var(--text)" }}
                  onClick={() => {
                    if (opinionText.trim()) setUserOpinion(opinionText);
                    setStep(3);
                  }}
                >
                  Skip to Script Settings
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 3: AI Questions + Duration/Format */}
      {step >= 3 && idea && (
        <div className="section">
          {qaQuestions.length > 0 && (
            <div className="card mb-16">
              <h3 style={{ marginBottom: 16 }}>AI Follow-up Questions</h3>
              {qaQuestions.map((q, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <p className="text-sm" style={{ marginBottom: 6, fontWeight: 500 }}>
                    {q}
                  </p>
                  <textarea
                    rows={2}
                    placeholder="Your answer..."
                    value={answers[i] || ""}
                    onChange={(e) => {
                      const newA = [...answers];
                      newA[i] = e.target.value;
                      setAnswers(newA);
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Video Settings</h3>
            <div style={{ marginBottom: 16 }}>
              <label className="text-sm text-dim" style={{ display: "block", marginBottom: 8 }}>
                Duration
              </label>
              <div className="radio-group">
                {["3min", "5min", "8min"].map((d) => (
                  <label
                    key={d}
                    className={`radio-option ${duration === d ? "selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="duration"
                      checked={duration === d}
                      onChange={() => setDuration(d)}
                    />
                    {d === "3min"
                      ? "3 min (~6-8 scenes)"
                      : d === "5min"
                      ? "5 min (~10-12 scenes)"
                      : "8 min (~16-18 scenes)"}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="text-sm text-dim" style={{ display: "block", marginBottom: 8 }}>
                Video Format
              </label>
              <div className="radio-group">
                {[
                  { v: "16:9", l: "Horizontal 16:9 (YouTube)" },
                  { v: "9:16", l: "Vertical 9:16 (Shorts/Reels)" },
                ].map(({ v, l }) => (
                  <label
                    key={v}
                    className={`radio-option ${aspectRatio === v ? "selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="aspect"
                      checked={aspectRatio === v}
                      onChange={() => setAspectRatio(v)}
                    />
                    {l}
                  </label>
                ))}
              </div>
            </div>
            <button
              className="btn btn-success mt-16"
              onClick={handleGenerateScript}
              disabled={loadingScenes}
            >
              {loadingScenes ? (
                <>
                  <span className="spinner" /> Generating Script...
                </>
              ) : (
                "Generate Script"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
