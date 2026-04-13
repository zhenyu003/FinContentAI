import type { ChartConfig } from "../types";

/**
 * Generates a ChartConfig from a scene description string.
 * Currently uses keyword heuristics; can be replaced with an LLM call.
 */
export function generateChartFromDescription(description: string): ChartConfig {
  const lower = description.toLowerCase();

  const hasVolatile = lower.includes("volatile") || lower.includes("crash") || lower.includes("shock");
  const hasGrowth = lower.includes("growth") || lower.includes("ai") || lower.includes("surge");
  const hasComparison = lower.includes("sector") || lower.includes("comparison") || lower.includes("vs");

  if (hasComparison) {
    return {
      chartType: "bar",
      labels: ["Tech", "Healthcare", "Energy", "Finance", "Consumer"],
      series: [
        { name: "Performance A", data: [28, 12, -5, 15, 8], style: "smooth" },
        { name: "Performance B", data: [18, 22, 8, 10, 14], style: "volatile" },
      ],
    };
  }

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

  return { chartType: "line", labels, series };
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
