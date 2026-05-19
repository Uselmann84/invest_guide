import React, { useState, useMemo } from 'react';
import { simulationEngine } from '../services/simulationEngine';
import { SectionHeader, TabBar, ChangeIndicator, Disclaimer } from '../components/SharedComponents';
import { SimulatedPortfolio } from '../models/types';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

const scenarioOptions = [
  { id: 'base', label: 'Base' },
  { id: 'conservative', label: 'Conservative' },
  { id: 'optimistic', label: 'Optimistic' },
  { id: 'crisis', label: 'Crisis' },
  { id: 'tech-boom', label: 'Tech Boom' },
  { id: 'rate-shock', label: 'Rate Shock' },
];

function PortfolioChart({ data }: { data: { date: string; value: number }[] }) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b7280' }} tickFormatter={v => v.slice(5)} />
          <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ background: '#131c2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
            formatter={(v: number) => [`$${v.toLocaleString()}`, 'Value']}
            labelFormatter={l => l}
          />
          <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function SimulatorPage() {
  const [portfolios] = useState<SimulatedPortfolio[]>(() => simulationEngine.getDefaultPortfolios());
  const [activePortfolio, setActivePortfolio] = useState(0);
  const [scenario, setScenario] = useState('base');
  const [view, setView] = useState('overview');

  const portfolio = portfolios[activePortfolio];
  const scenarioPerf = useMemo(
    () => scenario === 'base' ? portfolio.performance : simulationEngine.runScenario(portfolio, scenario),
    [portfolio, scenario]
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Portfolio Simulator</h1>
        <p className="text-xs text-gray-500 mt-0.5">Simulate and backtest investment strategies</p>
      </div>

      {/* Portfolio header */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">{portfolio.name}</h3>
          <span className="badge-orange">{portfolio.strategy}</span>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-2xl font-bold">${scenarioPerf.totalReturn > 0
              ? (portfolio.startingAmount + scenarioPerf.totalReturn).toLocaleString(undefined, { maximumFractionDigits: 0 })
              : (portfolio.startingAmount + scenarioPerf.totalReturn).toLocaleString(undefined, { maximumFractionDigits: 0 })
            }</p>
            <p className="text-xs text-gray-500">Starting: ${portfolio.startingAmount.toLocaleString()}</p>
          </div>
          <div className="ml-auto text-right">
            <ChangeIndicator value={scenarioPerf.totalReturnPercent} />
            <p className="text-xs text-gray-500 mt-0.5">Total Return</p>
          </div>
        </div>
      </div>

      {/* Scenario selector */}
      <div>
        <SectionHeader title="Scenario" />
        <TabBar tabs={scenarioOptions} active={scenario} onChange={setScenario} />
      </div>

      {/* Chart */}
      <div className="card p-4">
        <SectionHeader title="Portfolio Value" />
        <PortfolioChart data={scenarioPerf.valueHistory} />
      </div>

      {/* View tabs */}
      <TabBar
        tabs={[{ id: 'overview', label: 'Overview' }, { id: 'positions', label: 'Positions' }, { id: 'metrics', label: 'Metrics' }]}
        active={view}
        onChange={setView}
      />

      {view === 'overview' && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Return', value: `${scenarioPerf.totalReturnPercent >= 0 ? '+' : ''}${scenarioPerf.totalReturnPercent.toFixed(1)}%`, color: scenarioPerf.totalReturnPercent >= 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Max Drawdown', value: `${scenarioPerf.maxDrawdown}%`, color: 'text-red-400' },
            { label: 'Volatility', value: `${scenarioPerf.volatility}%`, color: 'text-amber-400' },
            { label: 'Sharpe Ratio', value: scenarioPerf.sharpeRatio.toFixed(2), color: scenarioPerf.sharpeRatio > 1 ? 'text-emerald-400' : 'text-amber-400' },
            { label: 'vs S&P 500', value: `${scenarioPerf.vs_sp500 >= 0 ? '+' : ''}${scenarioPerf.vs_sp500}%`, color: scenarioPerf.vs_sp500 >= 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'vs Nasdaq', value: `${scenarioPerf.vs_nasdaq >= 0 ? '+' : ''}${scenarioPerf.vs_nasdaq}%`, color: scenarioPerf.vs_nasdaq >= 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Risk Score', value: `${scenarioPerf.riskScore}/100`, color: scenarioPerf.riskScore > 60 ? 'text-red-400' : 'text-amber-400' },
            { label: 'Positions', value: `${portfolio.positions.length}`, color: 'text-gray-300' },
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
          {portfolio.positions.map(p => (
            <div key={p.ticker} className="card-compact p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{p.ticker}</span>
                  <span className="text-xs text-gray-500">{p.name}</span>
                </div>
                <span className="text-xs text-gray-400">{p.allocation}%</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500">{p.shares} shares @ ${p.avgPrice}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300">${p.currentPrice}</span>
                  <span className={`text-xs ${p.gainPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {p.gainPercent >= 0 ? '+' : ''}{p.gainPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'metrics' && (
        <div className="card p-4">
          <SectionHeader title="Monthly Returns" />
          <div className="grid grid-cols-6 gap-1">
            {scenarioPerf.monthlyReturns.map((r, i) => (
              <div key={i} className={`text-center p-1.5 rounded-lg text-[10px] font-mono ${
                r >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
              }`}>
                <p className="text-[8px] text-gray-500">M{i + 1}</p>
                {r >= 0 ? '+' : ''}{r.toFixed(1)}%
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-white/5 rounded-xl">
            <p className="text-[10px] text-gray-500 uppercase mb-1">AI Performance Note</p>
            <p className="text-xs text-gray-300 leading-relaxed">
              This portfolio shows {scenarioPerf.totalReturnPercent > 0 ? 'positive' : 'negative'} returns in the{' '}
              {scenario} scenario. Key drivers: heavy AI/semiconductor exposure and technology momentum.
              {scenarioPerf.totalReturnPercent > 20 && ' Returns may not be sustainable — consider rebalancing.'}
              {scenarioPerf.totalReturnPercent < 0 && ' Drawdown is within expected range for this risk profile.'}
            </p>
          </div>
        </div>
      )}

      <Disclaimer />
    </div>
  );
}
