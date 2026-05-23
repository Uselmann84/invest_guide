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
        { role: 'system', content: 'You are a financial analyst AI. Return ONLY valid JSON. The summary field must be a single JSON string with \\n for newlines. Do NOT use actual newlines inside JSON string values. No markdown code fences. No text outside the JSON object.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 4096,
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
  // Strip code fences, leading/trailing whitespace, and any text before first {
  let cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

function isLive(): boolean {
  const prefs = userPreferenceService.getPreferences();
  return !!prefs.openaiApiKey;
}

function generateDataDrivenSummary(indexes: IndexData[], sectors: SectorPerformance[], companies: Company[]): string {
  const spx = indexes.find(i => i.symbol === 'SPX');
  const ndx = indexes.find(i => i.symbol === 'NDX');
  const dji = indexes.find(i => i.symbol === 'DJI');

  const advancing = indexes.filter(i => i.changePercent >= 0).length;
  const declining = indexes.length - advancing;
  const marketTone = advancing > declining ? 'positive' : advancing < declining ? 'negative' : 'mixed';

  const topSectors = [...sectors].sort((a, b) => b.change - a.change);
  const gainingSectors = topSectors.filter(s => s.change > 0).slice(0, 3);
  const losingSectors = topSectors.filter(s => s.change < 0).slice(0, 2);

  const topStocks = [...companies].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3);
  const worstStocks = [...companies].sort((a, b) => a.changePercent - b.changePercent).slice(0, 2);

  let brief = '';

  // Market overview
  if (spx) {
    const dir = spx.changePercent >= 0 ? 'advanced' : 'declined';
    brief += `The **S&P 500** ${dir} ${Math.abs(spx.changePercent).toFixed(2)}% to ${spx.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}. `;
  }
  if (ndx) {
    const dir = ndx.changePercent >= 0 ? 'gained' : 'fell';
    brief += `The **Nasdaq** ${dir} ${Math.abs(ndx.changePercent).toFixed(2)}%. `;
  }
  if (dji) {
    const dir = dji.changePercent >= 0 ? 'rose' : 'dropped';
    brief += `The **Dow** ${dir} ${Math.abs(dji.changePercent).toFixed(2)}%. `;
  }

  brief += `Overall market tone is **${marketTone}** with ${advancing} of ${indexes.length} major indexes advancing.\n\n`;

  // Sector performance
  if (gainingSectors.length > 0) {
    brief += `**Leading sectors:** ${gainingSectors.map(s => `${s.name} (+${s.change.toFixed(1)}%)`).join(', ')}. `;
  }
  if (losingSectors.length > 0) {
    brief += `**Lagging:** ${losingSectors.map(s => `${s.name} (${s.change.toFixed(1)}%)`).join(', ')}.\n\n`;
  }

  // Top movers
  if (topStocks.length > 0) {
    brief += `**Top movers:** ${topStocks.map(s => `${s.ticker} (${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(1)}%)`).join(', ')}. `;
  }
  if (worstStocks.length > 0 && worstStocks[0].changePercent < 0) {
    brief += `**Underperformers:** ${worstStocks.filter(s => s.changePercent < 0).map(s => `${s.ticker} (${s.changePercent.toFixed(1)}%)`).join(', ')}.`;
  }

  return brief.trim();
}

import { TechTrend } from '../models/types';
import { mockTrends } from '../data/mockTrends';

const TRENDS_PERSIST_KEY = 'invest_guide_ai_trends';

export const marketDataService = {
  isLive,
  generateSummary: generateDataDrivenSummary,

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

      // Fetch 5Y daily chart for each index to compute real performance across all timeframes
      const perfCharts: Record<string, { date: string; value: number }[]> = {};
      await Promise.all(mockIndexes.map(async (mi) => {
        try {
          const data = await yahooFinance.getIndexChart(mi.symbol, '5Y');
          if (data.length > 10) perfCharts[mi.symbol] = data;
        } catch { /* skip */ }
      }));

      const indexes: IndexData[] = mockIndexes.map(mi => {
        const yq = indexQuotes[mi.symbol];
        if (!yq) return mi;
        const realSparkline = indexSparklines[mi.symbol];

        // Compute real performance from chart data
        // 5Y chart has weekly data points (~260 points for 5 years)
        const chart = perfCharts[mi.symbol];
        let performance = { ...mi.performance, daily: Math.round(yq.regularMarketChangePercent * 100) / 100 };
        if (chart && chart.length > 2) {
          const current = chart[chart.length - 1].value;
          const pctFrom = (weeksAgo: number) => {
            const idx = Math.max(0, chart.length - 1 - weeksAgo);
            return Math.round(((current - chart[idx].value) / chart[idx].value) * 10000) / 100;
          };
          performance = {
            daily: Math.round(yq.regularMarketChangePercent * 100) / 100,
            weekly: pctFrom(1),       // 1 week ago
            monthly: pctFrom(4),      // ~4 weeks ago
            sixMonth: pctFrom(26),    // ~26 weeks ago
            yearly: pctFrom(52),      // ~52 weeks ago
            fiveYear: Math.round(((current - chart[0].value) / chart[0].value) * 10000) / 100,
          };
        }

        return {
          ...mi,
          value: yq.regularMarketPrice,
          change: yq.regularMarketChange,
          changePercent: yq.regularMarketChangePercent,
          performance,
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

  // Create a Company from Yahoo Finance data for tickers not in our database
  async fetchNewCompanies(tickers: string[]): Promise<Company[]> {
    const results: Company[] = [];
    await Promise.all(tickers.map(async (ticker) => {
      try {
        const p = await yahooFinance.getProfile(ticker);
        if (!p.price || !p.name) return;
        const sparkline = Array.from({ length: 30 }, (_, i) => {
          const base = p.price! * (1 - (p.changePercent ?? 0) / 100 * (30 - i) / 30);
          return base + (Math.random() - 0.5) * p.price! * 0.002;
        });
        results.push({
          ticker,
          name: p.name ?? ticker,
          sector: p.sector ?? 'Technology',
          industry: p.industry ?? 'Unknown',
          marketCap: p.marketCap ?? 0,
          marketCapLabel: p.marketCapLabel ?? 'N/A',
          price: p.price,
          change: p.change ?? 0,
          changePercent: p.changePercent ?? 0,
          revenueGrowth: p.revenueGrowth ?? 0,
          profitMargin: p.profitMargin ?? 0,
          debtToEquity: p.debtToEquity ?? 0,
          analystSentiment: 'Hold',
          institutionalOwnership: 50,
          insiderActivity: 'Neutral',
          relativeStrength: 50,
          aiTrendConnection: [],
          sparkline,
          scores: { momentum: 50, fundamental: 50, valuation: 50, institutionalInterest: 50, technologyExposure: 50, marketDemand: 50, risk: 50, opportunity: 50, userFit: 50, overall: 50 },
          summary: p.summary ?? `${p.name} (${ticker})`,
        });
      } catch { /* skip failed tickers */ }
    }));
    return results;
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
      const indexSummary = indexes.map(i => {
        const p = i.performance;
        return `${i.symbol} (${i.name}): ${i.value.toLocaleString()} (today ${i.changePercent >= 0 ? '+' : ''}${i.changePercent.toFixed(2)}%, 1W ${p.weekly >= 0 ? '+' : ''}${p.weekly.toFixed(1)}%, 1M ${p.monthly >= 0 ? '+' : ''}${p.monthly.toFixed(1)}%, 6M ${p.sixMonth >= 0 ? '+' : ''}${p.sixMonth.toFixed(1)}%, 1Y ${p.yearly >= 0 ? '+' : ''}${p.yearly.toFixed(1)}%)`;
      }).join('\n');
      const sectorSummary = sectors.map(s => `${s.name}: ${s.change >= 0 ? '+' : ''}${s.change.toFixed(1)}%`).join(', ');
      const stockSummary = topStocks.slice(0, 20).map(s => `${s.ticker}: $${s.price.toFixed(2)} (${s.change >= 0 ? '+' : ''}${s.change.toFixed(2)}%)`).join(', ');

      const json = await callOpenAI(`You are a senior Wall Street market strategist writing a daily market brief for sophisticated retail investors. Analyze the REAL current market data below and provide a comprehensive analysis with actionable investment ideas.

CURRENT MARKET DATA (${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}):

INDEXES:
${indexSummary}

SECTORS (today): ${sectorSummary}

TOP STOCKS: ${stockSummary}

Return this exact JSON structure:
{
  "sentiment": {"label": "Extreme Fear|Fear|Neutral|Greed|Extreme Greed", "value": NUMBER_0_100},
  "macroRisk": {"level": "Low|Moderate|Elevated|High|Extreme", "score": NUMBER_0_100,
    "factors": ["factor1", "factor2", "factor3", "factor4", "factor5"]},
  "summary": "YOUR DEEP ANALYSIS HERE - see requirements below",
  "heatmap": [
    {"sector":"Technology","subsectors":[{"name":"Semiconductors","change":NUMBER},{"name":"Software","change":NUMBER},{"name":"Cloud","change":NUMBER},{"name":"Hardware","change":NUMBER}]},
    {"sector":"Healthcare","subsectors":[{"name":"Biotech","change":NUMBER},{"name":"Pharma","change":NUMBER},{"name":"Med Devices","change":NUMBER},{"name":"Services","change":NUMBER}]},
    {"sector":"Financials","subsectors":[{"name":"Banks","change":NUMBER},{"name":"Insurance","change":NUMBER},{"name":"Fintech","change":NUMBER},{"name":"Asset Mgmt","change":NUMBER}]},
    {"sector":"Energy","subsectors":[{"name":"Oil & Gas","change":NUMBER},{"name":"Renewables","change":NUMBER},{"name":"Nuclear","change":NUMBER},{"name":"Utilities","change":NUMBER}]}
  ]
}

SUMMARY REQUIREMENTS — use this exact format with section headers and bullet points:

## Market Overview
Brief 1-2 sentence overview of today's session.
• Key index move 1 with actual numbers
• Key index move 2
• What drove the session

## Sector & Themes
• Leading sectors with % moves and why
• Lagging sectors and reasons
• Dominant investment themes (AI, rate cuts, earnings, etc.)

## Investment Opportunities
• **TICKER1** — why this is interesting right now (price, catalyst)
• **TICKER2** — opportunity thesis
• **TICKER3** — what to watch for
• Sector or thematic plays worth exploring

## Risks & Caution
• Specific risk 1
• Specific risk 2
• Overextended areas or warning signals

## Outlook & Positioning
• Short-term view (1-2 weeks)
• Medium-term view (1-3 months)
• Suggested positioning: aggressive / balanced / defensive

Use **bold** for tickers and key terms. Use • for bullet points. Keep each bullet concise (1 line). Base ALL analysis on the real data provided. Reference actual numbers. This is for educational purposes, not financial advice.

CRITICAL: The summary value must be a valid JSON string. Use \\n for newlines, NOT actual line breaks inside the string. Escape any quotes with \\".`);

      let parsed;
      try {
        parsed = JSON.parse(json);
      } catch {
        // Try to fix common JSON issues: unescaped newlines in string values
        try {
          // Replace literal newlines inside JSON string values with \n
          const fixed = json.replace(/(["]:[ ]*")([\s\S]*?)("[ ]*[,}])/g, (m, pre, content, post) => {
            return pre + content.replace(/\n/g, '\\n').replace(/\r/g, '') + post;
          });
          parsed = JSON.parse(fixed);
        } catch {
          console.error('OpenAI returned invalid JSON (first 1000 chars):', json.substring(0, 1000));
          // Last resort: try to extract summary text directly from the response
          const summaryMatch = json.match(/"summary"\s*:\s*"([\s\S]*?)"\s*[,}]/);
          parsed = {
            sentiment: mockSentiment,
            macroRisk: mockMacroRisk,
            summary: summaryMatch ? summaryMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : null,
            heatmap: mockHeatmapData,
          };
        }
      }

      // Validate we got something useful
      if (!parsed?.summary) {
        throw new Error('AI response missing summary. Try refreshing again.');
      }

      const result: AnalysisCache = {
        timestamp: Date.now(),
        sentiment: parsed.sentiment || mockSentiment,
        macroRisk: parsed.macroRisk || mockMacroRisk,
        summary: parsed.summary.replace(/\\n/g, '\n'),
        heatmap: parsed.heatmap || mockHeatmapData,
      };
      setCache(ANALYSIS_CACHE_KEY, result);
      return result;
    } catch (e: any) {
      console.error('AI analysis failed:', e);
      if (cached) return cached;
      // Don't return mock summary — keep whatever data-driven summary is already showing
      throw e;
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

  getPersistedTrends(): { trends: TechTrend[]; generatedAt: number } | null {
    try {
      const stored = localStorage.getItem(TRENDS_PERSIST_KEY);
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return null;
  },

  async fetchTrendsAnalysis(currentTrends: TechTrend[]): Promise<{ trends: TechTrend[]; generatedAt: number; newTickers: string[] }> {
    if (!isLive()) throw new Error('API key required for AI analysis');

    const prefs = userPreferenceService.getPreferences();
    const trendNames = currentTrends.map(t => `${t.name} (${t.icon})`).join(', ');

    const prompt = `Update scores for these tech trends based on current market: ${trendNames}.

For each, return: id, scores (0-100: momentumScore, marketDemandScore, investmentAttentionScore, publicHypeScore, realRevenueImpactScore), keyCompanies (5 US stock tickers), emergingCompanies (3 US stock tickers), risks (3 short items), description (1 sentence).

Keep longTermImpact and historicalComparison unchanged. Return ONLY valid JSON, no newlines in string values.
Format: {"trends":[{"id":"ai","momentumScore":N,...}]}`;

    const json = await callOpenAI(prompt);

    let parsed;
    try {
      const firstBrace = json.indexOf('{');
      const lastBrace = json.lastIndexOf('}');
      const cleaned = firstBrace >= 0 && lastBrace > firstBrace ? json.substring(firstBrace, lastBrace + 1) : json;
      parsed = JSON.parse(cleaned);
    } catch {
      // Try fixing unescaped newlines
      try {
        const fixed = json.replace(/(":\s*")([^"]*?)("\s*[,}])/gs, (_, pre, content, post) =>
          pre + content.replace(/\n/g, '\\n').replace(/\r/g, '') + post
        );
        const firstBrace = fixed.indexOf('{');
        const lastBrace = fixed.lastIndexOf('}');
        parsed = JSON.parse(fixed.substring(firstBrace, lastBrace + 1));
      } catch {
        throw new Error('AI returned invalid response. Try again.');
      }
    }

    if (!parsed?.trends?.length) throw new Error('AI response missing trends data');

    const normalize = (s: string) => s?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
    const knownTickers = new Set(mockCompanies.map(c => c.ticker));
    const newTickers = new Set<string>();

    // Collect all tickers from AI response and find new ones
    const collectNew = (arr: string[]) => (arr || []).forEach(t => { if (!knownTickers.has(t)) newTickers.add(t); });

    // Merge AI data with existing trends (keep any fields AI didn't return)
    const updatedTrends: TechTrend[] = currentTrends.map(existing => {
      const ai = parsed.trends.find((t: any) => t.id === existing.id || normalize(t.name) === normalize(existing.name));
      if (!ai) return existing;
      const merged = { ...existing, ...ai, id: existing.id, name: existing.name, icon: ai.icon || existing.icon };
      collectNew(merged.keyCompanies);
      collectNew(merged.emergingCompanies);
      return merged;
    });

    // Add any new trends from AI that don't exist in current list (dedupe by normalized name)
    parsed.trends.forEach((ai: any) => {
      if (ai.icon && ai.name && !updatedTrends.find(t => t.id === ai.id || normalize(t.name) === normalize(ai.name))) {
        collectNew(ai.keyCompanies);
        collectNew(ai.emergingCompanies);
        updatedTrends.push(ai);
      }
    });

    const now = Date.now();
    const result = { trends: updatedTrends, generatedAt: now, newTickers: [...newTickers] };
    try { localStorage.setItem(TRENDS_PERSIST_KEY, JSON.stringify(result)); } catch { /* full */ }
    return result;
  },
};
