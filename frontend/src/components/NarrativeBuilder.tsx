import { useCallback, useEffect, useState } from "react";
import { generateNarrativeTemplate } from "../utils/generateNarrativeTemplate";
import { createNarrativeTemplate } from "../api/client";
import type { Idea, NarrativeBeat, NarrativeStructure } from "../types";

const PLACEHOLDER =
  "Describe how you want to tell the story..e.g., start with two opposing viewpoints, then use data to prove which is correct, or explain like a movie story with a twist ending.";

export function narrativeStructureToIdea(
  structure: NarrativeStructure,
  userPrompt: string
): Idea {
  const beats = structure.beats;
  const core_argument =
    beats.length > 0
      ? beats.map((b) => b.purpose).join(" → ")
      : structure.name;
  const first = beats[0];
  const hook = first
    ? `${first.purpose}: ${first.instruction}`.slice(0, 500)
    : structure.name;
  return {
    narrative_template: structure.name,
    template_reason: structure.tone,
    core_argument,
    angle: userPrompt.trim() || "Creator-defined narrative intent",
    hook,
    narrative_structure: structure,
  };
}

function cloneStructure(s: NarrativeStructure): NarrativeStructure {
  return {
    name: s.name,
    tone: s.tone,
    beats: s.beats.map((b) => ({ ...b })),
  };
}

type Props = {
  activeIdea: Idea | null;
  onUseTemplate: (idea: Idea) => void;
  /** Called after a successful save so parent can refresh the saved-templates list. */
  onSaved?: () => void;
};

export default function NarrativeBuilder({ activeIdea, onUseTemplate, onSaved }: Props) {
  /** User-defined template title; tone/beats still come from AI. */
  const [templateTitle, setTemplateTitle] = useState("");
  const [userInput, setUserInput] = useState("");
  const [structure, setStructure] = useState<NarrativeStructure | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedNotice, setSavedNotice] = useState("");

  const hydrateFromIdea = useCallback((idea: Idea) => {
    if (idea.narrative_structure) {
      setStructure(cloneStructure(idea.narrative_structure));
      setTemplateTitle(idea.narrative_structure.name || idea.narrative_template || "");
      setUserInput(idea.angle || "");
      setEditing(false);
    }
  }, []);

  useEffect(() => {
    if (activeIdea?.narrative_structure) {
      hydrateFromIdea(activeIdea);
    }
  }, [activeIdea, hydrateFromIdea]);

  const handleGenerate = async () => {
    const text = userInput.trim();
    const title = templateTitle.trim();
    if (!text) return;
    if (!title) {
      setError("Enter a template title first.");
      return;
    }
    setLoading(true);
    setError("");
    setSavedNotice("");
    try {
      const data = await generateNarrativeTemplate(text);
      setStructure({
        ...data,
        name: title,
        beats: data.beats.map((b) => ({ ...b, id: b.id || crypto.randomUUID() })),
      });
      setEditing(false);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Could not generate template. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!structure || saving) return;
    setSaving(true);
    setError("");
    setSavedNotice("");
    const payload = {
      name: structure.name,
      tone: structure.tone,
      beats: structure.beats,
      source: "ai_generated" as const,
      prompt: userInput.trim() || null,
    };
    try {
      await createNarrativeTemplate(payload);
      setSavedNotice(`Saved "${structure.name}" to your templates.`);
      setEditing(false);
      // Collapse the preview so the user returns to a clean state.
      setStructure(null);
      setTemplateTitle("");
      setUserInput("");
      onSaved?.();
    } catch (err: unknown) {
      // Detect 409 name conflict and offer overwrite
      const anyErr = err as { response?: { status?: number; data?: { detail?: { code?: string } } }; message?: string };
      const status = anyErr?.response?.status;
      const code = anyErr?.response?.data?.detail?.code;
      if (status === 409 && code === "name_exists") {
        const ok = window.confirm(
          `A template named "${structure.name}" already exists. Overwrite it?`
        );
        if (ok) {
          try {
            await createNarrativeTemplate({ ...payload, overwrite: true });
            setSavedNotice(`Updated "${structure.name}" in your templates.`);
            setEditing(false);
            setStructure(null);
            setTemplateTitle("");
            setUserInput("");
            onSaved?.();
          } catch (err2: unknown) {
            setError(err2 instanceof Error ? err2.message : "Could not save template.");
          }
        }
      } else {
        setError(
          anyErr?.message || "Could not save template. Make sure you are signed in and try again."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const updateBeat = (index: number, patch: Partial<NarrativeBeat>) => {
    if (!structure) return;
    const beats = structure.beats.map((b, i) =>
      i === index ? { ...b, ...patch } : b
    );
    setStructure({ ...structure, beats });
  };

  const updateMeta = (patch: Partial<Pick<NarrativeStructure, "name" | "tone">>) => {
    if (!structure) return;
    if (patch.name !== undefined) setTemplateTitle(patch.name);
    setStructure({ ...structure, ...patch });
  };

  const handleUseTemplate = () => {
    if (!structure) return;
    onUseTemplate(narrativeStructureToIdea(structure, userInput));
  };

  return (
    <div className="narrative-builder">
      <p className="text-dim text-sm narrative-builder-lead">
        Name your template, then describe how you want the story to unfold. The model generates tone and
        beats from your description.
      </p>

      <div style={{ marginBottom: 12 }}>
        <label className="text-dim text-sm" style={{ display: "block", marginBottom: 6 }}>
          Template title
        </label>
        <input
          type="text"
          value={templateTitle}
          onChange={(e) => {
            const v = e.target.value;
            setTemplateTitle(v);
            if (structure) {
              setStructure({ ...structure, name: v });
            }
          }}
          placeholder="e.g. Contrarian earnings breakdown"
          maxLength={200}
          disabled={loading}
          style={{ width: "100%" }}
        />
      </div>

      <textarea
        className="narrative-builder-textarea"
        rows={5}
        placeholder={PLACEHOLDER}
        value={userInput}
        onChange={(e) => setUserInput(e.target.value)}
        disabled={loading}
      />

      <div className="narrative-builder-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={loading || !userInput.trim() || !templateTitle.trim()}
        >
          {loading ? (
            <>
              <span className="spinner" /> Generating...
            </>
          ) : (
            "Generate Template"
          )}
        </button>
      </div>

      {error && (
        <p className="narrative-builder-error" role="alert">
          {error}
        </p>
      )}

      {savedNotice && !error && (
        <p className="text-sm" style={{ color: "var(--success, #16a34a)", marginTop: 8 }}>
          {savedNotice}
        </p>
      )}

      {structure && (
        <div className="template-preview-card card">
          <h3 className="template-preview-title">Template preview</h3>

          {!editing ? (
            <>
              <div className="template-preview-row">
                <span className="text-dim text-sm">Name</span>
                <div className="template-preview-value">{structure.name}</div>
              </div>
              <div className="template-preview-row">
                <span className="text-dim text-sm">Tone</span>
                <div className="template-preview-value">{structure.tone}</div>
              </div>
              <div className="template-preview-beats">
                <span className="text-dim text-sm" style={{ display: "block", marginBottom: 8 }}>
                  Beats
                </span>
                <ol className="template-beats-list">
                  {structure.beats.map((b, i) => (
                    <li key={`${b.id}-${i}`}>
                      <span className="template-beat-purpose">{b.purpose}</span>
                      <span className="template-beat-instruction text-dim text-sm">
                        {b.instruction}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          ) : (
            <div className="template-edit-form">
              <label className="text-sm text-dim">Template name</label>
              <input
                type="text"
                value={structure.name}
                onChange={(e) => updateMeta({ name: e.target.value })}
              />
              <label className="text-sm text-dim">Tone</label>
              <input
                type="text"
                value={structure.tone}
                onChange={(e) => updateMeta({ tone: e.target.value })}
              />
              {structure.beats.map((b, i) => (
                <div key={`edit-${b.id}-${i}`} className="template-beat-edit">
                  <span className="text-dim text-sm">Beat {i + 1}</span>
                  <input
                    type="text"
                    placeholder="Purpose"
                    value={b.purpose}
                    onChange={(e) => updateBeat(i, { purpose: e.target.value })}
                  />
                  <textarea
                    rows={2}
                    placeholder="Instruction"
                    value={b.instruction}
                    onChange={(e) => updateBeat(i, { instruction: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="template-preview-actions">
            <button
              type="button"
              className="btn btn-sm"
              style={{ background: "var(--surface2)", color: "var(--text)" }}
              onClick={() => setEditing((e) => !e)}
            >
              {editing ? "Done editing" : "Edit Template"}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="spinner" /> Saving...
                </>
              ) : (
                "Save Template"
              )}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-success"
              onClick={handleUseTemplate}
            >
              Use Template
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
