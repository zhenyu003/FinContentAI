import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../App";
import { fetchTopics, searchTopic } from "../api/client";
import type { Topic } from "../types";

type ContentMode = "video" | "social";

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

  useEffect(() => {
    if (getCachedTopics()) return;
    fetchTopics()
      .then((data) => {
        const t = data.topics || [];
        setCachedTopics(t);
        setTopics(t);
      })
      .catch((e) => setError("Failed to load topics: " + e.message))
      .finally(() => setLoading(false));
  }, []);

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
          <div className="topic-grid">
            {topics.map((topic, i) => (
              <div
                key={i}
                className="card topic-card"
                onClick={() => handleSelectTopic(topic)}
              >
                <h3>{topic.title}</h3>
                <p>{topic.summary}</p>
                {topic.sources?.length > 0 && (
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
