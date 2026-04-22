import { useState, useRef } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useProject } from "../App";
import {
  splitSceneToShots,
  generateMotionVeo,
  stitchMotionShots,
  generateImage,
  uploadSceneImage,
  BACKEND,
  formatApiError,
} from "../api/client";
import type { ShotData } from "../types";

export default function MotionStudioPage() {
  const { sceneIndex } = useParams<{ sceneIndex: string }>();
  const navigate = useNavigate();
  const { state, updateScene } = useProject();
  const { scenes, aspectRatio } = state;

  const idx = Number(sceneIndex);
  const scene = scenes[idx];

  // Restore shots from scene state if available
  const [shots, setShots] = useState<ShotData[]>(scene?.shots ?? []);
  // Ref mirrors the latest `shots` synchronously so overlapping async handlers
  // don't overwrite each other with a stale closure snapshot.
  const shotsRef = useRef<ShotData[]>(shots);
  shotsRef.current = shots;
  const [loadingSplit, setLoadingSplit] = useState(false);
  const [loadingMotion, setLoadingMotion] = useState<Record<number, boolean>>({});
  const [loadingAllMotion, setLoadingAllMotion] = useState(false);
  const [batchHint, setBatchHint] = useState("");
  const [loadingStitch, setLoadingStitch] = useState(false);
  const [stitchedUrl, setStitchedUrl] = useState<string | null>(scene?.motion_url || null);
  const [error, setError] = useState("");

  // Motion model selector — UI-only for now; backend is wired to Veo 3.1 Lite.
  // Seedance option is a visual preview of the future multi-provider abstraction.
  const [motionModel, setMotionModel] = useState<
    "veo-3.1-lite" | "seedance-1.5-pro-fast"
  >("veo-3.1-lite");

  // Reference image (image-to-video) state
  const [singleShotImage, setSingleShotImage] = useState<string | undefined>(undefined);
  const [loadingRefGen, setLoadingRefGen] = useState<Record<number | "single", boolean>>({});
  const [loadingRefUpload, setLoadingRefUpload] = useState<Record<number | "single", boolean>>({});

  // Guard: need valid scene with audio
  if (!scene || !scene.audio_url) {
    return <Navigate to="/workspace" replace />;
  }

  const duration = scene.audio_duration ?? 0;
  // Matches the backend's split_scene_to_shots logic: a single ~8s Veo clip
  // plus up to ~2s of freeze-tail covers anything ≤ 10s in one shot, so we
  // skip the "Split into Shots" step entirely and go straight to the
  // single-shot work area.
  const isSingleShot = duration <= 10;

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // Persist shots to scene state whenever they change.
  // Update ref eagerly so any in-flight async handler sees the latest value.
  const updateShots = (newShots: ShotData[]) => {
    shotsRef.current = newShots;
    setShots(newShots);
    updateScene(idx, { shots: newShots });
  };

  // ── Split shots via LLM ──
  const handleSplitShots = async () => {
    setLoadingSplit(true);
    setError("");
    try {
      const data = await splitSceneToShots({
        scene_description: scene.description,
        narration: scene.narration,
        audio_duration: duration,
        aspect_ratio: aspectRatio,
      });
      const newShots: ShotData[] = data.shots.map((s) => ({ ...s }));
      updateShots(newShots);
      setStitchedUrl(null);
    } catch (e: unknown) {
      setError("Failed to split shots: " + formatApiError(e));
    } finally {
      setLoadingSplit(false);
    }
  };

  // ── Generate motion video for a shot ──
  const handleGenMotion = async (shotIdx: number): Promise<boolean> => {
    setLoadingMotion((s) => ({ ...s, [shotIdx]: true }));
    setError("");
    try {
      const shot = shotsRef.current[shotIdx];
      const data = await generateMotionVeo({
        description: shot.visual_prompt,
        narration: scene.narration,
        aspect_ratio: aspectRatio,
        reference_image_url: shot.reference_image_url,
      });
      // Read from ref — any concurrent handler that completed meanwhile has
      // already updated shotsRef.current, so we don't drop its changes.
      const newShots = shotsRef.current.map((s, i) =>
        i === shotIdx ? { ...s, motion_url: data.video_url } : s
      );
      updateShots(newShots);

      // Single shot — auto-stitch (mux with audio) so user can save directly
      if (newShots.length === 1) {
        try {
          setLoadingStitch(true);
          const stitchData = await stitchMotionShots({
            shot_videos: [data.video_url.replace(/^\//, "")],
            audio_url: scene.audio_url!.replace(/^\//, ""),
            audio_duration: duration,
            tail_strategy: "freeze",
          });
          setStitchedUrl(stitchData.video_url);
        } catch {
          // Stitch failed silently — user can still manually stitch
        } finally {
          setLoadingStitch(false);
        }
      }

      return true;
    } catch (e: unknown) {
      const msg = formatApiError(e);
      const isRateLimit = msg.includes("429") || msg.includes("rate limit") || msg.includes("quota");
      if (isRateLimit) {
        setError(`Shot ${shotIdx + 1}: API rate limited. Waiting before retry...`);
      } else {
        setError(`Motion failed for shot ${shotIdx + 1}: ${msg}`);
      }
      return false;
    } finally {
      setLoadingMotion((s) => ({ ...s, [shotIdx]: false }));
    }
  };

  // ── Batch: all motions (with delay between shots to avoid rate limits) ──
  // Uses a local accumulator to avoid stale closure over `shots` state.
  const handleGenAllMotion = async () => {
    setLoadingAllMotion(true);
    setError("");
    let currentShots = [...shotsRef.current];
    let generated = 0;

    const genOne = async (i: number): Promise<boolean> => {
      setLoadingMotion((s) => ({ ...s, [i]: true }));
      try {
        const shot = currentShots[i];
        const data = await generateMotionVeo({
          description: shot.visual_prompt,
          narration: scene.narration,
          aspect_ratio: aspectRatio,
          reference_image_url: shot.reference_image_url,
        });
        currentShots = currentShots.map((s, j) =>
          j === i ? { ...s, motion_url: data.video_url } : s
        );
        updateShots([...currentShots]);
        return true;
      } catch (e: unknown) {
        const msg = formatApiError(e);
        const isRateLimit = msg.includes("429") || msg.includes("rate limit") || msg.includes("quota");
        setError(isRateLimit
          ? `Shot ${i + 1}: API rate limited. Waiting before retry...`
          : `Motion failed for shot ${i + 1}: ${msg}`
        );
        return false;
      } finally {
        setLoadingMotion((s) => ({ ...s, [i]: false }));
      }
    };

    for (let i = 0; i < currentShots.length; i++) {
      if (!currentShots[i].motion_url) {
        if (generated > 0) {
          setBatchHint(`Waiting 10s before shot ${i + 1}...`);
          await new Promise((r) => setTimeout(r, 10_000));
          setBatchHint("");
        }
        const ok = await genOne(i);
        if (ok) {
          generated++;
        } else {
          setBatchHint(`Retrying shot ${i + 1} after 30s cooldown...`);
          await new Promise((r) => setTimeout(r, 30_000));
          setBatchHint("");
          const retryOk = await genOne(i);
          if (retryOk) generated++;
          else break;
        }
      }
    }

    // Auto-stitch if all motions ready and only 1 shot
    if (currentShots.length === 1 && currentShots[0].motion_url) {
      try {
        setLoadingStitch(true);
        const stitchData = await stitchMotionShots({
          shot_videos: [currentShots[0].motion_url.replace(/^\//, "")],
          audio_url: scene.audio_url!.replace(/^\//, ""),
          audio_duration: duration,
          tail_strategy: "freeze",
        });
        setStitchedUrl(stitchData.video_url);
      } catch { /* user can stitch manually */ }
      finally { setLoadingStitch(false); }
    }

    setLoadingAllMotion(false);
    setBatchHint("");
  };

  // ── Stitch all shots ──
  const allMotionReady = shots.length > 0 && shots.every((s) => !!s.motion_url);

  const handleStitch = async () => {
    if (!allMotionReady) return;
    setLoadingStitch(true);
    setError("");
    try {
      const shotVideos = shots.map((s) => s.motion_url!.replace(/^\//, ""));
      const data = await stitchMotionShots({
        shot_videos: shotVideos,
        audio_url: scene.audio_url!.replace(/^\//, ""),
        audio_duration: duration,
        tail_strategy: "freeze",
      });
      setStitchedUrl(data.video_url);
    } catch (e: unknown) {
      setError("Stitch failed: " + formatApiError(e));
    } finally {
      setLoadingStitch(false);
    }
  };

  // ── Single-shot: generate motion directly (no split/stitch) ──
  const [loadingDirect, setLoadingDirect] = useState(false);

  const handleDirectGenerate = async () => {
    setLoadingDirect(true);
    setError("");
    try {
      const data = await generateMotionVeo({
        description: scene.description,
        narration: scene.narration,
        aspect_ratio: aspectRatio,
        reference_image_url: singleShotImage,
      });
      setStitchedUrl(data.video_url);
    } catch (e: unknown) {
      setError("Motion generation failed: " + formatApiError(e));
    } finally {
      setLoadingDirect(false);
    }
  };

  // ── Reference image (image-to-video) handlers ──
  const setShotRefImage = (shotIdx: number, url: string | undefined) => {
    const newShots = shotsRef.current.map((s, i) =>
      i === shotIdx ? { ...s, reference_image_url: url } : s
    );
    updateShots(newShots);
  };

  const handleRefImageGen = async (shotIdx: number | "single") => {
    setLoadingRefGen((s) => ({ ...s, [shotIdx]: true }));
    setError("");
    try {
      const prompt =
        shotIdx === "single" ? scene.description : shotsRef.current[shotIdx].visual_prompt;
      const data = await generateImage(prompt, aspectRatio);
      if (shotIdx === "single") setSingleShotImage(data.image_url);
      else setShotRefImage(shotIdx, data.image_url);
    } catch (e: unknown) {
      setError("Reference image generation failed: " + formatApiError(e));
    } finally {
      setLoadingRefGen((s) => ({ ...s, [shotIdx]: false }));
    }
  };

  const handleRefImageUpload = async (shotIdx: number | "single", file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError("File too large (max 5 MB)");
      return;
    }
    setLoadingRefUpload((s) => ({ ...s, [shotIdx]: true }));
    setError("");
    try {
      const data = await uploadSceneImage(file);
      if (shotIdx === "single") setSingleShotImage(data.image_url);
      else setShotRefImage(shotIdx, data.image_url);
    } catch (e: unknown) {
      setError("Upload failed: " + formatApiError(e));
    } finally {
      setLoadingRefUpload((s) => ({ ...s, [shotIdx]: false }));
    }
  };

  const handleRefImageRemove = (shotIdx: number | "single") => {
    if (shotIdx === "single") setSingleShotImage(undefined);
    else setShotRefImage(shotIdx, undefined);
  };

  // Compact per-shot (or single-shot) reference-image zone.
  const renderRefImageZone = (key: number | "single", imageUrl?: string) => {
    const busy = !!loadingRefGen[key] || !!loadingRefUpload[key];
    return (
      <div
        style={{
          border: "1px dashed var(--border)",
          borderRadius: 6,
          padding: 8,
          marginBottom: 8,
          background: "var(--bg-input)",
          fontSize: 11,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>🖼 Reference image</span>
          <span className="text-dim" style={{ fontSize: 10 }}>(optional anchor)</span>
        </div>
        {imageUrl ? (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            {/* Image fills available width at the correct video aspect ratio */}
            <img
              src={imageUrl.startsWith("data:") ? imageUrl : BACKEND + imageUrl}
              alt="reference"
              style={{
                flex: 1,
                minWidth: 0,
                width: "100%",
                aspectRatio: aspectRatio === "9:16" ? "9/16" : "16/9",
                objectFit: "cover",
                borderRadius: 6,
              }}
            />
            {/* Buttons column — fixed width on the right.
                NOTE: `.btn` uses `display: inline-flex` with default `justify-content: flex-start`,
                so text-align alone does not center the label — we must set `justifyContent: center`
                explicitly on the flex container. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, width: 72, paddingTop: 2 }}>
              <button
                className="btn btn-sm btn-secondary"
                style={{ fontSize: 11, padding: "6px 0", width: "100%", justifyContent: "center", textAlign: "center", gap: 0 }}
                onClick={() => handleRefImageGen(key)}
                disabled={busy}
              >
                {loadingRefGen[key] ? <span className="spinner" style={{ width: 11, height: 11 }} /> : "Regen"}
              </button>
              <label
                className="btn btn-sm btn-secondary"
                title={aspectRatio === "9:16" ? "Upload image — 9:16 ratio recommended" : "Upload image — 16:9 ratio recommended"}
                style={{ fontSize: 11, padding: "6px 0", width: "100%", justifyContent: "center", textAlign: "center", gap: 0, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1 }}
              >
                {loadingRefUpload[key] ? <span className="spinner" style={{ width: 11, height: 11 }} /> : "Upload"}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  style={{ display: "none" }}
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleRefImageUpload(key, file);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                className="btn btn-sm"
                style={{ fontSize: 11, padding: "6px 0", width: "100%", justifyContent: "center", textAlign: "center", gap: 0, background: "var(--bg-card)", color: "var(--red)", border: "1px solid var(--border)" }}
                onClick={() => handleRefImageRemove(key)}
                disabled={busy}
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="btn btn-sm btn-secondary"
              style={{ fontSize: 10, padding: "4px 8px", flex: 1 }}
              onClick={() => handleRefImageGen(key)}
              disabled={busy}
            >
              {loadingRefGen[key] ? <><span className="spinner" style={{ width: 10, height: 10 }} /> AI...</> : "AI Generate"}
            </button>
            <label
              className="btn btn-sm btn-secondary"
              title={aspectRatio === "9:16" ? "Upload image — 9:16 ratio recommended" : "Upload image — 16:9 ratio recommended"}
              style={{ fontSize: 10, padding: "4px 8px", flex: 1, textAlign: "center", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1 }}
            >
              {loadingRefUpload[key] ? <span className="spinner" style={{ width: 10, height: 10 }} /> : "Upload"}
              <input
                type="file"
                accept="image/jpeg,image/png"
                style={{ display: "none" }}
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleRefImageUpload(key, file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        )}
      </div>
    );
  };

  // ── Save & go back ──
  const handleSaveAndBack = () => {
    if (stitchedUrl) {
      // Save motion data without overwriting the scene's visual mode (chart/image).
      // The video pipeline checks for motion_url directly.
      updateScene(idx, { motion_url: stitchedUrl, shots });
    }
    navigate("/workspace");
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button
          className="btn btn-sm"
          onClick={() => navigate("/workspace")}
          style={{ background: "var(--bg-input)", color: "var(--text-dim)" }}
        >
          &larr; Back to Workspace
        </button>
        {stitchedUrl && (
          <button className="btn btn-sm btn-success" onClick={handleSaveAndBack}>
            Save & Back
          </button>
        )}
      </div>

      <h2 style={{ marginBottom: 4 }}>
        Motion Studio — Scene {scene.scene_number}
      </h2>
      <p className="text-sm text-dim" style={{ marginBottom: 20 }}>
        Create AI motion video from multiple shots, synced to audio duration.
      </p>

      {error && (
        <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
      )}

      {/* Scene context */}
      <div className="card mb-16">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label className="text-sm text-dim" style={{ display: "block", marginBottom: 4 }}>Description</label>
            <p style={{ fontSize: 13, lineHeight: 1.5 }}>{scene.description}</p>
          </div>
          <div>
            <label className="text-sm text-dim" style={{ display: "block", marginBottom: 4 }}>Narration</label>
            <p style={{ fontSize: 13, lineHeight: 1.5, fontStyle: "italic" }}>
              &ldquo;{scene.narration}&rdquo;
            </p>
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <audio controls src={BACKEND + scene.audio_url} style={{ height: 32, width: 200 }} />
          <span className="badge">{formatDuration(duration)}</span>
          <span className="badge">{aspectRatio}</span>
        </div>
      </div>

      {/* ── Motion model selector ── */}
      <div className="card mb-16">
        <label
          className="text-sm text-dim"
          style={{ display: "block", marginBottom: 8 }}
        >
          Motion Model
        </label>
        <div className="radio-group">
          <label
            className={`radio-option ${motionModel === "veo-3.1-lite" ? "selected" : ""}`}
          >
            <input
              type="radio"
              name="motion-model"
              checked={motionModel === "veo-3.1-lite"}
              onChange={() => setMotionModel("veo-3.1-lite")}
            />
            <span>Veo 3.1 Lite Preview</span>
          </label>
          <label
            className="radio-option"
            style={{ opacity: 0.55, cursor: "not-allowed" }}
            title="Coming soon"
          >
            <input
              type="radio"
              name="motion-model"
              checked={motionModel === "seedance-1.5-pro-fast"}
              onChange={() => setMotionModel("seedance-1.5-pro-fast")}
              disabled
            />
            <span>Seedance 1.5 Pro Fast</span>
          </label>
        </div>
      </div>

      {/* ── Single-shot mode: generate directly, no split/stitch ── */}
      {isSingleShot ? (
        <div className="section">
          <h3 className="section-title">Generate Motion</h3>
          <div className="card" style={{ textAlign: "center" }}>
            <p className="text-dim text-sm" style={{ marginBottom: 16 }}>
              This scene is {formatDuration(duration)} — a single motion clip is all you need.
            </p>
            <div style={{ maxWidth: 320, margin: "0 auto 12px" }}>
              {renderRefImageZone("single", singleShotImage)}
            </div>
            {stitchedUrl ? (
              <>
                <video
                  controls
                  playsInline
                  preload="metadata"
                  style={{
                    maxWidth: aspectRatio === "9:16" ? 240 : 640,
                    maxHeight: 400,
                    borderRadius: 8,
                    marginBottom: 12,
                  }}
                  src={BACKEND + stitchedUrl}
                />
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  <button
                    className="btn btn-secondary"
                    onClick={handleDirectGenerate}
                    disabled={loadingDirect}
                  >
                    {loadingDirect ? <><span className="spinner" /> Generating...</> : "Regenerate"}
                  </button>
                  <button className="btn btn-success" onClick={handleSaveAndBack}>
                    Save & Back to Workspace
                  </button>
                </div>
              </>
            ) : (
              <button
                className="btn btn-success"
                style={{ padding: "12px 32px", fontSize: 15 }}
                onClick={handleDirectGenerate}
                disabled={loadingDirect}
              >
                {loadingDirect ? (
                  <><span className="spinner" /> Generating Motion...</>
                ) : (
                  "Generate Motion Video"
                )}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ── Multi-shot mode: split → generate → stitch ── */}
          <div className="section">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <h3 className="section-title" style={{ marginBottom: 0 }}>Shots Timeline</h3>
              <button
                className="btn btn-sm btn-primary"
                onClick={handleSplitShots}
                disabled={loadingSplit}
              >
                {loadingSplit ? (
                  <><span className="spinner" /> Splitting...</>
                ) : shots.length > 0 ? (
                  "Re-split Shots"
                ) : (
                  "Split into Shots"
                )}
              </button>
              {shots.length > 0 && (
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={handleGenAllMotion}
                  disabled={loadingAllMotion}
                >
                  {loadingAllMotion ? <><span className="spinner" /> Generating...</> : "Generate All Motions"}
                </button>
              )}
              {batchHint && (
                <span style={{ fontSize: 12, color: "var(--accent)" }}>{batchHint}</span>
              )}
            </div>

            {shots.length === 0 && !loadingSplit && (
              <div className="card" style={{ textAlign: "center", padding: 32 }}>
                <p className="text-dim">
                  Click "Split into Shots" to plan the visual narrative for this scene.
                </p>
              </div>
            )}

            {shots.length > 0 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: aspectRatio === "9:16"
                  ? `repeat(${Math.min(shots.length, 3)}, minmax(0, 320px))`
                  : `repeat(${Math.min(shots.length, 3)}, 1fr)`,
                gap: 20,
              }}>
                {shots.map((shot, si) => (
                  <div key={si} className="card" style={{ padding: 12 }}>
                    {/* Shot header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>Shot {shot.shot_index}</span>
                      <span className="text-dim" style={{ fontSize: 11 }}>
                        {shot.start.toFixed(1)}s – {shot.end.toFixed(1)}s
                        {shot.freeze_tail && " ❄️"}
                      </span>
                    </div>

                    {/* Visual prompt */}
                    <p className="text-dim" style={{ fontSize: 11, lineHeight: 1.4, marginBottom: 8, maxHeight: 48, overflow: "hidden" }}>
                      {shot.visual_prompt}
                    </p>

                    {/* Reference image zone (optional image-to-video anchor) */}
                    {renderRefImageZone(si, shot.reference_image_url)}

                    {/* Motion preview or placeholder */}
                    <div style={{
                      width: "100%",
                      aspectRatio: aspectRatio === "9:16" ? "9/16" : "16/9",
                      background: "var(--surface2)",
                      borderRadius: 6,
                      marginBottom: 6,
                      overflow: "hidden",
                      position: "relative",
                    }}>
                      {shot.motion_url ? (
                        <video
                          controls
                          playsInline
                          muted
                          preload="metadata"
                          style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          src={BACKEND + shot.motion_url}
                        />
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                          <span className="text-dim" style={{ fontSize: 20 }}>🎬</span>
                        </div>
                      )}
                      {shot.motion_url && (
                        <div style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          background: "var(--green)",
                          color: "#fff",
                          fontSize: 9,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                        }}>
                          ✓
                        </div>
                      )}
                    </div>

                    {/* Action button */}
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleGenMotion(si)}
                      disabled={loadingMotion[si]}
                      style={{ fontSize: 12, width: "100%", padding: "8px 12px" }}
                    >
                      {loadingMotion[si] ? (
                        <><span className="spinner" /> Generating...</>
                      ) : shot.motion_url ? (
                        "Regenerate"
                      ) : (
                        "Generate Motion"
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stitch & Preview */}
          {shots.length > 0 && (
            <div className="section">
              {shots.length > 1 && (
                <h3 className="section-title">Stitch & Preview</h3>
              )}
              <div className="card" style={{ textAlign: "center" }}>
                {stitchedUrl ? (
                  <>
                    <video
                      controls
                      playsInline
                      preload="metadata"
                      style={{
                        maxWidth: aspectRatio === "9:16" ? 240 : 640,
                        maxHeight: 400,
                        borderRadius: 8,
                        marginBottom: 12,
                      }}
                      src={BACKEND + stitchedUrl}
                    />
                    <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                      {shots.length > 1 && (
                        <button
                          className="btn btn-secondary"
                          onClick={handleStitch}
                          disabled={loadingStitch || !allMotionReady}
                        >
                          Re-stitch
                        </button>
                      )}
                      <button className="btn btn-success" onClick={handleSaveAndBack}>
                        Save & Back to Workspace
                      </button>
                    </div>
                  </>
                ) : shots.length > 1 ? (
                  <>
                    <button
                      className="btn btn-success"
                      style={{ padding: "12px 32px", fontSize: 15 }}
                      onClick={handleStitch}
                      disabled={loadingStitch || !allMotionReady}
                    >
                      {loadingStitch ? (
                        <><span className="spinner" /> Stitching...</>
                      ) : (
                        "Stitch All Shots"
                      )}
                    </button>
                    {!allMotionReady && (
                      <p className="text-sm text-dim mt-16">
                        Generate motion video for all shots before stitching.
                      </p>
                    )}
                  </>
                ) : loadingStitch ? (
                  <p className="text-sm text-dim">
                    <span className="spinner" /> Preparing video...
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
