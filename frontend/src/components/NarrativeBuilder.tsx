import { useCallback, useEffect, useState } from "react";
import { generateNarrativeTemplate } from "../utils/generateNarrativeTemplate";
import type { Idea, NarrativeBeat, NarrativeStructure } from "../types";

const LS_KEY = "fincontent_saved_narrative_templates_v1";

const PLACEHOLDER =
  "Describe how you want to tell the story...";

const EXAMPLES = [
  "Start with two opposing viewpoints, then use data to prove which is correct",
  "Explain like a movie story with a twist ending",
  "Break down a complex financial topic using analogy",
];

type SavedEntry = {
  id: string;
  savedAt: string;
  user_input: string;
  structure: NarrativeStructure;
};

function loadSaved(): SavedEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function saveToStorage(entry: SavedEntry) {
  const prev = loadSaved().filter((e) => e.id !== entry.id);
  const next = [entry, ...prev].slice(0, 10);
  localStorage.setItem(LS_KEY, JSON.stringify(next));
}

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
    template_reason: [structure.tone, ...structure.style_tags].filter(Boolean).join(" · "),
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
    style_tags: [...s.style_tags],
    beats: s.beats.map((b) => ({ ...b })),
  };
}

type Props = {
  activeIdea: Idea | null;
  onUseTemplate: (idea: Idea) => void;
};

export default function NarrativeBuilder({ activeIdea, onUseTemplate }: Props) {
  const [userInput, setUserInput] = useState("");
  const [structure, setStructure] = useState<NarrativeStructure | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedList, setSavedList] = useState<SavedEntry[]>(() => loadSaved());

  const hydrateFromIdea = useCallback((idea: Idea) => {
    if (idea.narrative_structure) {
      setStructure(cloneStructure(idea.narrative_structure));
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
    if (!text) return;
    setLoading(true);
    setError("");
    try {
      const data = await generateNarrativeTemplate(text);
      setStructure(data);
      setEditing(false);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Could not generate template. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!structure) return;
    const entry: SavedEntry = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      user_input: userInput.trim(),
      structure: cloneStructure(structure),
    };
    saveToStorage(entry);
    setSavedList(loadSaved());
  };

  const handleLoadSaved = (e: SavedEntry) => {
    setUserInput(e.user_input);
    setStructure(cloneStructure(e.structure));
    setEditing(false);
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
    setStructure({ ...structure, ...patch });
  };

  const updateTagsFromString = (raw: string) => {
    if (!structure) return;
    const style_tags = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    setStructure({ ...structure, style_tags });
  };

  const handleUseTemplate = () => {
    if (!structure) return;
    onUseTemplate(narrativeStructureToIdea(structure, userInput));
  };

  return (
    <div className="narrative-builder">
      <p className="text-dim text-sm narrative-builder-lead">
        Describe how you want the story to unfold. The model will generate a reusable narrative
        structure.
      </p>

      <div className="narrative-builder-examples">
        <span className="text-dim text-sm">Suggestions:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            className="narrative-suggestion-chip"
            onClick={() => setUserInput(ex)}
          >
            {ex}
          </button>
        ))}
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
          disabled={loading || !userInput.trim()}
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

      {savedList.length > 0 && (
        <div className="narrative-saved-block">
          <span className="text-dim text-sm">Saved templates</span>
          <div className="narrative-saved-list">
            {savedList.map((s) => (
              <button
                key={s.id}
                type="button"
                className="narrative-saved-item"
                onClick={() => handleLoadSaved(s)}
              >
                {s.structure.name}
                <span className="text-dim">
                  {new Date(s.savedAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        </div>
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
              <div className="template-preview-row">
                <span className="text-dim text-sm">Style</span>
                <div className="template-preview-tags">
                  {structure.style_tags.map((t) => (
                    <span key={t} className="style-tag-badge">
                      {t}
                    </span>
                  ))}
                </div>
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
              <label className="text-sm text-dim">Style tags (comma-separated)</label>
              <input
                type="text"
                value={structure.style_tags.join(", ")}
                onChange={(e) => updateTagsFromString(e.target.value)}
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
            >
              Save Template
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
