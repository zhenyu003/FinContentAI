import type { ChartConfig } from "../types";

export const chartTemplates: Record<string, { label: string; config: ChartConfig }> = {
  earningsTrend: {
    label: "Earnings Trend",
    config: {
      chartType: "line",
      labels: ["Q1 2023", "Q2 2023", "Q3 2023", "Q4 2023", "Q1 2024"],
      series: [
        {
          name: "Revenue ($B)",
          data: [7.2, 8.1, 9.4, 11.0, 13.5],
          style: "smooth",
        },
        {
          name: "Net Income ($B)",
          data: [2.1, 2.4, 2.0, 3.1, 3.8],
          style: "volatile",
        },
      ],
    },
  },
  marketShock: {
    label: "Market Shock",
    config: {
      chartType: "line",
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      series: [
        {
          name: "S&P 500",
          data: [4500, 4600, 4200, 3800, 4100, 4350],
          style: "volatile",
        },
        {
          name: "VIX Index",
          data: [18, 22, 35, 42, 30, 24],
          style: "volatile",
        },
      ],
    },
  },
  sectorComparison: {
    label: "Sector Comparison",
    config: {
      chartType: "bar",
      labels: ["Tech", "Healthcare", "Energy", "Finance", "Consumer"],
      series: [
        {
          name: "YTD Return %",
          data: [28, 12, -5, 15, 8],
          style: "smooth",
        },
        {
          name: "Forward P/E",
          data: [32, 18, 11, 14, 22],
          style: "volatile",
        },
      ],
    },
  },
  aiRevolution: {
    label: "AI vs Legacy Revenue",
    config: {
      chartType: "line",
      labels: ["2019", "2020", "2021", "2022", "2023"],
      series: [
        {
          name: "Legacy Chip Revenue",
          data: [100, 80, 120, 90, 110],
          style: "volatile",
        },
        {
          name: "AI Infrastructure Revenue",
          data: [50, 70, 90, 130, 180],
          style: "smooth",
        },
      ],
    },
  },
};

export const defaultChartConfig: ChartConfig = chartTemplates.aiRevolution.config;
