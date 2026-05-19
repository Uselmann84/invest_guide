// Yahoo Finance Data Fetcher — free, no API key required
// Works from Capacitor native apps (CapacitorHttp bypasses CORS)
import { PricePoint, Timeframe } from '../models/types';

const BASE = 'https://query1.finance.yahoo.com';

// Map our index symbols to Yahoo tickers
const INDEX_TICKERS: Record<string, string> = {
  SPX: '%5EGSPC', NDX: '%5EIXIC', DJI: '%5EDJI', RUT: '%5ERUT',
  DAX: '%5EGDAXI', NKY: '%5EN225', MXWO: 'URTH', // MSCI World ETF proxy
};

const TF_TO_RANGE: Record<Timeframe, string> = {
  '1D': '1d', '1W': '5d', '1M': '1mo', '6M': '6mo', '1Y': '1y', '5Y': '5y', 'ALL': 'max',
};
const TF_TO_INTERVAL: Record<Timeframe, string> = {
  '1D': '5m', '1W': '15m', '1M': '1d', '6M': '1wk', '1Y': '1wk', '5Y': '1mo', 'ALL': '1mo',
};

export interface YahooQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  marketCap?: number;
  shortName?: string;
}

export interface YahooChartPoint {
  date: string;
  value: number;
}

async function fetchJSON(url: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export const yahooFinance = {
  // Fetch quotes for multiple tickers at once
  async getQuotes(tickers: string[]): Promise<Record<string, YahooQuote>> {
    const results: Record<string, YahooQuote> = {};

    // Yahoo v7 quote endpoint — batch up to 50 at a time
    for (let i = 0; i < tickers.length; i += 50) {
      const batch = tickers.slice(i, i + 50);
      const symbols = batch.join(',');
      try {
        const url = `${BASE}/v7/finance/quote?symbols=${symbols}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,marketCap,shortName`;
        const data = await fetchJSON(url);
        const quotes = data?.quoteResponse?.result || [];
        for (const q of quotes) {
          results[q.symbol] = {
            symbol: q.symbol,
            regularMarketPrice: q.regularMarketPrice ?? 0,
            regularMarketChange: q.regularMarketChange ?? 0,
            regularMarketChangePercent: q.regularMarketChangePercent ?? 0,
            marketCap: q.marketCap,
            shortName: q.shortName,
          };
        }
      } catch (e) {
        console.warn(`Yahoo quote batch failed for ${batch.join(',')}:`, e);
        // Try individual chart fallback for failed batch
        for (const ticker of batch) {
          try {
            const q = await this.getQuoteViaChart(ticker);
            if (q) results[ticker] = q;
          } catch { /* skip */ }
        }
      }
    }
    return results;
  },

  // Fallback: get quote data from chart endpoint (more reliable)
  async getQuoteViaChart(ticker: string): Promise<YahooQuote | null> {
    try {
      const url = `${BASE}/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2d&includePrePost=false`;
      const data = await fetchJSON(url);
      const result = data?.chart?.result?.[0];
      if (!result) return null;
      const meta = result.meta;
      return {
        symbol: meta.symbol,
        regularMarketPrice: meta.regularMarketPrice ?? 0,
        regularMarketChange: (meta.regularMarketPrice ?? 0) - (meta.chartPreviousClose ?? meta.previousClose ?? 0),
        regularMarketChangePercent: meta.chartPreviousClose
          ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
          : 0,
        marketCap: undefined, // Not available via chart
        shortName: undefined,
      };
    } catch {
      return null;
    }
  },

  // Fetch index quotes
  async getIndexQuotes(): Promise<Record<string, YahooQuote>> {
    const yahooTickers = Object.values(INDEX_TICKERS);
    const results = await this.getQuotes(yahooTickers);

    // Re-map Yahoo tickers back to our symbols
    const mapped: Record<string, YahooQuote> = {};
    for (const [ourSymbol, yahooTicker] of Object.entries(INDEX_TICKERS)) {
      const decoded = decodeURIComponent(yahooTicker);
      const quote = results[decoded];
      if (quote) mapped[ourSymbol] = quote;
    }
    return mapped;
  },

  // Fetch price history with ISO dates (YYYY-MM-DD) for portfolio calculations
  async getChartISO(ticker: string, range: string, interval: string): Promise<YahooChartPoint[]> {
    const encodedTicker = encodeURIComponent(ticker);
    const url = `${BASE}/v8/finance/chart/${encodedTicker}?interval=${interval}&range=${range}&includePrePost=false`;
    try {
      const data = await fetchJSON(url);
      const result = data?.chart?.result?.[0];
      if (!result) return [];
      const timestamps: number[] = result.timestamp || [];
      const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];
      const points: YahooChartPoint[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const close = closes[i];
        if (close == null) continue;
        const d = new Date(timestamps[i] * 1000);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        points.push({ date: iso, value: Math.round(close * 100) / 100 });
      }
      return points;
    } catch (e) {
      console.warn(`Yahoo chart ISO failed for ${ticker}:`, e);
      return [];
    }
  },

  // Fetch price history for a ticker
  async getChart(ticker: string, timeframe: Timeframe): Promise<YahooChartPoint[]> {
    const range = TF_TO_RANGE[timeframe];
    const interval = TF_TO_INTERVAL[timeframe];
    const encodedTicker = encodeURIComponent(ticker);
    const url = `${BASE}/v8/finance/chart/${encodedTicker}?interval=${interval}&range=${range}&includePrePost=false`;

    try {
      const data = await fetchJSON(url);
      const result = data?.chart?.result?.[0];
      if (!result) return [];

      const timestamps: number[] = result.timestamp || [];
      const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];

      const points: YahooChartPoint[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const close = closes[i];
        if (close == null) continue;
        const d = new Date(timestamps[i] * 1000);
        let label: string;
        if (timeframe === '1D') {
          label = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        } else if (timeframe === '1W') {
          label = d.toLocaleDateString('en-US', { weekday: 'short' });
        } else if (timeframe === '1M') {
          label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else if (timeframe === '6M') {
          label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else if (timeframe === '1Y') {
          label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        } else {
          label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        }
        points.push({ date: label, value: Math.round(close * 100) / 100 });
      }
      return points;
    } catch (e) {
      console.warn(`Yahoo chart failed for ${ticker}:`, e);
      return [];
    }
  },

  // Get index chart using mapped ticker
  async getIndexChart(indexSymbol: string, timeframe: Timeframe): Promise<YahooChartPoint[]> {
    const yahooTicker = INDEX_TICKERS[indexSymbol];
    if (!yahooTicker) return [];
    return this.getChart(decodeURIComponent(yahooTicker), timeframe);
  },

  // Fetch sector ETF data as proxy for sector performance
  async getSectorPerformance(): Promise<Record<string, { change: number; marketCap: number }>> {
    const sectorETFs: Record<string, string> = {
      Technology: 'XLK', Healthcare: 'XLV', Financials: 'XLF',
      'Consumer Discretionary': 'XLY', Industrials: 'XLI',
      Energy: 'XLE', Communication: 'XLC', Materials: 'XLB',
      Utilities: 'XLU', 'Real Estate': 'XLRE', 'Consumer Staples': 'XLP',
    };
    const quotes = await this.getQuotes(Object.values(sectorETFs));
    const result: Record<string, { change: number; marketCap: number }> = {};
    for (const [sector, etf] of Object.entries(sectorETFs)) {
      const q = quotes[etf];
      if (q) {
        result[sector] = {
          change: Math.round(q.regularMarketChangePercent * 100) / 100,
          marketCap: q.marketCap || 0,
        };
      }
    }
    return result;
  },

  // Fetch sparkline data (closing prices) for a ticker — lightweight 1mo daily chart
  async getSparkline(ticker: string): Promise<number[]> {
    try {
      const data = await this.getChart(ticker, '1M');
      if (data.length < 2) return [];
      return data.map(d => d.value);
    } catch {
      return [];
    }
  },

  // Fetch sparklines for multiple index symbols
  async getIndexSparklines(): Promise<Record<string, number[]>> {
    const result: Record<string, number[]> = {};
    // Fetch in parallel
    const entries = Object.entries(INDEX_TICKERS);
    const promises = entries.map(async ([ourSymbol, yahooTicker]) => {
      try {
        const data = await this.getChart(decodeURIComponent(yahooTicker), '1M');
        if (data.length >= 2) {
          result[ourSymbol] = data.map(d => d.value);
        }
      } catch { /* skip */ }
    });
    await Promise.all(promises);
    return result;
  },
};
