import { useState } from "react";
import { generateIdea } from "../api/client";
import type { Idea, Topic } from "../types";
import NarrativeBuilder from "./NarrativeBuilder";

const TEMPLATES = [
  { value: "Counterintuitive", desc: "Challenge conventional wisdom with a surprising take" },
  { value: "Anxiety-Driven", desc: "Address fears and provide actionable solutions" },
  { value: "Company Breakdown", desc: "Deep-dive analysis of a specific company or stock" },
  { value: "Trend Forecast", desc: "Predict where this trend is heading and why it matters" },
  { value: "Data Reveal", desc: "Lead with compelling data points and statistics" },
];

type TemplateMode = "preset" | "custom";

type Props = {
  topic: Topic;
  idea: Idea | null;
  setIdea: (idea: Idea) => void;
  onGenerateError: (message: string) => void;
};

export default function NarrativeTemplateSection({
  topic,
  idea,
  setIdea,
  onGenerateError,
}: Props) {
  const [templateMode, setTemplateMode] = useState<TemplateMode>("preset");
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].value);
  const [loadingIdea, setLoadingIdea] = useState(false);

  const handleSelectPreset = (value: string) => {
    setTemplateMode("preset");
    setSelectedTemplate(value);
  };

  const handleSelectCustom = () => {
    setTemplateMode("custom");
  };

  const handleGenerateIdea = async () => {
    setLoadingIdea(true);
    onGenerateError("");
    try {
      const data = await generateIdea(
        topic.title,
        topic.summary,
        topic.sources,
        selectedTemplate
      );
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

  return (
    <div className="section">
      <h2 className="section-title">Narrative Template</h2>
      <div className="card" style={{ marginBottom: 20 }}>
        <p className="text-dim text-sm" style={{ marginBottom: 14 }}>
          Choose a narrative style for a quick AI-generated idea, or use{" "}
          <strong>Custom Template</strong> to describe your own story structure.
        </p>

        <div className="template-grid">
          {TEMPLATES.map((t) => (
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
              name="template"
              checked={templateMode === "custom"}
              onChange={handleSelectCustom}
            />
            <div>
              <div className="template-option-name">+ Custom Template</div>
              <div className="text-dim" style={{ fontSize: 12, lineHeight: 1.4 }}>
                AI narrative builder from a short description
              </div>
            </div>
          </label>
        </div>

        {templateMode === "custom" ? (
          <div className="custom-template-panel">
            <NarrativeBuilder activeIdea={idea} onUseTemplate={setIdea} />
            <p className="text-dim text-sm" style={{ marginTop: 16, marginBottom: 0 }}>
              When the preview looks right, click <strong>Use Template</strong> to lock this
              narrative in for script generation.
            </p>
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
