// Virtual ("paper trading") portfolio. Records buys/sells against current
// market prices and persists everything in localStorage. Holdings are
// computed by replaying the transaction log so cost-basis stays exact.

export interface VirtualTransaction {
  id: string;
  ticker: string;
  name: string;
  side: 'buy' | 'sell';
  shares: number;
  price: number; // execution price per share
  date: string;  // ISO datetime
}

export interface VirtualPosition {
  ticker: string;
  name: string;
  shares: number;
  avgCost: number;        // remaining cost basis per share
  totalInvested: number;  // shares * avgCost
  realizedPL: number;     // realised P/L from completed sells
}

const TX_KEY = 'invest_guide_vp_transactions_v1';

function loadTx(): VirtualTransaction[] {
  try {
    const raw = localStorage.getItem(TX_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveTx(tx: VirtualTransaction[]) {
  try { localStorage.setItem(TX_KEY, JSON.stringify(tx)); } catch { /* quota */ }
}

function genId(): string {
  try { return crypto.randomUUID(); }
  catch { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
}

/** Replay the transaction log into a position map using average-cost accounting. */
function computePositions(tx: VirtualTransaction[]): Map<string, VirtualPosition> {
  // Process oldest first
  const ordered = [...tx].sort((a, b) => a.date.localeCompare(b.date));
  const positions = new Map<string, VirtualPosition>();
  for (const t of ordered) {
    const existing = positions.get(t.ticker) ?? {
      ticker: t.ticker,
      name: t.name,
      shares: 0,
      avgCost: 0,
      totalInvested: 0,
      realizedPL: 0,
    };
    existing.name = t.name || existing.name;
    if (t.side === 'buy') {
      const newShares = existing.shares + t.shares;
      const newCostTotal = existing.totalInvested + t.shares * t.price;
      existing.shares = newShares;
      existing.totalInvested = newCostTotal;
      existing.avgCost = newShares > 0 ? newCostTotal / newShares : 0;
    } else {
      const sellShares = Math.min(t.shares, existing.shares);
      const costRemoved = sellShares * existing.avgCost;
      const proceeds = sellShares * t.price;
      existing.realizedPL += proceeds - costRemoved;
      existing.shares -= sellShares;
      existing.totalInvested = Math.max(0, existing.totalInvested - costRemoved);
      if (existing.shares <= 1e-9) {
        existing.shares = 0;
        existing.avgCost = 0;
        existing.totalInvested = 0;
      }
    }
    positions.set(t.ticker, existing);
  }
  return positions;
}

export const virtualPortfolioService = {
  transactions(): VirtualTransaction[] {
    return [...loadTx()].sort((a, b) => b.date.localeCompare(a.date));
  },

  /** All positions including zeroed-out tickers (for realised-P/L display). */
  allPositions(): VirtualPosition[] {
    return [...computePositions(loadTx()).values()];
  },

  /** Only positions with shares > 0. */
  openPositions(): VirtualPosition[] {
    return this.allPositions().filter(p => p.shares > 0);
  },

  buy(ticker: string, name: string, shares: number, price: number): VirtualTransaction {
    const tx: VirtualTransaction = {
      id: genId(),
      ticker: ticker.toUpperCase(),
      name,
      side: 'buy',
      shares,
      price,
      date: new Date().toISOString(),
    };
    const all = loadTx();
    all.push(tx);
    saveTx(all);
    return tx;
  },

  sell(ticker: string, name: string, shares: number, price: number): VirtualTransaction | null {
    const pos = computePositions(loadTx()).get(ticker.toUpperCase());
    if (!pos || pos.shares <= 0) return null;
    const actualShares = Math.min(shares, pos.shares);
    if (actualShares <= 0) return null;
    const tx: VirtualTransaction = {
      id: genId(),
      ticker: ticker.toUpperCase(),
      name,
      side: 'sell',
      shares: actualShares,
      price,
      date: new Date().toISOString(),
    };
    const all = loadTx();
    all.push(tx);
    saveTx(all);
    return tx;
  },

  deleteTransaction(id: string) {
    saveTx(loadTx().filter(t => t.id !== id));
  },

  reset() {
    saveTx([]);
  },

  /**
   * Build a daily equity curve by replaying transactions and applying a
   * provided price history (ticker → date → close). Dates without an entry
   * carry forward the previous day's price.
   */
  equityCurve(
    priceHistory: Record<string, Array<{ date: string; price: number }>>,
  ): Array<{ date: string; value: number; invested: number }> {
    const tx = [...loadTx()].sort((a, b) => a.date.localeCompare(b.date));
    if (tx.length === 0) return [];

    // Build per-ticker price map (yyyy-mm-dd → close).
    const priceMap: Record<string, Record<string, number>> = {};
    const allDates = new Set<string>();
    for (const [tk, hist] of Object.entries(priceHistory)) {
      const m: Record<string, number> = {};
      for (const p of hist) {
        const d = p.date.slice(0, 10);
        m[d] = p.price;
        allDates.add(d);
      }
      priceMap[tk] = m;
    }

    const startDate = tx[0].date.slice(0, 10);
    const endDate = new Date().toISOString().slice(0, 10);

    // Day iteration
    const days: string[] = [];
    const cur = new Date(startDate);
    const end = new Date(endDate);
    while (cur <= end) {
      days.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }

    // For each day, compute holdings (shares per ticker) from tx <= day
    let txIdx = 0;
    const shares: Record<string, number> = {};
    let invested = 0;
    const out: Array<{ date: string; value: number; invested: number }> = [];

    // Track last known price for fallback
    const lastPrice: Record<string, number> = {};

    for (const day of days) {
      // Apply tx up to and including this day
      while (txIdx < tx.length && tx[txIdx].date.slice(0, 10) <= day) {
        const t = tx[txIdx];
        if (t.side === 'buy') {
          shares[t.ticker] = (shares[t.ticker] ?? 0) + t.shares;
          invested += t.shares * t.price;
        } else {
          const have = shares[t.ticker] ?? 0;
          const sellShares = Math.min(t.shares, have);
          shares[t.ticker] = have - sellShares;
          // Reduce invested proportionally to cost basis would be ideal,
          // but for the chart we approximate with the sell price.
          invested = Math.max(0, invested - sellShares * t.price);
        }
        // remember exec price as fallback
        lastPrice[t.ticker] = t.price;
        txIdx++;
      }

      // Mark-to-market
      let value = 0;
      for (const [tk, sh] of Object.entries(shares)) {
        if (sh <= 0) continue;
        const px = priceMap[tk]?.[day] ?? lastPrice[tk];
        if (px != null) {
          value += sh * px;
          lastPrice[tk] = px;
        }
      }
      out.push({ date: day, value, invested });
    }

    return out;
  },
};
