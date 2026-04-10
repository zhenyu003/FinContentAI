import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getProfile, getProfileStyles, updateProfile } from "../api/client";

interface ProfileStyles {
  writing_styles: string[];
  tones: string[];
  focus_areas_options: string[];
  target_audiences: string[];
}

interface ProfileData {
  display_name: string;
  bio: string;
  writing_style: string;
  tone: string;
  focus_areas: string[];
  target_audience: string;
  persona_notes: string;
}

const emptyProfile: ProfileData = {
  display_name: "",
  bio: "",
  writing_style: "",
  tone: "",
  focus_areas: [],
  target_audience: "",
  persona_notes: "",
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [styles, setStyles] = useState<ProfileStyles | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([getProfile(), getProfileStyles()])
      .then(([profileData, stylesData]) => {
        setProfile({
          display_name: profileData.display_name || "",
          bio: profileData.bio || "",
          writing_style: profileData.writing_style || "",
          tone: profileData.tone || "",
          focus_areas: profileData.focus_areas || [],
          target_audience: profileData.target_audience || "",
          persona_notes: profileData.persona_notes || "",
        });
        setStyles(stylesData);
      })
      .catch((e) => setError("Failed to load profile: " + e.message))
      .finally(() => setLoading(false));
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

  const toggleFocusArea = (area: string) => {
    setProfile((prev) => ({
      ...prev,
      focus_areas: prev.focus_areas.includes(area)
        ? prev.focus_areas.filter((a) => a !== area)
        : [...prev.focus_areas, area],
    }));
  };

  if (authLoading || loading) {
    return (
      <div className="loading-center">
        <div className="spinner spinner-lg" />
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="section-title">Profile Settings</h2>

      {error && (
        <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
      )}
      {success && (
        <p style={{ color: "var(--green)", marginBottom: 16 }}>{success}</p>
      )}

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Display Name */}
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

        {/* Bio */}
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

        {/* Writing Style */}
        {styles && (
          <div>
            <label className="text-dim text-sm" style={{ display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Writing Style
            </label>
            <select
              value={profile.writing_style}
              onChange={(e) => setProfile((p) => ({ ...p, writing_style: e.target.value }))}
            >
              <option value="">Select a writing style</option>
              {styles.writing_styles.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {/* Tone */}
        {styles && (
          <div>
            <label className="text-dim text-sm" style={{ display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Tone
            </label>
            <select
              value={profile.tone}
              onChange={(e) => setProfile((p) => ({ ...p, tone: e.target.value }))}
            >
              <option value="">Select a tone</option>
              {styles.tones.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}

        {/* Focus Areas */}
        {styles && (
          <div>
            <label className="text-dim text-sm" style={{ display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Focus Areas
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {styles.focus_areas_options.map((area) => {
                const selected = profile.focus_areas.includes(area);
                return (
                  <span
                    key={area}
                    onClick={() => toggleFocusArea(area)}
                    style={{
                      display: "inline-block",
                      padding: "6px 14px",
                      borderRadius: 20,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      border: selected ? "1px solid var(--accent)" : "1px solid var(--border)",
                      background: selected ? "rgba(59, 130, 246, 0.15)" : "var(--bg-input)",
                      color: selected ? "var(--accent)" : "var(--text-dim)",
                      userSelect: "none",
                    }}
                  >
                    {area}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Target Audience */}
        {styles && (
          <div>
            <label className="text-dim text-sm" style={{ display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Target Audience
            </label>
            <select
              value={profile.target_audience}
              onChange={(e) => setProfile((p) => ({ ...p, target_audience: e.target.value }))}
            >
              <option value="">Select a target audience</option>
              {styles.target_audiences.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        )}

        {/* Persona Notes */}
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

        {/* Save */}
        <div>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <span className="spinner" /> : "Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
