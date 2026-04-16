import type { ChartConfig } from "../types";

/**
 * Generates a ChartConfig from a scene description string.
 * Uses keyword heuristics; can be replaced with an LLM call.
 */
export function generateChartFromDescription(description: string): ChartConfig {
  const lower = description.toLowerCase();

  const hasVolatile = lower.includes("volatile") || lower.includes("crash") || lower.includes("shock");
  const hasGrowth = lower.includes("growth") || lower.includes("ai") || lower.includes("surge");
  const hasComparison = lower.includes("sector") || lower.includes("comparison") || lower.includes("vs");
  const hasShare = lower.includes("share") || lower.includes("breakdown") || lower.includes("portion")
    || lower.includes("allocation") || lower.includes("split") || lower.includes("composition");

  // Pie chart for market share / breakdown scenarios
  if (hasShare) {
    return {
      chartType: "pie",
      title: "Market Breakdown",
      source: "Industry Estimates",
      labels: ["Segment A", "Segment B", "Segment C", "Segment D", "Others"],
      series: [
        {
          name: "Share",
          data: [
            Math.round(25 + Math.random() * 15),
            Math.round(18 + Math.random() * 10),
            Math.round(12 + Math.random() * 8),
            Math.round(8 + Math.random() * 6),
            Math.round(10 + Math.random() * 10),
          ],
          style: "smooth",
        },
      ],
    };
  }

  // Bar chart for comparison scenarios
  if (hasComparison) {
    return {
      chartType: "bar",
      title: "Sector Performance",
      xAxisLabel: "Sector",
      yAxisLabel: "Value",
      source: "Bloomberg",
      labels: ["Tech", "Healthcare", "Energy", "Finance", "Consumer"],
      series: [
        { name: "Performance A", data: [28, 12, -5, 15, 8], style: "smooth" },
        { name: "Performance B", data: [18, 22, 8, 10, 14], style: "volatile" },
      ],
    };
  }

  // Line chart for growth / volatile scenarios
  const labels = ["2019", "2020", "2021", "2022", "2023"];
  const series = [];

  if (hasGrowth) {
    series.push({
      name: "Growth Metric",
      data: generateUpwardTrend(5),
      style: "smooth" as const,
    });
  }

  if (hasVolatile) {
    series.push({
      name: "Volatile Metric",
      data: generateJaggedData(5),
      style: "volatile" as const,
    });
  }

  if (series.length === 0) {
    series.push(
      { name: "Series A", data: generateUpwardTrend(5), style: "smooth" as const },
      { name: "Series B", data: generateJaggedData(5), style: "volatile" as const },
    );
  }

  return {
    chartType: "line",
    title: "Trend Overview",
    xAxisLabel: "Year",
    yAxisLabel: "Value",
    source: "Industry Data",
    labels,
    series,
  };
}

function generateUpwardTrend(length: number): number[] {
  const result: number[] = [];
  let value = 40 + Math.random() * 30;
  for (let i = 0; i < length; i++) {
    value += 15 + Math.random() * 25;
    result.push(Math.round(value));
  }
  return result;
}

function generateJaggedData(length: number): number[] {
  const result: number[] = [];
  let value = 80 + Math.random() * 40;
  for (let i = 0; i < length; i++) {
    value += (Math.random() - 0.5) * 60;
    value = Math.max(20, value);
    result.push(Math.round(value));
  }
  return result;
}
