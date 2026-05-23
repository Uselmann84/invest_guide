import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useMarketData } from '../components/MarketDataContext';
import { IndexData, Company, Timeframe, PricePoint } from '../models/types';
import { ChangeIndicator, MiniSparkline, SentimentGauge, SectionHeader, Disclaimer, TabBar } from '../components/SharedComponents';
import { historicalPriceService } from '../services/historicalPriceService';
import { CompanyDetail } from './StocksPage';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area, CartesianGrid } from 'recharts';

const perfTabs = [
  { id: '1D', label: '1D' }, { id: '1W', label: '1W' }, { id: '1M', label: '1M' },
  { id: '6M', label: '6M' }, { id: '1Y', label: '1Y' }, { id: '5Y', label: '5Y' },
];

const perfKeyMap: Record<string, string> = {
  '1D': 'daily', '1W': 'weekly', '1M': 'monthly',
  '6M': 'sixMonth', '1Y': 'yearly', '5Y': 'fiveYear',
};

const timeframes: { id: Timeframe; label: string }[] = [
  { id: '1D', label: '1D' }, { id: '1W', label: '1W' }, { id: '1M', label: '1M' },
  { id: '6M', label: '6M' }, { id: '1Y', label: '1Y' }, { id: '5Y', label: '5Y' },
];

function IndexDetail({ index, onClose }: { index: IndexData; onClose: () => void }) {
  const { fetchIndexHistory } = useMarketData();
  const [timeframe, setTimeframe] = useState<Timeframe>('1M');
  const [priceData, setPriceData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [tilePerfs, setTilePerfs] = useState<Record<string, number | null>>({});

  // Generate chart data from sparkline or fetch from Yahoo Finance
  const chartData = useMemo(() => {
    if (priceData.length > 0) return priceData;
    // Fallback: generate from sparkline
    return index.sparkline.map((v, i) => ({
      date: `${i + 1}`,
      value: v,
    }));
  }, [priceData, index.sparkline]);

  // Fetch real chart data when timeframe changes
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchIndexHistory(index.symbol, timeframe)
      .then(data => { if (!cancelled && data.length) setPriceData(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [timeframe, fetchIndexHistory, index.symbol]);

  // Fetch performance for all tile timeframes
  useEffect(() => {
    const tfs: Timeframe[] = ['1D', '1W', '1M', '6M', '1Y', '5Y'];
    tfs.forEach(tf => {
      fetchIndexHistory(index.symbol, tf).then(data => {
        if (data.length >= 2) {
          const first = data[0].value;
          const last = data[data.length - 1].value;
          setTilePerfs(prev => ({ ...prev, [tf]: Math.round(((last - first) / first) * 10000) / 100 }));
        }
      });
    });
  }, [fetchIndexHistory, index.symbol]);

  const perf = index.performance;
  const tfPerf: Record<Timeframe, number> = {
    '1D': perf.daily, '1W': perf.weekly, '1M': perf.monthly,
    '6M': perf.sixMonth, '1Y': perf.yearly, '5Y': perf.fiveYear, '10Y': perf.fiveYear, 'ALL': perf.fiveYear,
  };
  // Compute performance from actual chart data when available
  const currentPerf = useMemo(() => {
    if (priceData.length >= 2) {
      const first = priceData[0].value;
      const last = priceData[priceData.length - 1].value;
      return Math.round(((last - first) / first) * 10000) / 100;
    }
    return tfPerf[timeframe];
  }, [priceData, tfPerf, timeframe]);
  const chartColor = currentPerf >= 0 ? '#10b981' : '#ef4444';

  return (
    <div className="fixed inset-0 z-50 bg-surface-950/95 overflow-y-auto">
      <div className="max-w-lg mx-auto p-4 pt-[env(safe-area-inset-top,16px)] pb-24">
        <button onClick={onClose} className="text-gray-400 hover:text-white mb-4 text-sm mt-2">← Back</button>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">{index.name}</h2>
            <p className="text-xs text-gray-500">{index.symbol}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">{index.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            <ChangeIndicator value={currentPerf} />
          </div>
        </div>

        {/* Chart */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-semibold ${currentPerf >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {currentPerf >= 0 ? '+' : ''}{currentPerf.toFixed(2)}%
            </span>
            <span className="text-[10px] text-gray-500">{timeframe}</span>
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
          <div className="h-56 relative">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-surface-900/50 rounded-lg">
                <div className="w-5 h-5 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id={`grad-idx-${index.symbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b7280' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} domain={['auto', 'auto']} tickFormatter={v => v.toLocaleString()} />
                <Tooltip
                  contentStyle={{ background: '#131c2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number) => [v.toLocaleString(undefined, { maximumFractionDigits: 2 }), index.name]}
                />
                <Area type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2} fill={`url(#grad-idx-${index.symbol})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Performance Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {([['1D', perf.daily], ['1W', perf.weekly], ['1M', perf.monthly],
             ['6M', perf.sixMonth], ['1Y', perf.yearly], ['5Y', perf.fiveYear]] as [string, number][]).map(([label, fallback]) => {
            const val = tilePerfs[label] ?? fallback;
            return (
            <div key={label} className="card-compact p-3 text-center">
              <p className="text-[10px] text-gray-500">{label}</p>
              <p className={`text-sm font-semibold ${val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {val >= 0 ? '+' : ''}{val.toFixed(2)}%
              </p>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { indexes, companies, sectors, sentiment, macroRisk, summary, heatmap, isLive, isLoading, aiStatus, aiGeneratedAt, dataSource, fetchIndexHistory, fetchHistory, runAiAnalysis, runDataSummary } = useMarketData();
  const [perfPeriod, setPerfPeriod] = useState<Timeframe>(() => (localStorage.getItem('dash_indexPeriod') as Timeframe) || '1M');
  const [stockPeriod, setStockPeriod] = useState<Timeframe>(() => (localStorage.getItem('dash_stockPeriod') as Timeframe) || '1M');
  const [selectedIndex, setSelectedIndex] = useState<IndexData | null>(null);

  const handleSetPerfPeriod = (t: Timeframe) => { setPerfPeriod(t); localStorage.setItem('dash_indexPeriod', t); };
  const handleSetStockPeriod = (t: Timeframe) => { setStockPeriod(t); localStorage.setItem('dash_stockPeriod', t); };
  const [selectedStock, setSelectedStock] = useState<Company | null>(null);
  const scrollPosRef = useRef(0);
  const openStock = useCallback((c: Company) => { scrollPosRef.current = window.scrollY; setSelectedStock(c); }, []);
  const closeStock = useCallback(() => { setSelectedStock(null); requestAnimationFrame(() => window.scrollTo(0, scrollPosRef.current)); }, []);
  const openIndex = useCallback((idx: IndexData) => { scrollPosRef.current = window.scrollY; setSelectedIndex(idx); }, []);
  const closeIndex = useCallback(() => { setSelectedIndex(null); requestAnimationFrame(() => window.scrollTo(0, scrollPosRef.current)); }, []);
  const [indexCharts, setIndexCharts] = useState<Record<string, PricePoint[]>>({});
  const [stockCharts, setStockCharts] = useState<Record<string, PricePoint[]>>({});
  const [chartsLoading, setChartsLoading] = useState(false);
  const [stockChartsLoading, setStockChartsLoading] = useState(false);
  const [showAllIndexes, setShowAllIndexes] = useState(false);

  const topGainers = [...sectors].sort((a, b) => b.change - a.change).slice(0, 3);
  const topDecliners = [...sectors].sort((a, b) => a.change - b.change).slice(0, 3);
  const topStocks = useMemo(() => [...companies].sort((a, b) => b.scores.overall - a.scores.overall).slice(0, 5), [companies]);

  // Fetch real chart data for indexes when index timeframe changes
  useEffect(() => {
    let cancelled = false;
    setChartsLoading(true);
    setIndexCharts({});

    const fetchAll = async () => {
      const promises = indexes.map(async (idx) => {
        try {
          const data = await fetchIndexHistory(idx.symbol, perfPeriod);
          if (!cancelled && data.length > 2) {
            setIndexCharts(prev => ({ ...prev, [idx.symbol]: data }));
          }
        } catch { /* skip */ }
      });
      await Promise.all(promises);
      if (!cancelled) setChartsLoading(false);
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [perfPeriod, indexes, fetchIndexHistory]);

  // Fetch real chart data for top stocks when stock timeframe changes
  useEffect(() => {
    let cancelled = false;
    setStockChartsLoading(true);
    setStockCharts({});

    const fetchAll = async () => {
      const promises = topStocks.map(async (stock) => {
        try {
          const data = await fetchHistory(stock.ticker, stockPeriod);
          if (!cancelled && data.length > 2) {
            setStockCharts(prev => ({ ...prev, [stock.ticker]: data }));
          }
        } catch { /* skip */ }
      });
      await Promise.all(promises);
      if (!cancelled) setStockChartsLoading(false);
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [stockPeriod, topStocks, fetchHistory]);

  // Known tickers from companies list for linking
  const tickerSet = useMemo(() => new Set(companies.map(c => c.ticker)), [companies]);

  // Render text segment with **bold** and ticker links
  const renderTextWithLinks = useCallback((text: string) => {
    // Split by **bold** first
    const boldParts = text.split('**');
    return boldParts.map((part, i) => {
      if (i % 2 === 1) {
        // Bold segment — check if it's a known ticker
        const upperPart = part.toUpperCase();
        const matchedCompany = companies.find(c => c.ticker === upperPart);
        if (matchedCompany) {
          return (
            <button key={i} className="font-bold text-accent-400 underline underline-offset-2" onClick={() => openStock(matchedCompany)}>
              {part}
            </button>
          );
        }
        return <strong key={i} className="text-white">{part}</strong>;
      }
      // Regular text — also scan for standalone tickers (e.g. AAPL, MSFT)
      const tickerRegex = /\b([A-Z]{1,5})\b/g;
      const segments: React.ReactNode[] = [];
      let lastIdx = 0;
      let match;
      while ((match = tickerRegex.exec(part)) !== null) {
        const ticker = match[1];
        const company = companies.find(c => c.ticker === ticker);
        if (company) {
          if (match.index > lastIdx) segments.push(<span key={`t${lastIdx}`}>{part.slice(lastIdx, match.index)}</span>);
          segments.push(
            <button key={`l${match.index}`} className="text-accent-400 underline underline-offset-2" onClick={() => openStock(company)}>
              {ticker}
            </button>
          );
          lastIdx = match.index + ticker.length;
        }
      }
      if (segments.length === 0) return <span key={i}>{part}</span>;
      if (lastIdx < part.length) segments.push(<span key={`t${lastIdx}`}>{part.slice(lastIdx)}</span>);
      return <span key={i}>{segments}</span>;
    });
  }, [companies]);

  if (selectedIndex) return <IndexDetail index={selectedIndex} onClose={closeIndex} />;
  if (selectedStock) return <CompanyDetail company={selectedStock} onClose={closeStock} />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Market Overview</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {' · '}{dataSource}
            {isLoading && ' · Updating...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${sentiment.value >= 50 ? 'badge-green' : 'badge-red'}`}>
            {sentiment.label}
          </span>
        </div>
      </div>

      {/* Sentiment & Risk */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <SentimentGauge value={sentiment.value} label={sentiment.label} />
        </div>
        <div className="card p-4">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">Macro Risk</p>
            <div className={`text-2xl font-bold ${
              macroRisk.level === 'Low' ? 'text-emerald-400' :
              macroRisk.level === 'Moderate' ? 'text-amber-400' : 'text-red-400'
            }`}>
              {macroRisk.score}
            </div>
            <p className={`text-sm font-medium ${
              macroRisk.level === 'Low' ? 'text-emerald-400' :
              macroRisk.level === 'Moderate' ? 'text-amber-400' : 'text-red-400'
            }`}>
              {macroRisk.level}
            </p>
            <div className="mt-2 space-y-1">
              {macroRisk.factors.slice(0, 3).map((f, i) => (
                <p key={i} className="text-[10px] text-gray-500 truncate">• {f}</p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Major Indexes — Large Cards */}
      <div>
        <SectionHeader title="Major Indexes" />
        <TabBar tabs={perfTabs} active={perfPeriod} onChange={(id) => handleSetPerfPeriod(id as Timeframe)} />
        <div className="mt-3 space-y-3">
          {(showAllIndexes ? indexes : indexes.filter(idx => idx.symbol === 'SPX')).map(idx => {
            const perfKey = perfKeyMap[perfPeriod] as keyof typeof idx.performance;
            const perfValue = idx.performance[perfKey];
            const chartData = indexCharts[idx.symbol];
            const chartPerfValue = chartData && chartData.length >= 2
              ? ((chartData[chartData.length - 1].value - chartData[0].value) / chartData[0].value) * 100
              : perfValue;
            const color = chartPerfValue >= 0 ? '#10b981' : '#ef4444';
            const miniData = chartData && chartData.length > 2
              ? chartData.map((p, i) => ({ i, v: p.value }))
              : idx.sparkline.map((v, i) => ({ i, v }));
            return (
              <button
                key={idx.symbol}
                onClick={() => openIndex(idx)}
                className="card p-4 w-full text-left active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-base font-bold">{idx.symbol}</span>
                    <span className="text-xs text-gray-500 ml-2">{idx.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-mono font-semibold">{idx.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <ChangeIndicator value={chartPerfValue} />
                  <span className="text-[10px] text-gray-600">{chartsLoading && !chartData ? 'Loading...' : 'Tap to view chart →'}</span>
                </div>
                <div className="h-16 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={miniData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id={`spark-${idx.symbol}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                          <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <YAxis hide domain={['dataMin', 'dataMax']} />
                      <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#spark-${idx.symbol})`} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </button>
            );
          })}
        </div>
        {indexes.length > 1 && (
          <button
            onClick={() => setShowAllIndexes(!showAllIndexes)}
            className="mt-3 w-full py-2.5 rounded-xl text-xs font-medium text-accent-400 bg-accent-500/10 border border-accent-500/20 active:scale-[0.98] transition-all"
          >
            {showAllIndexes ? 'Show less' : `Show ${indexes.length - 1} more indexes`}
          </button>
        )}
      </div>

      {/* Sector Heatmap */}
      <div>
        <SectionHeader title="Sector Heatmap" />
        <div className="grid grid-cols-2 gap-2">
          {heatmap.map(sector => (
            <div key={sector.sector} className="card-compact p-3">
              <p className="text-xs font-medium text-gray-300 mb-2">{sector.sector}</p>
              <div className="space-y-1">
                {sector.subsectors.map(sub => (
                  <div key={sub.name} className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">{sub.name}</span>
                    <span className={`text-[10px] font-mono ${sub.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {sub.change >= 0 ? '+' : ''}{sub.change}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Gaining / Declining */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <SectionHeader title="Top Sectors" />
          {topGainers.map(s => (
            <div key={s.name} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-gray-300 truncate flex-1">{s.name}</span>
              <ChangeIndicator value={s.change} />
            </div>
          ))}
        </div>
        <div>
          <SectionHeader title="Lagging" />
          {topDecliners.map(s => (
            <div key={s.name} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-gray-300 truncate flex-1">{s.name}</span>
              <ChangeIndicator value={s.change} />
            </div>
          ))}
        </div>
      </div>

      {/* Top Opportunities — Clickable */}
      <div>
        <SectionHeader title="Top Opportunities" />
        <TabBar tabs={perfTabs} active={stockPeriod} onChange={(id) => handleSetStockPeriod(id as Timeframe)} />
        <div className="mt-3 space-y-2">
          {topStocks.map((c, i) => {
            const chartData = stockCharts[c.ticker];
            const chartPerf = chartData && chartData.length >= 2
              ? ((chartData[chartData.length - 1].value - chartData[0].value) / chartData[0].value) * 100
              : c.changePercent;
            const sparkColor = chartPerf >= 0 ? '#10b981' : '#ef4444';
            const miniPoints = chartData && chartData.length > 2
              ? chartData.map(p => p.value)
              : c.sparkline;
            return (
              <button
                key={c.ticker}
                onClick={() => openStock(c)}
                className="card-compact p-3 flex items-center gap-3 w-full text-left active:scale-[0.98] transition-transform"
              >
                <div className="w-6 h-6 rounded-full bg-accent-500/20 flex items-center justify-center text-xs font-bold text-accent-400">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{c.ticker}</span>
                    <span className="text-xs text-gray-500 truncate">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono">${c.price.toFixed(2)}</span>
                    <span className="text-xs text-gray-600">•</span>
                    <span className="text-xs text-gray-400">Score: {c.scores.overall}</span>
                    <span className="text-xs text-gray-600">•</span>
                    <ChangeIndicator value={chartPerf} />
                  </div>
                </div>
                <MiniSparkline data={miniPoints} color={sparkColor} height={24} />
              </button>
            );
          })}
        </div>
      </div>

      {/* AI Summary */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <SectionHeader title="AI Market Brief" />
          <div className="flex gap-1.5">
            <button
              onClick={runDataSummary}
              disabled={aiStatus === 'running'}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-700 text-gray-300 text-xs font-medium disabled:opacity-40 active:bg-surface-600"
            >
              📊 Data
            </button>
            <button
              onClick={runAiAnalysis}
              disabled={aiStatus === 'running' || !isLive}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent-500/20 text-accent-400 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed active:bg-accent-500/30"
            >
              {aiStatus === 'running' ? (
                <>
                  <div className="w-3 h-3 border-2 border-accent-400 border-t-transparent rounded-full animate-spin" />
                  AI...
                </>
              ) : (
                <>🤖 AI</>
              )}
            </button>
          </div>
        </div>
        {aiStatus === 'running' && (
          <div className="card p-4 mb-2 flex items-center gap-3 border border-accent-500/20">
            <div className="w-4 h-4 border-2 border-accent-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <div>
              <p className="text-sm text-accent-400 font-medium">AI Analysis Running...</p>
              <p className="text-[10px] text-gray-500">Generating deep market analysis with investment ideas</p>
            </div>
          </div>
        )}
        {aiStatus === 'done' && (
          <div className="card p-3 mb-2 flex items-center gap-2 border border-emerald-500/20">
            <span className="text-emerald-400">✓</span>
            <p className="text-xs text-emerald-400">AI analysis updated successfully</p>
          </div>
        )}
        {aiStatus.startsWith('error') && (
          <div className="card p-3 mb-2 flex items-center gap-2 border border-red-500/20">
            <span className="text-red-400">✗</span>
            <p className="text-xs text-red-400">{aiStatus.replace('error: ', 'AI Error: ')}</p>
          </div>
        )}
        <div className="card p-4">
          <div className="text-sm text-gray-300 leading-relaxed space-y-3">
            {summary.split('\n').map((line, li) => {
              const trimmed = line.trim();
              if (!trimmed) return null;
              // Section headers (## Header)
              if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
                return <h3 key={li} className="text-sm font-bold text-accent-400 mt-3 first:mt-0">{trimmed.replace(/^#+\s*/, '')}</h3>;
              }
              // Bullet points (• or -)
              if (trimmed.startsWith('•') || trimmed.startsWith('- ')) {
                const content = trimmed.replace(/^[•\-]\s*/, '');
                return (
                  <div key={li} className="flex gap-2 pl-1">
                    <span className="text-accent-500 mt-0.5 shrink-0">•</span>
                    <span>{renderTextWithLinks(content)}</span>
                  </div>
                );
              }
              // Regular text with bold and ticker links
              return (
                <p key={li}>{renderTextWithLinks(trimmed)}</p>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-600 mt-3">
            {aiStatus === 'done' ? '🤖 AI-powered analysis' : '📊 Data-driven summary'}
            {aiGeneratedAt ? ` · Generated ${new Date(aiGeneratedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
            {' · '}{dataSource} · Not financial advice
          </p>
        </div>
      </div>

      <Disclaimer />
      <p className="text-[9px] text-gray-700 text-center pb-2">v1.1.0</p>
    </div>
  );
}
