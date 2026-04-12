import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getCredits,
  purchaseCredits,
  getHistory,
  getCreditTransactions,
} from "../api/client";

interface CreditsData {
  balance: number;
  tier: string;
}

interface HistoryItem {
  id: string;
  content_type: string;
  topic_title: string;
  platform: string;
  created_at: string;
  status: string;
}

interface Transaction {
  id: string;
  created_at: string;
  type: string;
  amount: number;
  description: string;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [credits, setCredits] = useState<CreditsData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingTx, setLoadingTx] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getCredits()
      .then((data) => setCredits(data))
      .catch(() => setCredits({ balance: 0, tier: "free" }))
      .finally(() => setLoadingCredits(false));

    getHistory({ limit: 10 })
      .then((data) => setHistory(data.items || data || []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));

    getCreditTransactions(5)
      .then((data) => setTransactions(data.transactions || data || []))
      .catch(() => setTransactions([]))
      .finally(() => setLoadingTx(false));
  }, []);

  const handleBuyCredits = async () => {
    setPurchasing(true);
    setError("");
    try {
      const data = await purchaseCredits(100);
      setCredits((prev) => ({
        balance: data.balance ?? (prev?.balance || 0) + 100,
        tier: prev?.tier || "free",
      }));
    } catch (err: any) {
      setError("Purchase failed: " + (err.message || "Unknown error"));
    } finally {
      setPurchasing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "var(--green)";
      case "failed":
        return "var(--red)";
      case "processing":
        return "var(--yellow)";
      default:
        return "var(--text-dim)";
    }
  };

  const typeBadgeStyle = (type: string): React.CSSProperties => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    background:
      type === "video"
        ? "rgba(59, 130, 246, 0.15)"
        : "rgba(16, 185, 129, 0.15)",
    color: type === "video" ? "var(--accent)" : "var(--green)",
  });

  return (
    <div>
      {/* Welcome header */}
      <div className="section">
        <h2 className="section-title" style={{ fontSize: 24 }}>
          Welcome back
        </h2>
        <p className="text-dim">{user?.email}</p>
      </div>

      {error && (
        <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
      )}

      {/* Credits + Quick Actions row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {/* Credits card */}
        <div className="card">
          <h3
            className="text-dim"
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 12,
            }}
          >
            Credits
          </h3>
          {loadingCredits ? (
            <div style={{ textAlign: "center", padding: 20 }}>
              <span className="spinner" />
            </div>
          ) : (
            <>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: "var(--accent)",
                  marginBottom: 4,
                }}
              >
                {credits?.balance ?? 0}
              </div>
              <p className="text-dim text-sm" style={{ marginBottom: 16 }}>
                Tier:{" "}
                <span style={{ color: "var(--text)", fontWeight: 500 }}>
                  {credits?.tier || "free"}
                </span>
              </p>
              <button
                className="btn btn-success btn-sm"
                onClick={handleBuyCredits}
                disabled={purchasing}
              >
                {purchasing ? <span className="spinner" /> : "Buy 100 Credits"}
              </button>
            </>
          )}
        </div>

        {/* Quick Actions card */}
        <div className="card">
          <h3
            className="text-dim"
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 12,
            }}
          >
            Quick Actions
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => navigate("/")}
            >
              Create Video
            </button>
            <button
              className="btn btn-secondary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => navigate("/")}
            >
              Create Social Post
            </button>
          </div>
        </div>
      </div>

      {/* Recent Content History */}
      <div className="section">
        <h2 className="section-title">Recent Content</h2>
        {loadingHistory ? (
          <div className="loading-center">
            <div className="spinner spinner-lg" />
            <p>Loading history...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="card" style={{ textAlign: "center" }}>
            <p className="text-dim">
              No content created yet. Start by creating a video or social post.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map((item) => (
              <div
                key={item.id}
                className="card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "14px 20px",
                  cursor: "pointer",
                }}
              >
                <span style={typeBadgeStyle(item.content_type)}>
                  {item.content_type === "video" ? "Video" : "Post"}
                </span>
                <span style={{ flex: 1, fontWeight: 500, fontSize: 14 }}>
                  {item.topic_title}
                </span>
                {item.platform && (
                  <span className="text-dim text-sm">{item.platform}</span>
                )}
                <span className="text-dim text-sm">
                  {formatDate(item.created_at)}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: statusColor(item.status),
                  }}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="section">
        <h2 className="section-title">Recent Transactions</h2>
        {loadingTx ? (
          <div className="loading-center">
            <div className="spinner spinner-lg" />
            <p>Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="card" style={{ textAlign: "center" }}>
            <p className="text-dim">No transactions yet.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="scene-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="text-sm">{formatDate(tx.created_at)}</td>
                    <td className="text-sm" style={{ textTransform: "capitalize" }}>
                      {tx.type}
                    </td>
                    <td
                      style={{
                        fontWeight: 600,
                        color:
                          tx.amount > 0 ? "var(--green)" : "var(--red)",
                      }}
                    >
                      {tx.amount > 0 ? "+" : ""}
                      {tx.amount}
                    </td>
                    <td className="text-dim text-sm">{tx.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
