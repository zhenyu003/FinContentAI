import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  refineSocialContent,
  generateSocialImage,
  createHistoryRecord,
  BACKEND,
} from "../api/client";
import { useAuth } from "../contexts/AuthContext";

interface PlatformContent {
  text: string;
  hashtags: string[];
}

interface ImagePrompt {
  description: string;
  prompt: string;
}

interface SocialContent {
  platforms: Record<string, PlatformContent>;
  image_prompts: ImagePrompt[];
}

export default function SocialStudioPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [content, setContent] = useState<SocialContent | null>(null);
  const [activePlatforms, setActivePlatforms] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [error, setError] = useState("");

  // Refine state
  const [refineOpen, setRefineOpen] = useState<string | null>(null);
  const [refineFeedback, setRefineFeedback] = useState("");
  const [loadingRefine, setLoadingRefine] = useState(false);

  // Copy feedback
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);

  // Image generation
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [loadingImage, setLoadingImage] = useState<Record<number, boolean>>({});
  const [editablePrompts, setEditablePrompts] = useState<Record<number, string>>({});

  useEffect(() => {
    const raw = sessionStorage.getItem("social_content");
    const rawPlatforms = sessionStorage.getItem("social_platforms");
    if (!raw) {
      navigate("/");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as SocialContent;
      const plats: string[] = rawPlatforms ? JSON.parse(rawPlatforms) : Object.keys(parsed.platforms);
      setContent(parsed);
      setActivePlatforms(plats);
      setActiveTab(plats[0] || "");

      // Initialize editable prompts
      const prompts: Record<number, string> = {};
      (parsed.image_prompts || []).forEach((ip, i) => {
        prompts[i] = ip.prompt;
      });
      setEditablePrompts(prompts);

      // Auto-save to history if logged in
      if (user) {
        const topicData = sessionStorage.getItem("social_topic");
        const topic = topicData ? JSON.parse(topicData) : {};
        createHistoryRecord({
          content_type: "social_post",
          topic_title: topic.title || "Untitled",
          topic_summary: topic.summary || "",
          post_data: { platforms: parsed.platforms, image_prompts: parsed.image_prompts },
          platform: plats.join(", "),
          status: "draft",
        }).catch(() => {}); // silent fail
      }
    } catch {
      navigate("/");
    }
  }, [navigate, user]);

  if (!content) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <span className="spinner" />
        <p className="text-dim mt-16">Loading content...</p>
      </div>
    );
  }

  const currentPlatform = content.platforms[activeTab];

  const handleTextChange = (text: string) => {
    setContent((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        platforms: {
          ...prev.platforms,
          [activeTab]: { ...prev.platforms[activeTab], text },
        },
      };
    });
  };

  const handleRefine = async () => {
    if (!refineFeedback.trim() || !currentPlatform) return;
    setLoadingRefine(true);
    setError("");
    try {
      const data = await refineSocialContent({
        platform: activeTab,
        current_text: currentPlatform.text,
        feedback: refineFeedback,
      });
      setContent((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          platforms: {
            ...prev.platforms,
            [activeTab]: {
              ...prev.platforms[activeTab],
              text: data.refined_text || data.text || currentPlatform.text,
            },
          },
        };
      });
      setRefineFeedback("");
      setRefineOpen(null);
    } catch (e: any) {
      setError("Refine failed: " + e.message);
    } finally {
      setLoadingRefine(false);
    }
  };

  const handleCopy = async () => {
    if (!currentPlatform) return;
    const hashtags = currentPlatform.hashtags.map((h) =>
      h.startsWith("#") ? h : `#${h}`
    );
    const fullText = currentPlatform.text + "\n\n" + hashtags.join(" ");
    await navigator.clipboard.writeText(fullText);
    setCopiedPlatform(activeTab);
    setTimeout(() => setCopiedPlatform(null), 2000);
  };

  const handleGenerateImage = async (index: number) => {
    const prompt = editablePrompts[index] || content.image_prompts[index]?.prompt;
    if (!prompt) return;
    setLoadingImage((s) => ({ ...s, [index]: true }));
    setError("");
    try {
      const data = await generateSocialImage(prompt, "1:1");
      setGeneratedImages((s) => ({ ...s, [index]: data.image_url }));
    } catch (e: any) {
      setError(`Image generation failed: ${e.message}`);
    } finally {
      setLoadingImage((s) => ({ ...s, [index]: false }));
    }
  };

  const imagePrompts = content.image_prompts || [];
  const generatedCount = Object.keys(generatedImages).length;

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <button className="btn btn-sm" onClick={() => navigate("/social/idea")} style={{ background: "var(--bg-input)", color: "var(--text-dim)" }}>&larr; Back to Idea</button>
      </div>
      <div className="step-indicator">
        <span className="step" style={{ cursor: "pointer" }} onClick={() => navigate("/")}>1. Topic Discovery</span>
        <span className="arrow">&rarr;</span>
        <span className="step" style={{ cursor: "pointer" }} onClick={() => navigate("/social/idea")}>2. Social Post Idea</span>
        <span className="arrow">&rarr;</span>
        <span className="step active">3. Content Studio</span>
      </div>

      {error && (
        <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
      )}

      {/* Platform Tabs */}
      <div className="section">
        <h2 className="section-title">Platform Content</h2>
        <div
          style={{
            display: "flex",
            gap: 0,
            borderBottom: "2px solid var(--border)",
            marginBottom: 20,
          }}
        >
          {activePlatforms.map((p) => (
            <button
              key={p}
              onClick={() => {
                setActiveTab(p);
                setRefineOpen(null);
                setRefineFeedback("");
              }}
              style={{
                padding: "10px 24px",
                background: activeTab === p ? "var(--surface2)" : "transparent",
                color: activeTab === p ? "var(--accent)" : "var(--text-dim)",
                border: "none",
                borderBottom:
                  activeTab === p ? "2px solid var(--accent)" : "2px solid transparent",
                cursor: "pointer",
                fontWeight: activeTab === p ? 600 : 400,
                fontSize: 15,
                marginBottom: -2,
                transition: "all 0.2s",
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {currentPlatform && (
          <div className="card">
            <textarea
              rows={10}
              value={currentPlatform.text}
              onChange={(e) => handleTextChange(e.target.value)}
              style={{ marginBottom: 12, fontFamily: "inherit", lineHeight: 1.6 }}
            />

            {/* Hashtags */}
            {currentPlatform.hashtags && currentPlatform.hashtags.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label
                  className="text-sm text-dim"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Hashtags
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {currentPlatform.hashtags.map((tag, i) => (
                    <span
                      key={i}
                      style={{
                        display: "inline-block",
                        padding: "4px 12px",
                        borderRadius: 20,
                        background: "rgba(99, 102, 241, 0.15)",
                        color: "var(--accent)",
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {tag.startsWith("#") ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button
                className="btn btn-primary"
                onClick={handleCopy}
              >
                {copiedPlatform === activeTab ? "Copied!" : "Copy to Clipboard"}
              </button>
              <button
                className="btn"
                style={{ background: "var(--surface2)", color: "var(--text)" }}
                onClick={() =>
                  setRefineOpen(refineOpen === activeTab ? null : activeTab)
                }
              >
                Refine
              </button>
            </div>

            {/* Refine panel */}
            {refineOpen === activeTab && (
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  background: "var(--surface)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                <label
                  className="text-sm"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  What would you like to change?
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Make it more concise, add a call to action, change the tone..."
                  value={refineFeedback}
                  onChange={(e) => setRefineFeedback(e.target.value)}
                  style={{ marginBottom: 12 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleRefine}
                  disabled={loadingRefine || !refineFeedback.trim()}
                >
                  {loadingRefine ? (
                    <span className="spinner" />
                  ) : (
                    "Apply Refinement"
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image Section */}
      {imagePrompts.length > 0 && (
        <div className="section">
          <h2 className="section-title">Images</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 16,
            }}
          >
            {imagePrompts.map((ip, i) => (
              <div key={i} className="card" style={{ padding: 16 }}>
                <p
                  className="text-sm text-dim"
                  style={{ marginBottom: 8 }}
                >
                  {ip.description}
                </p>
                <textarea
                  rows={3}
                  value={editablePrompts[i] ?? ip.prompt}
                  onChange={(e) =>
                    setEditablePrompts((s) => ({ ...s, [i]: e.target.value }))
                  }
                  style={{ marginBottom: 12, fontSize: 13 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => handleGenerateImage(i)}
                  disabled={loadingImage[i]}
                  style={{ marginBottom: 12 }}
                >
                  {loadingImage[i] ? (
                    <span className="spinner" />
                  ) : generatedImages[i] ? (
                    "Regenerate"
                  ) : (
                    "Generate"
                  )}
                </button>
                {generatedImages[i] && (
                  <img
                    src={BACKEND + generatedImages[i]}
                    alt={`Generated image ${i + 1}`}
                    style={{
                      width: "100%",
                      borderRadius: 8,
                      marginTop: 8,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Section */}
      <div className="section">
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span className="text-sm text-dim">
            Platforms: {activePlatforms.join(", ")} &middot; Images: {generatedCount} / {imagePrompts.length}
          </span>
          {user && <span className="text-sm" style={{ color: "var(--green)" }}>Auto-saved to history</span>}
        </div>
      </div>
    </div>
  );
}
