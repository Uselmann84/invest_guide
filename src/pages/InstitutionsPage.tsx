import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { institutionShortNames, institutionColors, TradeFlowEntry, StockFlowEntry } from '../data/tradeFlowHistory';
import { getInstitutionalData, getMockInstitutionalData, InstitutionalData } from '../services/institutionalDataService';
import { SectionHeader, TabBar, ChangeIndicator, Disclaimer } from '../components/SharedComponents';
import { Institution, Company } from '../models/types';
import { useMarketData } from '../components/MarketDataContext';
import { CompanyDetail } from './StocksPage';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useEdgeSwipeClose } from '../hooks/useEdgeSwipeClose';
import { useNavRequest, useNavigation } from '../components/NavigationContext';
import { aiAgentService } from '../services/aiAgentService';
import { askCacheService } from '../services/askCacheService';
import { institutionalFlowService } from '../services/institutionalFlowService';
import InstitutionalFlowPanel from './InstitutionalFlowPanel';

function parseValue(v: string): number {
  const n = parseFloat(v.replace(/[^0-9.]/g, ''));
  if (v.includes('T')) return n * 1e12;
  if (v.includes('B')) return n * 1e9;
  if (v.includes('M')) return n * 1e6;
  return n;
}
function formatValue(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

const confidenceInfo: Record<string, string> = {
  'Very High': 'Strong track record, transparent 13F filings, high conviction bets',
  'High': 'Reliable filings, consistent strategy, good signal quality',
  'Moderate': 'Mixed signals, less transparent, or shorter public track record',
  'Low': 'Limited public data or inconsistent filing history',
};

const flowTimeframes = ['1Y', '3Y', '5Y', '10Y'] as const;
type FlowTF = typeof flowTimeframes[number];

function getFlowCutoff(tf: FlowTF): Date {
  const now = new Date();
  const years = tf === '1Y' ? 1 : tf === '3Y' ? 3 : tf === '5Y' ? 5 : 10;
  return new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
}

function FlowChart({ mode, flowData }: { mode: 'buys' | 'sells'; flowData: TradeFlowEntry[] }) {
  const [tf, setTf] = useState<FlowTF>('3Y');
  const cutoff = getFlowCutoff(tf);

  const { chartData, institutions } = useMemo(() => {
    const filtered = flowData.filter(e => new Date(e.date) >= cutoff);
    const quarters = [...new Set(filtered.map(e => e.quarter))].sort();
    const instSet = new Set<string>();

    const data = quarters.map(q => {
      const row: Record<string, number | string> = { quarter: q };
      const entries = filtered.filter(e => e.quarter === q);
      for (const e of entries) {
        const short = institutionShortNames[e.institution] || e.institution;
        const val = mode === 'buys' ? e.buys : e.sells;
        row[short] = val;
        instSet.add(short);
      }
      return row;
    });

    const instTotals = [...instSet].map(name => ({
      name,
      total: data.reduce((sum, row) => sum + ((row[name] as number) || 0), 0),
    })).sort((a, b) => b.total - a.total);

    return { chartData: data, institutions: instTotals.map(i => i.name) };
  }, [tf, mode]);

  return (
    <div className="card p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-300">
          {mode === 'buys' ? 'Buy' : 'Sell'} Volume by Investor ($M)
        </p>
        <div className="flex gap-1">
          {flowTimeframes.map(t => (
            <button key={t} onClick={() => setTf(t)}
              className={`text-[10px] px-2 py-0.5 rounded-full ${tf === t ? 'bg-accent-500 text-white' : 'bg-white/5 text-gray-500'}`}
            >{t}</button>
          ))}
        </div>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="quarter" tick={{ fontSize: 8, fill: '#6b7280' }} interval="preserveStartEnd" angle={-45} textAnchor="end" height={40} />
            <YAxis tick={{ fontSize: 8, fill: '#6b7280' }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}B` : `${v}M`} />
            <Tooltip
              contentStyle={{ background: '#131c2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }}
              formatter={(v: number, name: string) => [`$${v >= 1000 ? (v / 1000).toFixed(1) + 'B' : v + 'M'}`, name]}
              labelStyle={{ color: '#9ca3af', fontSize: 10 }}
            />
            {institutions.map(name => (
              <Bar key={name} dataKey={name} stackId="a" fill={institutionColors[name] || '#6b7280'} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {institutions.map(name => (
          <div key={name} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: institutionColors[name] || '#6b7280' }} />
            <span className="text-[9px] text-gray-500">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StockFlowChart({ ticker, name, onClose, mode, flowData }: { ticker: string; name: string; onClose: () => void; mode: 'buys' | 'sells'; flowData: Record<string, StockFlowEntry[]> }) {
  const [tf, setTf] = useState<FlowTF>('3Y');
  const cutoff = getFlowCutoff(tf);
  const entries = flowData[ticker] || [];

  const { chartData, institutions } = useMemo(() => {
    const actionFilter = mode === 'buys' ? 'Buy' : 'Sell';
    const filtered = entries.filter(e => new Date(e.date) >= cutoff && e.action === actionFilter);
    const quarters = [...new Set(filtered.map(e => e.quarter))].sort();
    const instSet = new Set<string>();

    const data = quarters.map(q => {
      const row: Record<string, number | string> = { quarter: q };
      const qEntries = filtered.filter(e => e.quarter === q);
      for (const e of qEntries) {
        const short = institutionShortNames[e.institution] || e.institution;
        row[short] = (row[short] as number || 0) + e.amount;
        instSet.add(short);
      }
      return row;
    });

    const instTotals = [...instSet].map(n => ({
      name: n,
      total: data.reduce((sum, row) => sum + Math.abs((row[n] as number) || 0), 0),
    })).sort((a, b) => b.total - a.total);

    return { chartData: data, institutions: instTotals.map(i => i.name) };
  }, [tf, entries]);

  if (!entries.length) {
    return (
      <div className="card p-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-300">{ticker} — {name}</p>
          <button onClick={onClose} className="text-[10px] text-gray-500 active:text-white">✕</button>
        </div>
        <p className="text-xs text-gray-500 text-center py-4">No detailed flow data available for {ticker}</p>
      </div>
    );
  }

  return (
    <div className="card p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-300">{ticker} — {mode === 'buys' ? 'Buy' : 'Sell'} Flow ($M)</p>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {flowTimeframes.map(t => (
              <button key={t} onClick={() => setTf(t)}
                className={`text-[10px] px-2 py-0.5 rounded-full ${tf === t ? 'bg-accent-500 text-white' : 'bg-white/5 text-gray-500'}`}
              >{t}</button>
            ))}
          </div>
          <button onClick={onClose} className="text-[10px] text-gray-500 active:text-white ml-1">✕</button>
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="quarter" tick={{ fontSize: 8, fill: '#6b7280' }} interval="preserveStartEnd" angle={-45} textAnchor="end" height={40} />
            <YAxis tick={{ fontSize: 8, fill: '#6b7280' }} tickFormatter={v => v >= 1000 || v <= -1000 ? `${(v / 1000).toFixed(0)}B` : `${v}M`} />
            <Tooltip
              contentStyle={{ background: '#131c2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }}
              formatter={(v: number, n: string) => {
                const label = v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${v}M`;
                return [label, n];
              }}
              labelStyle={{ color: '#9ca3af', fontSize: 10 }}
            />
            {institutions.map(n => (
              <Bar key={n} dataKey={n} stackId="a" fill={institutionColors[n] || '#6b7280'} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {institutions.map(n => (
          <div key={n} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: institutionColors[n] || '#6b7280' }} />
            <span className="text-[9px] text-gray-500">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InstitutionDetail({ inst, onClose, onTickerClick }: { inst: Institution; onClose: () => void; onTickerClick: (ticker: string) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEdgeSwipeClose(rootRef, onClose);

  // Ask Agent (persisted cache, keyed per institution)
  const [askOpen, setAskOpen] = useState(false);
  const [askLoading, setAskLoading] = useState(false);
  const [askContent, setAskContent] = useState('');

  const openAsk = useCallback(async () => {
    setAskOpen(true);
    const cacheKey = `inst:${inst.id}`;
    const cached = askCacheService.get(cacheKey);
    if (cached) { setAskContent(cached); return; }
    setAskLoading(true);
    setAskContent('');
    try {
      const topTickers = inst.topHoldings.slice(0, 8).map(h => h.ticker).join(', ');
      const prompt = `Provide an in-depth profile of the institutional investor **${inst.name}** (type: ${inst.type}, AUM: ${inst.aum}). Cover:\n1. Firm history, founders, headquarters and notable leadership\n2. Investment philosophy and strategy\n3. Notable wins, losses or thesis-defining positions\n4. Current portfolio themes (top holdings include: ${topTickers})\n5. Recent public commentary, letters, or 13F highlights\n\nBe factual and concise. Use markdown with bold headers and bullet points.`;
      const res = await aiAgentService.chat(prompt, []);
      askCacheService.set(cacheKey, res.content);
      setAskContent(res.content);
    } catch (err: any) {
      setAskContent(`**Error:** ${err?.message ?? 'Failed to fetch'}`);
    } finally {
      setAskLoading(false);
    }
  }, [inst.id, inst.name, inst.type, inst.aum, inst.topHoldings]);

  const renderAskMarkdown = (text: string) => text.split('\n').map((line, i) => {
    if (line.startsWith('---')) return <hr key={i} className="border-white/10 my-2" />;
    if (line.startsWith('**') && line.endsWith('**')) {
      return <p key={i} className="font-semibold text-white mt-3">{line.replace(/\*\*/g, '')}</p>;
    }
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="text-sm text-gray-300 leading-relaxed">
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j} className="text-white">{part.replace(/\*\*/g, '')}</strong>
            : <React.Fragment key={j}>{part}</React.Fragment>
        )}
      </p>
    );
  });

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 bg-surface-950/95 overflow-y-auto">
      <div className="max-w-lg mx-auto p-4 pt-[env(safe-area-inset-top,16px)] pb-24">
        <button onClick={onClose} className="text-gray-400 hover:text-white mb-4 text-sm mt-2">← Back</button>

        <div className="mb-4">
          <h2 className="text-lg font-bold">{inst.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="badge-gray">{inst.type}</span>
            <span className="text-xs text-gray-500">AUM: {inst.aum}</span>
            <span className={`text-xs ${
              inst.confidenceSignal === 'Very High' ? 'badge-green' :
              inst.confidenceSignal === 'High' ? 'badge-blue' : 'badge-orange'
            }`}>{inst.confidenceSignal}</span>
          </div>
          <p className="text-[10px] text-gray-600 mt-1 italic">Signal: {confidenceInfo[inst.confidenceSignal]}</p>
          <div className="mt-2 flex items-start gap-2">
            <p className="text-xs text-gray-400 leading-relaxed flex-1">{inst.description}</p>
            <button
              onClick={openAsk}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-gradient-to-br from-accent-500/20 to-accent-500/5 border border-accent-500/30 text-accent-300 text-[10px] font-semibold hover:from-accent-500/30 transition-all"
              title="Ask Agent for Details"
            >🤖 Ask AI</button>
          </div>
        </div>

        {/* Top Holdings */}
        <div className="card p-4 mb-3">
          <SectionHeader title="Top Holdings" />
          <div className="flex items-center gap-3 px-1 mb-1">
            <span className="text-[10px] text-gray-600 w-12">Ticker</span>
            <span className="text-[10px] text-gray-600 flex-1">Name</span>
            <span className="text-[10px] text-gray-600">Weight</span>
            <span className="text-[10px] text-gray-600">Value</span>
            <span className="text-[10px] text-gray-600 w-8 text-right">QoQ</span>
          </div>
          <div className="space-y-2">
            {inst.topHoldings.map(h => (
              <button key={h.ticker} onClick={() => onTickerClick(h.ticker)} className="flex items-center gap-3 w-full text-left active:bg-white/5 rounded-lg -mx-1 px-1 py-0.5 transition-colors">
                <span className="text-sm font-semibold w-12 text-accent-400">{h.ticker}</span>
                <span className="text-xs text-gray-400 flex-1 truncate">{h.name}</span>
                <span className="text-xs text-gray-300 font-mono">{h.weight}%</span>
                <span className="text-xs text-gray-500">{h.value}</span>
                {h.change !== 0 ? (
                  <span className={`text-[10px] w-8 text-right ${h.change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {h.change > 0 ? '↑' : '↓'}{Math.abs(h.change)}%
                  </span>
                ) : <span className="w-8" />}
              </button>
            ))}
          </div>
        </div>

        {/* Recent Buys */}
        {inst.recentBuys.length > 0 && (
          <div className="card p-4 mb-3">
            <SectionHeader title="Recent Buys" />
            <div className="space-y-2">
              {inst.recentBuys.map((t, i) => (
                <button key={i} onClick={() => onTickerClick(t.ticker)} className="flex items-center gap-3 w-full text-left active:bg-white/5 rounded-lg -mx-1 px-1 py-0.5 transition-colors">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] text-emerald-400">+</span>
                  <span className="text-sm font-semibold text-accent-400">{t.ticker}</span>
                  <span className="text-xs text-gray-400 flex-1 truncate">{t.name}</span>
                  <span className="text-xs text-gray-300">{t.value}</span>
                  <span className="text-[10px] text-gray-500">{t.date}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent Sells */}
        {inst.recentSells.length > 0 && (
          <div className="card p-4 mb-3">
            <SectionHeader title="Recent Sells" />
            <div className="space-y-2">
              {inst.recentSells.map((t, i) => (
                <button key={i} onClick={() => onTickerClick(t.ticker)} className="flex items-center gap-3 w-full text-left active:bg-white/5 rounded-lg -mx-1 px-1 py-0.5 transition-colors">
                  <span className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center text-[10px] text-red-400">−</span>
                  <span className="text-sm font-semibold text-accent-400">{t.ticker}</span>
                  <span className="text-xs text-gray-400 flex-1 truncate">{t.name}</span>
                  <span className="text-xs text-gray-300">{t.value}</span>
                  <span className="text-[10px] text-gray-500">{t.date}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* New & Reduced Positions */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="card p-3">
            <p className="text-[10px] text-gray-500 uppercase mb-2">New Positions</p>
            <div className="flex flex-wrap gap-1">
              {inst.newPositions.map(t => <button key={t} onClick={() => onTickerClick(t)} className="badge-green active:opacity-70">{t}</button>)}
              {inst.newPositions.length === 0 && <span className="text-xs text-gray-600">None</span>}
            </div>
          </div>
          <div className="card p-3">
            <p className="text-[10px] text-gray-500 uppercase mb-2">Reduced</p>
            <div className="flex flex-wrap gap-1">
              {inst.reducedPositions.map(t => <button key={t} onClick={() => onTickerClick(t)} className="badge-red active:opacity-70">{t}</button>)}
              {inst.reducedPositions.length === 0 && <span className="text-xs text-gray-600">None</span>}
            </div>
          </div>
        </div>

        {/* Sector Exposure */}
        <div className="card p-4">
          <SectionHeader title="Sector Exposure" />
          <div className="space-y-2">
            {inst.sectorExposure.map(s => (
              <div key={s.sector} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-24">{s.sector}</span>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-accent-500/60 rounded-full" style={{ width: `${s.weight}%` }} />
                </div>
                <span className="text-xs text-gray-400 w-8 text-right">{s.weight}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {askOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_180ms_ease-out]" onClick={() => setAskOpen(false)}>
          <div
            onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-lg sm:mx-4 max-h-[85vh] bg-surface-900 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col animate-[slideUp_220ms_ease-out]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-gradient-to-r from-accent-500/10 to-transparent rounded-t-3xl">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg">🤖</span>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 leading-none">AI brief on</p>
                  <p className="text-sm font-bold truncate">{inst.name}</p>
                </div>
              </div>
              <button
                onClick={() => setAskOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400"
                aria-label="Close"
              >×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {askLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
                  <span className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" />
                  <span className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" style={{ animationDelay: '120ms' }} />
                  <span className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" style={{ animationDelay: '240ms' }} />
                  <span className="ml-2">Asking the agent…</span>
                </div>
              ) : (
                <div className="space-y-1">{renderAskMarkdown(askContent)}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InstitutionsPage() {
  const { companies } = useMarketData();
  const [selected, setSelected] = useState<Institution | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [view, setView] = useState('flow');

  useEffect(() => {
    const handler = (e: Event) => { if ((e as CustomEvent).detail === 'institutions') { setSelected(null); setSelectedCompany(null); setView('flow'); } };
    window.addEventListener('tab-reset', handler);
    return () => window.removeEventListener('tab-reset', handler);
  }, []);
  const [showChart, setShowChart] = useState(false);
  const [expandedStock, setExpandedStock] = useState<string | null>(null);
  const scrollPosRef = useRef(0);
  const [data, setData] = useState<InstitutionalData>(() => getMockInstitutionalData());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getInstitutionalData().then(d => {
      if (!cancelled) { setData(d); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const institutions = data.institutions;
  const allBuys = institutions.flatMap(i => i.recentBuys.map(t => ({ ...t, institution: i.name })));
  const allSells = institutions.flatMap(i => i.recentSells.map(t => ({ ...t, institution: i.name })));

  type GroupedTrade = { ticker: string; name: string; totalValue: number; trades: { institution: string; value: string; numValue: number; date: string }[] };

  const groupTrades = (trades: typeof allBuys): GroupedTrade[] => {
    // Find the latest quarter across all trades
    const latestQ = trades.reduce((max, t) => t.date > max ? t.date : max, '');
    // Only include trades from the latest quarter
    const latestTrades = trades.filter(t => t.date === latestQ);
    const map = new Map<string, GroupedTrade>();
    for (const t of latestTrades) {
      const nv = parseValue(t.value);
      if (!map.has(t.ticker)) {
        map.set(t.ticker, { ticker: t.ticker, name: t.name, totalValue: 0, trades: [] });
      }
      const g = map.get(t.ticker)!;
      g.totalValue += nv;
      g.trades.push({ institution: t.institution, value: t.value, numValue: nv, date: t.date });
    }
    return [...map.values()].sort((a, b) => b.totalValue - a.totalValue);
  };

  const groupedBuys = useMemo(() => groupTrades(allBuys), [institutions]);
  const groupedSells = useMemo(() => groupTrades(allSells), [institutions]);

  const handleTickerClick = (ticker: string) => {
    const company = companies.find(c => c.ticker === ticker);
    scrollPosRef.current = window.scrollY;
    if (company) { setSelectedCompany(company); return; }
    // Build a stub Company from institution data so we can still open the detail (chart fetches live Yahoo data)
    const allHoldings = institutions.flatMap(i => [...i.topHoldings, ...i.recentBuys, ...i.recentSells]);
    const match = allHoldings.find(h => h.ticker === ticker);
    const stub: Company = {
      ticker, name: match?.name ?? ticker, sector: '—', industry: '—',
      marketCap: 0, marketCapLabel: '—', price: 0, change: 0, changePercent: 0,
      revenueGrowth: 0, profitMargin: 0, debtToEquity: 0, analystSentiment: 'Hold',
      institutionalOwnership: 0, insiderActivity: 'Neutral', relativeStrength: 0,
      aiTrendConnection: [], sparkline: [], summary: '',
      scores: { momentum: 0, fundamental: 0, valuation: 0, institutionalInterest: 0, technologyExposure: 0, marketDemand: 0, risk: 0, opportunity: 0, userFit: 0, overall: 0 },
    };
    setSelectedCompany(stub);
  };

  const restoreScroll = useCallback(() => { requestAnimationFrame(() => window.scrollTo(0, scrollPosRef.current)); }, []);

  const nav = useNavigation();
  // When inst detail is closed and the user originally came from another tab
  // (e.g. clicked an institution from a stock detail), return there.
  const closeInstDetail = useCallback(() => {
    setSelected(null);
    if (!nav.goBack()) restoreScroll();
  }, [nav, restoreScroll]);

  // Cross-page navigation — open an institution detail by id
  useNavRequest('institutions', (req) => {
    if (!req.institutionId) return;
    const found = institutions.find(i => i.id === req.institutionId);
    if (found) {
      scrollPosRef.current = window.scrollY;
      setSelected(found);
    }
  });

  if (selectedCompany) return <CompanyDetail company={selectedCompany} onClose={() => { setSelectedCompany(null); restoreScroll(); }} />;
  if (selected) return <InstitutionDetail inst={selected} onClose={closeInstDetail} onTickerClick={handleTickerClick} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Institutional Tracker</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {loading ? 'Updating from SEC EDGAR...' : data.isLive ? 'Live 13F data' : 'Track publicly available institutional investor data'}
        </p>
      </div>

      <TabBar
        tabs={[{ id: 'flow', label: 'Flow' }, { id: 'investors', label: 'Investors' }, { id: 'buys', label: 'Recent Buys' }, { id: 'sells', label: 'Recent Sells' }]}
        active={view}
        onChange={setView}
      />

      {view === 'investors' && (
        <div className="space-y-2">
          {institutions.map(inst => (
            <button
              key={inst.id}
              onClick={() => { scrollPosRef.current = window.scrollY; setSelected(inst); }}
              className="card-compact p-4 w-full text-left hover:border-accent-500/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center text-sm font-bold text-accent-400">
                  {inst.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate">{inst.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{inst.type}</span>
                    <span className="text-xs text-gray-600">•</span>
                    <span className="text-xs text-gray-500">{inst.aum}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-[10px] ${
                    inst.confidenceSignal === 'Very High' ? 'badge-green' :
                    inst.confidenceSignal === 'High' ? 'badge-blue' : 'badge-orange'
                  }`}>{inst.confidenceSignal}</span>
                  <p className="text-[9px] text-gray-600 mt-0.5">Signal Quality</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {inst.topHoldings.slice(0, 4).map(h => (
                  <span key={h.ticker} className="text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">{h.ticker} {h.weight}%</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {view === 'buys' && (
        <div className="space-y-3">
          <button onClick={() => setShowChart(!showChart)} className="flex items-center gap-2 text-[11px] text-accent-400 active:opacity-70">
            <span>{showChart ? '▼' : '▶'}</span>
            <span>{showChart ? 'Hide' : 'Show'} Investment Flow Chart</span>
          </button>
          {showChart && <FlowChart mode="buys" flowData={data.tradeFlow} />}
          {groupedBuys.map(g => (
            <div key={g.ticker}>
              <div className="card p-4 w-full text-left active:bg-white/5 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <button onClick={() => handleTickerClick(g.ticker)} className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] text-emerald-400">+</span>
                    <span className="text-sm font-semibold text-accent-400">{g.ticker}</span>
                    <span className="text-xs text-gray-400 flex-1 truncate">{g.name}</span>
                  </button>
                  <span className="text-xs font-semibold text-emerald-400">{formatValue(g.totalValue)}</span>
                  {(() => { const badge = institutionalFlowService.getBadge(g.ticker); return badge ? <span className={`text-[9px] px-1.5 py-0.5 rounded ${badge.color}`}>{badge.label}</span> : null; })()}
                  <button onClick={() => setExpandedStock(expandedStock === g.ticker ? null : g.ticker)}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${expandedStock === g.ticker ? 'bg-accent-500/20 text-accent-400' : 'bg-white/5 text-gray-500'} active:opacity-70`}
                  >📊</button>
                </div>
                <div className="ml-8 space-y-1">
                  {g.trades.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="text-gray-400 flex-1 truncate">{t.institution}</span>
                      <span className="text-gray-300">{t.value}</span>
                      <span className="text-gray-600">{t.date}</span>
                    </div>
                  ))}
                </div>
              </div>
              {expandedStock === g.ticker && (
                <StockFlowChart ticker={g.ticker} name={g.name} onClose={() => setExpandedStock(null)} mode="buys" flowData={data.stockFlow} />
              )}
            </div>
          ))}
        </div>
      )}

      {view === 'sells' && (
        <div className="space-y-3">
          <button onClick={() => setShowChart(!showChart)} className="flex items-center gap-2 text-[11px] text-accent-400 active:opacity-70">
            <span>{showChart ? '▼' : '▶'}</span>
            <span>{showChart ? 'Hide' : 'Show'} Investment Flow Chart</span>
          </button>
          {showChart && <FlowChart mode="sells" flowData={data.tradeFlow} />}
          {groupedSells.map(g => (
            <div key={g.ticker}>
              <div className="card p-4 w-full text-left active:bg-white/5 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <button onClick={() => handleTickerClick(g.ticker)} className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center text-[10px] text-red-400">−</span>
                    <span className="text-sm font-semibold text-accent-400">{g.ticker}</span>
                    <span className="text-xs text-gray-400 flex-1 truncate">{g.name}</span>
                  </button>
                  <span className="text-xs font-semibold text-red-400">{formatValue(g.totalValue)}</span>
                  {(() => { const badge = institutionalFlowService.getBadge(g.ticker); return badge ? <span className={`text-[9px] px-1.5 py-0.5 rounded ${badge.color}`}>{badge.label}</span> : null; })()}
                  <button onClick={() => setExpandedStock(expandedStock === g.ticker ? null : g.ticker)}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${expandedStock === g.ticker ? 'bg-accent-500/20 text-accent-400' : 'bg-white/5 text-gray-500'} active:opacity-70`}
                  >📊</button>
                </div>
                <div className="ml-8 space-y-1">
                  {g.trades.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="text-gray-400 flex-1 truncate">{t.institution}</span>
                      <span className="text-gray-300">{t.value}</span>
                      <span className="text-gray-600">{t.date}</span>
                    </div>
                  ))}
                </div>
              </div>
              {expandedStock === g.ticker && (
                <StockFlowChart ticker={g.ticker} name={g.name} onClose={() => setExpandedStock(null)} mode="sells" flowData={data.stockFlow} />
              )}
            </div>
          ))}
        </div>
      )}

      {view === 'flow' && (
        <InstitutionalFlowPanel onTickerClick={handleTickerClick} />
      )}

      <Disclaimer />
    </div>
  );
}
