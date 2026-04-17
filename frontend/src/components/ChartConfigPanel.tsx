import { useState, useRef, useCallback } from "react";
import html2canvas from "html2canvas";
import type { ChartConfig } from "../types";
import { chartTemplates, defaultChartConfig } from "../lib/chartTemplates";
import { generateChartFromDescription } from "../lib/chartFromText";
import { uploadChartVideo } from "../api/client";
import ChartRenderer from "./ChartRenderer";

interface Props {
  description: string;
  /** Called with the final PNG snapshot, the config, and (optionally) a video URL
   *  pointing to an mp4 that contains the Recharts draw-in animation.
   */
  onChartImage: (dataUrl: string, config: ChartConfig, videoUrl?: string) => void;
  /** Restore a previously saved chart config (e.g. after navigating back). */
  savedConfig?: ChartConfig;
}

// Recording parameters
const ANIMATION_MS = 1500;      // matches animationDuration in ChartRenderer
const TAIL_HOLD_MS = 500;       // extra time after animation so final frame is fully settled
const REC_TOTAL_MS = ANIMATION_MS + TAIL_HOLD_MS;
const REC_FPS = 20;

export default function ChartConfigPanel({ description, onChartImage, savedConfig }: Props) {
  const initial = savedConfig ?? defaultChartConfig;
  const [config, setConfig] = useState<ChartConfig>(initial);
  const [jsonText, setJsonText] = useState(JSON.stringify(initial, null, 2));
  const [jsonError, setJsonError] = useState("");
  const [rendering, setRendering] = useState(false);
  const [renderStatus, setRenderStatus] = useState("");
  // Auto-show preview if restoring a previously generated chart
  const [showPreview, setShowPreview] = useState(!!savedConfig);
  // Changing this forces a fresh mount of ChartRenderer so Recharts replays its animation.
  const [animKey, setAnimKey] = useState(0);
  const chartRef = useRef<HTMLDivElement>(null);

  const updateConfig = (next: ChartConfig) => {
    setConfig(next);
    setJsonText(JSON.stringify(next, null, 2));
    setJsonError("");
    setShowPreview(false);
  };

  const applyTemplate = (key: string) => {
    const tpl = chartTemplates[key];
    if (!tpl) return;
    updateConfig(tpl.config);
  };

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text) as ChartConfig;
      if (!parsed.labels || !parsed.series) throw new Error("Missing labels or series");
      setConfig(parsed);
      setJsonError("");
    } catch (e: any) {
      setJsonError(e.message);
    }
  };

  const handleGenerateFromDescription = () => {
    const generated = generateChartFromDescription(description);
    updateConfig(generated);
  };

  /** Record the chart's draw-in animation into a webm Blob.
   *
   * Strategy: html2canvas is too slow (200-500 ms per snapshot) — it blocks
   * the main thread, which freezes Recharts' RAF-based animation between
   * snapshots, so the recorded webm ends up with only 4-13 frames of mostly
   * identical content. Instead, we:
   *   1. Capture the static chrome (title, legend, source, background) ONCE
   *      via html2canvas before the animation starts. The SVG region of this
   *      base will be overwritten per-frame, so its content doesn't matter.
   *   2. Per-frame, serialize the live <svg> and rasterize it via an Image
   *      data URL — this typically takes 5-30 ms, leaving Recharts' RAF
   *      callbacks plenty of room to advance the animation.
   *   3. Composite each fresh SVG image on top of the cached base.
   *
   * The caller is responsible for triggering the Recharts remount (so the
   * animation restarts from frame 0) before calling this.
   */
  const recordAnimation = useCallback(
    async (baseImage: HTMLCanvasElement | null): Promise<Blob | null> => {
      const host = chartRef.current;
      if (!host) return null;

      // Size the offscreen canvas to match the rendered chart (2x for crisper video).
      const wrapperRect = host.getBoundingClientRect();
      const scale = 2;
      const canvasW = Math.max(2, Math.round(wrapperRect.width * scale));
      const canvasH = Math.max(2, Math.round(wrapperRect.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      // Pick the best available webm codec.
      const mimeCandidates = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      const mimeType = mimeCandidates.find(
        (m) =>
          typeof MediaRecorder !== "undefined" &&
          MediaRecorder.isTypeSupported(m),
      );
      if (!mimeType) {
        console.warn("[chart-rec] MediaRecorder webm not supported in this browser");
        return null;
      }

      // Find the live SVG so we can serialize it cheaply each frame.
      const svg = host.querySelector("svg");
      if (!svg) {
        console.warn("[chart-rec] no SVG found in chart container");
        return null;
      }
      const svgRect = svg.getBoundingClientRect();
      const svgX = (svgRect.left - wrapperRect.left) * scale;
      const svgY = (svgRect.top - wrapperRect.top) * scale;
      const svgW = svgRect.width * scale;
      const svgH = svgRect.height * scale;
      const svgIntrinsicW = svgRect.width;
      const svgIntrinsicH = svgRect.height;

      // Helper: paint background + base chrome, then clear the SVG region.
      // We MUST clear the SVG region before drawing the per-frame SVG on top.
      // Reason: during animation, large parts of the SVG are TRANSPARENT
      // (e.g. a Pie slice at progress=5% is a tiny arc; the rest of the SVG
      // canvas is empty). drawImage of a transparent pixel preserves the
      // destination, so without clearing, the base's *fully-rendered* chart
      // bleeds through the SVG's transparent regions and the recorded video
      // shows a fully-drawn chart from frame 0 — masking the animation.
      const paintBase = () => {
        if (baseImage) {
          ctx.drawImage(baseImage, 0, 0, canvasW, canvasH);
        } else {
          ctx.fillStyle = "#0f1117";
          ctx.fillRect(0, 0, canvasW, canvasH);
        }
        // Wipe the SVG region back to background so per-frame SVG composites cleanly.
        ctx.fillStyle = "#0f1117";
        ctx.fillRect(svgX, svgY, svgW, svgH);
      };

      // Helper: serialize the live SVG and rasterize via Image().
      // Dramatically faster than html2canvas; doesn't block Recharts.
      const captureSvgImage = (): Promise<HTMLImageElement | null> =>
        new Promise((resolve) => {
          try {
            const svgClone = svg.cloneNode(true) as SVGElement;
            svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            svgClone.setAttribute("width", String(svgIntrinsicW));
            svgClone.setAttribute("height", String(svgIntrinsicH));
            const svgString = new XMLSerializer().serializeToString(svgClone);
            const blob = new Blob([svgString], {
              type: "image/svg+xml;charset=utf-8",
            });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
              URL.revokeObjectURL(url);
              resolve(img);
            };
            img.onerror = () => {
              URL.revokeObjectURL(url);
              resolve(null);
            };
            img.src = url;
          } catch (e) {
            console.warn("[chart-rec] svg serialize failed", e);
            resolve(null);
          }
        });

      // Paint the first frame so captureStream has something to start with.
      paintBase();

      const stream = canvas.captureStream(REC_FPS);
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 4_000_000,
      });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      recorder.start();

      // Frame loop — yields to RAF after each frame so Recharts' animation
      // can actually advance between snapshots.
      const start = performance.now();
      let frameCount = 0;
      while (performance.now() - start < REC_TOTAL_MS) {
        const svgImg = await captureSvgImage();
        if (svgImg) {
          paintBase();
          ctx.drawImage(svgImg, svgX, svgY, svgW, svgH);
        }
        frameCount++;
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      }

      // Grab one final settled frame after the animation has finished.
      const finalImg = await captureSvgImage();
      if (finalImg) {
        paintBase();
        ctx.drawImage(finalImg, svgX, svgY, svgW, svgH);
      }

      recorder.stop();
      await stopped;

      const elapsed = performance.now() - start;
      console.log(
        `[chart-rec] captured ${frameCount} frames in ${elapsed.toFixed(0)} ms ` +
          `(~${(frameCount / (elapsed / 1000)).toFixed(1)} fps), ` +
          `${chunks.length} chunks`,
      );
      if (chunks.length === 0) return null;
      return new Blob(chunks, { type: mimeType });
    },
    [],
  );

  const handleRenderChart = useCallback(async () => {
    setShowPreview(true);
    setRendering(true);
    setRenderStatus("Preparing chart...");

    // Wait for chart to be visible (first mount or already mounted).
    await new Promise((r) => setTimeout(r, 80));
    if (!chartRef.current) {
      setRendering(false);
      setRenderStatus("");
      return;
    }

    let videoUrl: string | undefined;
    try {
      // Step 1: Snapshot the static chrome (title/legend/source/background)
      // BEFORE re-triggering animation. The SVG region of this base will be
      // overwritten per-frame, so whatever animation state it captures is fine.
      setRenderStatus("Snapshotting chrome...");
      let baseImage: HTMLCanvasElement | null = null;
      try {
        baseImage = await html2canvas(chartRef.current, {
          backgroundColor: "#0f1117",
          scale: 2,
          logging: false,
        });
      } catch (e) {
        console.warn("[chart-rec] base capture failed", e);
      }

      // Step 2: Restart Recharts animation by remounting (key change unmounts
      // and remounts the chart, so animationActive replays from frame 0).
      setAnimKey((k) => k + 1);
      // Wait for React to flush the remount and Recharts to start its RAF loop.
      await new Promise((r) => setTimeout(r, 100));

      // Step 3: Record the animation using fast SVG serialization.
      setRenderStatus("Recording animation...");
      const webmBlob = await recordAnimation(baseImage);
      if (webmBlob) {
        try {
          setRenderStatus("Uploading animation...");
          const up = await uploadChartVideo(webmBlob);
          videoUrl = up.video_url;
        } catch (upErr) {
          console.warn("[chart-rec] upload failed; falling back to PNG-only", upErr);
        }
      } else {
        console.warn("[chart-rec] no recording produced; using PNG-only");
      }

      // Step 4: Final snapshot — chart is at its final animated state by now.
      setRenderStatus("Capturing thumbnail...");
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#0f1117",
        scale: 2,
        logging: false,
      });
      const dataUrl = canvas.toDataURL("image/png");
      onChartImage(dataUrl, config, videoUrl);
    } catch (err) {
      console.error("Chart capture failed", err);
    } finally {
      setRendering(false);
      setRenderStatus("");
    }
  }, [config, onChartImage, recordAnimation]);

  const panelStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: "100%",
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  };

  return (
    <div style={panelStyle}>
      {/* Row 1: Chart type + template */}
      <div style={rowStyle}>
        <select
          value={config.chartType}
          onChange={(e) => {
            updateConfig({ ...config, chartType: e.target.value as "line" | "bar" | "pie" });
          }}
          style={{ width: 110, fontSize: 12, padding: "5px 8px" }}
        >
          <option value="line">Line Chart</option>
          <option value="bar">Bar Chart</option>
          <option value="pie">Pie Chart</option>
        </select>

        <select
          defaultValue=""
          onChange={(e) => applyTemplate(e.target.value)}
          style={{ width: 150, fontSize: 12, padding: "5px 8px" }}
        >
          <option value="" disabled>
            Select Template
          </option>
          {Object.entries(chartTemplates).map(([key, t]) => (
            <option key={key} value={key}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Row 2: JSON data editor */}
      <textarea
        value={jsonText}
        onChange={(e) => handleJsonChange(e.target.value)}
        style={{
          minHeight: 100,
          maxHeight: 180,
          fontSize: 11,
          fontFamily: "monospace",
          lineHeight: 1.4,
        }}
      />
      {jsonError && (
        <span style={{ color: "var(--red)", fontSize: 11 }}>{jsonError}</span>
      )}

      {/* Row 3: Action buttons */}
      <div style={rowStyle}>
        <button
          className="btn btn-sm btn-secondary"
          onClick={handleGenerateFromDescription}
          style={{ fontSize: 11 }}
        >
          Generate from Description
        </button>
        <button
          className="btn btn-sm btn-primary"
          onClick={handleRenderChart}
          disabled={!!jsonError || rendering}
          style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          {rendering ? (
            <>
              <span className="spinner" style={{ width: 14, height: 14 }} />
              {renderStatus && <span>{renderStatus}</span>}
            </>
          ) : (
            "Generate Chart"
          )}
        </button>
      </div>

      {/* Chart preview (offscreen-friendly for capture) */}
      {showPreview && (
        <div style={{ marginTop: 6 }}>
          <ChartRenderer
            key={animKey}
            ref={chartRef}
            config={config}
            width={480}
            height={280}
            animate
          />
        </div>
      )}
    </div>
  );
}
