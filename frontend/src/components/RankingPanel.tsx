import type { Topic } from "../types";

function formatNum(n: number | undefined): string {
  if (n == null || n === 0) return "N/A";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

interface Props {
  /** Already-sliced topics for ranks 10–20 */
  topics: Topic[];
  onSelect: (topic: Topic) => void;
  loading?: boolean;
}

export default function RankingPanel({ topics, onSelect, loading }: Props) {
  return (
    <aside
      className="topic-ranking-panel card"
      aria-label="Topics ranked 10 to 20"
    >
      <h3 className="topic-ranking-panel-title">Topics Ranking (10–20)</h3>

      {topics.length === 0 ? (
        <div className="topic-ranking-empty">
          {loading ? (
            <>
              <span className="spinner" style={{ width: 16, height: 16 }} />
              <span>Loading more topics...</span>
            </>
          ) : (
            <span>More topics coming soon</span>
          )}
        </div>
      ) : (
        <ul className="topic-ranking-list">
          {topics.map((topic, i) => {
            const rank = i + 10;
            return (
              <li key={`${topic.title}-${rank}`}>
                <button
                  type="button"
                  className="topic-ranking-item"
                  onClick={() => onSelect(topic)}
                >
                  <span className="topic-ranking-rank">#{rank}</span>
                  <span className="topic-ranking-content">
                    <span className="topic-ranking-title">{topic.title}</span>
                    <span className="topic-ranking-metrics">
                      <span
                        className="topic-ranking-metric"
                        title="YouTube views"
                      >
                        <svg
                          className="icon-yt icon-yt--inline"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden
                        >
                          <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.9 31.9 0 0 0 0 12a31.9 31.9 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.9 31.9 0 0 0 24 12a31.9 31.9 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />
                        </svg>
                        {formatNum(topic.youtube_views)}
                      </span>
                      <span className="topic-ranking-metric" title="X views">
                        <svg
                          className="icon-x icon-x--inline"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden
                        >
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
                        </svg>
                        {formatNum(topic.twitter_views)}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
