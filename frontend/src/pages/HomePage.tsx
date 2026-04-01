import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../App";
import { fetchTopics, searchTopic } from "../api/client";
import type { Topic } from "../types";

export default function HomePage() {
  const navigate = useNavigate();
  const { setTopic } = useProject();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customQuery, setCustomQuery] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchTopics()
      .then((data) => setTopics(data.topics || []))
      .catch((e) => setError("Failed to load topics: " + e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSelectTopic = (topic: Topic) => {
    setTopic(topic);
    navigate("/topic");
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
      navigate("/topic");
    } catch (e: any) {
      setError("Search failed: " + e.message);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <div className="step-indicator">
        <span className="step active">1. Topic Discovery</span>
        <span className="arrow">&rarr;</span>
        <span className="step">2. Idea & Opinion</span>
        <span className="arrow">&rarr;</span>
        <span className="step">3. Asset Workstation</span>
        <span className="arrow">&rarr;</span>
        <span className="step">4. Preview & Export</span>
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
