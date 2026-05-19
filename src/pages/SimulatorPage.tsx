import React, { useState, useMemo } from 'react';
import { mockCompanies } from '../data/mockCompanies';
import { SectionHeader, TabBar, ChangeIndicator, Disclaimer } from '../components/SharedComponents';
import { PortfolioPosition, ScenarioParams } from '../models/types';
import { Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Area, AreaChart } from 'recharts';

const presetScenarios: { id: string; label: string; params: ScenarioParams }[] = [
  { id: 'base', label: 'Base', params: { expectedAnnualReturn: 12, volatility: 15, interestRateShock: 0, inflationShock: 0, techMultiplier: 1.0, durationMonths: 12 } },
  { id: 'conservative', label: 'Conservative', params: { expectedAnnualReturn: 6, volatility: 8, interestRateShock: 0, inflationShock: 0, techMultiplier: 0.8, durationMonths: 12 } },
  { id: 'optimistic', label: 'Optimistic', params: { expectedAnnualReturn: 25, volatility: 18, interestRateShock: -50, inflationShock: -1, techMultiplier: 1.5, durationMonths: 12 } },
  { id: 'crisis', label: 'Crisis', params: { expectedAnnualReturn: -20, volatility: 35, interestRateShock: 200, inflationShock: 3, techMultiplier: 0.5, durationMonths: 12 } },
  { id: 'tech-boom', label: 'Tech Boom', params: { expectedAnnualReturn: 40, volatility: 25, interestRateShock: -100, inflationShock: 0, techMultiplier: 2.0, durationMonths: 12 } },
  { id: 'rate-shock', label: 'Rate Shock', params: { expectedAnnualReturn: -8, volatility: 22, interestRateShock: 300, inflationShock: 2, techMultiplier: 0.7, durationMonths: 12 } },
];

function generateSimHistory(startVal: number, params: ScenarioParams, positions: PortfolioPosition[]) {
  const out: { date: string; value: number; sp500: number }[] = [];
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
    const noise = (Math.random() - 0.5) * 2 * monthlyV;
    val = val * (1 + monthlyR + techBoost / m + noise);
    sp = sp * (1 + spMonthlyR + (Math.random() - 0.5) * 0.02);
    out.push({
      date: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      value: Math.round(val),
      sp500: Math.round(sp),
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
  const [positions, setPositions] = useState<PortfolioPosition[]>([
    { ticker: 'NVDA', name: 'NVIDIA', allocation: 25, shares: 18, avgPrice: 120, currentPrice: 138.72, gain: 337, gainPercent: 15.6 },
    { ticker: 'MSFT', name: 'Microsoft', allocation: 20, shares: 5, avgPrice: 380, currentPrice: 415.28, gain: 176.4, gainPercent: 9.3 },
    { ticker: 'AMD', name: 'AMD', allocation: 15, shares: 10, avgPrice: 140, currentPrice: 154.62, gain: 146.2, gainPercent: 10.4 },
    { ticker: 'AVGO', name: 'Broadcom', allocation: 15, shares: 8, avgPrice: 160, currentPrice: 186.45, gain: 211.6, gainPercent: 16.5 },
    { ticker: 'META', name: 'Meta', allocation: 15, shares: 2, avgPrice: 480, currentPrice: 582.14, gain: 204.3, gainPercent: 21.3 },
    { ticker: 'CRWD', name: 'CrowdStrike', allocation: 10, shares: 3, avgPrice: 290, currentPrice: 338.92, gain: 146.8, gainPercent: 16.9 },
  ]);
  const [startingAmount, setStartingAmount] = useState(100000);
  const [selectedPreset, setSelectedPreset] = useState('base');
  const [params, setParams] = useState<ScenarioParams>(presetScenarios[0].params);
  const [view, setView] = useState('overview');
  const [showAddStock, setShowAddStock] = useState(false);
  const [searchTicker, setSearchTicker] = useState('');

  const updateParam = <K extends keyof ScenarioParams>(key: K, val: ScenarioParams[K]) => {
    setParams(p => ({ ...p, [key]: val }));
    setSelectedPreset('custom');
  };

  const selectPreset = (id: string) => {
    const preset = presetScenarios.find(p => p.id === id);
    if (preset) { setParams(preset.params); setSelectedPreset(id); }
  };

  const chartData = useMemo(() => generateSimHistory(startingAmount, params, positions), [startingAmount, params, positions]);
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
        <div className="h-48">
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
              <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#131c2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                formatter={(v: number, name: string) => [`$${v.toLocaleString()}`, name === 'value' ? 'Portfolio' : 'S&P 500']}
              />
              <Area type="monotone" dataKey="value" stroke={totalReturn >= 0 ? '#10b981' : '#ef4444'} strokeWidth={2} fill="url(#simGrad)" />
              <Line type="monotone" dataKey="sp500" stroke="#6b7280" strokeWidth={1} strokeDasharray="4 4" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
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
          <ParamSlider label="Duration" value={params.durationMonths} min={3} max={60} step={3} suffix=" mo" onChange={v => updateParam('durationMonths', v)} />
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
        tabs={[{ id: 'overview', label: 'Overview' }, { id: 'positions', label: 'Positions' }]}
        active={view}
        onChange={setView}
      />

      {view === 'overview' && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Return', value: `${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct.toFixed(1)}%`, color: totalReturnPct >= 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'vs S&P 500', value: `${(totalReturnPct - sp500ReturnPct) >= 0 ? '+' : ''}${(totalReturnPct - sp500ReturnPct).toFixed(1)}%`, color: (totalReturnPct - sp500ReturnPct) >= 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Duration', value: `${params.durationMonths} months`, color: 'text-gray-300' },
            { label: 'Volatility', value: `${params.volatility}%`, color: 'text-amber-400' },
            { label: 'Positions', value: `${positions.length}`, color: 'text-gray-300' },
            { label: 'Tech Weight', value: `${Math.round(positions.reduce((s, p) => { const co = mockCompanies.find(c => c.ticker === p.ticker); return s + (co ? co.scores.technologyExposure * p.allocation / 100 : 0); }, 0))}`, color: 'text-blue-400' },
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

      <Disclaimer />
    </div>
  );
}
