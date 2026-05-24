import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { virtualPortfolioService, VirtualPosition, VirtualTransaction } from '../services/virtualPortfolioService';
import { portfolioService } from '../services/portfolioService';
import { customStocksService } from '../services/customStocksService';
import { useMarketData } from '../components/MarketDataContext';
import { buildStockIndex, searchStockIndex, IndexedStock, aiResolveStock } from '../services/stockIndexService';
import { historicalPriceService } from '../services/historicalPriceService';
import { yahooFinance } from '../services/yahooFinance';
import { Company, Timeframe } from '../models/types';
import { ChangeIndicator } from '../components/SharedComponents';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';

function fmt(n: number, digits = 2) {
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtCompact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${fmt(n)}`;
}

interface PickItem { ticker: string; name: string; price: number; }

export default function VirtualPortfolioPanel() {
  const { companies } = useMarketData();
  const [positions, setPositions] = useState<VirtualPosition[]>(() => virtualPortfolioService.openPositions());
  const [transactions, setTransactions] = useState<VirtualTransaction[]>(() => virtualPortfolioService.transactions());
  const [search, setSearch] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [trade, setTrade] = useState<{ ticker: string; name: string; price: number; side: 'buy' | 'sell' } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [chartTf, setChartTf] = useState<Timeframe>('1M');
  const [equityCurve, setEquityCurve] = useState<Array<{ date: string; value: number; invested: number }>>([]);
  const [perStockHist, setPerStockHist] = useState<Record<string, Array<{ date: string; price: number }>>>({});

  // Helpers ------------------------------------------------------------------
  const refresh = useCallback(() => {
    setPositions(virtualPortfolioService.openPositions());
    setTransactions(virtualPortfolioService.transactions());
  }, []);

  const watchlistTickers = useMemo(() => portfolioService.getWatchlist(), []);
  const customStocks = useMemo(() => customStocksService.list(), []);

  // Merge companies + custom for the picker
  const knownCompanies = useMemo<Company[]>(() => {
    const map = new Map<string, Company>();
    for (const c of companies) map.set(c.ticker, c);
    for (const c of customStocks) if (!map.has(c.ticker)) map.set(c.ticker, c);
    return [...map.values()];
  }, [companies, customStocks]);

  const tickerToCompany = useMemo(() => {
    const m = new Map<string, Company>();
    for (const c of knownCompanies) m.set(c.ticker, c);
    return m;
  }, [knownCompanies]);

  // Current price helper — fall back to last transaction price if unknown.
  const lastTxPrice = useCallback((ticker: string) => {
    const t = transactions.find(x => x.ticker === ticker);
    return t?.price ?? 0;
  }, [transactions]);

  const currentPrice = useCallback((ticker: string) => {
    return tickerToCompany.get(ticker)?.price ?? lastTxPrice(ticker);
  }, [tickerToCompany, lastTxPrice]);

  // Search index
  const stockIndex = useMemo(() => buildStockIndex(knownCompanies), [knownCompanies]);
  const searchResults = useMemo<IndexedStock[]>(
    () => searchStockIndex(stockIndex, search, 30),
    [stockIndex, search],
  );

  // Quick-pick from watchlist that the user hasn't already added
  const watchlistPickItems = useMemo<PickItem[]>(() => {
    return watchlistTickers
      .map(t => tickerToCompany.get(t))
      .filter((c): c is Company => !!c)
      .map(c => ({ ticker: c.ticker, name: c.name, price: c.price }));
  }, [watchlistTickers, tickerToCompany]);

  // Open trade modal from any source ----------------------------------------
  const openTrade = (ticker: string, name: string, price: number, side: 'buy' | 'sell') => {
    setTrade({ ticker, name, price, side });
  };

  const aiSearchAndPick = useCallback(async () => {
    const q = search.trim();
    if (!q) return;
    setAiBusy(true);
    try {
      const stub = await aiResolveStock(q);
      if (stub) {
        customStocksService.upsert(stub);
        openTrade(stub.ticker, stub.name, stub.price || 0, 'buy');
        setSearch('');
      }
    } finally {
      setAiBusy(false);
    }
  }, [search]);

  // Aggregates --------------------------------------------------------------
  const totals = useMemo(() => {
    let value = 0, cost = 0;
    for (const p of positions) {
      const px = currentPrice(p.ticker);
      value += p.shares * px;
      cost += p.totalInvested;
    }
    const realised = virtualPortfolioService.allPositions().reduce((s, p) => s + p.realizedPL, 0);
    const unrealised = value - cost;
    return { value, cost, realised, unrealised, total: realised + unrealised };
  }, [positions, currentPrice]);

  // Load price history for the equity curve --------------------------------
  useEffect(() => {
    if (positions.length === 0 && transactions.length === 0) {
      setEquityCurve([]);
      setPerStockHist({});
      return;
    }
    let cancelled = false;
    (async () => {
      const tickers = Array.from(new Set([
        ...positions.map(p => p.ticker),
        ...transactions.map(t => t.ticker),
      ]));
      const map: Record<string, Array<{ date: string; price: number }>> = {};
      await Promise.all(tickers.map(async (tk) => {
        try {
          const live = tickerToCompany.get(tk);
          let pts = await yahooFinance.getChart(tk, chartTf).catch(() => [] as Array<{ date: string; value: number }>);
          if (!pts || pts.length === 0) {
            pts = historicalPriceService.getHistory(tk, chartTf);
          }
          map[tk] = pts.map(p => ({ date: p.date, price: p.value }));
        } catch {
          map[tk] = [];
        }
      }));
      if (cancelled) return;
      setPerStockHist(map);
      setEquityCurve(virtualPortfolioService.equityCurve(map));
    })();
    return () => { cancelled = true; };
  }, [positions, transactions, chartTf, tickerToCompany]);

  // Render -----------------------------------------------------------------
  const isPositive = totals.total >= 0;
  const totalPL = totals.total;
  const totalPLPct = totals.cost > 0 ? (totals.unrealised / totals.cost) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Search / Add — at the very top */}
      <SearchBar
        search={search}
        setSearch={setSearch}
        searchResults={searchResults}
        watchlistPickItems={watchlistPickItems}
        aiBusy={aiBusy}
        onAiSearch={aiSearchAndPick}
        onPick={(t, n, p) => openTrade(t, n, p, 'buy')}
      />

      {/* Summary hero */}
      <div className="card overflow-hidden">
        <div className={`p-5 bg-gradient-to-br ${isPositive
          ? 'from-emerald-500/15 via-transparent to-accent-500/10'
          : 'from-red-500/15 via-transparent to-accent-500/10'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-widest text-gray-500">Virtual Portfolio</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-accent-500/15 text-accent-300 font-semibold">PAPER</span>
          </div>
          <p className="text-4xl font-extrabold tracking-tight">${fmt(totals.value)}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className={`text-sm font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalPL >= 0 ? '+' : ''}{fmtCompact(totalPL)}
            </span>
            {totals.cost > 0 && (
              <ChangeIndicator value={totalPLPct} />
            )}
            <span className="text-[10px] text-gray-500">vs ${fmt(totals.cost)} invested</span>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/5 border-t border-white/5 bg-white/[0.02]">
          <Stat label="Open Value" value={fmtCompact(totals.value)} />
          <Stat label="Unrealised" value={fmtCompact(totals.unrealised)} color={totals.unrealised >= 0 ? 'text-emerald-400' : 'text-red-400'} />
          <Stat label="Realised" value={fmtCompact(totals.realised)} color={totals.realised >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        </div>
      </div>

      {/* Equity curve */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-300">Portfolio Value Over Time</h3>
          <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
            {(['1W', '1M', '3M', '1Y'] as Timeframe[]).map(tf => (
              <button key={tf} onClick={() => setChartTf(tf)}
                className={`px-2 py-0.5 text-[10px] rounded-md font-semibold transition-colors ${
                  chartTf === tf ? 'bg-accent-500/30 text-accent-200' : 'text-gray-500'
                }`}>{tf}</button>
            ))}
          </div>
        </div>
        {equityCurve.length < 2 ? (
          <div className="h-40 flex items-center justify-center text-xs text-gray-500">
            {transactions.length === 0
              ? 'Buy your first stock to start tracking performance.'
              : 'Building chart…'}
          </div>
        ) : (
          <div className="h-44">
            <ResponsiveContainer>
              <AreaChart data={equityCurve}>
                <defs>
                  <linearGradient id="vp-grad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b7280' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} domain={['auto', 'auto']} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#131c2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number, name: string) => [`$${fmt(v)}`, name === 'value' ? 'Value' : 'Cost']}
                />
                <ReferenceLine y={totals.cost} stroke="#6b7280" strokeDasharray="3 3" strokeWidth={1} />
                <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} fill="url(#vp-grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Holdings */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Holdings</h3>
          <span className="text-[10px] text-gray-500">{positions.length} position{positions.length === 1 ? '' : 's'}</span>
        </div>

        {positions.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-6">
            No open positions yet. Search a stock above or tap one from your watchlist.
          </p>
        ) : (
          <div className="space-y-2">
            {positions.map(p => {
              const px = currentPrice(p.ticker);
              const mv = px * p.shares;
              const pl = mv - p.totalInvested;
              const plPct = p.totalInvested > 0 ? (pl / p.totalInvested) * 100 : 0;
              const isOpen = expanded === p.ticker;
              const hist = perStockHist[p.ticker] ?? [];
              return (
                <div key={p.ticker} className="rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
                  <button onClick={() => setExpanded(isOpen ? null : p.ticker)}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                    className="w-full flex items-center gap-3 px-3 py-3 active:bg-white/5 text-left">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500/20 to-accent-500/5 flex items-center justify-center text-xs font-bold text-accent-400 shrink-0">{p.ticker.slice(0, 2)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{p.ticker}</span>
                        <span className="text-[10px] text-gray-500 truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                        <span>{fmt(p.shares, 4).replace(/\.?0+$/, '')} sh</span>
                        <span className="text-gray-600">@</span>
                        <span>${fmt(p.avgCost)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono font-semibold">${fmt(mv)}</div>
                      <div className={`text-[11px] font-semibold ${pl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pl >= 0 ? '+' : ''}${fmt(pl)} ({plPct >= 0 ? '+' : ''}{plPct.toFixed(1)}%)
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 border-t border-white/5 bg-black/20 space-y-3">
                      {hist.length > 1 && (
                        <div className="h-28">
                          <ResponsiveContainer>
                            <LineChart data={hist}>
                              <XAxis dataKey="date" hide />
                              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#6b7280' }} tickFormatter={v => `$${v}`} width={40} />
                              <Tooltip contentStyle={{ background: '#131c2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [`$${fmt(v)}`, 'Price']} />
                              <ReferenceLine y={p.avgCost} stroke="#9ca3af" strokeDasharray="3 3" label={{ value: 'Cost', position: 'right', fill: '#9ca3af', fontSize: 9 }} />
                              <Line type="monotone" dataKey="price" stroke={pl >= 0 ? '#10b981' : '#ef4444'} strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2 text-[10px]">
                        <Mini label="Current" value={`$${fmt(px)}`} />
                        <Mini label="Cost basis" value={`$${fmt(p.totalInvested)}`} />
                        <Mini label="Realised" value={`${p.realizedPL >= 0 ? '+' : ''}$${fmt(p.realizedPL)}`} color={p.realizedPL >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => openTrade(p.ticker, p.name, px, 'buy')}
                          className="flex-1 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-semibold active:bg-emerald-500/25">
                          + Buy More
                        </button>
                        <button onClick={() => openTrade(p.ticker, p.name, px, 'sell')}
                          className="flex-1 py-2 rounded-lg bg-red-500/15 text-red-300 text-xs font-semibold active:bg-red-500/25">
                          − Sell
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent transactions */}
      {transactions.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Transactions</h3>
            <button onClick={() => {
              if (confirm('Reset the entire virtual portfolio? This deletes all paper trades.')) {
                virtualPortfolioService.reset();
                refresh();
              }
            }} className="text-[10px] text-gray-500 hover:text-red-400">Reset</button>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {transactions.slice(0, 50).map(t => (
              <div key={t.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg bg-white/[0.02]">
                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold tracking-wide ${
                  t.side === 'buy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>{t.side.toUpperCase()}</span>
                <span className="text-xs font-semibold text-accent-300">{t.ticker}</span>
                <span className="text-[11px] text-gray-300 flex-1">
                  {fmt(t.shares, 4).replace(/\.?0+$/, '')} × ${fmt(t.price)}
                </span>
                <span className="text-[10px] text-gray-500">{new Date(t.date).toLocaleDateString()}</span>
                <button onClick={() => { virtualPortfolioService.deleteTransaction(t.id); refresh(); }}
                  className="text-gray-600 hover:text-red-400 text-xs px-1">×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade modal */}
      {trade && (
        <TradeModal
          ticker={trade.ticker}
          name={trade.name}
          price={trade.price}
          side={trade.side}
          maxShares={trade.side === 'sell' ? (positions.find(p => p.ticker === trade.ticker)?.shares ?? 0) : Infinity}
          onClose={() => setTrade(null)}
          onConfirm={(n) => {
            if (trade.side === 'buy') {
              virtualPortfolioService.buy(trade.ticker, trade.name, n, trade.price);
            } else {
              virtualPortfolioService.sell(trade.ticker, trade.name, n, trade.price);
            }
            refresh();
            setTrade(null);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-3">
      <p className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${color ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="card-compact p-2">
      <p className="text-[9px] text-gray-500">{label}</p>
      <p className={`text-xs font-semibold mt-0.5 ${color ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

function SearchBar({ search, setSearch, searchResults, watchlistPickItems, aiBusy, onAiSearch, onPick }: {
  search: string;
  setSearch: (s: string) => void;
  searchResults: IndexedStock[];
  watchlistPickItems: PickItem[];
  aiBusy: boolean;
  onAiSearch: () => void;
  onPick: (ticker: string, name: string, price: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close dropdown when tapping outside
  useEffect(() => {
    if (!focused) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [focused]);

  const showDropdown = focused || search.trim() !== '';
  const hasQuery = search.trim() !== '';

  const pick = (ticker: string, name: string, price: number) => {
    setFocused(false);
    setSearch('');
    onPick(ticker, name, price);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Search stock..."
          className="input-field pl-9 pr-9"
        />
        {search && (
          <button
            onClick={() => { setSearch(''); setFocused(true); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/5 active:bg-white/15 flex items-center justify-center text-gray-400 text-xs"
          >×</button>
        )}
      </div>

      {showDropdown && (
        <div
          onMouseDown={e => e.preventDefault()}
          className="absolute left-0 right-0 top-full mt-2 z-30 bg-surface-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          <div className="max-h-[60vh] overflow-y-auto">
            {/* Watchlist (only when no query) */}
            {!hasQuery && watchlistPickItems.length > 0 && (
              <div className="p-2">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold px-2 pt-1 pb-1.5">From your watchlist</p>
                <div className="space-y-1">
                  {watchlistPickItems.map(i => (
                    <button key={i.ticker}
                      onClick={() => pick(i.ticker, i.name, i.price)}
                      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg active:bg-accent-500/20 text-left transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-accent-500/15 flex items-center justify-center text-[10px] font-bold text-accent-300 shrink-0">{i.ticker.slice(0, 2)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{i.ticker}</span>
                          <span className="text-[10px] text-gray-500 truncate">{i.name}</span>
                        </div>
                        {i.price > 0 && <span className="text-[11px] font-mono text-gray-400">${i.price.toFixed(2)}</span>}
                      </div>
                      <span className="text-[10px] text-emerald-400">+ Buy</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No watchlist + no query state */}
            {!hasQuery && watchlistPickItems.length === 0 && (
              <p className="p-4 text-xs text-gray-500 text-center">
                Start typing a ticker, or add stocks to your watchlist for quick access.
              </p>
            )}

            {/* Query results */}
            {hasQuery && (
              searchResults.length > 0 ? (
                <div className="p-2 space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold px-2 pt-1 pb-1.5">
                    {searchResults.length} match{searchResults.length === 1 ? '' : 'es'}
                  </p>
                  {searchResults.map(s => (
                    <button key={s.ticker}
                      onClick={() => pick(s.ticker, s.name, s.price ?? 0)}
                      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg active:bg-accent-500/20 text-left transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-accent-500/15 flex items-center justify-center text-[10px] font-bold text-accent-300 shrink-0">{s.ticker.slice(0, 2)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{s.ticker}</span>
                          <span className="text-[10px] text-gray-500 truncate">{s.name}</span>
                        </div>
                        {typeof s.price === 'number' && s.price > 0 && (
                          <span className="text-[11px] font-mono text-gray-400">${s.price.toFixed(2)}</span>
                        )}
                      </div>
                      <span className="text-[10px] text-emerald-400">+ Buy</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-500 mb-2">No matches in app data.</p>
                  <button onClick={onAiSearch} disabled={aiBusy}
                    className="px-3 py-1.5 rounded-lg bg-accent-500/20 text-accent-300 text-xs font-semibold disabled:opacity-50">
                    {aiBusy ? 'Searching…' : '🤖 AI Search & Trade'}
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TradeModal({ ticker, name, price, side, maxShares, onClose, onConfirm }: {
  ticker: string;
  name: string;
  price: number;
  side: 'buy' | 'sell';
  maxShares: number;
  onClose: () => void;
  onConfirm: (shares: number) => void;
}) {
  // Two synced fields: shares (whole integers) and dollar amount.
  // `lastEdited` tracks which one the user typed in so the other one is derived.
  const [sharesStr, setSharesStr] = useState('');
  const [dollarsStr, setDollarsStr] = useState('');
  const [lastEdited, setLastEdited] = useState<'shares' | 'dollars'>('shares');
  const sharesRef = useRef<HTMLInputElement>(null);
  const dollarsRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Track keyboard via visualViewport so the dialog can stay vertically
  // centred above the keyboard instead of behind it.
  const [vv, setVv] = useState({ top: 0, height: typeof window !== 'undefined' ? window.innerHeight : 800 });
  useEffect(() => {
    const v = window.visualViewport;
    if (!v) return;
    const update = () => setVv({ top: v.offsetTop, height: v.height });
    update();
    v.addEventListener('resize', update);
    v.addEventListener('scroll', update);
    return () => {
      v.removeEventListener('resize', update);
      v.removeEventListener('scroll', update);
    };
  }, []);

  const isBuy = side === 'buy';
  const sharesNum = Math.max(0, Math.floor(Number(sharesStr) || 0));
  const dollarsNum = Math.max(0, Number(dollarsStr) || 0);

  // Derived value for the "confirm" button.
  const finalShares = sharesNum;
  const finalTotal = finalShares * price;
  const cap = isBuy ? Infinity : maxShares;
  const valid = finalShares > 0 && finalShares <= cap && price > 0;

  const onSharesChange = (raw: string) => {
    // Whole shares only — strip everything non-digit
    const cleaned = raw.replace(/\D/g, '');
    setSharesStr(cleaned);
    setLastEdited('shares');
    if (cleaned === '') { setDollarsStr(''); return; }
    const n = Number(cleaned);
    setDollarsStr(price > 0 ? (n * price).toFixed(2) : '');
  };

  const onDollarsChange = (raw: string) => {
    // Allow digits + one decimal
    const cleaned = raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setDollarsStr(cleaned);
    setLastEdited('dollars');
    if (cleaned === '' || price <= 0) { setSharesStr(''); return; }
    const dollars = Number(cleaned);
    const shares = Math.floor(dollars / price);
    setSharesStr(shares > 0 ? String(shares) : '');
  };

  const setMaxFraction = (frac: number) => {
    if (cap === Infinity || cap <= 0) return;
    const shares = Math.floor(cap * frac);
    setSharesStr(String(shares));
    setDollarsStr((shares * price).toFixed(2));
    setLastEdited('shares');
  };

  // Centred dialog. We compute the centre based on the visible viewport
  // (so it stays nicely placed even when the iOS keyboard is up).
  const dialogStyle: React.CSSProperties = {
    position: 'fixed',
    left: '50%',
    top: vv.top + vv.height / 2,
    transform: 'translate(-50%, -50%)',
    width: 'calc(100% - 24px)',
    maxWidth: 420,
    maxHeight: vv.height - 24,
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        onClick={e => e.stopPropagation()}
        style={dialogStyle}
        className="bg-surface-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className={`p-4 border-b border-white/5 bg-gradient-to-r ${
          isBuy ? 'from-emerald-500/15' : 'from-red-500/15'
        } to-transparent shrink-0`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">{isBuy ? 'Buy' : 'Sell'}</p>
              <h3 className="text-base font-bold">{ticker} <span className="text-xs font-normal text-gray-500">{name}</span></h3>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 active:bg-white/10 flex items-center justify-center text-gray-400">×</button>
          </div>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Market price</span>
            <span className="font-mono">${fmt(price)}</span>
          </div>
          {!isBuy && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">You hold</span>
              <span className="font-mono">{Math.floor(maxShares)} sh</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Shares (whole)</label>
              <input
                ref={sharesRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                enterKeyHint="done"
                autoComplete="off"
                value={sharesStr}
                onChange={e => onSharesChange(e.target.value)}
                placeholder="0"
                className="input-field text-lg font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Amount ($)</label>
              <input
                ref={dollarsRef}
                type="text"
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
                value={dollarsStr}
                onChange={e => onDollarsChange(e.target.value)}
                placeholder="0.00"
                className="input-field text-lg font-mono"
              />
            </div>
          </div>

          {!isBuy && cap !== Infinity && cap > 0 && (
            <div className="flex gap-1">
              {[0.25, 0.5, 0.75, 1].map(frac => (
                <button key={frac} onClick={() => setMaxFraction(frac)}
                  className="flex-1 py-1.5 rounded-md bg-white/5 active:bg-white/10 text-[10px] text-gray-300">
                  {frac === 1 ? 'Max' : `${frac * 100}%`}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-white/5">
            <span className="text-xs text-gray-400">Estimated total</span>
            <span className="text-base font-mono font-semibold">${fmt(finalTotal)}</span>
          </div>

          {finalShares > 0 && lastEdited === 'dollars' && dollarsNum > 0 && Math.abs(dollarsNum - finalTotal) > 0.005 && (
            <p className="text-[10px] text-gray-500 -mt-1">
              Rounded down to {finalShares} whole share{finalShares === 1 ? '' : 's'} (${fmt(finalTotal)}).
            </p>
          )}

          <button
            disabled={!valid}
            onClick={() => onConfirm(finalShares)}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              isBuy ? 'bg-emerald-500/30 text-emerald-200 active:bg-emerald-500/40' : 'bg-red-500/30 text-red-200 active:bg-red-500/40'
            }`}
          >
            {price <= 0 ? 'No price available' : `Confirm ${isBuy ? 'Buy' : 'Sell'} · ${finalShares || 0} sh`}
          </button>
          <p className="text-[10px] text-gray-600 text-center">Paper trade — no real money is involved.</p>
        </div>
      </div>
    </div>
  );
}
