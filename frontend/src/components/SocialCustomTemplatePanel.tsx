import type {
  SocialPostTemplate,
  SocialPostTemplateSection,
} from "../types";

type Props = {
  userInput: string;
  onUserInputChange: (value: string) => void;
  template: SocialPostTemplate | null;
  onTemplateChange: (next: SocialPostTemplate) => void;
  loading: boolean;
  apiError: string;
  onGenerate: () => void;
};

export default function SocialCustomTemplatePanel({
  userInput,
  onUserInputChange,
  template,
  onTemplateChange,
  loading,
  apiError,
  onGenerate,
}: Props) {
  const updateSection = (index: number, patch: Partial<SocialPostTemplateSection>) => {
    if (!template) return;
    const structure = template.structure.map((row, j) =>
      j === index ? { ...row, ...patch } : row
    );
    onTemplateChange({ ...template, structure });
  };

  const updateMeta = (patch: Partial<Pick<SocialPostTemplate, "name" | "tone" | "platform_style">>) => {
    if (!template) return;
    onTemplateChange({ ...template, ...patch });
  };

  return (
    <div className="custom-template-panel social-custom-template">
      <p className="text-dim text-sm narrative-builder-lead">
        Describe how you want the post to read and feel. We&apos;ll turn it into a single-post
        structure (hook through CTA) tailored for social—not a multi-scene video script.
      </p>

      <textarea
        className="narrative-builder-textarea"
        rows={4}
        placeholder="Describe your post style..."
        value={userInput}
        onChange={(e) => onUserInputChange(e.target.value)}
        disabled={loading}
      />

      <div className="narrative-builder-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onGenerate}
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

      {apiError && (
        <p className="narrative-builder-error" role="alert">
          {apiError}
        </p>
      )}

      {template && (
        <div className="template-preview-card card" style={{ marginTop: 12 }}>
          <h3 className="template-preview-title">Template preview</h3>

          <label className="text-sm text-dim" style={{ display: "block", marginBottom: 4 }}>
            Template name
          </label>
          <input
            type="text"
            value={template.name}
            onChange={(e) => updateMeta({ name: e.target.value })}
            style={{ marginBottom: 12, width: "100%" }}
          />

          <div className="template-preview-row" style={{ marginBottom: 10 }}>
            <span className="text-dim text-sm">Structure</span>
            <ol className="template-beats-list" style={{ paddingLeft: "1.1rem", marginTop: 8 }}>
              {template.structure.map((row, i) => (
                <li key={`${row.section}-${i}`} style={{ marginBottom: 12 }}>
                  <div style={{ marginBottom: 6 }}>
                    <span className="text-dim text-sm">Section label</span>
                    <input
                      type="text"
                      value={row.section}
                      onChange={(e) => updateSection(i, { section: e.target.value })}
                      style={{ width: "100%", fontWeight: 600, marginTop: 2 }}
                    />
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <span className="text-dim text-sm">Purpose</span>
                    <input
                      type="text"
                      value={row.purpose}
                      onChange={(e) => updateSection(i, { purpose: e.target.value })}
                      style={{ width: "100%", marginTop: 2 }}
                    />
                  </div>
                  <span className="text-dim text-sm">Instruction</span>
                  <textarea
                    rows={2}
                    className="text-sm"
                    value={row.instruction}
                    onChange={(e) => updateSection(i, { instruction: e.target.value })}
                    style={{ width: "100%" }}
                  />
                </li>
              ))}
            </ol>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="text-sm text-dim">Tone</label>
              <input
                type="text"
                value={template.tone}
                onChange={(e) => updateMeta({ tone: e.target.value })}
                style={{ width: "100%", marginTop: 4 }}
              />
            </div>
            <div>
              <label className="text-sm text-dim">Platform style</label>
              <input
                type="text"
                value={template.platform_style}
                onChange={(e) => updateMeta({ platform_style: e.target.value })}
                style={{ width: "100%", marginTop: 4 }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
