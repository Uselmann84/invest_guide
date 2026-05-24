import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { riskEngine } from '../services/riskEngine';
import { historicalPriceService } from '../services/historicalPriceService';
import { portfolioService } from '../services/portfolioService';
import { ChangeIndicator, MiniSparkline, ScoreBar, SectionHeader, TabBar, Disclaimer, MarkdownContent } from '../components/SharedComponents';
import { Company, Timeframe, PricePoint } from '../models/types';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Area, AreaChart } from 'recharts';
import { useMarketData } from '../components/MarketDataContext';
import { yahooFinance } from '../services/yahooFinance';
import { mockInstitutions } from '../data/mockInstitutions';
import { aiAgentService } from '../services/aiAgentService';
import { useEdgeSwipeClose } from '../hooks/useEdgeSwipeClose';
import { useNavigation, useNavRequest } from '../components/NavigationContext';
import { buildStockIndex, searchStockIndex, toCompany, aiResolveStock, IndexedStock } from '../services/stockIndexService';
import { customStocksService } from '../services/customStocksService';
import { askCacheService } from '../services/askCacheService';

// Cross-component signal so toggling watch anywhere updates the watchlist tab immediately.
const WATCHLIST_EVENT = 'invest_guide:watchlist_changed';
export function emitWatchlistChanged() { try { window.dispatchEvent(new Event(WATCHLIST_EVENT)); } catch {} }

const rankTabs = [
  { id: 'overall', label: 'Top Ranked' },
  { id: 'momentum', label: 'Momentum' },
  { id: 'fundamental', label: 'Fundamentals' },
  { id: 'opportunity', label: 'Opportunity' },
  { id: 'risk', label: 'Lowest Risk' },
];

export function CompanyDetail({ company: initialCompany, onClose, onWatchlistChange }: { company: Company; onClose: () => void; onWatchlistChange?: () => void }) {
  const [company, setCompany] = useState(initialCompany);
  const [inWatchlist, setInWatchlist] = useState(() => portfolioService.isInWatchlist(company.ticker));

  // Fetch live profile data for stub companies (price === 0 means stub)
  React.useEffect(() => {
    if (initialCompany.price !== 0) return;
    let cancelled = false;
    yahooFinance.getProfile(initialCompany.ticker).then(p => {
      if (cancelled || !p.price) return;
      const yearRet = Math.round((p.yearlyReturn ?? 0) * 10) / 10;
      const chgPct = p.changePercent ?? 0;
      const hi = p.fiftyTwoWeekHigh ?? 0;
      const lo = p.fiftyTwoWeekLow ?? 0;
      // Derive scores from available data (0-100 scale)
      const clamp = (v: number) => Math.max(5, Math.min(95, Math.round(v)));
      const momentum = clamp(50 + chgPct * 5 + yearRet * 0.3);
      const priceVs52wk = hi > 0 ? ((p.price! - lo) / (hi - lo)) * 100 : 50;
      const fundamental = clamp(35 + priceVs52wk * 0.3 + (yearRet > 0 ? 15 : 0));
      const valuation = clamp(60 - priceVs52wk * 0.2);
      const risk = clamp(50 - yearRet * 0.3 + (priceVs52wk > 90 ? 15 : 0));
      const opportunity = clamp(40 + yearRet * 0.4 + (priceVs52wk < 40 ? 15 : 0));
      const overall = clamp((momentum + fundamental + valuation + opportunity) / 4);
      const sentiment: Company['analystSentiment'] = overall >= 70 ? 'Buy' : overall >= 55 ? 'Hold' : 'Sell';
      setCompany(prev => ({
        ...prev,
        name: p.name ?? prev.name,
        price: p.price ?? 0,
        change: p.change ?? 0,
        changePercent: chgPct,
        sector: p.sector ?? prev.sector,
        industry: p.industry ?? prev.industry,
        marketCap: p.marketCap ?? 0,
        marketCapLabel: p.marketCapLabel ?? '—',
        revenueGrowth: yearRet, // yearly price return as proxy
        profitMargin: Math.round(priceVs52wk * 10) / 10, // 52wk position as proxy
        debtToEquity: 0,
        summary: p.summary ?? '',
        analystSentiment: sentiment,
        insiderActivity: 'Neutral',
        scores: {
          overall, momentum, fundamental, valuation, risk, opportunity,
          institutionalInterest: clamp(50 + (p.marketCap && p.marketCap > 50e9 ? 20 : p.marketCap && p.marketCap > 10e9 ? 10 : 0)),
          technologyExposure: clamp(p.sector === 'Technology' ? 75 : p.sector === 'Financial Services' ? 55 : p.sector === 'Healthcare' ? 55 : 40),
          marketDemand: clamp(45 + yearRet * 0.4),
          userFit: clamp(overall * 0.9),
        },
      }));
    });
    return () => { cancelled = true; };
  }, [initialCompany.ticker, initialCompany.price]);

  const toggleWatchlist = () => {
    if (inWatchlist) {
      portfolioService.removeFromWatchlist(company.ticker);
    } else {
      // Make sure stub stocks (AI-resolved) stay resolvable in the watchlist.
      if (company.scores.overall === 0) customStocksService.upsert(company);
      portfolioService.addToWatchlist(company.ticker);
    }
    setInWatchlist(!inWatchlist);
    onWatchlistChange?.();
    emitWatchlistChanged();
  };
  const risk = riskEngine.assessCompanyRisk(company);
  const { fetchHistory } = useMarketData();
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [liveData, setLiveData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const fallbackData = useMemo(() => historicalPriceService.getHistory(company.ticker, timeframe, company.price, company.changePercent), [company.ticker, timeframe, company.price, company.changePercent]);
  const rawData = liveData.length > 0 ? liveData : fallbackData;

  // For 1D, prepend previous close so chart baseline matches daily change %
  const priceData = useMemo(() => {
    if (timeframe === '1D' && rawData.length > 0 && company.price > 0) {
      const prevClose = company.price - company.change;
      if (prevClose > 0) return [{ date: 'Prev Close', value: Math.round(prevClose * 100) / 100 }, ...rawData];
    }
    return rawData;
  }, [rawData, timeframe, company.price, company.change]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLiveData([]);
    fetchHistory(company.ticker, timeframe)
      .then(data => { if (!cancelled && data.length) setLiveData(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [timeframe, fetchHistory, company.ticker]);
  const timeframes: { id: Timeframe; label: string }[] = [
    { id: '1D', label: '1D' }, { id: '1W', label: '1W' }, { id: '1M', label: '1M' },
    { id: '6M', label: '6M' }, { id: '1Y', label: '1Y' }, { id: '5Y', label: '5Y' },
    { id: '10Y', label: '10Y' }, { id: 'ALL', label: 'Max' },
  ];
  const chartChange = priceData.length >= 2 ? priceData[priceData.length - 1].value - priceData[0].value : 0;
  const chartChangePercent = priceData.length >= 2 ? (chartChange / priceData[0].value) * 100 : 0;
  const chartColor = chartChange >= 0 ? '#10b981' : '#ef4444';

  // Edge-swipe-to-close
  const rootRef = useRef<HTMLDivElement>(null);
  useEdgeSwipeClose(rootRef, onClose);

  // Cross-page navigation (open institution from inst activity row)
  const nav = useNavigation();

  // Institutional activity for this ticker
  const institutionalActivity = useMemo(() => {
    const rows: { instId: string; instName: string; instType: string; action: 'Buy' | 'Sell' | 'New' | 'Exit'; shares: number; value: string; date: string }[] = [];
    for (const inst of mockInstitutions) {
      for (const t of inst.recentBuys) {
        if (t.ticker === company.ticker) rows.push({ instId: inst.id, instName: inst.name, instType: inst.type, action: t.action, shares: t.shares, value: t.value, date: t.date });
      }
      for (const t of inst.recentSells) {
        if (t.ticker === company.ticker) rows.push({ instId: inst.id, instName: inst.name, instType: inst.type, action: t.action, shares: t.shares, value: t.value, date: t.date });
      }
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  }, [company.ticker]);

  // Ask Agent modal (persisted via askCacheService)
  const [askOpen, setAskOpen] = useState(false);
  const [askLoading, setAskLoading] = useState(false);
  const [askContent, setAskContent] = useState('');

  const openAsk = useCallback(async () => {
    setAskOpen(true);
    const cacheKey = `stock:${company.ticker}`;
    const cached = askCacheService.get(cacheKey);
    if (cached) { setAskContent(cached); return; }
    setAskLoading(true);
    setAskContent('');
    try {
      const prompt = `Provide a detailed company profile for **${company.ticker} — ${company.name}**. Cover:\n1. Business model and main products / revenue segments\n2. Founder(s) and key leadership (names, background, year founded, headquarters)\n3. History and major milestones\n4. Competitive moat and market position\n5. Recent strategic developments and growth drivers\n\nBe factual and concise. Use markdown with bold headers and bullet points.`;
      const res = await aiAgentService.chat(prompt, []);
      askCacheService.set(cacheKey, res.content);
      setAskContent(res.content);
    } catch (err: any) {
      setAskContent(`**Error:** ${err?.message ?? 'Failed to fetch'}`);
    } finally {
      setAskLoading(false);
    }
  }, [company.ticker, company.name]);

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 bg-surface-950 overflow-y-auto">
      {/* Fixed back button bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-surface-950/95 backdrop-blur-xl" style={{ paddingTop: 'env(safe-area-inset-top, 16px)' }}>
        <div className="max-w-lg mx-auto px-4 py-2 flex items-center justify-between">
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">← Back</button>
          <button
            onClick={toggleWatchlist}
            title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm transition-all ${
              inWatchlist
                ? 'bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            <span className="text-base leading-none">{inWatchlist ? '★' : '☆'}</span>
            <span className="text-[11px] font-medium">{inWatchlist ? 'Watching' : 'Watch'}</span>
          </button>
        </div>
      </div>
      <div className="max-w-lg mx-auto p-4 pb-24" style={{ paddingTop: 'calc(env(safe-area-inset-top, 16px) + 44px)' }}>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-accent-500/20 flex items-center justify-center text-lg font-bold text-accent-400">
            {company.ticker.slice(0, 2)}
          </div>
          <div>
            <h2 className="text-lg font-bold">{company.ticker}</h2>
            <p className="text-xs text-gray-500">{company.name}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-lg font-bold">${company.price.toFixed(2)}</p>
            <ChangeIndicator value={chartChangePercent} />
          </div>
        </div>
        {company.summary && (
          <div className="-mt-2 mb-4">
            <p className="text-xs text-gray-400 leading-relaxed">{company.summary}</p>
            <button
              onClick={openAsk}
              className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-accent-500/20 to-purple-500/20 hover:from-accent-500/30 hover:to-purple-500/30 border border-accent-500/30 text-[11px] font-medium text-accent-300 transition-all"
            >
              <span>🤖</span>
              <span>Ask Agent for Details</span>
            </button>
          </div>
        )}
        {!company.summary && (
          <div className="-mt-2 mb-4">
            <button
              onClick={openAsk}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-accent-500/20 to-purple-500/20 hover:from-accent-500/30 hover:to-purple-500/30 border border-accent-500/30 text-[11px] font-medium text-accent-300 transition-all"
            >
              <span>🤖</span>
              <span>Ask Agent for Details</span>
            </button>
          </div>
        )}

        {/* Price Chart */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className={`text-sm font-semibold ${chartChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {chartChange >= 0 ? '+' : ''}{chartChange.toFixed(2)} ({chartChangePercent >= 0 ? '+' : ''}{chartChangePercent.toFixed(2)}%)
              </span>
              <span className="text-[10px] text-gray-500 ml-2">{timeframe}</span>
            </div>
          </div>
          <div className="flex gap-1 mb-3">
            {timeframes.map(tf => (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  timeframe === tf.id
                    ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                    : 'bg-white/5 text-gray-500 hover:text-gray-300'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
          <div className="h-44 relative">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-surface-900/50 rounded-lg">
                <div className="w-5 h-5 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={priceData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id={`grad-${company.ticker}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b7280' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} domain={['auto', 'auto']} tickFormatter={v => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: '#131c2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, 'Price']}
                />
                <Area type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2} fill={`url(#grad-${company.ticker})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {(initialCompany.price === 0 ? [
            { label: 'Market Cap', value: company.marketCapLabel },
            { label: 'Sector', value: company.sector },
            { label: 'Industry', value: company.industry },
            { label: '1Y Return', value: `${company.revenueGrowth > 0 ? '+' : ''}${company.revenueGrowth}%` },
            { label: '52W Position', value: `${company.profitMargin}%` },
            { label: '52W High', value: company.scores.overall > 0 ? `$${((company.price / (1 - company.profitMargin/100)) || 0).toFixed(0)}` : '—' },
            { label: 'Analyst', value: company.analystSentiment },
            { label: 'Exchange', value: 'NYSE/NASDAQ' },
            { label: 'Day Change', value: `${company.changePercent >= 0 ? '+' : ''}${company.changePercent.toFixed(2)}%` },
          ] : [
            { label: 'Market Cap', value: company.marketCapLabel },
            { label: 'Sector', value: company.sector },
            { label: 'Industry', value: company.industry },
            { label: 'Revenue Growth', value: `${company.revenueGrowth}%` },
            { label: 'Profit Margin', value: `${company.profitMargin}%` },
            { label: 'Debt/Equity', value: `${company.debtToEquity}x` },
            { label: 'Analyst', value: company.analystSentiment },
            { label: 'Inst. Ownership', value: `${company.institutionalOwnership}%` },
            { label: 'Insider Activity', value: company.insiderActivity },
          ]).map(m => (
            <div key={m.label} className="card-compact p-2.5">
              <p className="text-[10px] text-gray-500">{m.label}</p>
              <p className="text-xs font-medium text-white mt-0.5">{m.value}</p>
            </div>
          ))}
        </div>

        {/* AI Scores */}
        <div className="card p-4 mb-4">
          <SectionHeader title="AI Scores" />
          {company.scores.overall === 0 && (
            <p className="text-xs text-gray-400 mb-3 -mt-1">
              Analysis pending for this stock. Scores update once we ingest enough market data — usually within a few minutes.
            </p>
          )}
          <div className="space-y-2">
            {[
              { label: 'Overall', value: company.scores.overall },
              { label: 'Momentum', value: company.scores.momentum },
              { label: 'Fundamental', value: company.scores.fundamental },
              { label: 'Valuation', value: company.scores.valuation },
              { label: 'Institutional', value: company.scores.institutionalInterest },
              { label: 'Tech Exposure', value: company.scores.technologyExposure },
              { label: 'Market Demand', value: company.scores.marketDemand },
              { label: 'Risk', value: company.scores.risk },
              { label: 'Opportunity', value: company.scores.opportunity },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-24">{s.label}</span>
                <div className="flex-1"><ScoreBar value={s.value} /></div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Trend Connection */}
        {company.aiTrendConnection.length > 0 && (
          <div className="card p-4 mb-4">
            <SectionHeader title="AI Trend Connection" />
            <div className="flex flex-wrap gap-1.5">
              {company.aiTrendConnection.map(t => <span key={t} className="badge-blue">{t}</span>)}
            </div>
          </div>
        )}

        {/* Institutional Activity */}
        <div className="card p-4 mb-4">
          <SectionHeader title="Institutional Activity" />
          {institutionalActivity.length === 0 ? (
            <p className="text-xs text-gray-500">No recent institutional activity tracked for this ticker.</p>
          ) : (
            <div className="space-y-2">
              {institutionalActivity.map((row, i) => {
                const isBuy = row.action === 'Buy' || row.action === 'New';
                return (
                  <button
                    key={`${row.instId}-${i}`}
                    onClick={() => nav.openInstitution(row.instId)}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                    className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg bg-white/[0.02] active:bg-white/10 border border-white/5 transition-colors duration-75 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-500/40"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                    }`}>
                      {row.instName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white truncate">{row.instName}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold tracking-wide ${
                          isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}>{row.action.toUpperCase()}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">{row.instType} · {row.shares.toLocaleString()} sh · {row.date}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-mono font-semibold ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>{row.value}</p>
                      <p className="text-[9px] text-gray-600">View →</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Risk Assessment */}
        <div className="card p-4 mb-4">
          <SectionHeader title="Risk Assessment" />
          <div className="space-y-2 mb-3">
            {risk.factors.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  f.level === 'Critical' ? 'bg-red-500' : f.level === 'High' ? 'bg-amber-500' : f.level === 'Moderate' ? 'bg-yellow-500' : 'bg-emerald-500'
                }`} />
                <span className="text-xs text-gray-300 flex-1">{f.name}</span>
                <span className={`text-[10px] font-medium ${
                  f.level === 'Critical' || f.level === 'High' ? 'text-red-400' : f.level === 'Moderate' ? 'text-amber-400' : 'text-emerald-400'
                }`}>{f.level}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-[10px] text-gray-500 uppercase mb-2">Upside Drivers</p>
              <div className="space-y-2">
                {risk.upsideDrivers.map((d, i) => (
                  <div key={i} className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2.5">
                    <p className="text-xs font-medium text-emerald-400">✓ {d.label}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{d.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase mb-2 mt-3">Downside Risks</p>
              <div className="space-y-2">
                {risk.downsideRisks.map((d, i) => (
                  <div key={i} className="bg-red-500/5 border border-red-500/10 rounded-lg p-2.5">
                    <p className="text-xs font-medium text-red-400">✗ {d.label}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{d.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase mb-1">Invalidation</p>
              <p className="text-xs text-gray-400">{risk.invalidation}</p>
            </div>
          </div>
        </div>

        {/* Summary */}
        {company.summary && (
          <div className="card p-4 mb-4">
            <SectionHeader title="AI Summary" />
            <p className="text-sm text-gray-300 leading-relaxed">{company.summary}</p>
          </div>
        )}

        <Disclaimer />
      </div>

      {/* Ask Agent Modal */}
      {askOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_180ms_ease-out]" onClick={() => setAskOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg sm:rounded-2xl bg-surface-900 border border-white/10 shadow-2xl flex flex-col"
            style={{ maxHeight: '88vh', animation: 'slideUp 240ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-accent-500/10 to-purple-500/10 sm:rounded-t-2xl">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base">🤖</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{company.ticker} — Deep Profile</p>
                  <p className="text-[10px] text-gray-500">AI-generated company analysis</p>
                </div>
              </div>
              <button
                onClick={() => setAskOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 flex items-center justify-center text-gray-400 hover:text-white transition-all"
                aria-label="Close"
              >×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {askLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-xs text-gray-500">Generating detailed profile...</p>
                </div>
              ) : (
                <MarkdownContent text={askContent} />
              )}
            </div>
            <div className="px-4 py-2 border-t border-white/10 sm:rounded-b-2xl">
              <p className="text-[10px] text-gray-600 text-center">AI-generated · Verify before acting · Not financial advice</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Watchlist Drag-to-Reorder ----
function WatchlistDragList({ companies, watchlist, onReorder, onSelect }: {
  companies: Company[];
  watchlist: string[];
  onReorder: (newOrder: string[]) => void;
  onSelect: (c: Company) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [currentOrder, setCurrentOrder] = useState<string[]>(watchlist);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const dragStartIdx = useRef(0);

  // Keep currentOrder in sync when watchlist changes externally
  const prevWatchlist = useRef(watchlist);
  if (prevWatchlist.current !== watchlist) {
    prevWatchlist.current = watchlist;
    setCurrentOrder(watchlist);
  }

  const ordered = currentOrder.map(t => companies.find(c => c.ticker === t)).filter(Boolean) as Company[];

  const handleTouchStart = (idx: number, e: React.TouchEvent) => {
    e.preventDefault();
    startY.current = e.touches[0].clientY;
    dragStartIdx.current = idx;
    setDragIdx(idx);
    setCurrentOrder(watchlist);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragIdx === null || !containerRef.current) return;
    e.preventDefault();
    const children = containerRef.current.children;
    if (children.length === 0) return;
    const itemH = (children[0] as HTMLElement).getBoundingClientRect().height + 8;
    const dy = e.touches[0].clientY - startY.current;
    const offset = Math.round(dy / itemH);
    const newIdx = Math.max(0, Math.min(ordered.length - 1, dragStartIdx.current + offset));

    if (newIdx !== dragIdx) {
      const reordered = [...watchlist];
      const [moved] = reordered.splice(dragStartIdx.current, 1);
      reordered.splice(newIdx, 0, moved);
      setCurrentOrder(reordered);
      setDragIdx(newIdx);
    }
  };

  const handleTouchEnd = () => {
    if (dragIdx !== null) {
      onReorder(currentOrder);
    }
    setDragIdx(null);
  };

  return (
    <div ref={containerRef} className="space-y-2">
      {ordered.map((c, i) => {
        const isDragging = dragIdx === i;
        return (
          <div
            key={c.ticker}
            className={`card w-full text-left px-4 py-3 flex items-center gap-3 transition-transform ${
              isDragging ? 'bg-accent-500/10 border-accent-500/30 scale-[1.02] shadow-lg z-10 relative' : ''
            }`}
          >
            <button onClick={() => onSelect(c)} className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-500/20 to-accent-500/5 flex items-center justify-center text-xs font-bold text-accent-400 shrink-0">
                {c.ticker.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{c.ticker}</span>
                  <span className="text-sm font-mono">${c.price.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] text-gray-500 truncate">{c.name} · {c.marketCapLabel}</span>
                  <ChangeIndicator value={c.changePercent} />
                </div>
              </div>
            </button>
            {/* Drag handle on right */}
            <div
              className="shrink-0 touch-none px-1 py-3"
              onTouchStart={(e) => handleTouchStart(i, e)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="flex flex-col gap-[3px]">
                <div className="w-5 h-[2px] bg-gray-500 rounded" />
                <div className="w-5 h-[2px] bg-gray-500 rounded" />
                <div className="w-5 h-[2px] bg-gray-500 rounded" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function StocksPage() {
  const { companies } = useMarketData();
  const [search, setSearch] = useState('');
  const [rankBy, setRankBy] = useState('overall');
  const [selected, setSelected] = useState<Company | null>(null);
  const scrollPosRef = useRef(0);
  const [activeTab, setActiveTab] = useState<'ranked' | 'watchlist' | 'movers'>('watchlist');
  const [watchlist, setWatchlist] = useState<string[]>(() => portfolioService.getWatchlist());
  const [movers, setMovers] = useState<{ gainers: Company[]; active: Company[]; trending: Company[] }>({ gainers: [], active: [], trending: [] });
  const [moversLoading, setMoversLoading] = useState(false);
  const [moversSub, setMoversSub] = useState<'gainers' | 'active' | 'trending'>('gainers');

  // Global watchlist search state
  const [wlSearch, setWlSearch] = useState('');
  const [aiAdding, setAiAdding] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [customStocks, setCustomStocks] = useState<Company[]>(() => customStocksService.list());

  // Resolve a mover stock: use existing analyzed company if available, else create stub for live fetch
  const resolveCompany = useCallback((mover: Company) => {
    const existing = companies.find(c => c.ticker === mover.ticker);
    if (existing) return existing;
    // Create stub with price=0 so CompanyDetail triggers live profile fetch
    return {
      ...mover,
      price: 0, change: 0, changePercent: 0,
      scores: { momentum: 0, fundamental: 0, valuation: 0, institutionalInterest: 0, technologyExposure: 0, marketDemand: 0, risk: 0, opportunity: 0, userFit: 0, overall: 0 },
    } as Company;
  }, [companies]);

  // Fetch market movers when tab is selected
  React.useEffect(() => {
    if (activeTab !== 'movers' || movers.gainers.length > 0) return;
    setMoversLoading(true);
    yahooFinance.getMarketMovers().then(data => {
      setMovers(data);
      setMoversLoading(false);
    }).catch(() => setMoversLoading(false));
  }, [activeTab]);

  const refreshWatchlist = useCallback(() => setWatchlist(portfolioService.getWatchlist()), []);

  // Keep the watchlist tab in sync when toggled from other pages (DashboardPage, InstitutionsPage, etc.).
  useEffect(() => {
    const onChange = () => {
      setWatchlist(portfolioService.getWatchlist());
      setCustomStocks(customStocksService.list());
    };
    window.addEventListener('invest_guide:watchlist_changed', onChange);
    return () => window.removeEventListener('invest_guide:watchlist_changed', onChange);
  }, []);

  const filtered = useMemo(() => {
    let list = companies;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.sector.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const key = rankBy as keyof Company['scores'];
      if (key === 'risk') return a.scores[key] - b.scores[key]; // Lower risk = better
      return b.scores[key] - a.scores[key];
    });
  }, [search, rankBy]);

  // All known companies = analyzed + custom (AI-added) stocks
  const allKnownCompanies = useMemo(() => {
    const map = new Map<string, Company>();
    for (const c of companies) map.set(c.ticker, c);
    for (const c of customStocks) if (!map.has(c.ticker)) map.set(c.ticker, c);
    return [...map.values()];
  }, [companies, customStocks]);

  const watchlistCompanies = useMemo(() => {
    return allKnownCompanies.filter(c => watchlist.includes(c.ticker));
  }, [allKnownCompanies, watchlist]);

  const openStock = useCallback((c: Company) => { scrollPosRef.current = window.scrollY; setSelected(c); }, []);
  const closeStock = useCallback(() => { setSelected(null); refreshWatchlist(); requestAnimationFrame(() => window.scrollTo(0, scrollPosRef.current)); }, [refreshWatchlist]);

  useEffect(() => {
    const handler = (e: Event) => { if ((e as CustomEvent).detail === 'stocks') { setSelected(null); } };
    window.addEventListener('tab-reset', handler);
    return () => window.removeEventListener('tab-reset', handler);
  }, []);

  // Global ticker index — rebuilt when companies/customStocks change
  const stockIndex = useMemo(() => {
    const idx = buildStockIndex(allKnownCompanies);
    return idx;
  }, [allKnownCompanies]);
  const wlSearchResults = useMemo<IndexedStock[]>(() => searchStockIndex(stockIndex, wlSearch, 40), [stockIndex, wlSearch]);

  const aiSearchAndAdd = useCallback(async (query: string) => {
    setAiError(null);
    setAiAdding(true);
    try {
      const stub = await aiResolveStock(query);
      if (!stub) {
        setAiError(`No stock found matching "${query}".`);
        return;
      }
      // Persist so the stock is reachable later (search index, watchlist UI),
      // but DO NOT auto-add to the watchlist — user must tap the star manually.
      customStocksService.upsert(stub);
      setCustomStocks(customStocksService.list());
      setWlSearch('');
      // Open the detail page so user sees the new stock immediately
      scrollPosRef.current = window.scrollY;
      setSelected(stub);
    } catch (err: any) {
      setAiError(err?.message ?? 'Search failed');
    } finally {
      setAiAdding(false);
    }
  }, []);

  // Cross-page navigation: open a stock detail when requested from elsewhere
  useNavRequest('stocks', (req) => {
    if (!req.ticker) return;
    const c = allKnownCompanies.find(x => x.ticker === req.ticker);
    if (c) { setSelected(c); return; }
    // Look it up in the unified index
    const idx = stockIndex.find(s => s.ticker === req.ticker);
    if (idx) { setSelected(toCompany(idx)); return; }
    // Last resort: AI resolve
    aiSearchAndAdd(req.ticker);
  });

  if (selected) return <CompanyDetail company={selected} onClose={closeStock} onWatchlistChange={refreshWatchlist} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Stock Discovery</h1>
        <p className="text-xs text-gray-500 mt-0.5">AI-ranked companies across multiple factors</p>
      </div>

      {/* Top-level tab: Watchlist (default) vs Ranked vs Movers */}
      <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1">
        <button onClick={() => setActiveTab('watchlist')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'watchlist' ? 'bg-accent-500/20 text-accent-400' : 'text-gray-500'
          }`}>⭐ Watchlist{watchlist.length > 0 ? ` (${watchlist.length})` : ''}</button>
        <button onClick={() => setActiveTab('ranked')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'ranked' ? 'bg-white/10 text-white' : 'text-gray-500'
          }`}>📊 Ranked</button>
        <button onClick={() => setActiveTab('movers')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'movers' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-500'
          }`}>🔥 Movers</button>
      </div>

      {activeTab === 'ranked' && (
        <>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search ticker, name, or sector..."
            className="input-field"
          />

          <TabBar tabs={rankTabs} active={rankBy} onChange={setRankBy} />

          <div className="space-y-2">
            {filtered.map((c, i) => {
              const inWl = watchlist.includes(c.ticker);
              return (
              <div key={c.ticker} className="card-compact p-3 w-full flex items-center gap-3 hover:border-accent-500/30 transition-all">
                <button onClick={() => openStock(c)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-gray-400">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{c.ticker}</span>
                      <span className="text-xs text-gray-500 truncate">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono text-white">${c.price.toFixed(2)}</span>
                      <span className="text-xs text-gray-600">•</span>
                      <span className="text-xs text-gray-400">{c.marketCapLabel}</span>
                      <span className="text-xs text-gray-600">•</span>
                      <ChangeIndicator value={c.changePercent} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-accent-400">{c.scores[rankBy as keyof typeof c.scores]}</div>
                    <p className="text-[10px] text-gray-500">{rankBy === 'risk' ? 'Risk' : 'Score'}</p>
                  </div>
                </button>
                <button onClick={() => {
                  if (inWl) portfolioService.removeFromWatchlist(c.ticker);
                  else portfolioService.addToWatchlist(c.ticker);
                  refreshWatchlist();
                  emitWatchlistChanged();
                }} className={`text-lg shrink-0 px-1 transition-all ${inWl ? 'text-accent-400' : 'text-gray-600'}`}>
                  {inWl ? '★' : '☆'}
                </button>
              </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === 'movers' && (
        <>
          <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1">
            {([['gainers', '📈 Gainers'], ['active', '📊 Most Active'], ['trending', '🔥 Trending']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setMoversSub(key)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  moversSub === key ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-500'
                }`}>{label}</button>
            ))}
          </div>
          {moversLoading ? (
            <div className="card p-8 text-center">
              <div className="animate-pulse text-gray-400 text-sm">Loading live market data...</div>
            </div>
          ) : (
            <div className="space-y-2">
              {movers[moversSub].length === 0 ? (
                <div className="card p-8 text-center">
                  <p className="text-gray-400 text-sm">No data available</p>
                </div>
              ) : movers[moversSub].map((c, i) => (
                <button key={c.ticker} onClick={() => openStock(resolveCompany(c))} className="card-compact p-3 w-full flex items-center gap-3 hover:border-emerald-500/30 transition-all text-left">
                  <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-gray-400">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{c.ticker}</span>
                      <span className="text-xs text-gray-500 truncate">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono text-white">${c.price.toFixed(2)}</span>
                      <span className="text-xs text-gray-600">•</span>
                      <span className="text-xs text-gray-400">{c.sector}</span>
                      <span className="text-xs text-gray-600">•</span>
                      <ChangeIndicator value={c.changePercent} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <ChangeIndicator value={c.changePercent} />
                  </div>
                </button>
              ))}
            </div>
          )}
          <button onClick={() => {
            setMovers({ gainers: [], active: [], trending: [] });
            setMoversLoading(true);
            yahooFinance.getMarketMovers().then(data => {
              setMovers(data);
              setMoversLoading(false);
            }).catch(() => setMoversLoading(false));
          }} className="w-full py-2 rounded-xl bg-white/5 text-gray-400 text-xs hover:bg-white/10 transition-all">
            🔄 Refresh Market Data
          </button>
        </>
      )}

      {activeTab === 'watchlist' && (
        <div className="space-y-3">
          {/* Global stock search bar */}
          <div className="relative">
            <input
              type="text"
              value={wlSearch}
              onChange={e => { setWlSearch(e.target.value); setAiError(null); }}
              placeholder="Search stock..."
              className="input-field pr-9"
            />
            {wlSearch && (
              <button
                onClick={() => { setWlSearch(''); setAiError(null); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 text-xs"
                aria-label="Clear"
              >×</button>
            )}
          </div>

          {wlSearch.trim() !== '' ? (
            <div className="space-y-2">
              {wlSearchResults.length > 0 ? (
                <>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold px-1">
                    {wlSearchResults.length} match{wlSearchResults.length === 1 ? '' : 'es'}
                  </p>
                  {wlSearchResults.map(s => {
                    const inWl = watchlist.includes(s.ticker);
                    return (
                      <div key={s.ticker} className="card-compact p-3 flex items-center gap-3 hover:border-accent-500/30 transition-all">
                        <button
                          onClick={() => openStock(toCompany(s))}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-500/20 to-accent-500/5 flex items-center justify-center text-xs font-bold text-accent-400 shrink-0">
                            {s.ticker.slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{s.ticker}</span>
                              <span className="text-[10px] text-gray-500 truncate">{s.name}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {s.price && s.price > 0 ? (
                                <>
                                  <span className="text-[11px] font-mono text-white">${s.price.toFixed(2)}</span>
                                  {typeof s.changePercent === 'number' && <ChangeIndicator value={s.changePercent} />}
                                </>
                              ) : (
                                <span className="text-[10px] text-gray-500">{s.sector ?? 'Stock'}</span>
                              )}
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            if (inWl) portfolioService.removeFromWatchlist(s.ticker);
                            else { customStocksService.upsert(toCompany(s)); portfolioService.addToWatchlist(s.ticker); }
                            refreshWatchlist();
                            setCustomStocks(customStocksService.list());
                            emitWatchlistChanged();
                          }}
                          title={inWl ? 'Remove from watchlist' : 'Add to watchlist'}
                          className={`text-xl shrink-0 px-1 transition-all ${inWl ? 'text-accent-400' : 'text-gray-600 hover:text-accent-400'}`}
                        >
                          {inWl ? '★' : '☆'}
                        </button>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="card p-5 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-500/20 to-purple-500/10 flex items-center justify-center text-xl mx-auto mb-3">🔎</div>
                  <p className="text-sm text-gray-300 font-medium mb-1">No matches in the app</p>
                  <p className="text-[11px] text-gray-500 mb-3">Let the AI find "{wlSearch}" online and add it automatically.</p>
                  <button
                    onClick={() => aiSearchAndAdd(wlSearch)}
                    disabled={aiAdding}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-accent-500/30 to-purple-500/30 hover:from-accent-500/40 hover:to-purple-500/40 border border-accent-500/40 text-xs font-medium text-accent-200 transition-all disabled:opacity-50"
                  >
                    {aiAdding ? (
                      <>
                        <span className="w-3 h-3 border-2 border-accent-300 border-t-transparent rounded-full animate-spin" />
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <span>🤖</span>
                        <span>AI Search & Add</span>
                      </>
                    )}
                  </button>
                  {aiError && <p className="text-[10px] text-red-400 mt-2">{aiError}</p>}
                </div>
              )}
            </div>
          ) : watchlistCompanies.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-500/20 to-amber-500/10 flex items-center justify-center text-2xl mx-auto mb-4">⭐</div>
              <p className="text-gray-400 text-sm font-medium mb-1">No stocks in watchlist</p>
              <p className="text-gray-600 text-xs">Search a stock above to add it, or open a stock and tap the ☆ button.</p>
            </div>
          ) : (
            <WatchlistDragList
              companies={watchlistCompanies}
              watchlist={watchlist}
              onReorder={(newOrder) => { portfolioService.saveWatchlist(newOrder); refreshWatchlist(); }}
              onSelect={openStock}
            />
          )}
        </div>
      )}
    </div>
  );
}
