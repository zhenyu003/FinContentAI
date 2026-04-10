import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../App";
import { generateIdea, refineOpinion, generateScenes } from "../api/client";
import type { Idea } from "../types";

const TEMPLATES = [
  "Counterintuitive",
  "Anxiety-Driven",
  "Company Breakdown",
  "Trend Forecast",
  "Data Reveal",
];

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
      const data = await generateIdea(
        topic.title,
        topic.summary,
        topic.sources
      );
      setIdea(data as Idea);
    } catch (e: any) {
      setError("Failed to generate idea: " + e.message);
    } finally {
      setLoadingIdea(false);
    }
  };

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
        )}
      </div>

      {/* Section 2: Opinion Input */}
      {step >= 2 && (
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
      {step >= 3 && (
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
