import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getKnowledgeItems,
  addKnowledgeItem,
  deleteKnowledgeItem,
  searchKnowledge,
} from "../api/client";

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  source_type: string;
  source_url?: string;
  created_at: string;
}

interface SearchResult {
  content: string;
  similarity: number;
  title?: string;
}

export default function KnowledgePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Items list
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [error, setError] = useState("");

  // Add form
  const [newTitle, setNewTitle] = useState("");
  const [sourceType, setSourceType] = useState<"text" | "url" | "pdf">("text");
  const [newContent, setNewContent] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const loadItems = () => {
    if (!user) return;
    setLoadingItems(true);
    getKnowledgeItems()
      .then((data) => setItems(data.items || data || []))
      .catch((e) => setError("Failed to load knowledge items: " + e.message))
      .finally(() => setLoadingItems(false));
  };

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    if (sourceType === "url" && !newUrl.trim()) return;
    if (sourceType === "text" && !newContent.trim()) return;
    if (sourceType === "pdf" && !pdfFile) return;

    setAdding(true);
    setError("");
    try {
      let content = newContent;
      if (sourceType === "url") {
        content = newUrl;
      } else if (sourceType === "pdf" && pdfFile) {
        content = await readFileAsText(pdfFile);
        if (!content.trim()) {
          content = `[Uploaded PDF: ${pdfFile.name}]`;
        }
      }

      await addKnowledgeItem({
        title: newTitle,
        content,
        source_type: sourceType,
        source_url: sourceType === "url" ? newUrl : undefined,
      });
      setNewTitle("");
      setNewContent("");
      setNewUrl("");
      setPdfFile(null);
      setSourceType("text");
      loadItems();
    } catch (e: any) {
      setError("Failed to add item: " + e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this knowledge item?")) return;
    setError("");
    try {
      await deleteKnowledgeItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e: any) {
      setError("Failed to delete item: " + e.message);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError("");
    try {
      const data = await searchKnowledge(searchQuery);
      setSearchResults(data.results || data || []);
    } catch (e: any) {
      setError("Search failed: " + e.message);
    } finally {
      setSearching(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const sourceBadgeColor = (type: string) => {
    switch (type) {
      case "pdf":
        return { background: "rgba(239, 68, 68, 0.15)", color: "var(--red)" };
      case "url":
        return { background: "rgba(16, 185, 129, 0.15)", color: "var(--green)" };
      default:
        return { background: "rgba(59, 130, 246, 0.15)", color: "var(--accent)" };
    }
  };

  if (authLoading || loadingItems) {
    return (
      <div className="loading-center">
        <div className="spinner spinner-lg" />
        <p>Loading knowledge base...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="section-title">Knowledge Base</h2>

      {error && (
        <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
      )}

      {/* Add Knowledge Section */}
      <div className="card section">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          Add Knowledge
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="text"
            placeholder="Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <div>
            <label className="text-dim text-sm" style={{ display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Input Method
            </label>
            <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--border)", marginBottom: 16 }}>
              {([["text", "Paste Text"], ["url", "URL"], ["pdf", "Upload File"]] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setSourceType(val)}
                  style={{
                    padding: "8px 20px",
                    background: sourceType === val ? "var(--bg-input)" : "transparent",
                    color: sourceType === val ? "var(--accent)" : "var(--text-dim)",
                    border: "none",
                    borderBottom: sourceType === val ? "2px solid var(--accent)" : "2px solid transparent",
                    cursor: "pointer",
                    fontWeight: sourceType === val ? 600 : 400,
                    fontSize: 14,
                    marginBottom: -2,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {sourceType === "text" && (
            <textarea
              placeholder="Paste your content here — articles, notes, analysis, opinions..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={6}
            />
          )}

          {sourceType === "url" && (
            <input
              type="url"
              placeholder="https://example.com/article"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
            />
          )}

          {sourceType === "pdf" && (
            <div style={{
              border: "2px dashed var(--border)",
              borderRadius: 8,
              padding: 24,
              textAlign: "center",
              cursor: "pointer",
            }}
              onClick={() => document.getElementById("pdf-upload")?.click()}
            >
              <input
                id="pdf-upload"
                type="file"
                accept=".txt,.md,.csv,.pdf"
                style={{ display: "none" }}
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              />
              {pdfFile ? (
                <p>{pdfFile.name} <span className="text-dim text-sm">({(pdfFile.size / 1024).toFixed(1)} KB)</span></p>
              ) : (
                <p className="text-dim">Click to select a file (.txt, .md, .csv, .pdf)</p>
              )}
            </div>
          )}

          <div>
            <button
              className="btn btn-primary"
              onClick={handleAdd}
              disabled={adding}
            >
              {adding ? <span className="spinner" /> : "Add to Knowledge Base"}
            </button>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="section">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          Search Knowledge
        </h3>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search your knowledge base..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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

        {searchResults.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {searchResults.map((result, i) => (
              <div key={i} className="card" style={{ padding: 16 }}>
                <div className="flex-between" style={{ marginBottom: 8 }}>
                  {result.title && (
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{result.title}</span>
                  )}
                  <span
                    className="badge"
                    style={{
                      background: "rgba(245, 158, 11, 0.15)",
                      color: "var(--yellow)",
                      marginLeft: "auto",
                    }}
                  >
                    {(result.similarity * 100).toFixed(1)}% match
                  </span>
                </div>
                <p className="text-sm text-dim" style={{ lineHeight: 1.6 }}>
                  {result.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Knowledge Items List */}
      <div className="section">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          Your Knowledge Items ({items.length})
        </h3>

        {items.length === 0 ? (
          <p className="text-dim">No knowledge items yet. Add some content above to get started.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {items.map((item) => (
              <div key={item.id} className="card" style={{ padding: 16 }}>
                <div className="flex-between" style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{item.title}</span>
                    <span
                      className="badge"
                      style={sourceBadgeColor(item.source_type)}
                    >
                      {item.source_type}
                    </span>
                  </div>
                  <button
                    className="btn btn-sm"
                    style={{ color: "var(--red)", border: "1px solid var(--red)", background: "transparent" }}
                    onClick={() => handleDelete(item.id)}
                  >
                    Delete
                  </button>
                </div>
                <p className="text-sm text-dim" style={{ lineHeight: 1.6, marginBottom: 8 }}>
                  {item.content.length > 200
                    ? item.content.slice(0, 200) + "..."
                    : item.content}
                </p>
                <span className="text-sm text-dim">{formatDate(item.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
