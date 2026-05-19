import React, { useState, useMemo } from 'react';
import { riskEngine } from '../services/riskEngine';
import { historicalPriceService } from '../services/historicalPriceService';
import { ChangeIndicator, MiniSparkline, ScoreBar, SectionHeader, TabBar, Disclaimer } from '../components/SharedComponents';
import { Company, Timeframe, PricePoint } from '../models/types';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Area, AreaChart } from 'recharts';
import { useMarketData } from '../components/MarketDataContext';

const rankTabs = [
  { id: 'overall', label: 'Top Ranked' },
  { id: 'momentum', label: 'Momentum' },
  { id: 'fundamental', label: 'Fundamentals' },
  { id: 'opportunity', label: 'Opportunity' },
  { id: 'risk', label: 'Lowest Risk' },
];

export function CompanyDetail({ company, onClose }: { company: Company; onClose: () => void }) {
  const risk = riskEngine.assessCompanyRisk(company);
  const { fetchHistory } = useMarketData();
  const [timeframe, setTimeframe] = useState<Timeframe>('1M');
  const [liveData, setLiveData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const fallbackData = useMemo(() => historicalPriceService.getHistory(company.ticker, timeframe, company.price, company.changePercent), [company.ticker, timeframe, company.price, company.changePercent]);
  const priceData = liveData.length > 0 ? liveData : fallbackData;

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
  ];
  const priceChange = priceData.length >= 2 ? priceData[priceData.length - 1].value - priceData[0].value : 0;
  const priceChangePercent = priceData.length >= 2 ? (priceChange / priceData[0].value) * 100 : 0;
  const chartColor = priceChange >= 0 ? '#10b981' : '#ef4444';

  return (
    <div className="fixed inset-0 z-50 bg-surface-950/95 overflow-y-auto">
      <div className="max-w-lg mx-auto p-4 pt-[env(safe-area-inset-top,16px)] pb-24">
        <button onClick={onClose} className="text-gray-400 hover:text-white mb-4 text-sm mt-2">← Back</button>

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
            <ChangeIndicator value={priceChangePercent} />
          </div>
        </div>

        {/* Price Chart */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className={`text-sm font-semibold ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
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
          {[
            { label: 'Market Cap', value: company.marketCapLabel },
            { label: 'Sector', value: company.sector },
            { label: 'Industry', value: company.industry },
            { label: 'Revenue Growth', value: `${company.revenueGrowth}%` },
            { label: 'Profit Margin', value: `${company.profitMargin}%` },
            { label: 'Debt/Equity', value: `${company.debtToEquity}x` },
            { label: 'Analyst', value: company.analystSentiment },
            { label: 'Inst. Ownership', value: `${company.institutionalOwnership}%` },
            { label: 'Insider Activity', value: company.insiderActivity },
          ].map(m => (
            <div key={m.label} className="card-compact p-2.5">
              <p className="text-[10px] text-gray-500">{m.label}</p>
              <p className="text-xs font-medium text-white mt-0.5">{m.value}</p>
            </div>
          ))}
        </div>

        {/* AI Scores */}
        <div className="card p-4 mb-4">
          <SectionHeader title="AI Scores" />
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
        <div className="card p-4 mb-4">
          <SectionHeader title="AI Summary" />
          <p className="text-sm text-gray-300 leading-relaxed">{company.summary}</p>
        </div>

        <Disclaimer />
      </div>
    </div>
  );
}

export default function StocksPage() {
  const { companies } = useMarketData();
  const [search, setSearch] = useState('');
  const [rankBy, setRankBy] = useState('overall');
  const [selected, setSelected] = useState<Company | null>(null);

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

  if (selected) return <CompanyDetail company={selected} onClose={() => setSelected(null)} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Stock Discovery</h1>
        <p className="text-xs text-gray-500 mt-0.5">AI-ranked companies across multiple factors</p>
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search ticker, name, or sector..."
        className="input-field"
      />

      <TabBar tabs={rankTabs} active={rankBy} onChange={setRankBy} />

      <div className="space-y-2">
        {filtered.map((c, i) => (
          <button
            key={c.ticker}
            onClick={() => setSelected(c)}
            className="card-compact p-3 w-full text-left flex items-center gap-3 hover:border-accent-500/30 transition-all"
          >
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
        ))}
      </div>
    </div>
  );
}
