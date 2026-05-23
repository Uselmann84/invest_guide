// Unified ticker index — aggregates every stock mentioned anywhere in the app
import { Company } from '../models/types';
import { mockInstitutions } from '../data/mockInstitutions';
import { stockFlowHistory } from '../data/tradeFlowHistory';
import { portfolioService } from './portfolioService';
import { yahooFinance } from './yahooFinance';

export interface IndexedStock {
  ticker: string;
  name: string;
  sector?: string;
  marketCapLabel?: string;
  price?: number;
  changePercent?: number;
  /** Full Company record when the ticker is one of the analyzed companies */
  company?: Company;
}

const PROXY_NAME_BY_TICKER: Record<string, string> = {
  // Common tickers we want to show readable names for if they only appear as strings
};

function makeStub(ticker: string, name: string): Company {
  return {
    ticker,
    name,
    sector: '—',
    industry: '—',
    marketCap: 0,
    marketCapLabel: '—',
    price: 0,
    change: 0,
    changePercent: 0,
    revenueGrowth: 0,
    profitMargin: 0,
    debtToEquity: 0,
    analystSentiment: 'Hold',
    institutionalOwnership: 0,
    insiderActivity: 'Neutral',
    relativeStrength: 0,
    aiTrendConnection: [],
    sparkline: [],
    summary: '',
    scores: {
      momentum: 0, fundamental: 0, valuation: 0, institutionalInterest: 0,
      technologyExposure: 0, marketDemand: 0, risk: 0, opportunity: 0,
      userFit: 0, overall: 0,
    },
  };
}

/** Build the global, deduplicated index of every ticker mentioned anywhere. */
export function buildStockIndex(analyzedCompanies: Company[]): IndexedStock[] {
  const map = new Map<string, IndexedStock>();

  const upsert = (ticker: string, name: string, extras: Partial<IndexedStock> = {}) => {
    const key = ticker.toUpperCase();
    const existing = map.get(key);
    if (existing) {
      // Prefer the richest entry (one with a full company / better name)
      if (!existing.company && extras.company) Object.assign(existing, extras);
      if (existing.name === existing.ticker && name !== ticker) existing.name = name;
      return;
    }
    map.set(key, { ticker: key, name: name || key, ...extras });
  };

  // 1) Analyzed companies — richest source
  for (const c of analyzedCompanies) {
    upsert(c.ticker, c.name, {
      sector: c.sector,
      marketCapLabel: c.marketCapLabel,
      price: c.price,
      changePercent: c.changePercent,
      company: c,
    });
  }

  // 2) Institutions: top holdings + recent trades
  for (const inst of mockInstitutions) {
    for (const h of inst.topHoldings) upsert(h.ticker, h.name);
    for (const t of inst.recentBuys) upsert(t.ticker, t.name);
    for (const t of inst.recentSells) upsert(t.ticker, t.name);
    for (const t of inst.newPositions) upsert(t, PROXY_NAME_BY_TICKER[t] || t);
    for (const t of inst.reducedPositions) upsert(t, PROXY_NAME_BY_TICKER[t] || t);
  }

  // 3) Stock flow history (per-ticker quarterly entries)
  for (const [ticker, list] of Object.entries(stockFlowHistory)) {
    if (list.length > 0) upsert(ticker, PROXY_NAME_BY_TICKER[ticker] || ticker);
  }

  // 4) Portfolio holdings + RSUs
  try {
    for (const h of portfolioService.getHoldings()) upsert(h.ticker, h.ticker);
    for (const r of portfolioService.getRsuGrants()) upsert(r.ticker, r.ticker);
  } catch {
    // Portfolio service shape may differ; ignore failures
  }

  return [...map.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export function searchStockIndex(index: IndexedStock[], query: string, limit = 30): IndexedStock[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const exact: IndexedStock[] = [];
  const startsWith: IndexedStock[] = [];
  const contains: IndexedStock[] = [];
  for (const s of index) {
    const t = s.ticker.toLowerCase();
    const n = s.name.toLowerCase();
    if (t === q || n === q) exact.push(s);
    else if (t.startsWith(q) || n.startsWith(q)) startsWith.push(s);
    else if (t.includes(q) || n.includes(q)) contains.push(s);
  }
  return [...exact, ...startsWith, ...contains].slice(0, limit);
}

/** Convert an IndexedStock to a Company (stub if no full company is present). */
export function toCompany(s: IndexedStock): Company {
  return s.company ?? makeStub(s.ticker, s.name);
}

/**
 * AI-powered stock resolver. Given a free-text query (ticker or name) that the
 * local index couldn't match, ask Yahoo Finance search to find the best stock
 * and build a stub Company with profile data pre-filled. Returns null if not
 * found. The caller is expected to add the result to the watchlist.
 */
export async function aiResolveStock(query: string): Promise<Company | null> {
  const match = await yahooFinance.searchSymbol(query);
  if (!match) return null;
  const stub = makeStub(match.symbol, match.name);
  stub.sector = match.sector ?? '—';
  stub.industry = match.industry ?? '—';
  // Try to enrich with a profile fetch (price, market cap, etc.)
  try {
    const p = await yahooFinance.getProfile(match.symbol);
    if (p) {
      stub.price = p.price ?? 0;
      stub.change = p.change ?? 0;
      stub.changePercent = p.changePercent ?? 0;
      stub.marketCap = p.marketCap ?? 0;
      stub.marketCapLabel = p.marketCapLabel ?? '—';
      stub.summary = p.summary ?? '';
      if (p.name) stub.name = p.name;
      if (p.sector) stub.sector = p.sector;
      if (p.industry) stub.industry = p.industry;
    }
  } catch {
    // Profile fetch is best-effort
  }
  return stub;
}

