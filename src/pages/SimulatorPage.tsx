import React, { useState, useMemo, useEffect } from 'react';
import { mockCompanies } from '../data/mockCompanies';
import { SectionHeader, TabBar, ChangeIndicator, Disclaimer } from '../components/SharedComponents';
import { PortfolioPosition, ScenarioParams } from '../models/types';
import { portfolioService } from '../services/portfolioService';
import { useMarketData } from '../components/MarketDataContext';
import { Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Area, AreaChart, ReferenceLine } from 'recharts';

const presetScenarios: { id: string; label: string; params: ScenarioParams }[] = [
  { id: 'base', label: 'Base', params: { expectedAnnualReturn: 12, volatility: 15, interestRateShock: 0, inflationShock: 0, techMultiplier: 1.0, durationMonths: 36 } },
  { id: 'conservative', label: 'Conservative', params: { expectedAnnualReturn: 6, volatility: 8, interestRateShock: 0, inflationShock: 0, techMultiplier: 0.8, durationMonths: 36 } },
  { id: 'optimistic', label: 'Optimistic', params: { expectedAnnualReturn: 25, volatility: 18, interestRateShock: -50, inflationShock: -1, techMultiplier: 1.5, durationMonths: 36 } },
  { id: 'crisis', label: 'Crisis', params: { expectedAnnualReturn: -20, volatility: 35, interestRateShock: 200, inflationShock: 3, techMultiplier: 0.5, durationMonths: 12 } },
  { id: 'tech-boom', label: 'Tech Boom', params: { expectedAnnualReturn: 40, volatility: 25, interestRateShock: -100, inflationShock: 0, techMultiplier: 2.0, durationMonths: 36 } },
  { id: 'rate-shock', label: 'Rate Shock', params: { expectedAnnualReturn: -8, volatility: 22, interestRateShock: 300, inflationShock: 2, techMultiplier: 0.7, durationMonths: 12 } },
];

interface VestingEvent {
  monthOffset: number;
  ticker: string;
  shares: number;
  isCliff: boolean;
  date: string;
}

function generateSimHistory(
  startVal: number,
  params: ScenarioParams,
  positions: PortfolioPosition[],
  vestingEvents: VestingEvent[],
) {
  const out: { date: string; value: number; sp500: number; vestEvent?: string; vestValue?: number }[] = [];
  let val = startVal;
  let sp = startVal;
  const m = params.durationMonths;
  const monthlyR = params.expectedAnnualReturn / 12 / 100;
  const monthlyV = params.volatility / Math.sqrt(12) / 100;
  const spMonthlyR = 0.10 / 12;
  const techWeight = positions.reduce((s, p) => {
    const co = mockCompanies.find(c => c.ticker === p.ticker);
    return s + (co ? (co.scores.technologyExposure / 100) * (p.allocation / 100) : 0);
  }, 0);
  const techBoost = (params.techMultiplier - 1) * techWeight;

  for (let i = 0; i <= m; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() + i);

    // Add vesting event value
    const eventsThisMonth = vestingEvents.filter(e => e.monthOffset === i);
    let vestVal = 0;
    let vestLabel: string | undefined;
    for (const ev of eventsThisMonth) {
      const pos = positions.find(p => p.ticker === ev.ticker);
      const price = pos?.currentPrice ?? 0;
      vestVal += price * ev.shares;
      vestLabel = (vestLabel ? vestLabel + ', ' : '') + `+${ev.shares} ${ev.ticker}${ev.isCliff ? ' (cliff)' : ''}`;
    }

    if (i === 0) {
      out.push({
        date: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        value: Math.round(val),
        sp500: Math.round(sp),
        vestEvent: vestLabel,
        vestValue: vestVal > 0 ? Math.round(vestVal) : undefined,
      });
      continue;
    }

    const noise = (Math.random() - 0.5) * 2 * monthlyV;
    val = val * (1 + monthlyR + techBoost / m + noise) + vestVal;
    sp = sp * (1 + spMonthlyR + (Math.random() - 0.5) * 0.02);
    out.push({
      date: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      value: Math.round(val),
      sp500: Math.round(sp),
      vestEvent: vestLabel,
      vestValue: vestVal > 0 ? Math.round(vestVal) : undefined,
    });
  }
  return out;
}

function ParamSlider({ label, value, min, max, step, suffix, onChange }: {
  label: string; value: number; min: number; max: number; step: number; suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px] text-gray-400">{label}</span>
        <span className="text-[11px] text-accent-400 font-mono">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent-500" />
    </div>
  );
}

export default function SimulatorPage() {
  const { companies } = useMarketData();
  const holdings = useMemo(() => portfolioService.getHoldings(), []);
  const rsus = useMemo(() => portfolioService.getRsuGrants(), []);

  // Build positions from portfolio
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [startingAmount, setStartingAmount] = useState(100000);

  // Initialize from portfolio on mount
  useEffect(() => {
    const getPrice = (ticker: string) => companies.find(c => c.ticker === ticker)?.price ?? 0;

    const stockPositions: PortfolioPosition[] = holdings.map(h => {
      const price = getPrice(h.ticker);
      const currentVal = price * h.shares;
      const investedVal = h.buyPrice * h.shares;
      return {
        ticker: h.ticker, name: h.name, allocation: 0,
        shares: h.shares, avgPrice: h.buyPrice, currentPrice: price,
        gain: currentVal - investedVal,
        gainPercent: investedVal > 0 ? ((currentVal - investedVal) / investedVal) * 100 : 0,
      };
    });

    const rsuPositions: PortfolioPosition[] = rsus.map(g => {
      const price = getPrice(g.ticker);
      const vested = portfolioService.getVestedShares(g);
      const currentVal = price * vested;
      const grantVal = g.grantPrice * vested;
      return {
        ticker: g.ticker, name: `${g.name} (RSU)`, allocation: 0,
        shares: vested, avgPrice: g.grantPrice, currentPrice: price,
        gain: currentVal - grantVal,
        gainPercent: grantVal > 0 ? ((currentVal - grantVal) / grantVal) * 100 : 0,
      };
    });

    // Merge same tickers (stock + RSU)
    const merged = new Map<string, PortfolioPosition>();
    for (const p of [...stockPositions, ...rsuPositions]) {
      if (merged.has(p.ticker)) {
        const existing = merged.get(p.ticker)!;
        const totalShares = existing.shares + p.shares;
        const totalCost = existing.avgPrice * existing.shares + p.avgPrice * p.shares;
        existing.shares = totalShares;
        existing.avgPrice = totalShares > 0 ? totalCost / totalShares : 0;
        existing.currentPrice = p.currentPrice;
        existing.gain = existing.gain + p.gain;
        existing.gainPercent = (totalCost > 0) ? ((p.currentPrice * totalShares - totalCost) / totalCost) * 100 : 0;
        if (!existing.name.includes('RSU') && p.name.includes('RSU')) existing.name = p.name.replace(' (RSU)', '');
      } else {
        merged.set(p.ticker, { ...p });
      }
    }

    const all = Array.from(merged.values());
    const totalVal = all.reduce((s, p) => s + p.currentPrice * p.shares, 0);
    // Compute allocations based on current value
    for (const p of all) {
      p.allocation = totalVal > 0 ? Math.round((p.currentPrice * p.shares / totalVal) * 100) : Math.round(100 / all.length);
    }

    if (all.length > 0) {
      setPositions(all);
      setStartingAmount(Math.round(totalVal));
    }
  }, [companies, holdings, rsus]);

  // Compute RSU vesting events as month offsets from now
  const vestingEvents = useMemo(() => {
    const events: VestingEvent[] = [];
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    for (const g of rsus) {
      const schedule = portfolioService.computeVestingSchedule(g);
      for (const e of schedule) {
        if (e.date <= today) continue; // Only future vesting
        const vestDate = new Date(e.date);
        const monthOffset = (vestDate.getFullYear() - now.getFullYear()) * 12 + (vestDate.getMonth() - now.getMonth());
        if (monthOffset >= 0) {
          // e.shares is the shares vesting in this event (not cumulative)
          const prevIdx = schedule.indexOf(e) - 1;
          const sharesThisEvent = prevIdx >= 0 ? e.cumulative - schedule[prevIdx].cumulative : e.cumulative;
          events.push({
            monthOffset,
            ticker: g.ticker,
            shares: sharesThisEvent,
            isCliff: e.isCliff,
            date: e.date,
          });
        }
      }
    }
    return events;
  }, [rsus]);

  const savedDuration = () => {
    try { const v = localStorage.getItem('invest_guide_sim_duration'); return v ? Number(v) : null; } catch { return null; }
  };
  const [selectedPreset, setSelectedPreset] = useState('base');
  const [params, setParams] = useState<ScenarioParams>(() => ({
    ...presetScenarios[0].params,
    durationMonths: savedDuration() ?? presetScenarios[0].params.durationMonths,
  }));
  const [view, setView] = useState('overview');
  const [showAddStock, setShowAddStock] = useState(false);
  const [searchTicker, setSearchTicker] = useState('');


  const updateParam = <K extends keyof ScenarioParams>(key: K, val: ScenarioParams[K]) => {
    setParams(p => ({ ...p, [key]: val }));
    if (key !== 'durationMonths') setSelectedPreset('custom');
    if (key === 'durationMonths') {
      try { localStorage.setItem('invest_guide_sim_duration', String(val)); } catch {}
    }
  };

  const selectPreset = (id: string) => {
    const preset = presetScenarios.find(p => p.id === id);
    if (preset) { setParams(p => ({ ...preset.params, durationMonths: p.durationMonths })); setSelectedPreset(id); }
  };

  const chartData = useMemo(() => generateSimHistory(startingAmount, params, positions, vestingEvents), [startingAmount, params, positions, vestingEvents]);
  const finalValue = chartData[chartData.length - 1]?.value || startingAmount;
  const totalReturn = finalValue - startingAmount;
  const totalReturnPct = (totalReturn / startingAmount) * 100;
  const sp500Final = chartData[chartData.length - 1]?.sp500 || startingAmount;
  const sp500ReturnPct = ((sp500Final - startingAmount) / startingAmount) * 100;

  const removePosition = (ticker: string) => {
    setPositions(prev => {
      const removed = prev.filter(p => p.ticker !== ticker);
      const total = removed.reduce((s, p) => s + p.allocation, 0);
      if (total > 0 && removed.length > 0) {
        return removed.map(p => ({ ...p, allocation: Math.round(p.allocation / total * 100) }));
      }
      return removed;
    });
  };

  const addPosition = (ticker: string) => {
    if (positions.find(p => p.ticker === ticker)) return;
    const co = mockCompanies.find(c => c.ticker === ticker);
    if (!co) return;
    const newAlloc = Math.max(5, Math.round(100 / (positions.length + 1)));
    const adjusted = positions.map(p => ({ ...p, allocation: Math.round(p.allocation * (100 - newAlloc) / 100) }));
    setPositions([...adjusted, {
      ticker: co.ticker, name: co.name, allocation: newAlloc,
      shares: Math.round(startingAmount * newAlloc / 100 / co.price),
      avgPrice: co.price * 0.95, currentPrice: co.price,
      gain: co.price * 0.05 * Math.round(startingAmount * newAlloc / 100 / co.price),
      gainPercent: 5.0,
    }]);
    setShowAddStock(false);
    setSearchTicker('');
  };

  const updateAllocation = (ticker: string, newAlloc: number) => {
    setPositions(prev => prev.map(p => p.ticker === ticker ? { ...p, allocation: newAlloc } : p));
  };

  const availableStocks = useMemo(() => {
    const existing = new Set(positions.map(p => p.ticker));
    return mockCompanies.filter(c => !existing.has(c.ticker) &&
      (searchTicker ? c.ticker.toLowerCase().includes(searchTicker.toLowerCase()) || c.name.toLowerCase().includes(searchTicker.toLowerCase()) : true)
    ).slice(0, 10);
  }, [positions, searchTicker]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Portfolio Simulator</h1>
        <p className="text-xs text-gray-500 mt-0.5">Build, test, and simulate investment strategies</p>
      </div>

      {/* Portfolio Value */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold">Simulated Portfolio</h3>
          <span className="text-[10px] text-gray-500">{positions.length} positions</span>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-2xl font-bold">${finalValue.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Start: ${startingAmount.toLocaleString()}</p>
          </div>
          <div className="ml-auto text-right">
            <ChangeIndicator value={totalReturnPct} />
            <p className="text-xs text-gray-500 mt-0.5">vs S&P: {sp500ReturnPct >= 0 ? '+' : ''}{sp500ReturnPct.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card p-4">
        <SectionHeader title="Projected Performance" />
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={totalReturn >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={totalReturn >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b7280' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#131c2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div className="bg-surface-900 border border-white/10 rounded-xl p-3 text-xs shadow-xl">
                      <p className="text-gray-400 mb-1">{label}</p>
                      <p className="text-white font-semibold">Portfolio: ${payload[0]?.value?.toLocaleString()}</p>
                      {payload[1] && <p className="text-gray-400">S&P 500: ${payload[1]?.value?.toLocaleString()}</p>}
                      {d?.vestEvent && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                          <p className="text-accent-400 font-semibold">🎯 Vesting Event</p>
                          <p className="text-white">{d.vestEvent}</p>
                          <p className="text-gray-400">+${d.vestValue?.toLocaleString() ?? '—'} added</p>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={totalReturn >= 0 ? '#10b981' : '#ef4444'}
                strokeWidth={2}
                fill="url(#simGrad)"
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (!payload?.vestEvent) return <circle key={`dot-${cx}`} cx={0} cy={0} r={0} fill="none" />;
                  return (
                    <g key={`vest-${cx}-${cy}`}>
                      <circle cx={cx} cy={cy} r={8} fill="rgba(249,115,22,0.2)" />
                      <circle cx={cx} cy={cy} r={5} fill="#f97316" stroke="#fff" strokeWidth={1.5} />
                    </g>
                  );
                }}
                activeDot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload?.vestEvent) {
                    return <circle cx={cx} cy={cy} r={7} fill="#f97316" stroke="#fff" strokeWidth={2} />;
                  }
                  return <circle cx={cx} cy={cy} r={4} fill={totalReturn >= 0 ? '#10b981' : '#ef4444'} stroke="#fff" strokeWidth={1.5} />;
                }}
              />
              <Line type="monotone" dataKey="sp500" stroke="#6b7280" strokeWidth={1} strokeDasharray="4 4" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[9px] text-gray-600 mt-1 text-center">Orange dots = vesting events • Tap for details</p>
        {/* Duration slider directly under chart */}
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-400">Duration</span>
            <span className="text-[11px] text-accent-400 font-mono">
              {params.durationMonths >= 12 ? `${(params.durationMonths / 12).toFixed(params.durationMonths % 12 ? 1 : 0)} years` : `${params.durationMonths} mo`}
            </span>
          </div>
          <input type="range" min={3} max={120} step={3} value={params.durationMonths}
            onChange={e => updateParam('durationMonths', Number(e.target.value))}
            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent-500" />
        </div>
      </div>

      {/* Scenario Presets */}
      <div>
        <SectionHeader title="Scenario" />
        <div className="flex gap-1.5 flex-wrap">
          {presetScenarios.map(s => (
            <button key={s.id} onClick={() => selectPreset(s.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                selectedPreset === s.id ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30' : 'bg-white/5 text-gray-400 border border-white/10'
              }`}>
              {s.label}
            </button>
          ))}
          {selectedPreset === 'custom' && (
            <span className="px-2.5 py-1.5 rounded-lg text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30">Custom</span>
          )}
        </div>
      </div>

      {/* Scenario Sliders */}
      <div className="card p-4">
        <SectionHeader title="Scenario Parameters" />
        <div className="space-y-3">
          <ParamSlider label="Expected Annual Return" value={params.expectedAnnualReturn} min={-40} max={60} step={1} suffix="%" onChange={v => updateParam('expectedAnnualReturn', v)} />
          <ParamSlider label="Volatility" value={params.volatility} min={5} max={50} step={1} suffix="%" onChange={v => updateParam('volatility', v)} />
          <ParamSlider label="Interest Rate Shock" value={params.interestRateShock} min={-200} max={500} step={25} suffix=" bps" onChange={v => updateParam('interestRateShock', v)} />
          <ParamSlider label="Inflation Shock" value={params.inflationShock} min={-3} max={8} step={0.5} suffix="%" onChange={v => updateParam('inflationShock', v)} />
          <ParamSlider label="Tech Multiplier" value={params.techMultiplier} min={0.2} max={3.0} step={0.1} suffix="x" onChange={v => updateParam('techMultiplier', v)} />
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-400">Starting Capital</span>
            <span className="text-[11px] text-accent-400 font-mono">${startingAmount.toLocaleString()}</span>
          </div>
          <input type="range" min={10000} max={1000000} step={10000} value={startingAmount}
            onChange={e => setStartingAmount(Number(e.target.value))}
            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent-500" />
        </div>
      </div>

      {/* View tabs */}
      <TabBar
        tabs={[{ id: 'overview', label: 'Overview' }, { id: 'positions', label: 'Positions' }, { id: 'vesting', label: 'Vesting' }]}
        active={view}
        onChange={setView}
      />

      {view === 'overview' && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Return', value: `${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct.toFixed(1)}%`, color: totalReturnPct >= 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'vs S&P 500', value: `${(totalReturnPct - sp500ReturnPct) >= 0 ? '+' : ''}${(totalReturnPct - sp500ReturnPct).toFixed(1)}%`, color: (totalReturnPct - sp500ReturnPct) >= 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Duration', value: params.durationMonths >= 12 ? `${(params.durationMonths / 12).toFixed(params.durationMonths % 12 ? 1 : 0)} years` : `${params.durationMonths} months`, color: 'text-gray-300' },
            { label: 'Volatility', value: `${params.volatility}%`, color: 'text-amber-400' },
            { label: 'Positions', value: `${positions.length}`, color: 'text-gray-300' },
            { label: 'Tech Weight', value: `${Math.round(positions.reduce((s, p) => { const co = mockCompanies.find(c => c.ticker === p.ticker); return s + (co ? co.scores.technologyExposure * p.allocation / 100 : 0); }, 0))}`, color: 'text-blue-400' },
            { label: 'Vest Events', value: `${vestingEvents.filter(e => e.monthOffset <= params.durationMonths).length}`, color: 'text-violet-400' },
          ].map(m => (
            <div key={m.label} className="card-compact p-3">
              <p className="text-[10px] text-gray-500">{m.label}</p>
              <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {view === 'positions' && (
        <div className="space-y-2">
          {positions.map(p => (
            <div key={p.ticker} className="card-compact p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{p.ticker}</span>
                  <span className="text-xs text-gray-500">{p.name}</span>
                </div>
                <button onClick={() => removePosition(p.ticker)} className="text-red-400/60 hover:text-red-400 text-xs px-1">✕</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 w-16">Allocation</span>
                <input type="range" min={1} max={50} value={p.allocation}
                  onChange={e => updateAllocation(p.ticker, Number(e.target.value))}
                  className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent-500" />
                <span className="text-xs text-accent-400 font-mono w-8 text-right">{p.allocation}%</span>
              </div>
            </div>
          ))}

          {/* Add stock button */}
          {!showAddStock ? (
            <button onClick={() => setShowAddStock(true)}
              className="w-full p-3 border border-dashed border-white/10 rounded-2xl text-sm text-gray-500 hover:text-accent-400 hover:border-accent-500/30 transition-all">
              + Add Stock
            </button>
          ) : (
            <div className="card p-3 space-y-2">
              <input
                type="text" value={searchTicker}
                onChange={e => setSearchTicker(e.target.value)}
                placeholder="Search ticker or name..."
                className="input-field text-sm"
                autoFocus
              />
              <div className="max-h-40 overflow-y-auto space-y-1">
                {availableStocks.map(c => (
                  <button key={c.ticker} onClick={() => addPosition(c.ticker)}
                    className="w-full text-left p-2 rounded-lg hover:bg-white/5 flex items-center gap-2 transition-all">
                    <span className="text-xs font-semibold text-accent-400">{c.ticker}</span>
                    <span className="text-xs text-gray-400 truncate">{c.name}</span>
                    <span className="text-[10px] text-gray-600 ml-auto">{c.sector}</span>
                  </button>
                ))}
                {availableStocks.length === 0 && <p className="text-xs text-gray-600 text-center py-2">No matches</p>}
              </div>
              <button onClick={() => { setShowAddStock(false); setSearchTicker(''); }}
                className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
            </div>
          )}

          <p className="text-[10px] text-gray-600 text-center">
            Total allocation: {positions.reduce((s, p) => s + p.allocation, 0)}%
          </p>
        </div>
      )}

      {view === 'vesting' && (
        <div className="space-y-3">
          {vestingEvents.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-gray-400 text-sm font-medium mb-1">No upcoming vesting events</p>
              <p className="text-gray-600 text-xs">Add RSU grants in Portfolio to see vesting projections</p>
            </div>
          ) : (
            <>
              <div className="card p-4">
                <SectionHeader title="Upcoming RSU Vesting" />
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {vestingEvents
                    .filter(e => e.monthOffset <= params.durationMonths)
                    .map((e, i) => {
                      const pos = positions.find(p => p.ticker === e.ticker);
                      const estValue = (pos?.currentPrice ?? 0) * e.shares;
                      return (
                        <div key={i} className="flex items-center gap-3 text-xs py-1.5 border-b border-white/5 last:border-0">
                          <span className={`w-2 h-2 rounded-full ${e.isCliff ? 'bg-accent-400' : 'bg-emerald-500'}`} />
                          <span className="text-gray-400 w-20">{e.date}</span>
                          <span className="font-semibold">{e.ticker}</span>
                          <span className={`${e.isCliff ? 'text-accent-400' : ''}`}>
                            +{e.shares} shares{e.isCliff ? ' (cliff)' : ''}
                          </span>
                          <span className="text-gray-500 ml-auto">~${estValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
              <div className="card p-4">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Total vesting in projection</span>
                  <span className="text-emerald-400 font-semibold">
                    +{vestingEvents.filter(e => e.monthOffset <= params.durationMonths).reduce((s, e) => s + e.shares, 0)} shares
                  </span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-400">Est. vesting value (current prices)</span>
                  <span className="text-white font-semibold">
                    ${vestingEvents
                      .filter(e => e.monthOffset <= params.durationMonths)
                      .reduce((s, e) => s + (positions.find(p => p.ticker === e.ticker)?.currentPrice ?? 0) * e.shares, 0)
                      .toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <Disclaimer />
    </div>
  );
}
