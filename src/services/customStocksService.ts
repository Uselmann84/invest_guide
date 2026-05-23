// Persists Company stubs created by AI search ("AI Search & Add") so they
// appear in the watchlist and stock detail can be reopened across sessions.
import { Company } from '../models/types';

const KEY = 'invest_guide_custom_stocks';

function load(): Company[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(list: Company[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* quota */ }
}

export const customStocksService = {
  list(): Company[] { return load(); },

  /** Add or replace a stub by ticker. */
  upsert(stub: Company) {
    const all = load().filter(c => c.ticker !== stub.ticker);
    all.push(stub);
    save(all);
  },

  remove(ticker: string) {
    save(load().filter(c => c.ticker !== ticker));
  },

  get(ticker: string): Company | undefined {
    return load().find(c => c.ticker === ticker);
  },
};
