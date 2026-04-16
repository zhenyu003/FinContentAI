import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getKnowledgeItems,
  addKnowledgeItem,
  addKnowledgeFromUrl,
  addKnowledgeFromFile,
  updateKnowledgeItem,
  deleteKnowledgeItem,
  searchKnowledge,
  BACKEND,
} from "../api/client";

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  source_type: string;
  source_url?: string;
  metadata?: { original_filename?: string };
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

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Expand / Edit
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

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

  const userId = user?.id;
  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    if (sourceType === "url" && !newUrl.trim()) return;
    if (sourceType === "text" && !newContent.trim()) return;
    if (sourceType === "pdf" && !pdfFile) return;

    setAdding(true);
    setError("");
    try {
      let newItem: any;

      if (sourceType === "url") {
        // Backend fetches URL content, summarizes, and stores
        newItem = await addKnowledgeFromUrl(newTitle, newUrl);
      } else if (sourceType === "pdf" && pdfFile) {
        // Backend parses file, summarizes, and stores
        newItem = await addKnowledgeFromFile(newTitle, pdfFile);
      } else {
        // Plain text — store directly
        newItem = await addKnowledgeItem({
          title: newTitle,
          content: newContent,
          source_type: "text",
        });
      }

      if (newItem && newItem.id) {
        setItems((prev) => [newItem as KnowledgeItem, ...prev]);
      }
      setNewTitle("");
      setNewContent("");
      setNewUrl("");
      setPdfFile(null);
      setSourceType("text");
    } catch (e: any) {
      setError("Failed to add item: " + e.message);
    } finally {
      setAdding(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError("");
    try {
      await deleteKnowledgeItem(deleteTarget.id);
      setItems((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e: any) {
      setError("Failed to delete item: " + e.message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const startEdit = (item: KnowledgeItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content);
    setExpandedId(item.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setExpandedId(null);
    setEditTitle("");
    setEditContent("");
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSavingEdit(true);
    setError("");
    try {
      const updated = await updateKnowledgeItem(editingId, { title: editTitle, content: editContent });
      setItems((prev) => prev.map((it) => (it.id === editingId ? { ...it, ...updated } : it)));
      setEditingId(null);
    } catch (e: any) {
      setError("Failed to update: " + e.message);
    } finally {
      setSavingEdit(false);
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
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 9998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "24px 28px",
              maxWidth: 400,
              width: "90%",
              boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Delete Knowledge Item</h3>
            <p className="text-dim" style={{ fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
              Are you sure you want to delete <strong style={{ color: "var(--text)" }}>{deleteTarget.title}</strong>? This will also remove all associated embeddings and cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                className="btn btn-sm"
                style={{ background: "var(--bg-input)", color: "var(--text-dim)" }}
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm"
                style={{ background: "var(--red)", color: "#fff", border: "none" }}
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? <span className="spinner" /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <p className="text-dim">Click to select a file (.txt, .md, .csv, .pdf) — max 5 MB</p>
              )}
            </div>
          )}

          <div>
            <button
              className="btn btn-primary"
              onClick={handleAdd}
              disabled={adding}
            >
              {adding ? (
                <>
                  <span className="spinner" />{" "}
                  {sourceType === "url" ? "Fetching & summarizing..." : sourceType === "pdf" ? "Parsing & summarizing..." : "Adding..."}
                </>
              ) : (
                "Add to Knowledge Base"
              )}
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
            {items.map((item) => {
              const isExpanded = expandedId === item.id;
              const isEditing = editingId === item.id;
              const isUrl = item.source_type === "url";
              const isPdf = item.source_type === "pdf";
              const sourceLink = item.source_url || "";

              return (
                <div key={item.id} className="card" style={{ padding: 16 }}>
                  {/* Header row */}
                  <div className="flex-between" style={{ marginBottom: 8 }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }}
                      onClick={() => { setExpandedId(isExpanded ? null : item.id); if (isEditing) cancelEdit(); }}
                    >
                      <span style={{ fontSize: 11, color: "var(--text-dim)", transition: "transform 0.15s", transform: isExpanded ? "rotate(90deg)" : "none" }}>&#9654;</span>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{item.title}</span>
                      <span className="badge" style={sourceBadgeColor(item.source_type)}>{item.source_type}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button
                        className="btn btn-sm"
                        style={{ color: "var(--accent)", border: "1px solid var(--border)", background: "transparent" }}
                        onClick={() => isEditing ? cancelEdit() : startEdit(item)}
                      >
                        {isEditing ? "Cancel" : "Edit"}
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ color: "var(--red)", border: "1px solid var(--red)", background: "transparent" }}
                        onClick={() => setDeleteTarget({ id: item.id, title: item.title })}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Source link */}
                  {sourceLink && (
                    <p style={{ marginBottom: 6, fontSize: 13 }}>
                      {isUrl ? (
                        <a href={sourceLink} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>
                          {sourceLink}
                        </a>
                      ) : isPdf ? (
                        <a href={BACKEND + sourceLink} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>
                          {item.metadata?.original_filename || "Download PDF"} ↓
                        </a>
                      ) : (
                        <span className="text-dim">{sourceLink}</span>
                      )}
                    </p>
                  )}

                  {/* Edit mode */}
                  {isEditing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        style={{ fontWeight: 600 }}
                      />
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={8}
                        style={{ fontSize: 13, lineHeight: 1.6 }}
                      />
                      <div>
                        <button className="btn btn-sm btn-primary" onClick={handleSaveEdit} disabled={savingEdit}>
                          {savingEdit ? <><span className="spinner" /> Saving...</> : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Content preview / full */
                    <p className="text-sm text-dim" style={{ lineHeight: 1.6, marginBottom: 8, whiteSpace: isExpanded ? "pre-wrap" : undefined }}>
                      {isExpanded ? item.content : (item.content.length > 200 ? item.content.slice(0, 200) + "..." : item.content)}
                    </p>
                  )}

                  <span className="text-sm text-dim">{formatDate(item.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
