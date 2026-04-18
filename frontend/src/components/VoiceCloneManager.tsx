import { useCallback, useEffect, useRef, useState } from "react";
import {
  cloneVoice,
  deleteVoiceClone,
  listVoiceClones,
  type VoiceClone,
} from "../api/client";

/** Short passage (~15s) for users to read while recording. */
const SAMPLE_SCRIPT = `In markets, the obvious trade is rarely the profitable one. What looks safe often prices in the good news already, while the real edge hides in the messy middle — between consensus and doubt. Read this clearly and naturally, as if you were explaining it to a friend.`;

const MAX_CLONES = 3;
const MIN_RECORDING_SEC = 12;
const TARGET_RECORDING_SEC = 15;
const MAX_RECORDING_SEC = 25;

const ALLOWED_TYPES =
  "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/m4a,audio/mp4,audio/x-m4a,audio/webm,audio/ogg";

function pickRecorderMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm"];
  for (const t of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return undefined;
}

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return "—";
  if (sec < 60) return `${sec.toFixed(0)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec - m * 60);
  return `${m}m ${s}s`;
}

export default function VoiceCloneManager() {
  const [voices, setVoices] = useState<VoiceClone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordUrl, setRecordUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [recording, setRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordStartMsRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listVoiceClones();
      setVoices(data.voices || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load voice clones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (recordUrl) URL.revokeObjectURL(recordUrl);
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    };
  }, [recordUrl]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const clearRecording = () => {
    setRecordedBlob(null);
    setRecordUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setElapsedSec(0);
  };

  const resetForm = () => {
    setNewName("");
    setPickedFile(null);
    setShowForm(false);
    clearRecording();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startRecording = async () => {
    if (recording || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Recording is not supported in this browser.");
      return;
    }
    setError("");
    clearRecording();
    pickedFile && setPickedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const mime = pickRecorderMimeType();
    if (!mime) {
      setError("This browser cannot record WebM audio. Use file upload instead.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onerror = () => setError("Recording failed. Try again or use file upload.");
      mr.start(250);
      setRecording(true);
      const started = Date.now();
      recordStartMsRef.current = started;
      setElapsedSec(0);
      timerRef.current = setInterval(() => {
        setElapsedSec((Date.now() - started) / 1000);
      }, 200);
      maxTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          stopRecording();
        }
      }, MAX_RECORDING_SEC * 1000);
    } catch {
      setError("Microphone permission denied or unavailable.");
      stopStream();
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }

    const mr = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (!mr || mr.state === "inactive") {
      setRecording(false);
      stopStream();
      return;
    }

    mr.onstop = () => {
      const mime = mr.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: mime });
      chunksRef.current = [];
      const startMs = recordStartMsRef.current;
      recordStartMsRef.current = null;
      const durSec = startMs != null ? (Date.now() - startMs) / 1000 : 0;
      setElapsedSec(durSec);
      setRecordedBlob(blob);
      setRecordUrl(URL.createObjectURL(blob));
      setRecording(false);
      stopStream();
    };
    mr.stop();
  };

  const handleSubmit = async () => {
    const name = newName.trim();
    if (!name || submitting) return;
    const file = pickedFile ?? (recordedBlob ? new File([recordedBlob], "recording.webm", { type: recordedBlob.type || "audio/webm" }) : null);
    if (!file) {
      setError("Record audio or choose a file to upload.");
      return;
    }
    if (!pickedFile && recordedBlob && elapsedSec < MIN_RECORDING_SEC) {
      setError(`Recording should be at least ${MIN_RECORDING_SEC} seconds (aim for ~${TARGET_RECORDING_SEC}s).`);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("Sample is too large (max 25 MB).");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await cloneVoice(name, file);
      resetForm();
      await refresh();
    } catch (err: unknown) {
      const anyErr = err as {
        response?: { status?: number; data?: { detail?: string | { message?: string; code?: string } } };
        message?: string;
      };
      const st = anyErr?.response?.status;
      const detail = anyErr?.response?.data?.detail;
      let msg =
        (typeof detail === "string" && detail) ||
        (typeof detail === "object" && detail?.message) ||
        anyErr?.message ||
        "Failed to clone voice.";
      if (st === 429) msg = "ElevenLabs rate limit or quota. Try again shortly.";
      if (typeof detail === "object" && detail?.code === "max_clones") {
        msg = detail.message || msg;
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (v: VoiceClone) => {
    const ok = window.confirm(
      `Delete the cloned voice "${v.name}"? Existing audio files will keep working, but you won't be able to generate new audio with this voice.`
    );
    if (!ok) return;
    try {
      await deleteVoiceClone(v.id);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete voice clone");
    }
  };

  const atCloneLimit = voices.length >= MAX_CLONES;

  return (
    <div className="section">
      <h3 className="section-title">Voice Cloning</h3>
      <p className="text-dim text-sm" style={{ marginBottom: 12 }}>
        Record about {TARGET_RECORDING_SEC} seconds of clean English (minimum {MIN_RECORDING_SEC}s). Narration uses{" "}
        <strong>ElevenLabs Flash v2.5</strong> with your clone. You can have up to {MAX_CLONES} clones.
      </p>

      {error && (
        <p style={{ color: "var(--red)", marginBottom: 12 }} role="alert">
          {error}
        </p>
      )}

      {!showForm && (
        <div style={{ marginBottom: 12 }}>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setShowForm(true)}
            disabled={atCloneLimit}
            title={atCloneLimit ? `Maximum ${MAX_CLONES} voice clones` : undefined}
          >
            + Clone a New Voice
          </button>
          {atCloneLimit && (
            <span className="text-dim text-sm" style={{ marginLeft: 10 }}>
              Limit reached ({MAX_CLONES}/{MAX_CLONES}) — delete a clone to add another.
            </span>
          )}
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>Clone a new voice</strong>
            <button
              className="btn btn-sm"
              style={{ background: "var(--surface2)", color: "var(--text)" }}
              onClick={resetForm}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>

          <div>
            <label className="text-dim text-sm" style={{ display: "block", marginBottom: 6 }}>
              Voice name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. My Studio Voice"
              maxLength={80}
            />
          </div>

          <div
            style={{
              background: "var(--surface2)",
              padding: 12,
              borderRadius: 6,
              fontSize: 13,
              lineHeight: 1.5,
              border: "1px solid var(--border)",
            }}
          >
            <span className="text-dim text-sm" style={{ display: "block", marginBottom: 6 }}>
              Read this aloud while recording:
            </span>
            {SAMPLE_SCRIPT}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            {!recording ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={startRecording}
                disabled={submitting}
              >
                Start recording
              </button>
            ) : (
              <button type="button" className="btn" style={{ background: "var(--red)", color: "#fff" }} onClick={stopRecording}>
                Stop ({elapsedSec.toFixed(1)}s)
              </button>
            )}
            {recordedBlob && !recording && (
              <audio controls src={recordUrl ?? undefined} style={{ height: 36, flex: "1 1 200px" }} />
            )}
            {pickedFile && (
              <span className="text-dim text-sm">
                File: {pickedFile.name} ({(pickedFile.size / 1024).toFixed(0)} KB)
              </span>
            )}
          </div>

          <details style={{ fontSize: 12 }}>
            <summary className="text-dim" style={{ cursor: "pointer" }}>
              Upload a file instead (backup)
            </summary>
            <div style={{ marginTop: 10 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_TYPES}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setPickedFile(f);
                  if (f) {
                    clearRecording();
                  }
                }}
              />
              <p className="text-dim text-sm" style={{ marginTop: 6 }}>
                MP3, WAV, M4A, or WebM — max 25 MB.
              </p>
            </div>
          </details>

          <div>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={
                submitting ||
                !newName.trim() ||
                (!pickedFile && !recordedBlob) ||
                (!pickedFile && !!recordedBlob && elapsedSec < MIN_RECORDING_SEC)
              }
            >
              {submitting ? (
                <>
                  <span className="spinner" /> Cloning... (this can take 10–30s)
                </>
              ) : (
                "Create Voice Clone"
              )}
            </button>
            {!pickedFile && recordedBlob && elapsedSec < MIN_RECORDING_SEC && (
              <p className="text-dim text-sm" style={{ marginTop: 8 }}>
                Record at least {MIN_RECORDING_SEC}s (about {TARGET_RECORDING_SEC}s is ideal).
              </p>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-center">
          <div className="spinner spinner-lg" />
          <p>Loading voice clones...</p>
        </div>
      ) : voices.length === 0 ? (
        <div className="card" style={{ textAlign: "center" }}>
          <p className="text-dim">
            You haven't cloned any voices yet. Record a sample above to create your first.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p className="text-dim text-sm" style={{ margin: 0 }}>
            Your clones ({voices.length}/{MAX_CLONES})
          </p>
          {voices.map((v) => (
            <div key={v.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ marginBottom: 4 }}>
                    <strong>{v.name}</strong>
                  </div>
                  <div className="text-dim text-sm">
                    Sample: {v.sample_filename || "uploaded"} · {formatDuration(v.sample_duration_sec)} · added{" "}
                    {new Date(v.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  className="btn btn-sm"
                  style={{
                    background: "rgba(239,68,68,0.12)",
                    color: "#ef4444",
                    border: "1px solid rgba(239,68,68,0.4)",
                    flexShrink: 0,
                  }}
                  onClick={() => handleDelete(v)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
