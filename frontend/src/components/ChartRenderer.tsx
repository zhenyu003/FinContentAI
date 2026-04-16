import { forwardRef } from "react";
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  PieChart,
  Pie,
  Cell,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { ChartConfig } from "../types";

const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

interface Props {
  config: ChartConfig;
  width?: number;
  height?: number;
}

const ChartRenderer = forwardRef<HTMLDivElement, Props>(
  ({ config, width = 480, height = 280 }, ref) => {
    const { chartType, labels, series, title, xAxisLabel, yAxisLabel, source } = config;

    const axisStyle = { fill: "#8b8fa7", fontSize: 11 };
    const gridStroke = "rgba(45,49,72,0.6)";
    const tooltipStyle = {
      background: "#1a1d29",
      border: "1px solid #2d3148",
      borderRadius: 6,
      color: "#e1e4ed",
      fontSize: 12,
    };

    const wrapperStyle: React.CSSProperties = {
      background: "#0f1117",
      borderRadius: 8,
      padding: "16px 12px 8px",
      width,
      height,
      display: "flex",
      flexDirection: "column",
    };

    const titleEl = title ? (
      <div style={{ color: "#e1e4ed", fontSize: 14, fontWeight: 600, textAlign: "center", marginBottom: 4 }}>
        {title}
      </div>
    ) : null;

    const sourceEl = source ? (
      <div style={{ color: "#5a5f7a", fontSize: 9, textAlign: "right", marginTop: 2, paddingRight: 4 }}>
        Source: {source}
      </div>
    ) : null;

    // ── Pie / Donut Chart ──
    if (chartType === "pie") {
      const pieData = labels.map((label, i) => ({
        name: label,
        value: series[0]?.data[i] ?? 0,
      }));

      const pieLegendEl = (
        <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap", marginTop: 2 }}>
          {pieData.map((d, idx) => (
            <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#8b8fa7" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: PALETTE[idx % PALETTE.length] }} />
              {d.name}
            </div>
          ))}
        </div>
      );

      return (
        <div ref={ref} style={wrapperStyle}>
          {titleEl}
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius="40%"
                  outerRadius="75%"
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: "#5a5f7a", strokeWidth: 1 }}
                >
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {pieLegendEl}
          {sourceEl}
        </div>
      );
    }

    // ── Shared data rows for line / bar ──
    const rows = labels.map((label, i) => {
      const row: Record<string, string | number> = { label };
      for (const s of series) {
        row[s.name] = s.data[i] ?? 0;
      }
      return row;
    });

    // ── Custom legend + xAxisLabel rendered outside Recharts ──
    // Layout order: title → chart → xAxisLabel → legend → source
    const legendEl = (
      <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", marginTop: 2 }}>
        {series.map((s, idx) => (
          <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#8b8fa7" }}>
            <span style={{
              display: "inline-block",
              width: 18,
              height: 0,
              borderTop: `2.5px ${s.style === "volatile" ? "dashed" : "solid"} ${PALETTE[idx % PALETTE.length]}`,
            }} />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: PALETTE[idx % PALETTE.length], border: `1px solid ${PALETTE[idx % PALETTE.length]}` }} />
              {s.name}
            </span>
          </div>
        ))}
      </div>
    );

    const xAxisEl = xAxisLabel ? (
      <div style={{ color: "#6b7094", fontSize: 10, textAlign: "center", marginTop: 1 }}>
        {xAxisLabel}
      </div>
    ) : null;

    // ── Bar Chart ──
    if (chartType === "bar") {
      return (
        <div ref={ref} style={wrapperStyle}>
          {titleEl}
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis
                  dataKey="label"
                  tick={axisStyle}
                  axisLine={{ stroke: gridStroke }}
                  tickLine={false}
                />
                <YAxis
                  tick={axisStyle}
                  axisLine={{ stroke: gridStroke }}
                  tickLine={false}
                  label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: "insideLeft", offset: 8, fill: "#6b7094", fontSize: 10 } : undefined}
                />
                <Tooltip contentStyle={tooltipStyle} />
                {series.map((s, idx) => (
                  <Bar
                    key={s.name}
                    dataKey={s.name}
                    fill={PALETTE[idx % PALETTE.length]}
                    opacity={s.style === "volatile" ? 0.65 : 0.9}
                    radius={[3, 3, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {xAxisEl}
          {legendEl}
          {sourceEl}
        </div>
      );
    }

    // ── Line Chart (default) ──
    return (
      <div ref={ref} style={wrapperStyle}>
        {titleEl}
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                dataKey="label"
                tick={axisStyle}
                axisLine={{ stroke: gridStroke }}
                tickLine={false}
              />
              <YAxis
                tick={axisStyle}
                axisLine={{ stroke: gridStroke }}
                tickLine={false}
                label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: "insideLeft", offset: 8, fill: "#6b7094", fontSize: 10 } : undefined}
              />
              <Tooltip contentStyle={tooltipStyle} />
              {series.map((s, idx) => (
                <Line
                  key={s.name}
                  type={s.style === "volatile" ? "linear" : "monotone"}
                  dataKey={s.name}
                  stroke={PALETTE[idx % PALETTE.length]}
                  strokeWidth={s.style === "volatile" ? 1.5 : 2.5}
                  strokeDasharray={s.style === "volatile" ? "6 3" : undefined}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {xAxisEl}
        {legendEl}
        {sourceEl}
      </div>
    );
  },
);

ChartRenderer.displayName = "ChartRenderer";

export default ChartRenderer;
