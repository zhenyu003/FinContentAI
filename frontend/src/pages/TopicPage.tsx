import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../App";
import { refineOpinion, generateScenes } from "../api/client";
import NarrativeTemplateSection from "../components/NarrativeTemplateSection";

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
  const { topic, idea, qaQuestions, duration, aspectRatio } = state;

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
    } catch (e: unknown) {
      setError(
        "Failed to refine opinion: " +
          (e instanceof Error ? e.message : String(e))
      );
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
    } catch (e: unknown) {
      setError(
        "Failed to generate scenes: " +
          (e instanceof Error ? e.message : String(e))
      );
    } finally {
      setLoadingScenes(false);
    }
  };

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
        <span
          className="step"
          style={{ cursor: "pointer" }}
          onClick={() => navigate("/")}
        >
          1. Topic Discovery
        </span>
        <span className="arrow">&rarr;</span>
        <span className="step active">2. Idea & Opinion</span>
        <span className="arrow">&rarr;</span>
        <span className="step">3. Asset Workstation</span>
        <span className="arrow">&rarr;</span>
        <span className="step">4. Preview & Export</span>
      </div>

      <div className="card mb-16">
        <h3 style={{ marginBottom: 8 }}>{topic.title}</h3>
        <p className="text-dim text-sm">{topic.summary}</p>
      </div>

      {error && (
        <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
      )}

      <NarrativeTemplateSection
        topic={topic}
        idea={idea}
        setIdea={setIdea}
        onGenerateError={setError}
      />

      {idea && (
        <div className="section">
          <h2 className="section-title">Content Idea</h2>
          <div className="card idea-box">
            {idea.narrative_structure ? (
              <>
                <p className="text-sm text-dim" style={{ marginBottom: 12 }}>
                  This narrative is locked in for script generation. Switch to{" "}
                  <strong>+ Custom Template</strong> above to edit, then choose{" "}
                  <strong>Use Template</strong> again.
                </p>
                <div className="idea-field">
                  <label>Active template</label>
                  <div className="value" style={{ fontWeight: 600 }}>
                    {idea.narrative_structure.name}
                  </div>
                </div>
                <div className="idea-field">
                  <label>Tone & style</label>
                  <div className="value">{idea.template_reason}</div>
                </div>
              </>
            ) : (
              <>
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
                    &ldquo;{idea.hook}&rdquo;
                  </div>
                </div>
              </>
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
                  Skip to Script Settings
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
                  {loadingRefine ? (
                    <span className="spinner" />
                  ) : (
                    "Submit & Get AI Feedback"
                  )}
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
              <label
                className="text-sm text-dim"
                style={{ display: "block", marginBottom: 8 }}
              >
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
              <label
                className="text-sm text-dim"
                style={{ display: "block", marginBottom: 8 }}
              >
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
