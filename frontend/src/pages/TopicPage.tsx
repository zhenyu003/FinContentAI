import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useProject } from "../App";
import { refineOpinion, generateScenes } from "../api/client";
import NarrativeTemplateSection from "../components/NarrativeTemplateSection";

interface QAItem {
  question: string;
  suggestions: string[];
}

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
  const [qaItems, setQaItems] = useState<QAItem[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [customOpen, setCustomOpen] = useState<boolean[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [loadingScenes, setLoadingScenes] = useState(false);
  const [error, setError] = useState("");
  const [ideaKnowledgeUsed, setIdeaKnowledgeUsed] = useState(false);
  const [scenesKnowledgeUsed, setScenesKnowledgeUsed] = useState(false);

  if (!topic) {
    return <Navigate to="/" replace />;
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
      const items: QAItem[] = (data.questions || []).map(
        (q: { question: string; suggestions?: string[] }) => ({
          question: q.question,
          suggestions: q.suggestions || [],
        })
      );
      setQaItems(items);
      const questionStrings = items.map((q) => q.question);
      setQA(questionStrings, new Array(items.length).fill(""));
      setAnswers(new Array(items.length).fill(""));
      setCustomOpen(new Array(items.length).fill(false));
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

  const selectSuggestion = (qIndex: number, text: string) => {
    const newAnswers = [...answers];
    newAnswers[qIndex] = text;
    setAnswers(newAnswers);
    const newCustom = [...customOpen];
    newCustom[qIndex] = false;
    setCustomOpen(newCustom);
    setEditingIndex(null);
  };

  const startEditing = (qIndex: number) => {
    setEditingIndex(qIndex);
    const newCustom = [...customOpen];
    newCustom[qIndex] = false;
    setCustomOpen(newCustom);
  };

  const openCustom = (qIndex: number) => {
    const newCustom = [...customOpen];
    newCustom[qIndex] = true;
    setCustomOpen(newCustom);
    setEditingIndex(null);
  };

  const handleGenerateScript = async () => {
    setLoadingScenes(true);
    setError("");
    setScenesKnowledgeUsed(false);
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
      if (data.knowledge_used) setScenesKnowledgeUsed(true);
      setScenes(data.scenes || []);
      navigate("/workspace", { state: { knowledgeUsed: !!data.knowledge_used } });
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
        onKnowledgeUsed={setIdeaKnowledgeUsed}
      />

      {idea && (
        <div className="section">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>Content Idea</h2>
            {ideaKnowledgeUsed && (
              <span style={{ fontSize: 12, color: "var(--accent)" }}>
                ✦ Enhanced with your Knowledge Base
              </span>
            )}
          </div>
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
                  Add My Opinion
                </button>
                <button
                  className="btn"
                  style={{ background: "var(--surface2)", color: "var(--text)" }}
                  onClick={() => setStep(3)}
                >
                  Go to Script Settings
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 2 && idea && (
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
                  Go to Script Settings
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {step >= 3 && idea && (
        <div className="section">
          {qaItems.length > 0 && (
            <div className="card mb-16">
              <h3 style={{ marginBottom: 16 }}>AI Follow-up Questions</h3>
              {qaItems.map((item, i) => {
                const isCustom = customOpen[i];
                const isEditing = editingIndex === i;
                const currentAnswer = answers[i] || "";
                const matchedSuggestion = !isCustom && !isEditing
                  ? item.suggestions.findIndex((s) => s === currentAnswer)
                  : -1;

                return (
                  <div key={i} className="qa-item">
                    <p className="qa-question">{item.question}</p>

                    {isEditing ? (
                      <div>
                        <textarea
                          rows={2}
                          className="qa-custom-input"
                          autoFocus
                          value={currentAnswer}
                          onChange={(e) => {
                            const newA = [...answers];
                            newA[i] = e.target.value;
                            setAnswers(newA);
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ marginTop: 6 }}
                          onClick={() => setEditingIndex(null)}
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      <div className="qa-suggestions">
                        {item.suggestions.map((s, si) => (
                          <div key={si} className="qa-chip-row">
                            <button
                              type="button"
                              className={`qa-chip ${matchedSuggestion === si ? "active" : ""}`}
                              onClick={() => selectSuggestion(i, s)}
                            >
                              {matchedSuggestion === si ? currentAnswer : s}
                            </button>
                            {matchedSuggestion === si && (
                              <button
                                type="button"
                                className="qa-edit-btn"
                                title="Edit this answer"
                                onClick={() => startEditing(i)}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                        <div className="qa-chip-row">
                          <button
                            type="button"
                            className={`qa-chip qa-chip--custom ${isCustom ? "active" : ""}`}
                            onClick={() => openCustom(i)}
                          >
                            Custom...
                          </button>
                        </div>
                        {isCustom && (
                          <textarea
                            rows={2}
                            className="qa-custom-input"
                            autoFocus
                            placeholder="Type your own take..."
                            value={currentAnswer}
                            onChange={(e) => {
                              const newA = [...answers];
                              newA[i] = e.target.value;
                              setAnswers(newA);
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
                {["90s", "3min", "5min"].map((d) => (
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
                    {d === "90s"
                      ? "90s (~3-4 scenes)"
                      : d === "3min"
                        ? "3 min (~6-8 scenes)"
                        : "5 min (~10-12 scenes)"}
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
