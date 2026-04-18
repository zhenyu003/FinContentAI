import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getProfile,
  updateProfile,
  getCredits,
  getCreditTransactions,
} from "../api/client";
import NarrativeTemplatesManager from "../components/NarrativeTemplatesManager";
import VoiceCloneManager from "../components/VoiceCloneManager";

interface ProfileData {
  display_name: string;
  bio: string;
  persona_notes: string;
}

interface CreditsData {
  balance: number;
  tier: string;
}

interface Transaction {
  id: string;
  created_at: string;
  type: string;
  amount: number;
  description: string;
}

const emptyProfile: ProfileData = {
  display_name: "",
  bio: "",
  persona_notes: "",
};

/* ── Pricing plans (demo) ── */
const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    credits: "50 / month",
    features: [
      "5 videos / month",
      "720p export",
      "Basic AI models",
      "Community support",
    ],
    cta: "Current Plan",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/ month",
    credits: "500 / month",
    features: [
      "Unlimited videos",
      "1080p export",
      "Advanced AI models",
      "Motion Studio (Veo)",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
    highlighted: true,
  },
  {
    name: "Max",
    price: "$49",
    period: "/ month",
    credits: "2,000 / month",
    features: [
      "Everything in Pro",
      "4K export",
      "Custom brand templates",
      "API access",
      "Dedicated support",
    ],
    cta: "Upgrade to Max",
    highlighted: false,
  },
];

/* ── Credit cost reference ── */
const CREDIT_COSTS = [
  { operation: "Topic Search", cost: 1 },
  { operation: "Idea Generation", cost: 2 },
  { operation: "Script Generation", cost: 3 },
  { operation: "Image Generation", cost: 5 },
  { operation: "Audio (TTS)", cost: 3 },
  { operation: "Motion Video (Veo)", cost: 8 },
  { operation: "Video Synthesis", cost: 10 },
  { operation: "Social Post", cost: 5 },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Profile state
  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Credits state
  const [credits, setCredits] = useState<CreditsData | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(true);

  // Transactions state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);

  // Toast
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;

    getProfile()
      .then((data) => {
        const p = data.profile ?? data;
        setProfile({
          display_name: p.display_name || "",
          bio: p.bio || "",
          persona_notes: p.persona_notes || "",
        });
      })
      .catch((e) => setError("Failed to load profile: " + e.message))
      .finally(() => setLoading(false));

    getCredits()
      .then((data) => setCredits(data))
      .catch(() => setCredits({ balance: 50, tier: "Free" }))
      .finally(() => setLoadingCredits(false));

    getCreditTransactions(5)
      .then((data) => setTransactions(data.transactions || data || []))
      .catch(() => setTransactions([]))
      .finally(() => setLoadingTx(false));
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await updateProfile(profile);
      setSuccess("Profile saved successfully.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError("Failed to save profile: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="loading-center">
        <div className="spinner spinner-lg" />
        <p>Loading account...</p>
      </div>
    );
  }

  const currentTier = credits?.tier || "Free";

  return (
    <div>
      {/* Toast notification with backdrop */}
      {toast && (
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
          onClick={() => setToast("")}
        >
          <div style={{
            background: "var(--surface2)",
            border: "1px solid var(--accent)",
            color: "var(--text)",
            padding: "20px 32px",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 500,
            maxWidth: 420,
            textAlign: "center",
            boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
          }}>
            {toast}
          </div>
        </div>
      )}

      <h2 className="section-title" style={{ fontSize: 24 }}>My Account</h2>
      <p className="text-dim text-sm" style={{ marginBottom: 24 }}>{user?.email}</p>

      {error && <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>}
      {success && <p style={{ color: "var(--green)", marginBottom: 16 }}>{success}</p>}

      {/* ── Profile Settings ── */}
      <div className="section">
        <h3 className="section-title">Profile Settings</h3>
        <p className="text-dim text-sm" style={{ marginBottom: 12 }}>
          Your creator profile helps AI generate content that matches your voice and expertise.
        </p>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label className="text-dim text-sm" style={{ display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Display Name
            </label>
            <input
              type="text"
              value={profile.display_name}
              onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))}
              placeholder="Your display name"
            />
          </div>
          <div>
            <label className="text-dim text-sm" style={{ display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Bio
            </label>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
              placeholder="Tell us about yourself..."
              rows={3}
            />
          </div>
          <div>
            <label className="text-dim text-sm" style={{ display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Persona Notes
            </label>
            <textarea
              value={profile.persona_notes}
              onChange={(e) => setProfile((p) => ({ ...p, persona_notes: e.target.value }))}
              placeholder="Any additional notes about your content style, preferred phrases, or things to avoid..."
              rows={4}
            />
          </div>
          <div>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <span className="spinner" /> : "Save Profile"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Voice Cloning (above Narrative Templates) ── */}
      <VoiceCloneManager />

      {/* ── Narrative Templates ── */}
      <NarrativeTemplatesManager />

      {/* ── Credits Overview ── */}
      <div className="section">
        <h3 className="section-title">Credits & Usage</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
          {/* Balance card */}
          <div className="card" style={{ textAlign: "center" }}>
            {loadingCredits ? (
              <span className="spinner" />
            ) : (
              <>
                <div style={{ fontSize: 42, fontWeight: 700, color: "var(--accent)" }}>
                  {credits?.balance ?? 0}
                </div>
                <p className="text-dim" style={{ fontSize: 12, marginBottom: 4 }}>credits remaining</p>
                <span className="badge" style={{ fontSize: 11 }}>
                  {currentTier} Tier
                </span>
                <div style={{ marginTop: 16 }}>
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => showToast("Credit purchase is coming soon. Currently all features are free!")}
                  >
                    Buy Credits
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Credit cost reference */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--surface2)" }}>
              <span className="text-dim" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Credit Cost per Operation
              </span>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 0,
            }}>
              {CREDIT_COSTS.map((item, i) => (
                <div
                  key={item.operation}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 16px",
                    borderBottom: i < CREDIT_COSTS.length - 2 ? "1px solid var(--surface2)" : "none",
                    borderRight: i % 2 === 0 ? "1px solid var(--surface2)" : "none",
                  }}
                >
                  <span style={{ fontSize: 12 }}>{item.operation}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
                    {item.cost} cr
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Pricing Plans ── */}
      <div className="section">
        <h3 className="section-title">Plans</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {PLANS.map((plan) => {
            const isCurrent = plan.name.toLowerCase() === currentTier.toLowerCase();
            return (
              <div
                key={plan.name}
                className="card"
                style={{
                  position: "relative",
                  border: plan.highlighted ? "1px solid var(--accent)" : "1px solid transparent",
                  textAlign: "center",
                  padding: "24px 16px",
                }}
              >
                {plan.highlighted && (
                  <div style={{
                    position: "absolute",
                    top: -10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "var(--accent)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "3px 12px",
                    borderRadius: 10,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}>
                    Most Popular
                  </div>
                )}

                <h3 style={{ fontSize: 18, marginBottom: 8 }}>{plan.name}</h3>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 32, fontWeight: 700 }}>{plan.price}</span>
                  <span className="text-dim" style={{ fontSize: 13 }}> {plan.period}</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--accent)", marginBottom: 16 }}>
                  {plan.credits} credits
                </p>

                <ul style={{ listStyle: "none", padding: 0, marginBottom: 20, textAlign: "left" }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ fontSize: 12, padding: "4px 0", color: "var(--text-dim)" }}>
                      <span style={{ color: "var(--green)", marginRight: 6 }}>&#10003;</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  className={`btn ${isCurrent ? "btn-sm" : ""} ${isCurrent ? "" : plan.highlighted ? "btn-primary" : "btn-secondary"}`}
                  style={{
                    width: "100%",
                    padding: isCurrent ? undefined : "10px 24px",
                    fontSize: isCurrent ? undefined : 14,
                    ...(isCurrent ? { background: "var(--surface2)", color: "var(--text-dim)", cursor: "default" } : {}),
                  }}
                  disabled={isCurrent}
                  onClick={() => {
                    if (!isCurrent) {
                      showToast(`Upgrade to ${plan.name} is coming soon. Currently all features are free!`);
                    }
                  }}
                >
                  {isCurrent ? "Current Plan" : plan.cta}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Recent Transactions ── */}
      <div className="section">
        <h3 className="section-title">Recent Transactions</h3>
        {loadingTx ? (
          <div className="loading-center">
            <div className="spinner spinner-lg" />
            <p>Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="card" style={{ textAlign: "center" }}>
            <p className="text-dim">No transactions yet. Start creating content to see usage here.</p>
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
                    <td className="text-sm" style={{ textTransform: "capitalize" }}>{tx.type}</td>
                    <td style={{ fontWeight: 600, color: tx.amount > 0 ? "var(--green)" : "var(--red)" }}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount}
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
