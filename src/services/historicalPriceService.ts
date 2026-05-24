// Historical Price Service — fetches real data from Yahoo Finance, caches results
import { PricePoint, Timeframe } from '../models/types';
import { yahooFinance } from './yahooFinance';

// Cache so repeated calls return the same data
const cache = new Map<string, PricePoint[]>();
// Track in-flight fetches to avoid duplicate requests
const fetching = new Set<string>();

export const historicalPriceService = {
  /** Store live-fetched data so thumbnails and detail views stay in sync */
  setHistory(ticker: string, timeframe: Timeframe, data: PricePoint[]) {
    if (data.length > 0) cache.set(`${ticker}:${timeframe}`, data);
  },

  /** Get cached history (returns [] if not yet fetched) */
  getHistory(ticker: string, timeframe: Timeframe): PricePoint[] {
    return cache.get(`${ticker}:${timeframe}`) || [];
  },

  /** Fetch live chart data from Yahoo Finance, cache it, return it */
  async fetchAndCache(ticker: string, timeframe: Timeframe): Promise<PricePoint[]> {
    const cacheKey = `${ticker}:${timeframe}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.length > 0) return cached;

    // Avoid duplicate in-flight requests
    if (fetching.has(cacheKey)) {
      // Wait briefly for the other fetch to finish
      await new Promise(r => setTimeout(r, 200));
      return cache.get(cacheKey) || [];
    }

    fetching.add(cacheKey);
    try {
      const raw = await yahooFinance.getChart(ticker, timeframe);
      if (raw.length > 0) {
        const data = raw.map(d => ({ date: d.date, value: d.value }));
        cache.set(cacheKey, data);
        return data;
      }
    } catch { /* fallback to empty */ }
    finally { fetching.delete(cacheKey); }
    return [];
  },
};
