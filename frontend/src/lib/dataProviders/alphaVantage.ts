/**
 * Alpha Vantage data provider scaffold.
 * Not yet implemented — structure only for future integration.
 */

export interface AlphaVantageTimeSeries {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AlphaVantageOptions {
  symbol: string;
  apiKey: string;
  function?: "TIME_SERIES_DAILY" | "TIME_SERIES_WEEKLY" | "TIME_SERIES_MONTHLY";
  outputSize?: "compact" | "full";
}

export async function fetchAlphaVantageData(
  _options: AlphaVantageOptions,
): Promise<AlphaVantageTimeSeries[]> {
  // TODO: Implement real API call
  // Example: GET https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol={symbol}&apikey={apiKey}
  throw new Error("Alpha Vantage provider not yet implemented");
}

export function alphaVantageToChartData(series: AlphaVantageTimeSeries[]) {
  return {
    labels: series.map((s) => s.date),
    values: series.map((s) => s.close),
  };
}
