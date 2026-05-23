// Institutional Flow Intelligence Panel
// Leaderboard + ticker detail with gauges, events, AI explanation
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SectionHeader, TabBar } from '../components/SharedComponents';
import { institutionalFlowService, FlowScore, FlowInsight, FlowEvent } from '../services/institutionalFlowService';
import { useMarketData } from '../components/MarketDataContext';
import { getInstitutionalData } from '../services/institutionalDataService';

// ─── Score Gauge ────────────────────────────────────────────────────────────

function Gauge({ label, value, max = 100, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between mb-1">
        <span className="text-[10px] text-gray-500">{label}</span>
        <span className={`text-[10px] font-semibold ${color}`}>{value}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%`, background: color.includes('emerald') ? '#34d399' : color.includes('red') ? '#f87171' : color.includes('blue') ? '#60a5fa' : color.includes('amber') ? '#fbbf24' : '#9ca3af' }} />
      </div>
    </div>
  );
}

// ─── Event Card ─────────────────────────────────────────────────────────────

const EVENT_ICONS: Record<string, string> = {
  sec_13f: '📋', sec_13d: '📋', sec_13g: '📋', insider_form4: '👤',
  volume_spike: '📈', large_trade: '💰', options_sweep: '⚡', options_block: '📦',
  dark_pool_print: '🌑', ats_block: '🌑', news_catalyst: '📰',
  opening_imbalance: '🔔', closing_imbalance: '🔔',
};

const DELAY_LABELS: Record<string, string> = {
  realtime: '⚡ Real-time', near_realtime: '⚡ Near real-time',
  delayed_15min: '⏱ 15-min delay', delayed_days: '📅 Days delayed',
  delayed_weeks: '📅 Weeks delayed', quarterly: '📅 Quarterly (45-day lag)',
};

const DIR_COLORS: Record<string, string> = {
  bullish: 'text-emerald-400', bearish: 'text-red-400', neutral: 'text-gray-400', unknown: 'text-gray-500',
};

function EventCard({ event }: { event: FlowEvent }) {
  return (
    <div className="py-3 border-b border-white/5 last:border-b-0">
      <div className="flex items-start gap-2.5">
        <span className="text-sm mt-0.5">{EVENT_ICONS[event.eventType] || '📊'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-semibold uppercase ${DIR_COLORS[event.direction]}`}>{event.direction}</span>
            <span className="text-[10px] text-gray-600">{event.eventType.replace(/_/g, ' ')}</span>
            <span className="text-[10px] text-gray-600">•</span>
            <span className="text-[10px] text-gray-500">{DELAY_LABELS[event.sourceDelay] || event.sourceDelay}</span>
          </div>
          <p className="text-xs text-gray-300 mt-1 leading-relaxed">{event.description}</p>
          <div className="flex items-center gap-3 mt-1.5">
            {event.notionalValue && <span className="text-[10px] text-gray-500">💵 {fmtVal(event.notionalValue)}</span>}
            {event.optionPremium && <span className="text-[10px] text-gray-500">🎯 {fmtVal(event.optionPremium)} premium</span>}
            <span className="text-[10px] text-gray-600">Conf: {event.confidence}%</span>
            <span className="text-[10px] text-gray-600 ml-auto">{formatEventDate(event)}</span>
          </div>
          <p className="text-[10px] text-gray-600 mt-0.5">Source: {event.source}</p>
        </div>
      </div>
    </div>
  );
}

function fmtVal(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatEventDate(event: FlowEvent): string {
  // Quarterly filings: show the quarter label + delay
  if (event.sourceDelay === 'quarterly') {
    const qt = event.eventTime; // e.g. "Q1 2025"
    if (/^Q\d/i.test(qt)) return `${qt} (45-day lag)`;
  }
  const d = new Date(event.eventTime);
  if (isNaN(d.getTime())) return event.eventTime; // fallback to raw string
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function parseEventTime(t: string): number {
  // Handle quarter strings like "Q1 2025"
  const qm = t.match(/^Q(\d)\s+(\d{4})$/i);
  if (qm) {
    const month = (parseInt(qm[1]) - 1) * 3; // Q1→Jan, Q2→Apr, ...
    return new Date(parseInt(qm[2]), month + 2, 28).getTime(); // end of quarter
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

// ─── Ticker Detail ──────────────────────────────────────────────────────────

function FlowDetail({ score, onClose, onTickerClick }: { score: FlowScore; onClose: () => void; onTickerClick: (t: string) => void }) {
  const [insight, setInsight] = useState<FlowInsight | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const loadInsight = useCallback(async () => {
    setAiLoading(true);
    try {
      const ins = await institutionalFlowService.getAiInsight(score);
      setInsight(ins);
    } catch { setInsight(institutionalFlowService.generateFallbackInsight(score)); }
    setAiLoading(false);
  }, [score]);

  useEffect(() => { loadInsight(); }, [loadInsight]);

  const label = institutionalFlowService.SIGNAL_LABEL_DISPLAY[score.signalLabel];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 active:bg-white/10 text-sm">←</button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <button onClick={() => onTickerClick(score.ticker)} className="text-lg font-bold text-accent-400 active:opacity-70">{score.ticker}</button>
            <span className="text-xs text-gray-500">{score.name}</span>
          </div>
          <p className="text-xs mt-0.5">{label}</p>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold tabular-nums">{Math.abs(score.totalScore)}</span>
          <p className="text-[10px] text-gray-500">Signal Score</p>
        </div>
      </div>

      {/* Score Gauges */}
      <div className="card p-4">
        <SectionHeader title="Signal Breakdown" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-3">
          <Gauge label="Accumulation" value={score.accumulationScore} color="text-emerald-400" />
          <Gauge label="Distribution" value={score.distributionScore} color="text-red-400" />
          <Gauge label="Options Flow" value={score.optionsFlowScore} color="text-blue-400" />
          <Gauge label="Dark Pool" value={score.darkPoolScore} color="text-amber-400" />
          <Gauge label="SEC Confirm" value={score.secConfirmationScore} color="text-emerald-400" />
          <Gauge label="Signal Confidence" value={score.confidence} color="text-gray-300" />
        </div>
      </div>

      {/* AI Explanation */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <SectionHeader title="🤖 AI Flow Analysis" />
          {!aiLoading && <button onClick={loadInsight} className="text-[10px] text-accent-400 active:opacity-70">Refresh</button>}
        </div>
        {aiLoading ? (
          <div className="flex items-center gap-2 py-4">
            <div className="w-4 h-4 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-400">Generating analysis…</span>
          </div>
        ) : insight ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-200">{insight.title}</h3>
            <p className="text-xs text-gray-300 leading-relaxed">{insight.summary}</p>

            {insight.bullishFactors.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-emerald-400 mb-1">Bullish Factors</p>
                {insight.bullishFactors.map((f, i) => <p key={i} className="text-[11px] text-gray-400 ml-2">• {f}</p>)}
              </div>
            )}
            {insight.bearishFactors.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-red-400 mb-1">Bearish / Risk Factors</p>
                {insight.bearishFactors.map((f, i) => <p key={i} className="text-[11px] text-gray-400 ml-2">• {f}</p>)}
              </div>
            )}
            {insight.uncertaintyNotes.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-amber-400 mb-1">⚠️ Why This May Be Misleading</p>
                {insight.uncertaintyNotes.map((n, i) => <p key={i} className="text-[11px] text-gray-400 ml-2">• {n}</p>)}
              </div>
            )}
            {insight.dataDelayNotes.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 mb-1">📅 Data Delay Notes</p>
                {insight.dataDelayNotes.map((n, i) => <p key={i} className="text-[11px] text-gray-500 ml-2">• {n}</p>)}
              </div>
            )}
            <div className="mt-2 p-2 bg-amber-500/5 rounded-lg border border-amber-500/10">
              <p className="text-[10px] text-amber-400">⚠️ {insight.notInvestmentAdvice}</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Event Timeline */}
      <div className="card p-4">
        <SectionHeader title="Event Timeline" />
        <p className="text-[10px] text-gray-600 mb-2">{score.events.length} signal{score.events.length === 1 ? '' : 's'} detected</p>
        <div className="divide-y divide-white/5">
          {[...score.events].sort((a, b) => parseEventTime(b.eventTime) - parseEventTime(a.eventTime)).map(e => <EventCard key={e.id} event={e} />)}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-gray-600 text-center pb-2">
        ⚠️ Estimated institutional signals. Not investment advice. All data sources clearly labeled.
      </p>
    </div>
  );
}

// ─── Leaderboard ────────────────────────────────────────────────────────────

export default function InstitutionalFlowPanel({ onTickerClick }: { onTickerClick: (ticker: string) => void }) {
  const { companies } = useMarketData();
  const [scores, setScores] = useState<FlowScore[]>(() => institutionalFlowService.getPersistedScores());
  const [loading, setLoading] = useState(false);
  const [selectedScore, setSelectedScore] = useState<FlowScore | null>(null);
  const [filter, setFilter] = useState<'all' | 'accumulation' | 'distribution'>('all');

  // Build scores from existing 13F + company data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getInstitutionalData().then(data => {
      if (cancelled) return;
      const trades = data.institutions.flatMap(inst => [
        ...inst.recentBuys.map(t => ({ ...t, institution: inst.name })),
        ...inst.recentSells.map(t => ({ ...t, institution: inst.name })),
      ]);

      const volumeData = companies
        .filter(c => c.price > 0)
        .map(c => ({
          ticker: c.ticker,
          avgVolume20d: c.sparkline.length > 0 ? 1_000_000 : 0, // approx, real volume not in model
          todayVolume: c.relativeStrength > 70 ? 2_500_000 : 800_000, // proxy from RS
          price: c.price,
          changePercent: c.changePercent,
          relativeStrength: c.relativeStrength,
        }));

      const built = institutionalFlowService.buildScores(trades, volumeData);
      if (!cancelled) { setScores(built); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [companies]);

  const filtered = useMemo(() => {
    if (filter === 'accumulation') return scores.filter(s => s.totalScore > 0).sort((a, b) => b.totalScore - a.totalScore);
    if (filter === 'distribution') return scores.filter(s => s.totalScore < 0).sort((a, b) => a.totalScore - b.totalScore);
    return scores;
  }, [scores, filter]);

  if (selectedScore) {
    return <FlowDetail score={selectedScore} onClose={() => setSelectedScore(null)} onTickerClick={onTickerClick} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold">Institutional Flow Intelligence</h2>
        <p className="text-[10px] text-gray-500 mt-0.5">Probability-based signals from SEC filings, volume anomalies, options flow, and dark pool activity</p>
      </div>

      {/* Filter */}
      <TabBar
        tabs={[
          { id: 'all', label: 'All Signals' },
          { id: 'accumulation', label: '🟢 Accumulation' },
          { id: 'distribution', label: '🔴 Distribution' },
        ]}
        active={filter}
        onChange={setFilter as (s: string) => void}
      />

      {loading && scores.length === 0 ? (
        <div className="card p-6 flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-400">Scanning for institutional signals…</span>
        </div>
      ) : (
        <>
          {/* Leaderboard */}
          <div className="space-y-2">
            {filtered.map(s => {
              const labelParts = institutionalFlowService.SIGNAL_LABEL_DISPLAY[s.signalLabel];
              const isAcc = s.totalScore > 0;
              return (
                <button
                  key={s.ticker}
                  onClick={() => setSelectedScore(s)}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  className="card p-4 w-full text-left active:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${isAcc ? 'bg-emerald-500/10' : 'bg-red-500/10'} flex items-center justify-center text-sm font-bold ${isAcc ? 'text-emerald-400' : 'text-red-400'}`}>
                      {s.ticker.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{s.ticker}</span>
                        <span className="text-[10px] text-gray-500 truncate">{s.name}</span>
                      </div>
                      <p className="text-[10px] mt-0.5">{labelParts}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-sm font-bold tabular-nums ${isAcc ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isAcc ? '+' : ''}{s.totalScore}
                      </span>
                      <p className="text-[9px] text-gray-600">Conf {s.confidence}%</p>
                    </div>
                  </div>

                  {/* Mini gauges */}
                  <div className="flex gap-3 mt-2.5">
                    {s.secConfirmationScore > 0 && <span className="text-[9px] text-emerald-400/70 bg-emerald-500/10 px-1.5 py-0.5 rounded">SEC {s.secConfirmationScore}</span>}
                    {s.optionsFlowScore > 0 && <span className="text-[9px] text-blue-400/70 bg-blue-500/10 px-1.5 py-0.5 rounded">Options {s.optionsFlowScore}</span>}
                    {s.darkPoolScore > 0 && <span className="text-[9px] text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded">Dark Pool {s.darkPoolScore}</span>}
                    <span className="text-[9px] text-gray-500 ml-auto">{s.events.length} events</span>
                  </div>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="card p-6 text-center">
              <p className="text-sm text-gray-400">No {filter === 'all' ? '' : filter} signals detected</p>
            </div>
          )}

          {/* Disclaimer */}
          <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/10">
            <p className="text-[10px] text-amber-400 leading-relaxed">
              ⚠️ <strong>Estimated institutional accumulation/distribution signals.</strong> These are probability-based indicators derived from SEC filings (delayed quarterly), volume anomalies, estimated options flow, and dark pool / off-exchange data (delayed). Not investment advice. No signal guarantees institutional intent.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
