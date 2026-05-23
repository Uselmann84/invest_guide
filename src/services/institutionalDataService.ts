// Institutional Data Service
// Fetches live 13F data from SEC EDGAR, caches results, computes trades
// Falls back to mock data on failure

import { Institution, InstitutionHolding, InstitutionTrade } from '../models/types';
import { getLatest13FFilings, getExpectedLatestQuarter, Filing13F, Holding13F, INSTITUTION_CIKS } from './secEdgar';
import { mockInstitutions } from '../data/mockInstitutions';
import { tradeFlowHistory, stockFlowHistory, TradeFlowEntry, StockFlowEntry } from '../data/tradeFlowHistory';

const CACHE_KEY = 'invest_guide_13f_cache';

interface CachedInstitution {
  name: string;
  latestQuarter: string;
  previousQuarter: string;
  latestHoldings: Holding13F[];
  previousHoldings: Holding13F[];
  totalValue: number;
  fetchedAt: number;
}

interface InstitutionalCache {
  institutions: Record<string, CachedInstitution>;
  tradeFlow: TradeFlowEntry[];
  stockFlow: Record<string, StockFlowEntry[]>;
  fetchedAt: number;
}

function getCache(): InstitutionalCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function setCache(data: InstitutionalCache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

// Check if cache is still fresh (24 hours, or until new quarter is expected)
function isCacheFresh(cache: InstitutionalCache): boolean {
  const age = Date.now() - cache.fetchedAt;
  const expectedQ = getExpectedLatestQuarter();

  // Invalidate caches missing stockFlow data (bug fix: old caches never stored it)
  if (!cache.stockFlow || Object.keys(cache.stockFlow).length === 0) return false;

  // Check if any institution has data for the expected quarter
  const hasLatest = Object.values(cache.institutions).some(i => i.latestQuarter === expectedQ);

  if (hasLatest) {
    // We have the latest quarter — cache is good for 7 days
    return age < 7 * 24 * 60 * 60 * 1000;
  }
  // Missing latest quarter — check every 24 hours
  return age < 24 * 60 * 60 * 1000;
}

function formatValue(dollars: number): string {
  if (dollars >= 1e12) return `$${(dollars / 1e12).toFixed(2)}T`;
  if (dollars >= 1e9) return `$${(dollars / 1e9).toFixed(1)}B`;
  if (dollars >= 1e6) return `$${(dollars / 1e6).toFixed(0)}M`;
  return `$${Math.round(dollars).toLocaleString()}`;
}

// Compute trades by comparing two quarters of holdings
function computeTrades(
  latest: Holding13F[],
  previous: Holding13F[],
  latestQuarter: string
): { buys: InstitutionTrade[]; sells: InstitutionTrade[]; newPositions: string[]; reducedPositions: string[] } {
  const buys: InstitutionTrade[] = [];
  const sells: InstitutionTrade[] = [];
  const newPositions: string[] = [];
  const reducedPositions: string[] = [];

  const prevMap = new Map<string, Holding13F>();
  for (const h of previous) {
    if (h.ticker) {
      const existing = prevMap.get(h.ticker);
      if (existing) {
        existing.shares += h.shares;
        existing.value += h.value;
      } else {
        prevMap.set(h.ticker, { ...h });
      }
    }
  }

  // Aggregate latest by ticker
  const latestMap = new Map<string, Holding13F>();
  for (const h of latest) {
    if (h.ticker) {
      const existing = latestMap.get(h.ticker);
      if (existing) {
        existing.shares += h.shares;
        existing.value += h.value;
      } else {
        latestMap.set(h.ticker, { ...h });
      }
    }
  }

  // Detect buys (new or increased positions)
  for (const [ticker, curr] of latestMap) {
    const prev = prevMap.get(ticker);
    if (!prev) {
      // New position
      newPositions.push(ticker);
      buys.push({
        ticker,
        name: curr.nameOfIssuer,
        action: 'New',
        shares: curr.shares,
        value: formatValue(curr.value),
        date: latestQuarter,
      });
    } else if (curr.shares > prev.shares) {
      const addedShares = curr.shares - prev.shares;
      const addedValue = curr.value - prev.value;
      if (addedValue > 0) {
        buys.push({
          ticker,
          name: curr.nameOfIssuer,
          action: 'Buy',
          shares: addedShares,
          value: formatValue(Math.abs(addedValue)),
          date: latestQuarter,
        });
      }
    }
  }

  // Detect sells (exited or reduced positions)
  for (const [ticker, prev] of prevMap) {
    const curr = latestMap.get(ticker);
    if (!curr) {
      // Exited position
      reducedPositions.push(ticker);
      sells.push({
        ticker,
        name: prev.nameOfIssuer,
        action: 'Exit',
        shares: prev.shares,
        value: formatValue(prev.value),
        date: latestQuarter,
      });
    } else if (curr.shares < prev.shares) {
      const removedShares = prev.shares - curr.shares;
      const removedValue = prev.value - curr.value;
      reducedPositions.push(ticker);
      sells.push({
        ticker,
        name: prev.nameOfIssuer,
        action: 'Sell',
        shares: removedShares,
        value: formatValue(Math.abs(removedValue)),
        date: latestQuarter,
      });
    }
  }

  // Sort by value descending
  const parseVal = (v: string): number => {
    const n = parseFloat(v.replace(/[$,]/g, ''));
    if (v.includes('T')) return n * 1e12;
    if (v.includes('B')) return n * 1e9;
    if (v.includes('M')) return n * 1e6;
    return n;
  };
  buys.sort((a, b) => parseVal(b.value) - parseVal(a.value));
  sells.sort((a, b) => parseVal(b.value) - parseVal(a.value));

  return { buys: buys.slice(0, 5), sells: sells.slice(0, 5), newPositions: newPositions.slice(0, 5), reducedPositions: reducedPositions.slice(0, 5) };
}

// Build top holdings from 13F data
function buildTopHoldings(holdings: Holding13F[], previousHoldings: Holding13F[]): InstitutionHolding[] {
  // Aggregate by ticker
  const map = new Map<string, { ticker: string; name: string; value: number; shares: number }>();
  for (const h of holdings) {
    if (!h.ticker) continue;
    const existing = map.get(h.ticker);
    if (existing) {
      existing.value += h.value;
      existing.shares += h.shares;
    } else {
      map.set(h.ticker, { ticker: h.ticker, name: h.nameOfIssuer, value: h.value, shares: h.shares });
    }
  }

  const prevMap = new Map<string, number>();
  for (const h of previousHoldings) {
    if (!h.ticker) continue;
    prevMap.set(h.ticker, (prevMap.get(h.ticker) || 0) + h.shares);
  }

  const totalValue = [...map.values()].reduce((sum, h) => sum + h.value, 0);

  return [...map.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map(h => {
      const prevShares = prevMap.get(h.ticker) || 0;
      const changePct = prevShares > 0 ? ((h.shares - prevShares) / prevShares) * 100 : 0;
      return {
        ticker: h.ticker,
        name: h.name,
        weight: Math.round((h.value / totalValue) * 1000) / 10,
        shares: h.shares,
        value: formatValue(h.value),
        change: Math.round(changePct * 10) / 10,
      };
    });
}

// Build trade flow entry for the overall chart
function buildTradeFlowEntry(
  instName: string,
  quarter: string,
  date: string,
  latest: Holding13F[],
  previous: Holding13F[]
): TradeFlowEntry {
  let buys = 0;
  let sells = 0;

  const prevMap = new Map<string, number>();
  for (const h of previous) {
    const key = h.cusip || h.nameOfIssuer;
    prevMap.set(key, (prevMap.get(key) || 0) + h.value);
  }

  const currMap = new Map<string, number>();
  for (const h of latest) {
    const key = h.cusip || h.nameOfIssuer;
    currMap.set(key, (currMap.get(key) || 0) + h.value);
  }

  for (const [key, currVal] of currMap) {
    const prevVal = prevMap.get(key) || 0;
    const diff = currVal - prevVal;
    if (diff > 0) buys += diff;
    else sells += Math.abs(diff);
  }
  for (const [key, prevVal] of prevMap) {
    if (!currMap.has(key)) sells += prevVal;
  }

  // Convert to $M
  const buysM = Math.round(buys / 1e6);
  const sellsM = Math.round(sells / 1e6);

  return { quarter, date, institution: instName, buys: buysM, sells: sellsM, net: buysM - sellsM };
}

// Build per-stock flow entries, keyed by ticker
function buildStockFlowEntries(
  instName: string,
  quarter: string,
  date: string,
  latest: Holding13F[],
  previous: Holding13F[]
): Record<string, StockFlowEntry[]> {
  const result: Record<string, StockFlowEntry[]> = {};

  const latestByTicker = new Map<string, number>();
  for (const h of latest) {
    if (!h.ticker) continue;
    latestByTicker.set(h.ticker, (latestByTicker.get(h.ticker) || 0) + h.value);
  }

  const prevByTicker = new Map<string, number>();
  for (const h of previous) {
    if (!h.ticker) continue;
    prevByTicker.set(h.ticker, (prevByTicker.get(h.ticker) || 0) + h.value);
  }

  const allTickers = new Set([...latestByTicker.keys(), ...prevByTicker.keys()]);

  for (const ticker of allTickers) {
    const currVal = latestByTicker.get(ticker) || 0;
    const prevVal = prevByTicker.get(ticker) || 0;
    const diffM = Math.round((currVal - prevVal) / 1e6);

    if (Math.abs(diffM) >= 10) { // Only include significant moves ($10M+)
      if (!result[ticker]) result[ticker] = [];
      result[ticker].push({
        quarter,
        date,
        institution: instName,
        amount: Math.abs(diffM),
        action: diffM > 0 ? 'Buy' : 'Sell',
      });
    }
  }

  return result;
}

// Merge live data with historical mock data
function mergeTradeFlow(mock: TradeFlowEntry[], live: TradeFlowEntry[]): TradeFlowEntry[] {
  const liveKeys = new Set(live.map(e => `${e.quarter}|${e.institution}`));
  const filtered = mock.filter(e => !liveKeys.has(`${e.quarter}|${e.institution}`));
  return [...filtered, ...live].sort((a, b) => a.date.localeCompare(b.date));
}

function mergeStockFlow(mock: Record<string, StockFlowEntry[]>, live: Record<string, StockFlowEntry[]>): Record<string, StockFlowEntry[]> {
  const result = { ...mock };
  for (const [ticker, liveEntries] of Object.entries(live)) {
    if (!result[ticker]) {
      result[ticker] = liveEntries;
    } else {
      const liveKeys = new Set(liveEntries.map(e => `${e.quarter}|${e.institution}`));
      const filtered = result[ticker].filter(e => !liveKeys.has(`${e.quarter}|${e.institution}`));
      result[ticker] = [...filtered, ...liveEntries].sort((a, b) => a.date.localeCompare(b.date));
    }
  }
  return result;
}

export interface InstitutionalData {
  institutions: Institution[];
  tradeFlow: TradeFlowEntry[];
  stockFlow: Record<string, StockFlowEntry[]>;
  lastUpdated: number;
  isLive: boolean;
}

// Fetch live data for all institutions (runs in background)
async function fetchLiveData(
  onProgress?: (done: number, total: number) => void
): Promise<InstitutionalCache | null> {
  const instNames = Object.keys(INSTITUTION_CIKS);
  const total = instNames.length;
  const cache: InstitutionalCache = {
    institutions: {},
    tradeFlow: [],
    stockFlow: {},
    fetchedAt: Date.now(),
  };

  let done = 0;
  let successCount = 0;

  for (const name of instNames) {
    try {
      const filings = await getLatest13FFilings(name);
      if (filings.length >= 1) {
        const latest = filings[0];
        const previous = filings[1] || { accessionNumber: '', filingDate: '', reportDate: '', quarter: '', holdings: [], totalValue: 0 } as Filing13F;

        cache.institutions[name] = {
          name,
          latestQuarter: latest.quarter,
          previousQuarter: previous.quarter,
          latestHoldings: latest.holdings,
          previousHoldings: previous.holdings,
          totalValue: latest.totalValue,
          fetchedAt: Date.now(),
        };

        // Build trade flow entry
        if (previous.holdings.length > 0) {
          const flowEntry = buildTradeFlowEntry(name, latest.quarter, latest.reportDate, latest.holdings, previous.holdings);
          cache.tradeFlow.push(flowEntry);

          // Build per-stock flow entries and merge into cache
          const stockEntries = buildStockFlowEntries(name, latest.quarter, latest.reportDate, latest.holdings, previous.holdings);
          for (const [ticker, entries] of Object.entries(stockEntries)) {
            if (!cache.stockFlow[ticker]) cache.stockFlow[ticker] = [];
            cache.stockFlow[ticker].push(...entries);
          }
        }

        successCount++;
      }
    } catch (e) {
      console.warn(`Failed to fetch 13F for ${name}:`, e);
    }

    done++;
    onProgress?.(done, total);
  }

  if (successCount === 0) return null;
  setCache(cache);
  return cache;
}

// Build Institution objects by merging live 13F data with mock metadata
function buildInstitutions(cache: InstitutionalCache): Institution[] {
  return mockInstitutions.map(mock => {
    const live = cache.institutions[mock.name];
    if (!live || live.latestHoldings.length === 0) return mock;

    const topHoldings = buildTopHoldings(live.latestHoldings, live.previousHoldings);
    const { buys, sells, newPositions, reducedPositions } = computeTrades(
      live.latestHoldings, live.previousHoldings, live.latestQuarter
    );

    return {
      ...mock,
      aum: formatValue(live.totalValue),
      topHoldings: topHoldings.length > 0 ? topHoldings : mock.topHoldings,
    };
  });
}

// Main entry: get institutional data with caching and fallback
export async function getInstitutionalData(
  onProgress?: (done: number, total: number) => void
): Promise<InstitutionalData> {
  // Check cache first
  const cached = getCache();
  if (cached && isCacheFresh(cached)) {
    return {
      institutions: buildInstitutions(cached),
      tradeFlow: tradeFlowHistory,
      stockFlow: stockFlowHistory,
      lastUpdated: cached.fetchedAt,
      isLive: true,
    };
  }

  // Try fetching live data
  try {
    const live = await fetchLiveData(onProgress);
    if (live) {
      return {
        institutions: buildInstitutions(live),
        tradeFlow: tradeFlowHistory,
        stockFlow: stockFlowHistory,
        lastUpdated: live.fetchedAt,
        isLive: true,
      };
    }
  } catch (e) {
    console.warn('Live 13F fetch failed, using mock data:', e);
  }

  // Fallback to mock data
  return {
    institutions: mockInstitutions,
    tradeFlow: tradeFlowHistory,
    stockFlow: stockFlowHistory,
    lastUpdated: 0,
    isLive: false,
  };
}

// Convenience: get mock data immediately (for initial render)
export function getMockInstitutionalData(): InstitutionalData {
  const cached = getCache();
  if (cached) {
    return {
      institutions: buildInstitutions(cached),
      tradeFlow: tradeFlowHistory,
      stockFlow: stockFlowHistory,
      lastUpdated: cached.fetchedAt,
      isLive: true,
    };
  }

  return {
    institutions: mockInstitutions,
    tradeFlow: tradeFlowHistory,
    stockFlow: stockFlowHistory,
    lastUpdated: 0,
    isLive: false,
  };
}

// Clear cache (for manual refresh)
export function clearInstitutionalCache() {
  localStorage.removeItem(CACHE_KEY);
}
