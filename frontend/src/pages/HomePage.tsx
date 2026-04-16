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

/** Shown when the API fails so the page is still usable (mirrors server fallback set). */
const OFFLINE_TOPICS: Topic[] = [
  { title: "Fed Rate Decision Impact on Tech Stocks", summary: "The Federal Reserve's latest rate decision is sending ripples through the tech sector, with growth stocks seeing increased volatility as investors reassess valuations.", sources: [], category: "macro", youtube_views: 1_200_000, twitter_views: 890_000 },
  { title: "AI Chip Shortage Drives Semiconductor Rally", summary: "Surging demand for AI training and inference chips has created a global semiconductor shortage, pushing major chipmakers higher.", sources: [], category: "tech", youtube_views: 980_000, twitter_views: 720_000 },
  { title: "Bitcoin ETF Inflows Hit Record Levels", summary: "Spot Bitcoin ETFs are attracting unprecedented capital inflows as institutional investors increase crypto allocations.", sources: [], category: "crypto", youtube_views: 870_000, twitter_views: 1_100_000 },
  { title: "Commercial Real Estate Debt Crisis Deepens", summary: "Regional banks face mounting pressure as commercial real estate loan defaults accelerate, raising concerns about systemic risk.", sources: [], category: "real_estate", youtube_views: 760_000, twitter_views: 540_000 },
  { title: "NVIDIA Earnings Beat Expectations on AI Demand", summary: "NVIDIA reported record quarterly revenue driven by data-center GPU sales as enterprises ramp up spending on AI infrastructure.", sources: [], category: "companies", youtube_views: 1_400_000, twitter_views: 950_000 },
  { title: "Treasury Yields Hit Multi-Year Highs", summary: "The 10-year Treasury yield crossed key thresholds as strong economic data pushed back expectations for rate cuts.", sources: [], category: "macro", youtube_views: 650_000, twitter_views: 410_000 },
  { title: "Oil Prices Surge on OPEC Production Cuts", summary: "Crude oil prices jumped after OPEC+ announced deeper-than-expected output reductions, raising energy costs worldwide.", sources: [], category: "commodities", youtube_views: 590_000, twitter_views: 380_000 },
  { title: "Cybersecurity Spending Surges After Major Data Breaches", summary: "A string of high-profile data breaches is accelerating enterprise cybersecurity budgets, benefiting security platforms.", sources: [], category: "tech", youtube_views: 520_000, twitter_views: 620_000 },
  { title: "India Emerges as Top Destination for Foreign Investment", summary: "Record FDI inflows into India reflect growing confidence as global supply chains diversify away from China.", sources: [], category: "macro", youtube_views: 480_000, twitter_views: 510_000 },
  { title: "Consumer Spending Resilience Surprises Analysts", summary: "Despite inflation concerns, retail sales data shows consumers continue to spend, defying recession predictions.", sources: [], category: "macro", youtube_views: 440_000, twitter_views: 460_000 },
  // Ranks 11–20
  { title: "Green Energy Subsidies Reshape Utility Sector", summary: "New government subsidies are accelerating the transition to renewable energy, creating winners and losers among traditional utilities.", sources: [], category: "commodities", youtube_views: 432_000, twitter_views: 280_000 },
  { title: "US-China Trade Tensions Escalate with New Tariffs", summary: "Fresh tariff announcements on semiconductors and EV batteries have reignited trade-war fears for global supply chains.", sources: [], category: "macro", youtube_views: 424_000, twitter_views: 510_000 },
  { title: "Ethereum Staking Yields Attract Institutional Capital", summary: "Growing staking yields on Ethereum are drawing allocators positioning ETH as yield-bearing digital infrastructure.", sources: [], category: "crypto", youtube_views: 418_000, twitter_views: 330_000 },
  { title: "Meta Platforms Pivots to AI-First Revenue Model", summary: "Meta reported a shift in ad strategy powered by generative AI, boosting margins and signaling a new growth phase.", sources: [], category: "companies", youtube_views: 410_000, twitter_views: 395_000 },
  { title: "Regional Bank Mergers Accelerate Amid Deposit Flight", summary: "A wave of regional bank consolidation is underway as smaller lenders face deposit outflows and tighter capital rules.", sources: [], category: "companies", youtube_views: 402_000, twitter_views: 265_000 },
  { title: "Japan Yen Weakness Fuels Global Carry Trade", summary: "The yen's slide to multi-decade lows is fueling carry trades with implications for EM currencies and capital flows.", sources: [], category: "macro", youtube_views: 394_000, twitter_views: 440_000 },
  { title: "Pharmaceutical Stocks Rally on Weight-Loss Drug Demand", summary: "GLP-1 drug makers are seeing explosive revenue growth as demand for weight-loss treatments outstrips supply.", sources: [], category: "companies", youtube_views: 386_000, twitter_views: 298_000 },
  { title: "Apple Vision Pro Sales Disappoint, AR Sector Cools", summary: "Slower-than-expected Vision Pro adoption has dampened enthusiasm for AR hardware across the spatial computing chain.", sources: [], category: "tech", youtube_views: 378_000, twitter_views: 352_000 },
  { title: "Global Copper Shortage Signals Infrastructure Boom", summary: "Rising copper prices reflect surging demand from EV manufacturing and grid modernization across the mining sector.", sources: [], category: "commodities", youtube_views: 370_000, twitter_views: 240_000 },
  { title: "Student Loan Repayments Resume, Hitting Retail Spending", summary: "The restart of federal student loan payments is expected to redirect billions from consumer spending into servicing debt.", sources: [], category: "macro", youtube_views: 362_000, twitter_views: 288_000 },
];

/** Append only low-engagement offline tail so short API/cache lists still fill ranks 10–20 without reshuffling the top grid. */
function padTopicsForRanking(list: Topic[]): Topic[] {
  if (list.length >= 20) return list;
  const seen = new Set(list.map((t) => t.title));
  const out = [...list];
  for (const row of OFFLINE_TOPICS.slice(10)) {
    if (out.length >= 20) break;
    if (!seen.has(row.title)) {
      seen.add(row.title);
      out.push({ ...row });
    }
  }
  return out;
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

const CATEGORIES: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "macro", label: "Macro" },
  { key: "companies", label: "Companies" },
  { key: "tech", label: "Tech" },
  { key: "crypto", label: "Crypto" },
  { key: "commodities", label: "Commodities" },
  { key: "real_estate", label: "Real Estate" },
  { key: "etfs_funds", label: "ETFs & Funds" },
];

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
  const [activeCategory, setActiveCategory] = useState("all");
  const [categoryCache, setCategoryCache] = useState<Record<string, Topic[]>>({});

  const hasInsights = (t: Topic) =>
    t.ai_summary != null || t.youtube_views != null || t.twitter_views != null;

  const sortedTopics = useMemo(
    () => sortTopicsForDiscovery(padTopicsForRanking(topics)),
    [topics],
  );
  const gridTopics = useMemo(() => sortedTopics.slice(0, 9), [sortedTopics]);
  const rankedTopics = useMemo(() => sortedTopics.slice(9, 20), [sortedTopics]);

  // Load topics for a category
  const loadCategory = (cat: string) => {
    setActiveCategory(cat);

    // Check local category cache first
    if (categoryCache[cat]) {
      setTopics(categoryCache[cat]);
      return;
    }

    setLoading(true);
    setError("");
    const opts = cat === "all" ? undefined : { category: cat };
    fetchTopics(opts)
      .then((data) => {
        const t: Topic[] = data.topics || [];
        setTopics(t);
        setCategoryCache((prev) => ({ ...prev, [cat]: t }));
        if (cat === "all") setCachedTopics(t);
        triggerEnrich(t);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Topic feed unavailable (${msg}). Showing sample topics.`);
        setTopics(OFFLINE_TOPICS);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const cachedTopics = getCachedTopics();

    if (cachedTopics && cachedTopics.length > 0) {
      setCategoryCache((prev) => ({ ...prev, all: cachedTopics }));
      if (cachedTopics.some(hasInsights)) return;
      triggerEnrich(cachedTopics);
      return;
    }

    fetchTopics()
      .then((data) => {
        setError("");
        const t: Topic[] = data.topics || [];
        setCachedTopics(t);
        setTopics(t);
        setCategoryCache((prev) => ({ ...prev, all: t }));
        triggerEnrich(t);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        setError(
          `Live topic feed unavailable (${msg}). Showing sample financial stories — you can still pick one or use Custom Topic.`
        );
        setTopics(OFFLINE_TOPICS);
        setCachedTopics(OFFLINE_TOPICS);
      })
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
    } catch (e: unknown) {
      setError("Search failed: " + (e instanceof Error ? e.message : String(e)));
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

        {/* Category tabs */}
        <div className="category-tabs" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              className={`category-tab ${activeCategory === cat.key ? "active" : ""}`}
              onClick={() => loadCategory(cat.key)}
              disabled={loading}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {error && (
          <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
        )}
        {loading ? (
          <div className="loading-center">
            <div className="spinner spinner-lg" />
            <p>Loading {activeCategory === "all" ? "trending" : CATEGORIES.find((c) => c.key === activeCategory)?.label} topics...</p>
          </div>
        ) : (
          <>
            <p className="topic-grid-eyebrow text-sm text-dim">
              {activeCategory === "all"
                ? "Top Trending Topics (Ranked by YouTube Engagement)"
                : `${CATEGORIES.find((c) => c.key === activeCategory)?.label} Topics`}
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
