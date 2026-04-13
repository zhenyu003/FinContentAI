import { forwardRef } from "react";
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { ChartConfig } from "../types";

const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

interface Props {
  config: ChartConfig;
  width?: number;
  height?: number;
}

const ChartRenderer = forwardRef<HTMLDivElement, Props>(
  ({ config, width = 480, height = 280 }, ref) => {
    const { chartType, labels, series } = config;

    const rows = labels.map((label, i) => {
      const row: Record<string, string | number> = { label };
      for (const s of series) {
        row[s.name] = s.data[i] ?? 0;
      }
      return row;
    });

    const chartStyle: React.CSSProperties = {
      background: "#0f1117",
      borderRadius: 8,
      padding: "16px 8px 8px",
      width,
      height,
    };

    const axisStyle = { fill: "#8b8fa7", fontSize: 11 };
    const gridStroke = "rgba(45,49,72,0.6)";

    if (chartType === "bar") {
      return (
        <div ref={ref} style={chartStyle}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="label" tick={axisStyle} axisLine={{ stroke: gridStroke }} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={{ stroke: gridStroke }} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#1a1d29", border: "1px solid #2d3148", borderRadius: 6, color: "#e1e4ed", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#8b8fa7" }} />
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
      );
    }

    return (
      <div ref={ref} style={chartStyle}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="label" tick={axisStyle} axisLine={{ stroke: gridStroke }} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={{ stroke: gridStroke }} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#1a1d29", border: "1px solid #2d3148", borderRadius: 6, color: "#e1e4ed", fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#8b8fa7" }} />
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
    );
  },
);

ChartRenderer.displayName = "ChartRenderer";

export default ChartRenderer;
