// Yahoo Finance Data Fetcher — free, no API key required
// Works from Capacitor native apps (CapacitorHttp bypasses CORS)
import { Company, CompanyScores, PricePoint, Timeframe } from '../models/types';

const BASE = 'https://query1.finance.yahoo.com';

// Map our index symbols to Yahoo tickers
const INDEX_TICKERS: Record<string, string> = {
  SPX: '%5EGSPC', NDX: '%5EIXIC', DJI: '%5EDJI', RUT: '%5ERUT',
  DAX: '%5EGDAXI', NKY: '%5EN225', MXWO: 'URTH', // MSCI World ETF proxy
};

const TF_TO_RANGE: Record<Timeframe, string> = {
  '1D': '1d', '1W': '5d', '1M': '1mo', '6M': '6mo', '1Y': '1y', '5Y': '5y', '10Y': '10y', 'ALL': 'max',
};
const TF_TO_INTERVAL: Record<Timeframe, string> = {
  '1D': '5m', '1W': '15m', '1M': '1h', '6M': '1d', '1Y': '1d', '5Y': '1wk', '10Y': '1wk', 'ALL': '1wk',
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
  // Free-text search → best ticker match. e.g. "tesla" → { symbol: "TSLA", name: "Tesla, Inc." }
  async searchSymbol(query: string): Promise<{ symbol: string; name: string; sector?: string; industry?: string; exchange?: string } | null> {
    const q = query.trim();
    if (!q) return null;
    try {
      const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=5&newsCount=0`;
      const data = await fetchJSON(url);
      const quotes: any[] = data?.quotes ?? [];
      // Prefer equity matches
      const equity = quotes.find(x => x.quoteType === 'EQUITY') ?? quotes[0];
      if (!equity || !equity.symbol) return null;
      return {
        symbol: equity.symbol,
        name: equity.shortname ?? equity.longname ?? equity.symbol,
        sector: equity.sectorDisp ?? equity.sector,
        industry: equity.industryDisp ?? equity.industry,
        exchange: equity.exchange,
      };
    } catch {
      return null;
    }
  },

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

  // Fetch company profile (sector, industry, summary, market cap, financials)
  async getProfile(ticker: string): Promise<{
    sector?: string; industry?: string; summary?: string; marketCap?: number; marketCapLabel?: string;
    revenueGrowth?: number; profitMargin?: number; debtToEquity?: number; price?: number; change?: number; changePercent?: number; name?: string;
    fiftyTwoWeekHigh?: number; fiftyTwoWeekLow?: number; yearlyReturn?: number;
  }> {
    const formatCap = (v: number) => v >= 1e12 ? `$${(v/1e12).toFixed(2)}T` : v >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v/1e6).toFixed(0)}M` : `$${v}`;
    const result: any = {};

    // 1) Search endpoint — sector, industry, name (no auth required)
    try {
      const encoded = encodeURIComponent(ticker);
      const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encoded}&quotesCount=1&newsCount=0`;
      const data = await fetchJSON(url);
      const q = data?.quotes?.[0];
      if (q && q.symbol === ticker) {
        result.name = q.shortname ?? q.longname;
        result.sector = q.sectorDisp ?? q.sector;
        result.industry = q.industryDisp ?? q.industry;
      }
    } catch (e) {
      console.warn(`Yahoo search failed for ${ticker}:`, e);
    }

    // 2) Chart endpoint — price, change, 52wk, yearly performance
    try {
      const encoded = encodeURIComponent(ticker);
      const url = `${BASE}/v8/finance/chart/${encoded}?interval=1d&range=5d&includePrePost=false`;
      const data = await fetchJSON(url);
      const r = data?.chart?.result?.[0];
      if (r) {
        const meta = r.meta;
        result.price = meta.regularMarketPrice;
        result.change = meta.regularMarketPrice - (meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPrice);
        result.changePercent = meta.chartPreviousClose
          ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100 : 0;
        result.name = result.name ?? meta.shortName ?? meta.longName;
        result.fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh;
        result.fiftyTwoWeekLow = meta.fiftyTwoWeekLow;
      }
    } catch (e) {
      console.warn(`Yahoo chart failed for ${ticker}:`, e);
    }

    // 3) Longer chart for yearly performance estimate & market cap proxy
    if (result.price) {
      try {
        const encoded = encodeURIComponent(ticker);
        const url = `${BASE}/v8/finance/chart/${encoded}?interval=3mo&range=5y&includePrePost=false`;
        const data = await fetchJSON(url);
        const r = data?.chart?.result?.[0];
        if (r) {
          const closes: (number | null)[] = r.indicators?.quote?.[0]?.close || [];
          const validCloses = closes.filter((c): c is number => c != null);
          if (validCloses.length >= 4) {
            // Yearly return from ~4 quarters ago vs now
            const yearAgoIdx = Math.max(0, validCloses.length - 5);
            result.yearlyReturn = ((result.price - validCloses[yearAgoIdx]) / validCloses[yearAgoIdx]) * 100;
          }
          // Estimate market cap from volume * price (rough proxy)
          const vol = r.meta.regularMarketVolume;
          if (vol && result.price) {
            // Use average daily volume * price * float multiplier as very rough cap estimate
            // This is imprecise but gives order of magnitude
            const estimatedShares = vol * 200; // rough float estimate
            const estCap = estimatedShares * result.price;
            result.marketCap = estCap;
            result.marketCapLabel = formatCap(estCap);
          }
        }
      } catch (e) {
        console.warn(`Yahoo 5y chart failed for ${ticker}:`, e);
      }
    }

    // 4) Build a summary from available data
    if (!result.summary && result.name && result.sector) {
      result.summary = `${result.name} is a ${result.sector} company in the ${result.industry ?? 'diversified'} sector.${
        result.fiftyTwoWeekHigh ? ` 52-week range: $${result.fiftyTwoWeekLow?.toFixed(2)} – $${result.fiftyTwoWeekHigh?.toFixed(2)}.` : ''
      }${result.yearlyReturn != null ? ` 1Y return: ${result.yearlyReturn >= 0 ? '+' : ''}${result.yearlyReturn.toFixed(1)}%.` : ''}`;
    }

    return result;
  },

  // Fetch index quotes
  async getIndexQuotes(): Promise<Record<string, YahooQuote>> {
    // Decode tickers so getQuoteViaChart fallback doesn't double-encode
    const yahooTickers = Object.values(INDEX_TICKERS).map(t => decodeURIComponent(t));
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
    const isIntraday = interval.endsWith('m') || interval.endsWith('h');
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
        const label = isIntraday ? `${iso}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : iso;
        points.push({ date: label, value: Math.round(close * 100) / 100 });
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

  // Convert Yahoo screener quote to Company object
  _quoteToCompany(q: any): Company {
    const clamp = (v: number) => Math.max(5, Math.min(95, Math.round(v)));
    const chg = q.regularMarketChangePercent ?? 0;
    const cap = q.marketCap ?? 0;
    const pe = q.forwardPE ?? q.trailingPE ?? 0;
    const hi = q.fiftyTwoWeekHigh ?? 0;
    const lo = q.fiftyTwoWeekLow ?? 0;
    const price = q.regularMarketPrice ?? 0;
    const pos52w = hi > lo ? ((price - lo) / (hi - lo)) * 100 : 50;
    const yrChg = q.fiftyTwoWeekChangePercent ?? 0;
    const momentum = clamp(50 + chg * 3 + yrChg * 0.2);
    const fundamental = clamp(40 + (pe > 0 && pe < 30 ? 20 : pe > 0 ? 10 : 0) + (yrChg > 0 ? 10 : 0));
    const valuation = clamp(60 - pos52w * 0.3 + (pe > 0 && pe < 20 ? 15 : 0));
    const risk = clamp(30 + (pos52w > 90 ? 20 : 0) + (pe <= 0 ? 15 : 0));
    const opportunity = clamp(40 + yrChg * 0.3 + (pos52w < 40 ? 15 : 0));
    const overall = clamp((momentum + fundamental + valuation + opportunity) / 4);
    const formatCap = (v: number) => v >= 1e12 ? `$${(v/1e12).toFixed(2)}T` : v >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v/1e6).toFixed(0)}M` : `$${v}`;
    const scores: CompanyScores = {
      overall, momentum, fundamental, valuation, risk, opportunity,
      institutionalInterest: clamp(50 + (cap > 100e9 ? 25 : cap > 10e9 ? 15 : cap > 1e9 ? 5 : 0)),
      technologyExposure: 50, marketDemand: clamp(45 + yrChg * 0.3), userFit: clamp(overall * 0.9),
    };
    return {
      ticker: q.symbol,
      name: q.shortName ?? q.longName ?? q.symbol,
      sector: q.sectorDisp ?? q.sector ?? '—',
      industry: q.industryDisp ?? q.industry ?? '—',
      marketCap: cap,
      marketCapLabel: cap ? formatCap(cap) : '—',
      price,
      change: q.regularMarketChange ?? 0,
      changePercent: chg,
      revenueGrowth: Math.round(yrChg * 10) / 10,
      profitMargin: pe > 0 ? Math.round(100 / pe * 10) / 10 : 0,
      debtToEquity: 0,
      analystSentiment: overall >= 70 ? 'Buy' : overall >= 55 ? 'Hold' : 'Sell',
      institutionalOwnership: scores.institutionalInterest,
      insiderActivity: 'Neutral',
      relativeStrength: momentum,
      aiTrendConnection: [],
      sparkline: [],
      scores,
      summary: `${q.shortName ?? q.symbol} — ${q.sectorDisp ?? q.sector ?? ''} / ${q.industryDisp ?? q.industry ?? ''}. Price $${price.toFixed(2)}, day change ${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%. 52-week range $${lo.toFixed(2)} – $${hi.toFixed(2)}.`,
    };
  },

  // Fetch market movers: day gainers, most active, trending
  async getMarketMovers(): Promise<{ gainers: Company[]; active: Company[]; trending: Company[] }> {
    const result = { gainers: [] as Company[], active: [] as Company[], trending: [] as Company[] };

    // Day gainers (stocks with biggest % gain today, filtered to >$2 and >100k vol)
    try {
      const url = `${BASE}/v1/finance/screener/predefined/saved?scrIds=day_gainers&count=25`;
      const data = await fetchJSON(url);
      const quotes = data?.finance?.result?.[0]?.quotes ?? [];
      result.gainers = quotes
        .filter((q: any) => q.quoteType === 'EQUITY' && (q.regularMarketPrice ?? 0) > 2)
        .slice(0, 15)
        .map((q: any) => this._quoteToCompany(q));
    } catch (e) { console.warn('Gainers fetch failed:', e); }

    // Most active (highest volume)
    try {
      const url = `${BASE}/v1/finance/screener/predefined/saved?scrIds=most_actives&count=25`;
      const data = await fetchJSON(url);
      const quotes = data?.finance?.result?.[0]?.quotes ?? [];
      result.active = quotes
        .filter((q: any) => q.quoteType === 'EQUITY')
        .slice(0, 15)
        .map((q: any) => this._quoteToCompany(q));
    } catch (e) { console.warn('Most active fetch failed:', e); }

    // Trending tickers — need to enrich with search data
    try {
      const url = `${BASE}/v1/finance/trending/US`;
      const data = await fetchJSON(url);
      const symbols: string[] = (data?.finance?.result?.[0]?.quotes ?? [])
        .map((q: any) => q.symbol)
        .filter((s: string) => !s.includes('-') && !s.startsWith('^')); // filter crypto and indices
      // Enrich via chart endpoint
      const companies = await Promise.all(symbols.slice(0, 15).map(async (sym: string) => {
        try {
          const chartUrl = `${BASE}/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d&includePrePost=false`;
          const cd = await fetchJSON(chartUrl);
          const meta = cd?.chart?.result?.[0]?.meta;
          if (!meta) return null;
          const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(sym)}&quotesCount=1&newsCount=0`;
          const sd = await fetchJSON(searchUrl);
          const sq = sd?.quotes?.[0];
          const q = {
            symbol: sym,
            shortName: meta.shortName ?? meta.longName ?? sym,
            regularMarketPrice: meta.regularMarketPrice ?? 0,
            regularMarketChange: (meta.regularMarketPrice ?? 0) - (meta.chartPreviousClose ?? meta.regularMarketPrice ?? 0),
            regularMarketChangePercent: meta.chartPreviousClose
              ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100 : 0,
            fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? 0,
            fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? 0,
            marketCap: 0,
            quoteType: 'EQUITY',
            sectorDisp: sq?.sectorDisp ?? sq?.sector,
            industryDisp: sq?.industryDisp ?? sq?.industry,
          };
          return this._quoteToCompany(q);
        } catch { return null; }
      }));
      result.trending = companies.filter((c): c is Company => c !== null);
    } catch (e) { console.warn('Trending fetch failed:', e); }

    return result;
  },
};
