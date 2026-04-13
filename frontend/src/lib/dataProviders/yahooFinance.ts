/**
 * Yahoo Finance data provider scaffold.
 * Not yet implemented — structure only for future integration.
 */

export interface YahooQuote {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface YahooFinanceOptions {
  symbol: string;
  startDate: string;
  endDate: string;
  interval?: "1d" | "1wk" | "1mo";
}

export async function fetchYahooFinanceData(
  _options: YahooFinanceOptions,
): Promise<YahooQuote[]> {
  // TODO: Implement real API call
  // Example: GET https://query1.finance.yahoo.com/v8/finance/chart/{symbol}
  throw new Error("Yahoo Finance provider not yet implemented");
}

export function yahooQuotesToChartData(quotes: YahooQuote[]) {
  return {
    labels: quotes.map((q) => q.date),
    values: quotes.map((q) => q.close),
  };
}
