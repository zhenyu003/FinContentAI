import { useState, useRef, useCallback } from "react";
import html2canvas from "html2canvas";
import type { ChartConfig } from "../types";
import { chartTemplates, defaultChartConfig } from "../lib/chartTemplates";
import { generateChartFromDescription } from "../lib/chartFromText";
import ChartRenderer from "./ChartRenderer";

interface Props {
  description: string;
  onChartImage: (dataUrl: string, config: ChartConfig) => void;
  /** Restore a previously saved chart config (e.g. after navigating back). */
  savedConfig?: ChartConfig;
}

export default function ChartConfigPanel({ description, onChartImage, savedConfig }: Props) {
  const initial = savedConfig ?? defaultChartConfig;
  const [config, setConfig] = useState<ChartConfig>(initial);
  const [jsonText, setJsonText] = useState(JSON.stringify(initial, null, 2));
  const [jsonError, setJsonError] = useState("");
  const [rendering, setRendering] = useState(false);
  // Auto-show preview if restoring a previously generated chart
  const [showPreview, setShowPreview] = useState(!!savedConfig);
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

  const handleRenderChart = useCallback(async () => {
    setShowPreview(true);
    setRendering(true);

    // Wait for Recharts to paint
    await new Promise((r) => setTimeout(r, 600));

    if (!chartRef.current) {
      setRendering(false);
      return;
    }

    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#0f1117",
        scale: 2,
      });
      const dataUrl = canvas.toDataURL("image/png");
      onChartImage(dataUrl, config);
    } catch (err) {
      console.error("Chart capture failed", err);
    } finally {
      setRendering(false);
    }
  }, [config, onChartImage]);

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
          style={{ fontSize: 11 }}
        >
          {rendering ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Generate Chart"}
        </button>
      </div>

      {/* Chart preview (offscreen-friendly for capture) */}
      {showPreview && (
        <div style={{ marginTop: 6 }}>
          <ChartRenderer ref={chartRef} config={config} width={480} height={280} />
        </div>
      )}
    </div>
  );
}
