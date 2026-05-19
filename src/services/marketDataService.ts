// Market Data Service — Yahoo Finance for real prices + OpenAI for analysis
// Falls back to mock data when APIs are unavailable
import { userPreferenceService } from './userPreferenceService';
import { IndexData, Company, SectorPerformance, MarketSentiment, MacroRisk, PricePoint, Timeframe } from '../models/types';
import { mockIndexes, mockSectors, mockSentiment, mockMacroRisk, mockMarketSummary, mockHeatmapData } from '../data/mockMarketData';
import { mockCompanies } from '../data/mockCompanies';
import { yahooFinance } from './yahooFinance';

const CACHE_KEY = 'invest_guide_market_cache';
const STOCK_CACHE_KEY = 'invest_guide_stock_cache';
const ANALYSIS_CACHE_KEY = 'invest_guide_analysis_cache';

interface MarketCache {
  timestamp: number;
  indexes: IndexData[];
  sectors: SectorPerformance[];
}

interface StockCache {
  timestamp: number;
  companies: Partial<Record<string, { price: number; change: number; changePercent: number; marketCap: number; marketCapLabel: string }>>;
}

interface AnalysisCache {
  timestamp: number;
  sentiment: MarketSentiment;
  macroRisk: MacroRisk;
  summary: string;
  heatmap: typeof mockHeatmapData;
}

function getCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return null;
}

function setCache(key: string, data: unknown) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
}

function isFresh(timestamp: number, maxAge = 5 * 60 * 1000): boolean {
  return Date.now() - timestamp < maxAge;
}

function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`;
  return `$${cap}`;
}

function generateSparkline(base: number, count: number, changePercent = 0): number[] {
  // Generate a sparkline that trends in the correct direction based on changePercent
  const startPrice = base / (1 + changePercent / 100);
  const step = (base - startPrice) / count;
  return Array.from({ length: count }, (_, i) => {
    const trend = startPrice + step * i;
    // Small random noise (0.1% of price) for realism, but trend-consistent
    return trend + (Math.random() - 0.5) * base * 0.002;
  });
}

async function callOpenAI(prompt: string): Promise<string> {
  const prefs = userPreferenceService.getPreferences();
  if (!prefs.openaiApiKey) throw new Error('No API key configured. Go to Settings → Live Mode & API to add your OpenAI key.');

  const apiKey = prefs.openaiApiKey.trim();
  if (!apiKey.startsWith('sk-')) throw new Error('Invalid API key format. OpenAI keys start with "sk-".');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: prefs.openaiModel || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a financial analyst AI. Return ONLY valid JSON, no markdown, no code fences, no explanation.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error?.message || `HTTP ${res.status}`;
    if (res.status === 401) throw new Error('Invalid API key. Check your key in Settings.');
    if (res.status === 429) throw new Error('Rate limited. Wait a moment and try again.');
    if (res.status === 403) throw new Error('API key lacks permissions. Check your OpenAI plan.');
    throw new Error(`OpenAI error: ${msg}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  return content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
}

function isLive(): boolean {
  const prefs = userPreferenceService.getPreferences();
  return prefs.liveMode && !!prefs.openaiApiKey;
}

export const marketDataService = {
  isLive,

  // Fetch real index data from Yahoo Finance
  async fetchMarketData(): Promise<{ indexes: IndexData[]; sectors: SectorPerformance[] }> {
    const cached = getCache<MarketCache>(CACHE_KEY);
    if (cached && isFresh(cached.timestamp)) return cached;

    try {
      // Fetch index quotes from Yahoo Finance
      const [indexQuotes, sectorPerf, indexSparklines] = await Promise.all([
        yahooFinance.getIndexQuotes(),
        yahooFinance.getSectorPerformance(),
        yahooFinance.getIndexSparklines(),
      ]);

      const indexes: IndexData[] = mockIndexes.map(mi => {
        const yq = indexQuotes[mi.symbol];
        if (!yq) return mi;
        const realSparkline = indexSparklines[mi.symbol];
        return {
          ...mi,
          value: yq.regularMarketPrice,
          change: yq.regularMarketChange,
          changePercent: yq.regularMarketChangePercent,
          performance: {
            ...mi.performance,
            daily: Math.round(yq.regularMarketChangePercent * 100) / 100,
          },
          sparkline: realSparkline && realSparkline.length > 2
            ? realSparkline
            : generateSparkline(yq.regularMarketPrice, 30, yq.regularMarketChangePercent),
        };
      });

      const sectors: SectorPerformance[] = mockSectors.map(ms => {
        const sp = sectorPerf[ms.name];
        if (!sp) return ms;
        return { ...ms, change: sp.change };
      });

      const result: MarketCache = { timestamp: Date.now(), indexes, sectors };
      setCache(CACHE_KEY, result);
      return result;
    } catch (e) {
      console.error('Yahoo Finance market data failed:', e);
      if (cached) return cached;
      return { indexes: mockIndexes, sectors: mockSectors };
    }
  },

  // Fetch real stock prices from Yahoo Finance
  async fetchStockData(tickers: string[]): Promise<StockCache> {
    const cached = getCache<StockCache>(STOCK_CACHE_KEY);
    if (cached && isFresh(cached.timestamp)) return cached;

    try {
      const quotes = await yahooFinance.getQuotes(tickers);
      const companies: StockCache['companies'] = {};
      for (const [ticker, q] of Object.entries(quotes)) {
        companies[ticker] = {
          price: q.regularMarketPrice,
          change: q.regularMarketChange,
          changePercent: q.regularMarketChangePercent,
          marketCap: q.marketCap || 0,
          marketCapLabel: q.marketCap ? formatMarketCap(q.marketCap) : '',
        };
      }
      const result: StockCache = { timestamp: Date.now(), companies };
      setCache(STOCK_CACHE_KEY, result);
      return result;
    } catch (e) {
      console.error('Yahoo Finance stock data failed:', e);
      if (cached) return cached;
      return { timestamp: Date.now(), companies: {} };
    }
  },

  // Fetch price history from Yahoo Finance
  async fetchPriceHistory(ticker: string, timeframe: Timeframe): Promise<PricePoint[]> {
    try {
      const data = await yahooFinance.getChart(ticker, timeframe);
      return data.map(d => ({ date: d.date, value: d.value }));
    } catch (e) {
      console.error(`Chart fetch failed for ${ticker}:`, e);
      return [];
    }
  },

  // Fetch index chart from Yahoo Finance
  async fetchIndexHistory(indexSymbol: string, timeframe: Timeframe): Promise<PricePoint[]> {
    try {
      const data = await yahooFinance.getIndexChart(indexSymbol, timeframe);
      return data.map(d => ({ date: d.date, value: d.value }));
    } catch (e) {
      console.error(`Index chart fetch failed for ${indexSymbol}:`, e);
      return [];
    }
  },

  // OpenAI analyzes real market data to produce insights
  async fetchAnalysis(indexes: IndexData[], sectors: SectorPerformance[], topStocks: { ticker: string; price: number; change: number }[]): Promise<AnalysisCache> {
    if (!isLive()) {
      return {
        timestamp: Date.now(),
        sentiment: mockSentiment,
        macroRisk: mockMacroRisk,
        summary: mockMarketSummary,
        heatmap: mockHeatmapData,
      };
    }

    const cached = getCache<AnalysisCache>(ANALYSIS_CACHE_KEY);
    if (cached && isFresh(cached.timestamp, 10 * 60 * 1000)) return cached; // 10 min cache for AI analysis

    try {
      const indexSummary = indexes.map(i => `${i.symbol}: ${i.value.toFixed(0)} (${i.changePercent >= 0 ? '+' : ''}${i.changePercent.toFixed(2)}%)`).join(', ');
      const sectorSummary = sectors.map(s => `${s.name}: ${s.change >= 0 ? '+' : ''}${s.change}%`).join(', ');
      const stockSummary = topStocks.slice(0, 15).map(s => `${s.ticker}: $${s.price.toFixed(2)} (${s.change >= 0 ? '+' : ''}${s.change.toFixed(2)}%)`).join(', ');

      const json = await callOpenAI(`You are analyzing REAL current market data. Based on today's data below, return a JSON analysis.

CURRENT MARKET DATA:
Indexes: ${indexSummary}
Sectors: ${sectorSummary}
Top stocks: ${stockSummary}

Return this exact JSON structure:
{
  "sentiment": {"label": "Fear|Neutral|Greed|Extreme Fear|Extreme Greed", "value": NUMBER_0_100},
  "macroRisk": {"level": "Low|Moderate|Elevated|High|Extreme", "score": NUMBER_0_100,
    "factors": ["factor1", "factor2", "factor3", "factor4", "factor5"]},
  "summary": "2-3 paragraph analysis of current market conditions. Use **bold** for key terms. Include what's driving markets, key risks, and outlook. Reference the actual index values and sector moves.",
  "heatmap": [
    {"sector":"Technology","subsectors":[{"name":"Semiconductors","change":NUMBER},{"name":"Software","change":NUMBER},{"name":"Cloud","change":NUMBER},{"name":"Hardware","change":NUMBER}]},
    {"sector":"Healthcare","subsectors":[{"name":"Biotech","change":NUMBER},{"name":"Pharma","change":NUMBER},{"name":"Med Devices","change":NUMBER},{"name":"Services","change":NUMBER}]},
    {"sector":"Financials","subsectors":[{"name":"Banks","change":NUMBER},{"name":"Insurance","change":NUMBER},{"name":"Fintech","change":NUMBER},{"name":"Asset Mgmt","change":NUMBER}]},
    {"sector":"Energy","subsectors":[{"name":"Oil & Gas","change":NUMBER},{"name":"Renewables","change":NUMBER},{"name":"Nuclear","change":NUMBER},{"name":"Utilities","change":NUMBER}]}
  ]
}

Base your analysis on the real data provided. The sentiment and risk assessments should reflect actual current market conditions.`);

      let parsed;
      try {
        parsed = JSON.parse(json);
      } catch {
        console.error('OpenAI returned invalid JSON:', json.substring(0, 500));
        throw new Error('AI returned invalid response. Try again.');
      }

      const result: AnalysisCache = {
        timestamp: Date.now(),
        sentiment: parsed.sentiment || mockSentiment,
        macroRisk: parsed.macroRisk || mockMacroRisk,
        summary: parsed.summary || mockMarketSummary,
        heatmap: parsed.heatmap || mockHeatmapData,
      };
      setCache(ANALYSIS_CACHE_KEY, result);
      return result;
    } catch (e: any) {
      console.error('AI analysis failed:', e);
      if (cached) return cached;
      return {
        timestamp: Date.now(),
        sentiment: mockSentiment,
        macroRisk: mockMacroRisk,
        summary: `⚠️ AI Analysis Error: ${e.message || 'Unknown error'}\n\nFalling back to demo data. Check Settings → Live Mode & API.\n\n${mockMarketSummary}`,
        heatmap: mockHeatmapData,
      };
    }
  },

  getCompaniesWithLiveData(stockCache: StockCache): Company[] {
    return mockCompanies.map(c => {
      const update = stockCache.companies[c.ticker];
      if (!update) return c;
      const livePrice = update.price || c.price;
      const liveChangePercent = update.changePercent ?? c.changePercent;
      return {
        ...c,
        price: livePrice,
        change: update.change ?? c.change,
        changePercent: liveChangePercent,
        marketCap: update.marketCap || c.marketCap,
        marketCapLabel: update.marketCapLabel || c.marketCapLabel,
        // Regenerate sparkline to match actual price direction
        sparkline: generateSparkline(livePrice, 30, liveChangePercent),
      };
    });
  },

  clearCache() {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(STOCK_CACHE_KEY);
    localStorage.removeItem(ANALYSIS_CACHE_KEY);
  },
};
