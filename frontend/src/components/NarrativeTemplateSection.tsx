import { useState, useEffect, useMemo, useCallback } from "react";
import {
  generateIdea,
  recommendTemplate,
  listNarrativeTemplates,
  deleteNarrativeTemplate,
  type SavedNarrativeTemplate,
} from "../api/client";
import type { Idea, NarrativeStructure, Topic } from "../types";
import NarrativeBuilder, { narrativeStructureToIdea } from "./NarrativeBuilder";

const TEMPLATES = [
  { value: "Counterintuitive", desc: "Challenge conventional wisdom with a surprising take" },
  { value: "Anxiety-Driven", desc: "Address fears and provide actionable solutions" },
  { value: "Company Breakdown", desc: "Deep-dive analysis of a specific company or stock" },
  { value: "Trend Forecast", desc: "Predict where this trend is heading and why it matters" },
  { value: "Data Reveal", desc: "Lead with compelling data points and statistics" },
];

type TemplateMode = "preset" | "saved" | "custom";

type Props = {
  topic: Topic;
  idea: Idea | null;
  setIdea: (idea: Idea) => void;
  onGenerateError: (message: string) => void;
  onKnowledgeUsed?: (used: boolean) => void;
};

function toStructure(t: SavedNarrativeTemplate): NarrativeStructure {
  return { name: t.name, tone: t.tone, beats: t.beats };
}

export default function NarrativeTemplateSection({
  topic,
  idea,
  setIdea,
  onGenerateError,
  onKnowledgeUsed,
}: Props) {
  const [templateMode, setTemplateMode] = useState<TemplateMode>("preset");
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].value);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [recommendedTemplate, setRecommendedTemplate] = useState<string | null>(null);
  const [recommendReason, setRecommendReason] = useState("");
  const [loadingRecommend, setLoadingRecommend] = useState(false);
  const [loadingIdea, setLoadingIdea] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<SavedNarrativeTemplate[]>([]);

  const refreshSaved = useCallback(async () => {
    try {
      const data = await listNarrativeTemplates();
      setSavedTemplates(data.templates || []);
    } catch {
      // Likely unauthenticated — silently degrade so the section still works.
      setSavedTemplates([]);
    }
  }, []);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  useEffect(() => {
    if (!topic) return;
    let cancelled = false;
    setLoadingRecommend(true);
    recommendTemplate(
      topic.title,
      topic.summary,
      TEMPLATES.map((t) => t.value)
    ).then((data) => {
      if (cancelled) return;
      setRecommendedTemplate(data.template);
      setRecommendReason(data.reason);
      setSelectedTemplate(data.template);
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoadingRecommend(false);
    });
    return () => { cancelled = true; };
  }, [topic]);

  const sortedTemplates = useMemo(() => {
    if (!recommendedTemplate) return TEMPLATES;
    return [...TEMPLATES].sort((a, b) =>
      a.value === recommendedTemplate ? -1 : b.value === recommendedTemplate ? 1 : 0
    );
  }, [recommendedTemplate]);

  const selectedSaved = useMemo(
    () => savedTemplates.find((t) => t.id === selectedSavedId) || null,
    [savedTemplates, selectedSavedId]
  );

  const handleSelectPreset = (value: string) => {
    setTemplateMode("preset");
    setSelectedTemplate(value);
    setSelectedSavedId(null);
  };

  const handleSelectSaved = (t: SavedNarrativeTemplate) => {
    setTemplateMode("saved");
    setSelectedSavedId(t.id);
  };

  const handleSelectCustom = () => {
    setTemplateMode("custom");
    setSelectedSavedId(null);
  };

  const handleDeleteSaved = async (
    e: React.MouseEvent,
    t: SavedNarrativeTemplate
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = window.confirm(`Delete the saved template "${t.name}"?`);
    if (!ok) return;
    try {
      await deleteNarrativeTemplate(t.id);
      if (selectedSavedId === t.id) {
        setSelectedSavedId(null);
        setTemplateMode("preset");
      }
      await refreshSaved();
    } catch (err: unknown) {
      onGenerateError(
        "Failed to delete template: " + (err instanceof Error ? err.message : String(err))
      );
    }
  };

  const [knowledgeUsed, setKnowledgeUsed] = useState(false);

  const handleGenerateIdea = async () => {
    setLoadingIdea(true);
    setKnowledgeUsed(false);
    onGenerateError("");
    try {
      const data = await generateIdea(
        topic.title,
        topic.summary,
        topic.sources,
        selectedTemplate
      );
      const used = !!data.knowledge_used;
      setKnowledgeUsed(used);
      onKnowledgeUsed?.(used);
      setIdea(data as Idea);
    } catch (e: unknown) {
      onGenerateError(
        "Failed to generate idea: " +
          (e instanceof Error ? e.message : String(e))
      );
    } finally {
      setLoadingIdea(false);
    }
  };

  const handleUseSaved = () => {
    if (!selectedSaved) return;
    setIdea(narrativeStructureToIdea(toStructure(selectedSaved), selectedSaved.prompt || ""));
  };

  return (
    <div className="section">
      <h2 className="section-title">Narrative Template</h2>
      <div className="card" style={{ marginBottom: 20 }}>
        <p className="text-dim text-sm" style={{ marginBottom: 14 }}>
          Choose a narrative style for a quick AI-generated idea, pick one of your saved
          templates, or use <strong>Custom Template</strong> to name your template and describe a
          new story structure — AI fills in tone and beats.
        </p>

        {loadingRecommend && (
          <p className="text-sm text-dim" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <span className="spinner" /> Analyzing best template for this topic...
          </p>
        )}
        <div className="template-grid">
          {sortedTemplates.map((t) => (
            <label
              key={t.value}
              className={`template-option ${templateMode === "preset" && selectedTemplate === t.value ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="template"
                checked={templateMode === "preset" && selectedTemplate === t.value}
                onChange={() => handleSelectPreset(t.value)}
              />
              <div>
                <div className="template-option-name">
                  {t.value}
                  {recommendedTemplate === t.value && (
                    <span className="badge-recommended">Recommended</span>
                  )}
                </div>
                <div className="text-dim" style={{ fontSize: 12, lineHeight: 1.4 }}>
                  {t.desc}
                </div>
                {recommendedTemplate === t.value && recommendReason && (
                  <div className="recommend-reason">{recommendReason}</div>
                )}
              </div>
            </label>
          ))}

          {savedTemplates.map((t) => (
            <label
              key={t.id}
              className={`template-option ${templateMode === "saved" && selectedSavedId === t.id ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="template"
                checked={templateMode === "saved" && selectedSavedId === t.id}
                onChange={() => handleSelectSaved(t)}
              />
              <div style={{ width: "100%" }}>
                <div className="template-option-name" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {t.name}
                    <span className="badge-saved" title="Your custom template">Customized</span>
                  </span>
                  <button
                    type="button"
                    className="template-option-delete"
                    title="Delete this template"
                    onClick={(e) => handleDeleteSaved(e, t)}
                  >
                    ×
                  </button>
                </div>
                <div className="text-dim" style={{ fontSize: 12, lineHeight: 1.4 }}>
                  {t.tone || "—"} · {t.beats?.length || 0} beats
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
              name="template"
              checked={templateMode === "custom"}
              onChange={handleSelectCustom}
            />
            <div>
              <div className="template-option-name">+ Custom Template</div>
              <div className="text-dim" style={{ fontSize: 12, lineHeight: 1.4 }}>
                Set a title, describe the arc — AI generates tone and beats
              </div>
            </div>
          </label>
        </div>

        {templateMode === "custom" ? (
          <div className="custom-template-panel">
            <NarrativeBuilder activeIdea={idea} onUseTemplate={setIdea} onSaved={refreshSaved} />
            <p className="text-dim text-sm" style={{ marginTop: 16, marginBottom: 0 }}>
              When the preview looks right, click <strong>Use Template</strong> to lock this
              narrative in for script generation, or <strong>Save Template</strong> to save it under
              your title for reuse.
            </p>
          </div>
        ) : templateMode === "saved" && selectedSaved ? (
          <div className="custom-template-panel">
            <div className="template-preview-card card">
              <h3 className="template-preview-title">Template preview</h3>
              <div className="template-preview-row">
                <span className="text-dim text-sm">Name</span>
                <div className="template-preview-value">{selectedSaved.name}</div>
              </div>
              <div className="template-preview-row">
                <span className="text-dim text-sm">Tone</span>
                <div className="template-preview-value">{selectedSaved.tone}</div>
              </div>
              <div className="template-preview-beats">
                <span className="text-dim text-sm" style={{ display: "block", marginBottom: 8 }}>
                  Beats
                </span>
                <ol className="template-beats-list">
                  {selectedSaved.beats.map((b, i) => (
                    <li key={`${b.id}-${i}`}>
                      <span className="template-beat-purpose">{b.purpose}</span>
                      <span className="template-beat-instruction text-dim text-sm">
                        {b.instruction}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="template-preview-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-success"
                  onClick={handleUseSaved}
                >
                  Use Template
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <button
              className="btn btn-primary mt-24"
              onClick={handleGenerateIdea}
              disabled={loadingIdea}
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
          </>
        )}
      </div>
    </div>
  );
}
