import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { StockHolding, RsuGrant, TaxSettings, Timeframe } from '../models/types';
import { portfolioService } from '../services/portfolioService';
import { useMarketData } from '../components/MarketDataContext';
import { marketDataService } from '../services/marketDataService';
import { yahooFinance } from '../services/yahooFinance';
import { SectionHeader, TabBar, ChangeIndicator } from '../components/SharedComponents';
import { CompanyDetail } from './StocksPage';
import { Company } from '../models/types';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine, CartesianGrid } from 'recharts';

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtK(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${fmt(n)}`;
}

// ---- Add Stock Form ----
function AddStockForm({ onAdd, onCancel }: { onAdd: (h: StockHolding) => void; onCancel: () => void }) {
  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [shares, setShares] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [buyDate, setBuyDate] = useState(new Date().toISOString().slice(0, 10));

  const { companies } = useMarketData();
  const suggestions = useMemo(() => {
    if (!ticker || ticker.length < 1) return [];
    const q = ticker.toUpperCase();
    return companies.filter(c => c.ticker.startsWith(q) || c.name.toLowerCase().includes(ticker.toLowerCase())).slice(0, 5);
  }, [ticker, companies]);

  const selectSuggestion = (c: Company) => {
    setTicker(c.ticker);
    setName(c.name);
    if (!buyPrice) setBuyPrice(c.price.toFixed(2));
  };

  const submit = () => {
    if (!ticker || !shares || !buyPrice) return;
    onAdd({
      id: crypto.randomUUID(),
      ticker: ticker.toUpperCase(),
      name: name || ticker.toUpperCase(),
      shares: Number(shares),
      buyPrice: Number(buyPrice),
      buyDate,
    });
  };

  return (
    <div className="card overflow-hidden">
      <div className="bg-gradient-to-r from-accent-500/20 to-emerald-500/10 px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold flex items-center gap-2">📈 Add Stock Holding</h3>
      </div>
      <div className="p-4 space-y-3">
      <div className="relative">
        <input className="input-field text-sm" placeholder="Ticker (e.g. AAPL)" value={ticker}
          onChange={e => { setTicker(e.target.value); setName(''); }} />
        {suggestions.length > 0 && !name && (
          <div className="absolute top-full left-0 right-0 z-10 bg-surface-800 border border-white/10 rounded-lg mt-1 overflow-hidden">
            {suggestions.map(c => (
              <button key={c.ticker} onClick={() => selectSuggestion(c)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex justify-between">
                <span><span className="font-semibold">{c.ticker}</span> <span className="text-gray-500">{c.name}</span></span>
                <span className="text-gray-400">${c.price.toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {name && <p className="text-xs text-gray-500 -mt-2">{name}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Shares</label>
          <input className="input-field text-sm" type="number" placeholder="100" value={shares} onChange={e => setShares(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Buy Price ($)</label>
          <input className="input-field text-sm" type="number" step="0.01" placeholder="150.00" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-gray-500 block mb-1">Buy Date</label>
        <input className="input-field text-sm" type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)} />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={submit} disabled={!ticker || !shares || !buyPrice} className="btn-primary flex-1 text-sm py-2.5 disabled:opacity-40 disabled:cursor-not-allowed">Add Holding</button>
        <button onClick={onCancel} className="btn-secondary flex-1 text-sm py-2.5">Cancel</button>
      </div>
      </div>
    </div>
  );
}

// ---- Add RSU Form ----
function AddRsuForm({ onAdd, onCancel }: { onAdd: (g: RsuGrant) => void; onCancel: () => void }) {
  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [totalShares, setTotalShares] = useState('');
  const [grantDate, setGrantDate] = useState(new Date().toISOString().slice(0, 10));
  const [grantPrice, setGrantPrice] = useState('');
  const [vestingYears, setVestingYears] = useState('4');
  const [vestFreq, setVestFreq] = useState<'3' | '6'>('3');
  const [cliffPeriods, setCliffPeriods] = useState('4');

  const { companies } = useMarketData();
  const suggestions = useMemo(() => {
    if (!ticker || ticker.length < 1) return [];
    const q = ticker.toUpperCase();
    return companies.filter(c => c.ticker.startsWith(q) || c.name.toLowerCase().includes(ticker.toLowerCase())).slice(0, 5);
  }, [ticker, companies]);

  const selectSuggestion = (c: Company) => {
    setTicker(c.ticker);
    setName(c.name);
    if (!grantPrice) setGrantPrice(c.price.toFixed(2));
  };

  const submit = () => {
    if (!ticker || !totalShares || !grantPrice) return;
    onAdd({
      id: crypto.randomUUID(),
      ticker: ticker.toUpperCase(),
      name: name || ticker.toUpperCase(),
      totalShares: Number(totalShares),
      grantDate,
      grantPrice: Number(grantPrice),
      vestingYears: Number(vestingYears),
      vestingFrequencyMonths: Number(vestFreq) as 3 | 6,
      cliffPeriods: Number(cliffPeriods),
    });
  };

  return (
    <div className="card overflow-hidden">
      <div className="bg-gradient-to-r from-violet-500/20 to-accent-500/10 px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold flex items-center gap-2">🏦 Add RSU Grant</h3>
      </div>
      <div className="p-4 space-y-3">
      <div className="relative">
        <input className="input-field text-sm" placeholder="Ticker (e.g. TSLA)" value={ticker}
          onChange={e => { setTicker(e.target.value); setName(''); }} />
        {suggestions.length > 0 && !name && (
          <div className="absolute top-full left-0 right-0 z-10 bg-surface-800 border border-white/10 rounded-lg mt-1 overflow-hidden">
            {suggestions.map(c => (
              <button key={c.ticker} onClick={() => selectSuggestion(c)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex justify-between">
                <span><span className="font-semibold">{c.ticker}</span> <span className="text-gray-500">{c.name}</span></span>
                <span className="text-gray-400">${c.price.toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {name && <p className="text-xs text-gray-500 -mt-2">{name}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Total Shares</label>
          <input className="input-field text-sm" type="number" placeholder="1000" value={totalShares} onChange={e => setTotalShares(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Grant Price ($)</label>
          <input className="input-field text-sm" type="number" step="0.01" placeholder="200.00" value={grantPrice} onChange={e => setGrantPrice(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-gray-500 block mb-1">Grant Date</label>
        <input className="input-field text-sm" type="date" value={grantDate} onChange={e => setGrantDate(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Vesting (years)</label>
          <input className="input-field text-sm" type="number" value={vestingYears} onChange={e => setVestingYears(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Freq (months)</label>
          <select className="input-field text-sm" value={vestFreq} onChange={e => setVestFreq(e.target.value as '3' | '6')}>
            <option value="3">Every 3mo</option>
            <option value="6">Every 6mo</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Cliff periods</label>
          <input className="input-field text-sm" type="number" placeholder="4" value={cliffPeriods} onChange={e => setCliffPeriods(e.target.value)} />
        </div>
      </div>
      <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5">
        <p className="text-[10px] text-gray-500">💡 Cliff: first {cliffPeriods} periods vest together, then every {vestFreq} months after that</p>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={submit} disabled={!ticker || !totalShares || !grantPrice} className="btn-primary flex-1 text-sm py-2.5 disabled:opacity-40 disabled:cursor-not-allowed">Add Grant</button>
        <button onClick={onCancel} className="btn-secondary flex-1 text-sm py-2.5">Cancel</button>
      </div>
      </div>
    </div>
  );
}

// ---- Tax Settings Form ----
function TaxSettingsForm({ tax, onChange }: { tax: TaxSettings; onChange: (t: TaxSettings) => void }) {
  const update = (k: keyof TaxSettings, v: number) => {
    const next = { ...tax, [k]: v };
    onChange(next);
    portfolioService.saveTaxSettings(next);
  };
  return (
    <div className="card p-4 space-y-3">
      <SectionHeader title="Tax Rates" />
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Long-term CG %</label>
          <input className="input-field text-sm" type="number" value={tax.capitalGainsTaxRate} onChange={e => update('capitalGainsTaxRate', Number(e.target.value))} />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Short-term CG %</label>
          <input className="input-field text-sm" type="number" value={tax.shortTermCapGainsTaxRate} onChange={e => update('shortTermCapGainsTaxRate', Number(e.target.value))} />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Income Tax %</label>
          <input className="input-field text-sm" type="number" value={tax.incomeTaxRate} onChange={e => update('incomeTaxRate', Number(e.target.value))} />
        </div>
      </div>
    </div>
  );
}

// ---- RSU Vesting Schedule Detail ----
function RsuDetail({ grant, currentPrice, tax, onClose }: { grant: RsuGrant; currentPrice: number; tax: TaxSettings; onClose: () => void }) {
  const schedule = portfolioService.computeVestingSchedule(grant);
  const vestedShares = portfolioService.getVestedShares(grant);
  const unvestedShares = grant.totalShares - vestedShares;
  const taxCalc = portfolioService.calcRsuTax(grant, currentPrice, vestedShares, tax);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 bg-surface-950/95 overflow-y-auto">
      <div className="max-w-lg mx-auto p-4 pt-[env(safe-area-inset-top,16px)] pb-24">
        <button onClick={onClose} className="text-gray-400 hover:text-white mb-4 text-sm mt-2">← Back</button>
        <h2 className="text-lg font-bold mb-1">{grant.ticker} RSU Grant</h2>
        <p className="text-xs text-gray-500 mb-4">{grant.name} · Granted {grant.grantDate}</p>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="card p-3 text-center">
            <p className="text-[10px] text-gray-500">Total Shares</p>
            <p className="text-lg font-bold">{grant.totalShares.toLocaleString()}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[10px] text-gray-500">Grant Price</p>
            <p className="text-lg font-bold">${fmt(grant.grantPrice)}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[10px] text-gray-500">Vested</p>
            <p className="text-lg font-bold text-emerald-400">{vestedShares.toLocaleString()}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[10px] text-gray-500">Unvested</p>
            <p className="text-lg font-bold text-amber-400">{unvestedShares.toLocaleString()}</p>
          </div>
        </div>

        {/* Value & Tax */}
        <div className="card p-4 mb-4">
          <SectionHeader title="Vested Value & Tax" />
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Current Price</span>
              <span>${fmt(currentPrice)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Vested Value (pre-tax)</span>
              <span className="font-semibold">${fmt(currentPrice * vestedShares)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Income Tax ({tax.incomeTaxRate}%)</span>
              <span className="text-red-400">-${fmt(taxCalc.incomeTax)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Capital Gain</span>
              <span className={taxCalc.capitalGain >= 0 ? 'text-emerald-400' : 'text-red-400'}>${fmt(taxCalc.capitalGain)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Cap Gains Tax ({tax.capitalGainsTaxRate}%)</span>
              <span className="text-red-400">-${fmt(taxCalc.capGainTax)}</span>
            </div>
            <div className="border-t border-white/10 pt-2 flex justify-between text-sm font-semibold">
              <span>After-Tax Value</span>
              <span className="text-emerald-400">${fmt(taxCalc.afterTax)}</span>
            </div>
          </div>
        </div>

        {/* Total Grant Value */}
        <div className="card p-4 mb-4">
          <SectionHeader title="Total Grant Value (if fully vested)" />
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Total Value at Current Price</span>
              <span className="font-semibold">${fmt(currentPrice * grant.totalShares)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Total Value at Grant Price</span>
              <span>${fmt(grant.grantPrice * grant.totalShares)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Appreciation</span>
              <ChangeIndicator value={((currentPrice - grant.grantPrice) / grant.grantPrice) * 100} />
            </div>
          </div>
        </div>

        {/* Vesting Schedule */}
        <div className="card p-4">
          <SectionHeader title="Vesting Schedule" />
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {schedule.map((e, i) => {
              const isPast = e.date <= today;
              return (
                <div key={i} className={`flex items-center gap-3 text-xs py-1 ${isPast ? '' : 'opacity-50'}`}>
                  <span className={`w-2 h-2 rounded-full ${isPast ? 'bg-emerald-500' : 'bg-gray-600'}`} />
                  <span className="text-gray-400 w-24">{e.date}</span>
                  <span className={`font-semibold ${e.isCliff ? 'text-accent-400' : ''}`}>
                    +{e.shares} {e.isCliff ? '(cliff)' : ''}
                  </span>
                  <span className="text-gray-500 ml-auto">Total: {e.cumulative}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Main Page ----
export default function PortfolioPage() {
  const { companies } = useMarketData();
  const [holdings, setHoldings] = useState<StockHolding[]>(() => portfolioService.getHoldings());
  const [rsus, setRsus] = useState<RsuGrant[]>(() => portfolioService.getRsuGrants());
  const [tax, setTax] = useState<TaxSettings>(() => portfolioService.getTaxSettings());
  const [showAddStock, setShowAddStock] = useState(false);
  const [showAddRsu, setShowAddRsu] = useState(false);
  const [selectedRsu, setSelectedRsu] = useState<RsuGrant | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [view, setView] = useState('overview');
  const [chartTf, setChartTf] = useState<Timeframe>('1M');
  const [chartMode, setChartMode] = useState<'value' | 'profit'>('value');
  const [chartData, setChartData] = useState<{ date: string; value: number; cost: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  const getPrice = useCallback((ticker: string) => {
    const c = companies.find(c => c.ticker === ticker);
    return c?.price ?? 0;
  }, [companies]);

  const addHolding = (h: StockHolding) => {
    portfolioService.addHolding(h);
    setHoldings(portfolioService.getHoldings());
    setShowAddStock(false);
  };

  const removeHolding = (id: string) => {
    portfolioService.removeHolding(id);
    setHoldings(portfolioService.getHoldings());
  };

  const addRsu = (g: RsuGrant) => {
    portfolioService.addRsuGrant(g);
    setRsus(portfolioService.getRsuGrants());
    setShowAddRsu(false);
  };

  const removeRsu = (id: string) => {
    portfolioService.removeRsuGrant(id);
    setRsus(portfolioService.getRsuGrants());
  };

  // Compute portfolio totals
  const stockTotals = useMemo(() => {
    let invested = 0, current = 0, afterTax = 0;
    for (const h of holdings) {
      const price = getPrice(h.ticker);
      invested += h.buyPrice * h.shares;
      current += price * h.shares;
      const t = portfolioService.calcStockTax(h, price, tax);
      afterTax += t.afterTax;
    }
    return { invested, current, gain: current - invested, gainPct: invested > 0 ? ((current - invested) / invested) * 100 : 0, afterTax };
  }, [holdings, tax, getPrice]);

  const rsuTotals = useMemo(() => {
    let grantValue = 0, currentVested = 0, afterTax = 0, totalUnvested = 0;
    for (const g of rsus) {
      const price = getPrice(g.ticker);
      const vested = portfolioService.getVestedShares(g);
      const unvested = g.totalShares - vested;
      grantValue += g.grantPrice * g.totalShares;
      currentVested += price * vested;
      totalUnvested += price * unvested;
      const t = portfolioService.calcRsuTax(g, price, vested, tax);
      afterTax += t.afterTax;
    }
    return { grantValue, currentVested, afterTax, totalUnvested };
  }, [rsus, tax, getPrice]);

  const totalPortfolio = stockTotals.current + rsuTotals.currentVested;
  const totalInvested = stockTotals.invested + rsuTotals.grantValue;
  const totalAfterTax = stockTotals.afterTax + rsuTotals.afterTax;

  // Fetch portfolio chart data
  const allTickers = useMemo(() => {
    const tickers = new Set<string>();
    holdings.forEach(h => tickers.add(h.ticker));
    rsus.forEach(g => tickers.add(g.ticker));
    return Array.from(tickers);
  }, [holdings, rsus]);

  useEffect(() => {
    if (allTickers.length === 0) { setChartData([]); return; }
    let cancelled = false;
    setChartLoading(true);
    (async () => {
      // Find earliest portfolio date
      let earliestDate = '9999';
      for (const h of holdings) { if (h.buyDate < earliestDate) earliestDate = h.buyDate; }
      for (const g of rsus) { if (g.grantDate < earliestDate) earliestDate = g.grantDate; }

      // Determine Yahoo range and interval based on chart timeframe
      // Use daily data for detailed charts; weekly only for very long ranges
      let range: string;
      let interval: string;
      if (chartTf === 'ALL') {
        // Compute how many years since earliest date
        const years = (Date.now() - new Date(earliestDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (years > 5) { range = 'max'; interval = '1wk'; }
        else if (years > 2) { range = `${Math.ceil(years)}y`; interval = '1d'; }
        else { range = `${Math.ceil(years)}y`; interval = '1d'; }
      } else if (chartTf === '1Y') { range = '1y'; interval = '1d'; }
      else if (chartTf === '6M') { range = '6mo'; interval = '1d'; }
      else if (chartTf === '1M') { range = '1mo'; interval = '1d'; }
      else { range = '5d'; interval = '15m'; } // 1W

      const histories = await Promise.all(
        allTickers.map(async t => ({ ticker: t, data: await yahooFinance.getChartISO(t, range, interval) }))
      );
      if (cancelled) return;

      // Pre-compute RSU vesting schedules
      const rsuSchedules = rsus.map(g => ({
        grant: g,
        schedule: portfolioService.computeVestingSchedule(g),
      }));
      const getVestedAt = (schedule: { date: string; cumulative: number }[], asOf: string): number => {
        let vested = 0;
        for (const e of schedule) {
          if (e.date <= asOf) vested = e.cumulative;
          else break;
        }
        return vested;
      };

      // Build date→ticker→price map (dates are now YYYY-MM-DD)
      const dateMap = new Map<string, Record<string, number>>();
      for (const { ticker, data } of histories) {
        for (const pt of data) {
          if (!dateMap.has(pt.date)) dateMap.set(pt.date, {});
          dateMap.get(pt.date)![ticker] = pt.value;
        }
      }

      // Sort dates, filter to start from earliest portfolio date
      const dates = Array.from(dateMap.keys()).sort().filter(d => d >= earliestDate);

      // Forward-fill prices and compute portfolio value at each date
      const lastPrice: Record<string, number> = {};
      const result: { date: string; value: number; cost: number }[] = [];

      for (const d of dates) {
        const prices = dateMap.get(d)!;
        for (const t of allTickers) {
          if (prices[t] !== undefined) lastPrice[t] = prices[t];
        }
        if (Object.keys(lastPrice).length === 0) continue;

        let portfolioVal = 0;
        let costBasis = 0;

        // Stock holdings: value + cost only from buy date onward
        for (const h of holdings) {
          if (d >= h.buyDate && lastPrice[h.ticker] !== undefined) {
            portfolioVal += lastPrice[h.ticker] * h.shares;
            costBasis += h.buyPrice * h.shares;
          }
        }

        // RSU grants: value of shares vested as of this date (zero cost basis)
        for (const { grant, schedule } of rsuSchedules) {
          if (d >= grant.grantDate && lastPrice[grant.ticker] !== undefined) {
            const vestedAtDate = getVestedAt(schedule, d);
            if (vestedAtDate > 0) {
              portfolioVal += lastPrice[grant.ticker] * vestedAtDate;
            }
          }
        }

        result.push({ date: d, value: portfolioVal, cost: costBasis });
      }

      setChartData(result);
      setChartLoading(false);
    })();
    return () => { cancelled = true; };
  }, [allTickers, chartTf, holdings, rsus]);   if (selectedCompany) return <CompanyDetail company={selectedCompany} onClose={() => setSelectedCompany(null)} />;
  if (selectedRsu) return <RsuDetail grant={selectedRsu} currentPrice={getPrice(selectedRsu.ticker)} tax={tax} onClose={() => setSelectedRsu(null)} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500 to-amber-500 flex items-center justify-center text-lg shadow-lg shadow-accent-500/20">💼</div>
        <div>
          <h1 className="text-xl font-bold">My Portfolio</h1>
          <p className="text-xs text-gray-500 mt-0.5">Track your stocks & RSU grants</p>
        </div>
      </div>

      <TabBar
        tabs={[{ id: 'overview', label: 'Overview' }, { id: 'stocks', label: 'Stocks' }, { id: 'rsus', label: 'RSUs' }, { id: 'tax', label: 'Tax' }]}
        active={view}
        onChange={setView}
      />

      {/* ---- OVERVIEW ---- */}
      {view === 'overview' && (
        <div className="space-y-4">
          {/* Portfolio Summary */}
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-br from-accent-500/15 via-transparent to-emerald-500/10 p-5">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Total Value</p>
              <p className="text-4xl font-extrabold tracking-tight">${fmt(totalPortfolio)}</p>
              <p className="text-xs text-gray-500 mt-1">Pre-tax current value</p>
            </div>
            <div className="px-5 pb-4 pt-0">
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-[10px] text-gray-500">Invested</p>
                <p className="text-sm font-semibold">{fmtK(stockTotals.invested)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-500">P&L</p>
                <p className={`text-sm font-semibold ${stockTotals.gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stockTotals.gain >= 0 ? '+' : ''}{fmtK(stockTotals.gain)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-500">After Tax</p>
                <p className="text-sm font-semibold text-accent-400">{fmtK(totalAfterTax)}</p>
              </div>
            </div>
            </div>
          </div>

          {/* Portfolio Chart */}
          {allTickers.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                <div className="flex gap-1">
                  <button onClick={() => setChartMode('value')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                      chartMode === 'value' ? 'bg-accent-500/20 text-accent-400' : 'text-gray-500 hover:text-gray-300'
                    }`}>Value</button>
                  <button onClick={() => setChartMode('profit')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                      chartMode === 'profit' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-500 hover:text-gray-300'
                    }`}>Profit</button>
                </div>
                <div className="flex gap-0.5">
                  {(['1W', '1M', '6M', '1Y', 'ALL'] as Timeframe[]).map(tf => (
                    <button key={tf} onClick={() => setChartTf(tf)}
                      className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                        chartTf === tf ? 'bg-white/10 text-white' : 'text-gray-600 hover:text-gray-400'
                      }`}>{tf}</button>
                  ))}
                </div>
              </div>
              <div className="h-52 px-1 pb-2">
                {chartLoading ? (
                  <div className="h-full flex items-center justify-center text-gray-600 text-xs">Loading chart...</div>
                ) : chartData.length > 0 ? (() => {
                  const displayData = chartMode === 'profit'
                    ? chartData.map(d => ({ date: d.date, value: d.value - d.cost }))
                    : chartData.map(d => ({ date: d.date, value: d.value }));
                  const values = displayData.map(d => d.value);
                  const minVal = Math.min(...values);
                  const maxVal = Math.max(...values);
                  const padding = (maxVal - minVal) * 0.05 || 1;
                  const yMin = minVal - padding;
                  const yMax = maxVal + padding;
                  const isPositive = displayData.length > 0 && displayData[displayData.length - 1].value >= (chartMode === 'profit' ? 0 : displayData[0].value);
                  const color = isPositive ? '#34d399' : '#f87171';
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={displayData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: '#6b7280', fontSize: 9 }}
                          tickLine={false}
                          axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                          interval="preserveStartEnd"
                          tickFormatter={(d: string) => {
                            if (!d) return '';
                            const parts = d.includes('T') ? d.split('T')[0].split('-') : d.split('-');
                            if (parts.length < 3) return d;
                            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                            const m = parseInt(parts[1], 10) - 1;
                            const day = parseInt(parts[2], 10);
                            if (chartTf === '1W' || chartTf === '1M') return `${months[m]} ${day}`;
                            return `${months[m]} '${parts[0].slice(2)}`;
                          }}
                          minTickGap={45}
                        />
                        <YAxis
                          domain={[yMin, yMax]}
                          tick={{ fill: '#6b7280', fontSize: 9 }}
                          tickLine={false}
                          axisLine={false}
                          width={55}
                          tickFormatter={(v: number) => {
                            if (chartMode === 'profit') {
                              const sign = v >= 0 ? '+' : '-';
                              const abs = Math.abs(v);
                              return abs >= 1000 ? `${sign}$${(abs / 1000).toFixed(1)}K` : `${sign}$${abs.toFixed(0)}`;
                            }
                            return v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v.toFixed(0)}`;
                          }}
                          tickCount={5}
                        />
                        <Tooltip
                          contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
                          labelStyle={{ color: '#9ca3af', fontSize: '10px' }}
                          formatter={(v: number) => [chartMode === 'profit' ? `${v >= 0 ? '+' : ''}$${fmt(v)}` : `$${fmt(v)}`, chartMode === 'profit' ? 'P&L' : 'Value']}
                        />
                        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill="url(#portfolioGrad)" dot={false} />
                        {chartMode === 'profit' && <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />}
                      </AreaChart>
                    </ResponsiveContainer>
                  );
                })() : (
                  <div className="h-full flex items-center justify-center text-gray-600 text-xs">No data</div>
                )}
              </div>
            </div>
          )}

          {/* Stock + RSU split */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3 text-center">
              <p className="text-[10px] text-gray-500">Stocks</p>
              <p className="text-lg font-bold">{fmtK(stockTotals.current)}</p>
              {stockTotals.invested > 0 && <ChangeIndicator value={stockTotals.gainPct} />}
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-gray-500">RSUs (vested)</p>
              <p className="text-lg font-bold">{fmtK(rsuTotals.currentVested)}</p>
              {rsuTotals.totalUnvested > 0 && <p className="text-[10px] text-gray-500">+{fmtK(rsuTotals.totalUnvested)} unvested</p>}
            </div>
          </div>

          {/* Holdings widgets */}
          {holdings.length > 0 && (
            <div>
              <SectionHeader title="My Stocks" />
              <div className="space-y-2">
                {holdings.map(h => {
                  const price = getPrice(h.ticker);
                  const gain = (price - h.buyPrice) * h.shares;
                  const gainPct = h.buyPrice > 0 ? ((price - h.buyPrice) / h.buyPrice) * 100 : 0;
                  return (
                    <button key={h.id} onClick={() => {
                      const c = companies.find(c => c.ticker === h.ticker);
                      if (c) setSelectedCompany(c);
                    }} className="card w-full text-left px-4 py-3 flex items-center gap-3 active:scale-[0.98] transition-transform">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-500/20 to-accent-500/5 flex items-center justify-center text-xs font-bold text-accent-400 shrink-0">
                        {h.ticker.slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{h.ticker}</span>
                          <span className="text-sm font-mono">${price > 0 ? fmt(price) : '—'}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[10px] text-gray-500 truncate">{h.shares} shares · avg ${fmt(h.buyPrice)}</span>
                          <span className={`text-[11px] font-semibold ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {gain >= 0 ? '+' : ''}{fmtK(gain)} ({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* RSU widgets */}
          {rsus.length > 0 && (
            <div>
              <SectionHeader title="My RSUs" />
              <div className="space-y-2">
                {rsus.map(g => {
                  const price = getPrice(g.ticker);
                  const vested = portfolioService.getVestedShares(g);
                  const pctVested = (vested / g.totalShares) * 100;
                  return (
                    <button key={g.id} onClick={() => setSelectedRsu(g)}
                      className="card w-full text-left px-4 py-3 flex items-center gap-3 active:scale-[0.98] transition-transform">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center text-xs font-bold text-violet-400 shrink-0">
                        {g.ticker.slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{g.ticker}</span>
                          <span className="text-sm font-mono">${price > 0 ? fmt(price) : '—'}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[10px] text-gray-500">{vested}/{g.totalShares} vested</span>
                          <span className="text-[10px] text-gray-500">{pctVested.toFixed(0)}%</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full mt-1.5 overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pctVested}%` }} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {holdings.length === 0 && rsus.length === 0 && (
            <div className="card p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-500/20 to-emerald-500/10 flex items-center justify-center text-2xl mx-auto mb-4">📊</div>
              <p className="text-gray-400 text-sm font-medium mb-1">Start building your portfolio</p>
              <p className="text-gray-600 text-xs mb-4">Add stocks or RSU grants to track performance and taxes</p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => { setView('stocks'); setShowAddStock(true); }} className="btn-primary text-xs px-4 py-2">+ Add Stock</button>
                <button onClick={() => { setView('rsus'); setShowAddRsu(true); }} className="btn-secondary text-xs px-4 py-2">+ Add RSU</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- STOCKS ---- */}
      {view === 'stocks' && (
        <div className="space-y-3">
          <button onClick={() => setShowAddStock(!showAddStock)}
            className="w-full py-2.5 rounded-xl text-xs font-medium text-accent-400 bg-accent-500/10 border border-accent-500/20 active:scale-[0.98] transition-all">
            {showAddStock ? 'Cancel' : '+ Add Stock Holding'}
          </button>

          {showAddStock && <AddStockForm onAdd={addHolding} onCancel={() => setShowAddStock(false)} />}

          {holdings.length === 0 && !showAddStock && (
            <p className="text-center text-gray-600 text-sm py-8">No stock holdings added yet</p>
          )}

          {holdings.map(h => {
            const price = getPrice(h.ticker);
            const currentVal = price * h.shares;
            const investedVal = h.buyPrice * h.shares;
            const gain = currentVal - investedVal;
            const gainPct = investedVal > 0 ? (gain / investedVal) * 100 : 0;
            const taxInfo = portfolioService.calcStockTax(h, price, tax);
            return (
              <div key={h.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <button onClick={() => {
                    const c = companies.find(c => c.ticker === h.ticker);
                    if (c) setSelectedCompany(c);
                  }} className="text-left">
                    <span className="text-sm font-bold text-accent-400">{h.ticker}</span>
                    <span className="text-xs text-gray-500 ml-2">{h.name}</span>
                  </button>
                  <button onClick={() => removeHolding(h.id)} className="text-[10px] text-red-400/60 hover:text-red-400">Remove</button>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-gray-500">Shares</p>
                    <p className="text-xs font-semibold">{h.shares}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Avg Cost</p>
                    <p className="text-xs font-mono">${fmt(h.buyPrice)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Current</p>
                    <p className="text-xs font-mono">${price > 0 ? fmt(price) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">P&L</p>
                    <p className={`text-xs font-semibold ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {gain >= 0 ? '+' : ''}{fmtK(gain)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">Value: ${fmt(currentVal)}</span>
                    <ChangeIndicator value={gainPct} />
                  </div>
                  <span className="text-[10px] text-gray-500">After tax: <span className="text-accent-400">${fmt(taxInfo.afterTax)}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- RSUs ---- */}
      {view === 'rsus' && (
        <div className="space-y-3">
          <button onClick={() => setShowAddRsu(!showAddRsu)}
            className="w-full py-2.5 rounded-xl text-xs font-medium text-accent-400 bg-accent-500/10 border border-accent-500/20 active:scale-[0.98] transition-all">
            {showAddRsu ? 'Cancel' : '+ Add RSU Grant'}
          </button>

          {showAddRsu && <AddRsuForm onAdd={addRsu} onCancel={() => setShowAddRsu(false)} />}

          {rsus.length === 0 && !showAddRsu && (
            <p className="text-center text-gray-600 text-sm py-8">No RSU grants added yet</p>
          )}

          {rsus.map(g => {
            const price = getPrice(g.ticker);
            const vested = portfolioService.getVestedShares(g);
            const unvested = g.totalShares - vested;
            const vestedValue = price * vested;
            const taxCalc = portfolioService.calcRsuTax(g, price, vested, tax);
            const pctVested = (vested / g.totalShares) * 100;
            return (
              <button key={g.id} onClick={() => setSelectedRsu(g)}
                className="card p-4 w-full text-left active:scale-[0.98] transition-transform">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-bold text-accent-400">{g.ticker}</span>
                    <span className="text-xs text-gray-500 ml-2">{g.name}</span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removeRsu(g.id); }}
                    className="text-[10px] text-red-400/60 hover:text-red-400">Remove</button>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center mb-2">
                  <div>
                    <p className="text-[10px] text-gray-500">Total</p>
                    <p className="text-xs font-semibold">{g.totalShares}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Vested</p>
                    <p className="text-xs font-semibold text-emerald-400">{vested}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Unvested</p>
                    <p className="text-xs font-semibold text-amber-400">{unvested}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Grant $</p>
                    <p className="text-xs font-mono">${fmt(g.grantPrice)}</p>
                  </div>
                </div>
                {/* Vesting progress bar */}
                <div className="mb-2">
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pctVested}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">{pctVested.toFixed(0)}% vested · {g.vestingFrequencyMonths}mo frequency · {g.vestingYears}yr schedule</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-[10px] text-gray-500">Vested value: <span className="text-white font-semibold">${fmt(vestedValue)}</span></span>
                  <span className="text-[10px] text-gray-500">After tax: <span className="text-accent-400">${fmt(taxCalc.afterTax)}</span></span>
                </div>
                <p className="text-[10px] text-gray-600 mt-1">Tap for full vesting schedule →</p>
              </button>
            );
          })}
        </div>
      )}

      {/* ---- TAX ---- */}
      {view === 'tax' && (
        <div className="space-y-4">
          <TaxSettingsForm tax={tax} onChange={setTax} />

          {(holdings.length > 0 || rsus.length > 0) && (
            <div className="card p-4">
              <SectionHeader title="Tax Summary" />
              <div className="space-y-3">
                {holdings.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase mb-2">Stock Holdings</p>
                    {holdings.map(h => {
                      const price = getPrice(h.ticker);
                      const t = portfolioService.calcStockTax(h, price, tax);
                      const buyDate = new Date(h.buyDate);
                      const isLT = (Date.now() - buyDate.getTime()) > 365.25 * 24 * 60 * 60 * 1000;
                      return (
                        <div key={h.id} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0">
                          <div>
                            <span className="font-semibold">{h.ticker}</span>
                            <span className="text-[10px] text-gray-500 ml-1">{isLT ? 'Long-term' : 'Short-term'}</span>
                          </div>
                          <div className="text-right">
                            <span className={t.gain >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {t.gain >= 0 ? '+' : ''}${fmt(t.gain)}
                            </span>
                            <span className="text-gray-500 ml-2">Tax: ${fmt(t.taxAmount)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {rsus.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase mb-2">RSU Grants (vested only)</p>
                    {rsus.map(g => {
                      const price = getPrice(g.ticker);
                      const vested = portfolioService.getVestedShares(g);
                      const t = portfolioService.calcRsuTax(g, price, vested, tax);
                      return (
                        <div key={g.id} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0">
                          <div>
                            <span className="font-semibold">{g.ticker}</span>
                            <span className="text-[10px] text-gray-500 ml-1">{vested} vested</span>
                          </div>
                          <div className="text-right">
                            <span className="text-gray-400">Inc: ${fmt(t.incomeTax)}</span>
                            <span className="text-gray-400 ml-1">CG: ${fmt(t.capGainTax)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="border-t border-white/10 pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Pre-Tax Value</span>
                    <span className="font-semibold">${fmt(totalPortfolio)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-400">Est. Total Tax</span>
                    <span className="text-red-400 font-semibold">-${fmt(totalPortfolio - totalAfterTax)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="font-semibold">After-Tax Value</span>
                    <span className="text-emerald-400 font-bold">${fmt(totalAfterTax)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
