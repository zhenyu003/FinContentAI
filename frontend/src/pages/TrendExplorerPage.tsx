import { useState, useEffect, useCallback } from "react";
import { fetchTrends, generateFromTrend } from "../api/client";
import type { Trend } from "../types";

type ContentType = "text" | "video";

interface GenerateResult {
  status: string;
  content_type: ContentType;
  trend_title: string;
  result: Record<string, unknown>;
}

function formatNumber(n: number | undefined): string {
  if (n == null || n === 0) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

export default function TrendExplorerPage() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedTrend, setSelectedTrend] = useState<Trend | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [resultOpen, setResultOpen] = useState(false);

  useEffect(() => {
    fetchTrends()
      .then((data) => setTrends(data.trends || []))
      .catch((e) => setError("Failed to load trends: " + e.message))
      .finally(() => setLoading(false));
  }, []);

  const openModal = useCallback((trend: Trend) => {
    setSelectedTrend(trend);
    setModalOpen(true);
    setResult(null);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelectedTrend(null);
  }, []);

  const closeResult = useCallback(() => {
    setResultOpen(false);
    setResult(null);
  }, []);

  const handleGenerate = useCallback(
    async (contentType: ContentType) => {
      if (!selectedTrend) return;
      setGenerating(true);
      setModalOpen(false);
      try {
        const data = await generateFromTrend(
          selectedTrend as unknown as Record<string, unknown>,
          contentType
        );
        setResult(data);
        setResultOpen(true);
      } catch (e: any) {
        setError("Generation failed: " + e.message);
      } finally {
        setGenerating(false);
      }
    },
    [selectedTrend]
  );

  const engagementColor = (score: number) => {
    if (score >= 90) return "var(--green)";
    if (score >= 75) return "var(--accent)";
    return "var(--yellow)";
  };

  return (
    <div>
      <div className="section">
        <h2 className="section-title">Trend Explorer</h2>
        <p className="text-dim text-sm" style={{ marginTop: -8, marginBottom: 20 }}>
          Browse trending financial topics with real engagement data. Click any card to generate content.
        </p>
      </div>

      {error && (
        <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
      )}

      {loading ? (
        <div className="loading-center">
          <div className="spinner spinner-lg" />
          <p>Fetching live trends...</p>
        </div>
      ) : (
        <div className="trend-grid">
          {trends.map((trend) => (
            <div
              key={trend.id}
              className="card trend-card"
              onClick={() => openModal(trend)}
            >
              {/* ── Header: category + engagement score ── */}
              <div className="trend-card-header">
                {trend.category && (
                  <span className="badge">{trend.category}</span>
                )}
                <div
                  className="trend-engagement"
                  style={{ color: engagementColor(trend.engagement) }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                  {trend.engagement}
                </div>
              </div>

              {/* ── Title ── */}
              <h3>{trend.title}</h3>

              {/* ── AI Summary ── */}
              {trend.ai_summary ? (
                <p className="trend-ai-summary">"{trend.ai_summary}"</p>
              ) : (
                <p>{trend.summary}</p>
              )}

              {/* ── Metrics bar ── */}
              <div className="trend-metrics">
                <div className="trend-metric" title="YouTube views">
                  <svg className="icon-yt" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.9 31.9 0 0 0 0 12a31.9 31.9 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.9 31.9 0 0 0 24 12a31.9 31.9 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z"/></svg>
                  <span>{formatNumber(trend.youtube_views)}</span>
                </div>
                <div className="trend-metric" title="Twitter / X likes">
                  <svg className="icon-x" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>
                  <span>{formatNumber(trend.twitter_likes)}</span>
                </div>
                <div className="trend-metric" title="Twitter / X reposts">
                  <svg className="icon-x" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>
                  <span>{formatNumber(trend.twitter_retweets)}</span>
                </div>
              </div>

              {/* ── Footer ── */}
              <div className="trend-card-footer">
                <span className="text-dim text-sm">Click to generate content</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Generating spinner overlay ── */}
      {generating && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: "center", padding: 48 }}>
            <div className="spinner spinner-lg" />
            <p style={{ marginTop: 16 }}>Generating content...</p>
          </div>
        </div>
      )}

      {/* ── Content-type selection modal ── */}
      {modalOpen && selectedTrend && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Generate Content</h3>
              <button className="modal-close" onClick={closeModal}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="card" style={{ marginBottom: 20, borderColor: "var(--accent)" }}>
                <h4 style={{ marginBottom: 6 }}>{selectedTrend.title}</h4>
                {selectedTrend.ai_summary && (
                  <p className="text-dim text-sm" style={{ fontStyle: "italic", marginBottom: 8 }}>
                    "{selectedTrend.ai_summary}"
                  </p>
                )}
                <div className="trend-metrics" style={{ borderTop: "none", paddingTop: 0, marginTop: 4 }}>
                  <div className="trend-metric">
                    <svg className="icon-yt" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.9 31.9 0 0 0 0 12a31.9 31.9 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.9 31.9 0 0 0 24 12a31.9 31.9 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z"/></svg>
                    <span>{formatNumber(selectedTrend.youtube_views)}</span>
                  </div>
                  <div className="trend-metric">
                    <svg className="icon-x" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>
                    <span>{formatNumber(selectedTrend.twitter_likes)}</span>
                  </div>
                  <div className="trend-metric">
                    <svg className="icon-x" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>
                    <span>{formatNumber(selectedTrend.twitter_retweets)}</span>
                  </div>
                </div>
              </div>
              <p style={{ marginBottom: 16, fontWeight: 500 }}>
                Choose a content type:
              </p>
              <div className="content-type-options">
                <button
                  className="content-type-btn"
                  onClick={() => handleGenerate("text")}
                >
                  <div className="content-type-icon">&#9997;&#65039;</div>
                  <div>
                    <div className="content-type-label">Text Post</div>
                    <div className="text-dim text-sm">
                      Generate a written post for social platforms
                    </div>
                  </div>
                </button>
                <button
                  className="content-type-btn"
                  onClick={() => handleGenerate("video")}
                >
                  <div className="content-type-icon">&#127909;</div>
                  <div>
                    <div className="content-type-label">Video</div>
                    <div className="text-dim text-sm">
                      Generate a video script with scenes and narration
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Result modal ── */}
      {resultOpen && result && (
        <div className="modal-overlay" onClick={closeResult}>
          <div
            className="modal-content modal-content-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>
                {result.content_type === "text" ? "Text Post" : "Video Script"} — {result.trend_title}
              </h3>
              <button className="modal-close" onClick={closeResult}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              {result.content_type === "text" ? (
                <TextResult data={result.result} />
              ) : (
                <VideoResult data={result.result} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TextResult({ data }: { data: Record<string, unknown> }) {
  const headline = data.headline as string;
  const body = data.body as string;
  const platforms = (data.platforms as string[]) || [];

  return (
    <div className="result-content">
      <h4 style={{ marginBottom: 12, color: "var(--accent)" }}>{headline}</h4>
      <div className="card" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 14 }}>
        {body}
      </div>
      {platforms.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          {platforms.map((p) => (
            <span key={p} className="badge">{p}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function VideoResult({ data }: { data: Record<string, unknown> }) {
  const outline = (data.script_outline as string[]) || [];
  const duration = data.estimated_duration as string;
  const format = data.suggested_format as string;

  return (
    <div className="result-content">
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        {duration && (
          <div className="badge" style={{ background: "rgba(16,185,129,.15)", color: "var(--green)" }}>
            {duration}
          </div>
        )}
        {format && (
          <div className="badge">{format}</div>
        )}
      </div>
      <h4 style={{ marginBottom: 12 }}>Script Outline</h4>
      <div className="video-outline">
        {outline.map((item, i) => (
          <div key={i} className="outline-step">
            <span className="outline-num">{i + 1}</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
