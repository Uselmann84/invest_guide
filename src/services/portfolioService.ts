import { StockHolding, RsuGrant, TaxSettings, VestedRsuEvent } from '../models/types';

const HOLDINGS_KEY = 'invest_guide_holdings';
const RSU_KEY = 'invest_guide_rsus';
const TAX_KEY = 'invest_guide_tax';
const WATCHLIST_KEY = 'invest_guide_watchlist';

const DEFAULT_TAX: TaxSettings = {
  capitalGainsTaxRate: 20,
  shortTermCapGainsTaxRate: 37,
  incomeTaxRate: 40,
};

function load<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch { return fallback; }
}

function save(key: string, data: unknown) {
  localStorage.setItem(key, JSON.stringify(data));
}

export const portfolioService = {
  // ---- Holdings ----
  getHoldings(): StockHolding[] { return load<StockHolding[]>(HOLDINGS_KEY, []); },
  saveHoldings(h: StockHolding[]) { save(HOLDINGS_KEY, h); },
  addHolding(h: StockHolding) {
    const all = this.getHoldings();
    all.push(h);
    this.saveHoldings(all);
  },
  removeHolding(id: string) {
    this.saveHoldings(this.getHoldings().filter(h => h.id !== id));
  },
  updateHolding(updated: StockHolding) {
    this.saveHoldings(this.getHoldings().map(h => h.id === updated.id ? updated : h));
  },

  // ---- RSUs ----
  getRsuGrants(): RsuGrant[] { return load<RsuGrant[]>(RSU_KEY, []); },
  saveRsuGrants(g: RsuGrant[]) { save(RSU_KEY, g); },
  addRsuGrant(g: RsuGrant) {
    const all = this.getRsuGrants();
    all.push(g);
    this.saveRsuGrants(all);
  },
  removeRsuGrant(id: string) {
    this.saveRsuGrants(this.getRsuGrants().filter(g => g.id !== id));
  },
  updateRsuGrant(updated: RsuGrant) {
    this.saveRsuGrants(this.getRsuGrants().map(g => g.id === updated.id ? updated : g));
  },

  // ---- Tax ----
  getTaxSettings(): TaxSettings { return load<TaxSettings>(TAX_KEY, DEFAULT_TAX); },
  saveTaxSettings(t: TaxSettings) { save(TAX_KEY, t); },

  // ---- RSU Vesting Schedule ----
  computeVestingSchedule(grant: RsuGrant): VestedRsuEvent[] {
    const events: VestedRsuEvent[] = [];
    const grantDate = new Date(grant.grantDate);
    const totalPeriods = Math.floor((grant.vestingYears * 12) / grant.vestingFrequencyMonths);
    if (totalPeriods <= 0) return events;

    const sharesPerPeriod = Math.floor(grant.totalShares / totalPeriods);
    let remainder = grant.totalShares - sharesPerPeriod * totalPeriods;
    let cumulative = 0;

    for (let p = 1; p <= totalPeriods; p++) {
      const vestDate = new Date(grantDate);
      vestDate.setMonth(vestDate.getMonth() + p * grant.vestingFrequencyMonths);

      if (p < grant.cliffPeriods) continue; // still in cliff, skip

      let shares = sharesPerPeriod;
      if (p === grant.cliffPeriods) {
        // Cliff vest: all accumulated periods vest at once
        shares = sharesPerPeriod * grant.cliffPeriods;
        if (remainder > 0) { shares += 1; remainder--; } // distribute remainder
      } else {
        if (remainder > 0) { shares += 1; remainder--; }
      }

      cumulative += shares;
      events.push({
        date: vestDate.toISOString().slice(0, 10),
        shares,
        cumulative,
        isCliff: p === grant.cliffPeriods,
      });
    }
    return events;
  },

  // ---- Vested shares as of today ----
  getVestedShares(grant: RsuGrant): number {
    const today = new Date().toISOString().slice(0, 10);
    const schedule = this.computeVestingSchedule(grant);
    let vested = 0;
    for (const e of schedule) {
      if (e.date <= today) vested = e.cumulative;
    }
    return vested;
  },

  // ---- Tax calculations ----
  calcStockTax(holding: StockHolding, currentPrice: number, tax: TaxSettings): { gain: number; taxAmount: number; afterTax: number } {
    const gain = (currentPrice - holding.buyPrice) * holding.shares;
    const buyDate = new Date(holding.buyDate);
    const now = new Date();
    const heldMs = now.getTime() - buyDate.getTime();
    const isLongTerm = heldMs > 365.25 * 24 * 60 * 60 * 1000;
    const rate = gain > 0 ? (isLongTerm ? tax.capitalGainsTaxRate : tax.shortTermCapGainsTaxRate) : 0;
    const taxAmount = Math.max(0, gain * rate / 100);
    const currentValue = currentPrice * holding.shares;
    return { gain, taxAmount, afterTax: currentValue - taxAmount };
  },

  calcRsuTax(grant: RsuGrant, currentPrice: number, vestedShares: number, tax: TaxSettings): { incomeValue: number; incomeTax: number; capitalGain: number; capGainTax: number; afterTax: number } {
    // RSU income tax: taxed at vest on (vestPrice - 0) * shares (treated as income)
    // For simplicity, use grant price as the cost basis (price at vest ≈ price at grant for estimate)
    const incomeValue = grant.grantPrice * vestedShares;
    const incomeTax = incomeValue * tax.incomeTaxRate / 100;
    // Capital gains on appreciation above grant price
    const capitalGain = Math.max(0, (currentPrice - grant.grantPrice) * vestedShares);
    const capGainTax = capitalGain * tax.capitalGainsTaxRate / 100;
    const currentValue = currentPrice * vestedShares;
    return { incomeValue, incomeTax, capitalGain, capGainTax, afterTax: currentValue - incomeTax - capGainTax };
  },

  // ---- Watchlist ----
  getWatchlist(): string[] { return load<string[]>(WATCHLIST_KEY, []); },
  saveWatchlist(tickers: string[]) { save(WATCHLIST_KEY, tickers); },
  addToWatchlist(ticker: string) {
    const all = this.getWatchlist();
    if (!all.includes(ticker)) { all.push(ticker); this.saveWatchlist(all); }
  },
  removeFromWatchlist(ticker: string) {
    this.saveWatchlist(this.getWatchlist().filter(t => t !== ticker));
  },
  isInWatchlist(ticker: string): boolean {
    return this.getWatchlist().includes(ticker);
  },
};
