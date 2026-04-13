import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../App";
import { fetchTopics, searchTopic, enrichTopics } from "../api/client";
import type { Topic } from "../types";
import RankingPanel from "../components/RankingPanel";

type ContentMode = "video" | "social";

function formatNum(n: number | undefined): string {
  if (n == null || n === 0) return "N/A";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

/** Primary: YouTube views (desc). Tie / no data: X views (desc), then title. */
function compareTopicsByEngagement(a: Topic, b: Topic): number {
  const ay = a.youtube_views ?? 0;
  const by = b.youtube_views ?? 0;
  if (ay !== by) return by - ay;
  const at = a.twitter_views ?? 0;
  const bt = b.twitter_views ?? 0;
  if (at !== bt) return bt - at;
  return a.title.localeCompare(b.title);
}

function sortTopicsForDiscovery(list: Topic[]): Topic[] {
  return [...list].sort(compareTopicsByEngagement);
}

function getCachedTopics(): Topic[] | null {
  try {
    const raw = sessionStorage.getItem("trending_topics");
    if (!raw) return null;
    const { topics } = JSON.parse(raw);
    return topics;
  } catch {}
  return null;
}

function setCachedTopics(topics: Topic[]) {
  sessionStorage.setItem("trending_topics", JSON.stringify({ topics, timestamp: Date.now() }));
}

export default function HomePage() {
  const navigate = useNavigate();
  const { setTopic } = useProject();
  const cached = getCachedTopics();
  const [topics, setTopics] = useState<Topic[]>(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");
  const [customQuery, setCustomQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [contentMode, setContentMode] = useState<ContentMode>("video");
  const [enriching, setEnriching] = useState(false);

  const hasInsights = (t: Topic) =>
    t.ai_summary != null || t.youtube_views != null || t.twitter_views != null;

  const sortedTopics = useMemo(() => sortTopicsForDiscovery(topics), [topics]);
  const gridTopics = useMemo(() => sortedTopics.slice(0, 9), [sortedTopics]);
  const rankedTopics = useMemo(() => sortedTopics.slice(9, 20), [sortedTopics]);

  console.log("Total topics:", sortedTopics.length);
  console.log("Top 9:", gridTopics.length);
  console.log("Ranking:", rankedTopics.length);

  useEffect(() => {
    const cachedTopics = getCachedTopics();

    if (cachedTopics && cachedTopics.length > 0) {
      if (cachedTopics.some(hasInsights)) return;
      triggerEnrich(cachedTopics);
      return;
    }

    fetchTopics()
      .then((data) => {
        const t: Topic[] = data.topics || [];
        setCachedTopics(t);
        setTopics(t);
        triggerEnrich(t);
      })
      .catch((e) => setError("Failed to load topics: " + e.message))
      .finally(() => setLoading(false));
  }, []);

  function triggerEnrich(topicList: Topic[]) {
    if (topicList.length === 0) return;
    setEnriching(true);
    enrichTopics(topicList as unknown as Record<string, unknown>[])
      .then((data) => {
        const enriched: Topic[] = data.topics || topicList;
        setTopics(enriched);
        setCachedTopics(enriched);
      })
      .catch(() => {})
      .finally(() => setEnriching(false));
  }

  const handleSelectTopic = (topic: Topic) => {
    setTopic(topic);
    navigate(contentMode === "video" ? "/topic" : "/social/idea");
  };

  const handleSearch = async () => {
    if (!customQuery.trim()) return;
    setSearching(true);
    setError("");
    try {
      const data = await searchTopic(customQuery);
      const topic: Topic = {
        title: data.title || customQuery,
        summary: data.summary || "",
        sources: data.sources || [],
      };
      setTopic(topic);
      navigate(contentMode === "video" ? "/topic" : "/social/idea");
    } catch (e: any) {
      setError("Search failed: " + e.message);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      {/* Content Mode Selector */}
      <div className="section">
        <h2 className="section-title">What do you want to create?</h2>
        <div style={{ display: "flex", gap: 16 }}>
          <div
            className="card"
            onClick={() => setContentMode("video")}
            style={{
              flex: 1,
              cursor: "pointer",
              border: contentMode === "video" ? "2px solid var(--accent)" : "2px solid transparent",
              textAlign: "center",
              padding: "24px 16px",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>&#127909;</div>
            <h3 style={{ marginBottom: 4 }}>Video</h3>
            <p className="text-dim text-sm">Create a narrated video for YouTube, Shorts, or Reels</p>
          </div>
          <div
            className="card"
            onClick={() => setContentMode("social")}
            style={{
              flex: 1,
              cursor: "pointer",
              border: contentMode === "social" ? "2px solid var(--accent)" : "2px solid transparent",
              textAlign: "center",
              padding: "24px 16px",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>&#128240;</div>
            <h3 style={{ marginBottom: 4 }}>Social Post</h3>
            <p className="text-dim text-sm">Create image + text posts for LinkedIn, Instagram, or X</p>
          </div>
        </div>
      </div>

      <div className="step-indicator">
        <span className="step active">1. Topic Discovery</span>
        <span className="arrow">&rarr;</span>
        <span className="step">
          {contentMode === "video" ? "2. Idea & Opinion" : "2. Social Post Idea"}
        </span>
        <span className="arrow">&rarr;</span>
        <span className="step">
          {contentMode === "video" ? "3. Asset Workstation" : "3. Content Studio"}
        </span>
        <span className="arrow">&rarr;</span>
        <span className="step">
          {contentMode === "video" ? "4. Preview & Export" : "4. Copy & Publish"}
        </span>
      </div>

      <div className="section">
        <h2 className="section-title">Custom Topic</h2>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Enter your own topic to research..."
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button
            className="btn btn-primary"
            onClick={handleSearch}
            disabled={searching}
          >
            {searching ? <span className="spinner" /> : "Search"}
          </button>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Trending Financial Topics</h2>
        {error && (
          <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
        )}
        {loading ? (
          <div className="loading-center">
            <div className="spinner spinner-lg" />
            <p>Loading trending topics...</p>
          </div>
        ) : (
          <>
            <p className="topic-grid-eyebrow text-sm text-dim">
              Top Trending Topics (Ranked by YouTube Engagement)
            </p>
            <div className="topic-discovery-layout">
              <div className="topic-discovery-main">
                <div className="topic-grid topic-grid--top9">
                  {gridTopics.map((topic, i) => (
                    <div
                      key={`${topic.title}-${i}`}
                      className="card topic-card"
                      onClick={() => handleSelectTopic(topic)}
                    >
                      <h3>{topic.title}</h3>
                      <p>{topic.summary}</p>
                      {topic.sources && topic.sources.length > 0 && (
                        <div className="sources">
                          {topic.sources.slice(0, 3).map((src, j) => (
                            <a
                              key={j}
                              href={src}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Source {j + 1}
                            </a>
                          ))}
                        </div>
                      )}

                      <div className="topic-insights">
                        {hasInsights(topic) ? (
                          <>
                            <div className="topic-insights-metrics">
                              <span className="topic-insights-metric" title="YouTube views">
                                <svg className="icon-yt" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.9 31.9 0 0 0 0 12a31.9 31.9 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.9 31.9 0 0 0 24 12a31.9 31.9 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z"/></svg>
                                {formatNum(topic.youtube_views)}
                              </span>
                              <span className="topic-insights-metric" title="Twitter / X views">
                                <svg className="icon-x" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>
                                {formatNum(topic.twitter_views)} views
                              </span>
                            </div>
                            {topic.ai_summary && (
                              <p className="topic-insights-summary">
                                &ldquo;{topic.ai_summary}&rdquo;
                              </p>
                            )}
                          </>
                        ) : enriching ? (
                          <div className="topic-insights-loading">
                            <span className="spinner" />
                            <span>Loading insights...</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <RankingPanel
                topics={rankedTopics}
                onSelect={handleSelectTopic}
                loading={loading || enriching}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
