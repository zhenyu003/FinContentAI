import type { ChartConfig } from "../types";

export const chartTemplates: Record<string, { label: string; config: ChartConfig }> = {
  earningsTrend: {
    label: "Earnings Trend",
    config: {
      chartType: "line",
      title: "Quarterly Earnings Trend",
      xAxisLabel: "Quarter",
      yAxisLabel: "USD (Billions)",
      source: "Company 10-K Filings",
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
      title: "S&P 500 Drawdown & Recovery",
      xAxisLabel: "Month",
      yAxisLabel: "Index Value",
      source: "Yahoo Finance",
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      series: [
        {
          name: "S&P 500",
          data: [4500, 4600, 4200, 3800, 4100, 4350],
          style: "volatile",
        },
        {
          name: "200-Day MA",
          data: [4400, 4420, 4380, 4320, 4280, 4260],
          style: "smooth",
        },
      ],
    },
  },
  sectorComparison: {
    label: "Sector Comparison",
    config: {
      chartType: "bar",
      title: "Sector YTD Returns",
      xAxisLabel: "Sector",
      yAxisLabel: "YTD Return (%)",
      source: "Bloomberg",
      labels: ["Tech", "Healthcare", "Energy", "Finance", "Consumer"],
      series: [
        {
          name: "2023 Return %",
          data: [28, 12, -5, 15, 8],
          style: "smooth",
        },
        {
          name: "2024 Return %",
          data: [18, 8, 10, 14, 6],
          style: "smooth",
        },
      ],
    },
  },
  marketShare: {
    label: "Market Share",
    config: {
      chartType: "pie",
      title: "Cloud Market Share (2024)",
      source: "Gartner",
      labels: ["AWS", "Azure", "Google Cloud", "Alibaba", "Others"],
      series: [
        {
          name: "Share",
          data: [31, 25, 11, 5, 28],
          style: "smooth",
        },
      ],
    },
  },
  revenueBreakdown: {
    label: "Revenue Breakdown",
    config: {
      chartType: "pie",
      title: "Revenue by Segment",
      source: "Annual Report",
      labels: ["Services", "Hardware", "Subscriptions", "Advertising", "Licensing"],
      series: [
        {
          name: "Revenue",
          data: [42, 23, 18, 12, 5],
          style: "smooth",
        },
      ],
    },
  },
  aiRevolution: {
    label: "AI vs Legacy Revenue",
    config: {
      chartType: "line",
      title: "AI Infrastructure vs Legacy Revenue",
      xAxisLabel: "Year",
      yAxisLabel: "Revenue ($B)",
      source: "Industry Estimates",
      labels: ["2019", "2020", "2021", "2022", "2023"],
      series: [
        {
          name: "Legacy Chip Revenue",
          data: [105, 98, 102, 95, 88],
          style: "volatile",
        },
        {
          name: "AI Infrastructure Revenue",
          data: [50, 65, 90, 130, 180],
          style: "smooth",
        },
      ],
    },
  },
};

export const defaultChartConfig: ChartConfig = chartTemplates.aiRevolution.config;
