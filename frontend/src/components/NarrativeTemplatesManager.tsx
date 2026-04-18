import { useCallback, useEffect, useState } from "react";
import {
  listNarrativeTemplates,
  createNarrativeTemplate,
  updateNarrativeTemplate,
  deleteNarrativeTemplate,
  generateNarrativeTemplate,
  type SavedNarrativeTemplate,
} from "../api/client";
import type { NarrativeBeat, NarrativeStructure } from "../types";

const PLACEHOLDER =
  "Describe how you want to tell the story..e.g., start with two opposing viewpoints, then use data to prove which is correct, or explain like a movie story with a twist ending.";

function ensureBeatIds(structure: NarrativeStructure): NarrativeStructure {
  return {
    ...structure,
    beats: structure.beats.map((b) => ({
      ...b,
      id: b.id || crypto.randomUUID(),
    })),
  };
}

export default function NarrativeTemplatesManager() {
  const [templates, setTemplates] = useState<SavedNarrativeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /** Wizard: create new or edit existing (by id). */
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  /** User-defined template title (applied to saved template; tone/beats still from AI). */
  const [templateTitle, setTemplateTitle] = useState("");
  const [userInput, setUserInput] = useState("");
  const [structure, setStructure] = useState<NarrativeStructure | null>(null);
  const [editingBeats, setEditingBeats] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listNarrativeTemplates();
      setTemplates(data.templates || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const closeWizard = () => {
    setWizardOpen(false);
    setEditingId(null);
    setTemplateTitle("");
    setUserInput("");
    setStructure(null);
    setEditingBeats(false);
  };

  const startNew = () => {
    setEditingId(null);
    setTemplateTitle("");
    setUserInput("");
    setStructure(null);
    setEditingBeats(false);
    setWizardOpen(true);
  };

  const startEdit = (t: SavedNarrativeTemplate) => {
    setEditingId(t.id);
    setTemplateTitle(t.name);
    setUserInput(t.prompt || "");
    setStructure(
      ensureBeatIds({
        name: t.name,
        tone: t.tone,
        beats: t.beats.map((b) => ({ ...b })),
      })
    );
    setEditingBeats(false);
    setWizardOpen(true);
  };

  const handleGenerate = async () => {
    const text = userInput.trim();
    const title = templateTitle.trim();
    if (!text) return;
    if (!title) {
      setError("Enter a template title first.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const raw = (await generateNarrativeTemplate(text)) as NarrativeStructure;
      const merged = ensureBeatIds({
        ...raw,
        name: title,
      });
      setStructure(merged);
      setEditingBeats(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not generate template.");
    } finally {
      setGenerating(false);
    }
  };

  const updateBeat = (index: number, patch: Partial<NarrativeBeat>) => {
    if (!structure) return;
    const beats = structure.beats.map((b, i) => (i === index ? { ...b, ...patch } : b));
    setStructure({ ...structure, beats });
  };

  const updateMeta = (patch: Partial<Pick<NarrativeStructure, "name" | "tone">>) => {
    if (!structure) return;
    if (patch.name !== undefined) setTemplateTitle(patch.name);
    setStructure({ ...structure, ...patch });
  };

  const savePayloadFromStructure = () => {
    if (!structure) return null;
    const nameFromTitle = templateTitle.trim() || structure.name.trim();
    return {
      name: nameFromTitle,
      tone: structure.tone.trim() || "professional",
      beats: structure.beats.map((b) => ({
        id: b.id || crypto.randomUUID(),
        purpose: b.purpose.trim(),
        instruction: b.instruction.trim(),
      })),
      source: "ai_generated" as const,
      prompt: userInput.trim() || null,
    };
  };

  const handleSave = async () => {
    if (!structure || saving) return;
    const payload = savePayloadFromStructure();
    if (!payload || !payload.name) {
      setError("Generated template needs a name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await updateNarrativeTemplate(editingId, {
          name: payload.name,
          tone: payload.tone,
          beats: payload.beats,
          prompt: payload.prompt,
        });
      } else {
        try {
          await createNarrativeTemplate(payload);
        } catch (err: unknown) {
          const anyErr = err as { response?: { status?: number; data?: { detail?: { code?: string } } } };
          if (anyErr?.response?.status === 409 && anyErr?.response?.data?.detail?.code === "name_exists") {
            const ok = window.confirm(
              `A template named "${payload.name}" already exists. Overwrite it?`
            );
            if (!ok) {
              setSaving(false);
              return;
            }
            await createNarrativeTemplate({ ...payload, overwrite: true });
          } else {
            throw err;
          }
        }
      }
      closeWizard();
      await refresh();
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { detail?: { message?: string } } }; message?: string };
      const detail = anyErr?.response?.data?.detail;
      setError(
        (typeof detail === "object" && detail?.message) ||
          anyErr?.message ||
          "Failed to save template."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: SavedNarrativeTemplate) => {
    const ok = window.confirm(`Delete "${t.name}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await deleteNarrativeTemplate(t.id);
      if (expandedId === t.id) setExpandedId(null);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    }
  };

  return (
    <div className="section">
      <h3 className="section-title">Narrative Templates</h3>
      <p className="text-dim text-sm" style={{ marginBottom: 12 }}>
        Reusable story structures the narrative builder can pull from. Name your template, describe how the
        story should unfold — AI generates tone and beats — then save. Saved templates appear in the
        Workstation alongside system presets.
      </p>

      {error && (
        <p style={{ color: "var(--red)", marginBottom: 12 }} role="alert">
          {error}
        </p>
      )}

      {!wizardOpen && (
        <div style={{ marginBottom: 12 }}>
          <button className="btn btn-sm btn-primary" onClick={startNew}>
            + New Template
          </button>
        </div>
      )}

      {wizardOpen && (
        <div className="card narrative-builder" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <strong>{editingId ? "Edit template" : "New template"}</strong>
            <button
              className="btn btn-sm"
              style={{ background: "var(--surface2)", color: "var(--text)" }}
              onClick={closeWizard}
              disabled={generating || saving}
            >
              Cancel
            </button>
          </div>

          <p className="text-dim text-sm narrative-builder-lead">
            Give your template a title, then describe how you want the story to unfold. The model generates
            tone and beats from your description.
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
              disabled={generating}
              style={{ width: "100%" }}
            />
          </div>

          <textarea
            className="narrative-builder-textarea"
            rows={5}
            placeholder={PLACEHOLDER}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            disabled={generating}
          />

          <div className="narrative-builder-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={generating || !userInput.trim() || !templateTitle.trim()}
            >
              {generating ? (
                <>
                  <span className="spinner" /> Generating...
                </>
              ) : (
                "Generate Template"
              )}
            </button>
          </div>

          {structure && (
            <div className="template-preview-card card" style={{ marginTop: 16 }}>
              <h3 className="template-preview-title">Template preview</h3>

              {!editingBeats ? (
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
                          <span className="template-beat-instruction text-dim text-sm">{b.instruction}</span>
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
                  onClick={() => setEditingBeats((e) => !e)}
                >
                  {editingBeats ? "Done editing" : "Edit details"}
                </button>
                <button type="button" className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <span className="spinner" /> Saving...
                    </>
                  ) : editingId ? (
                    "Save changes"
                  ) : (
                    "Save Template"
                  )}
                </button>
              </div>
            </div>
          )}

          <p className="text-dim text-sm" style={{ marginTop: 12 }}>
            When the preview looks right, click <strong>Save Template</strong>. You can refine tone and beats with{" "}
            <strong>Edit details</strong> (title can be edited above anytime).
          </p>
        </div>
      )}

      {loading ? (
        <div className="loading-center">
          <div className="spinner spinner-lg" />
          <p>Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="card" style={{ textAlign: "center" }}>
          <p className="text-dim">
            You haven't saved any templates yet. Create one here, or save one from the Workstation's Narrative
            Builder.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {templates.map((t) => {
            const isExpanded = expandedId === t.id;
            return (
              <div key={t.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ marginBottom: 4 }}>
                      <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                        {t.name}
                      </strong>
                    </div>
                    <div className="text-dim text-sm">
                      {t.tone || "—"} · {t.beats?.length || 0} beats · saved {new Date(t.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      className="btn btn-sm"
                      style={{ background: "var(--surface2)", color: "var(--text)" }}
                      onClick={() => setExpandedId(isExpanded ? null : t.id)}
                    >
                      {isExpanded ? "Hide" : "View"}
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={() => startEdit(t)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)" }}
                      onClick={() => handleDelete(t)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <ol className="template-beats-list" style={{ marginTop: 12 }}>
                    {t.beats.map((b, i) => (
                      <li key={`${b.id}-${i}`}>
                        <span className="template-beat-purpose">{b.purpose}</span>
                        <span className="template-beat-instruction text-dim text-sm">{b.instruction}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
