import React, { useState } from 'react';
import { mockIndexes, mockSectors, mockSentiment, mockMacroRisk, mockMarketSummary, mockHeatmapData } from '../data/mockMarketData';
import { mockCompanies } from '../data/mockCompanies';
import { ChangeIndicator, MiniSparkline, SentimentGauge, SectionHeader, Disclaimer, TabBar } from '../components/SharedComponents';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area } from 'recharts';

const perfTabs = [
  { id: 'daily', label: '1D' }, { id: 'weekly', label: '1W' }, { id: 'monthly', label: '1M' },
  { id: 'sixMonth', label: '6M' }, { id: 'yearly', label: '1Y' }, { id: 'fiveYear', label: '5Y' },
];

export default function DashboardPage() {
  const [perfPeriod, setPerfPeriod] = useState('daily');

  const topGainers = [...mockSectors].sort((a, b) => b.change - a.change).slice(0, 3);
  const topDecliners = [...mockSectors].sort((a, b) => a.change - b.change).slice(0, 3);
  const topStocks = [...mockCompanies].sort((a, b) => b.scores.overall - a.scores.overall).slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Market Overview</h1>
          <p className="text-xs text-gray-500 mt-0.5">May 19, 2026 · Mock Data</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${mockSentiment.value >= 50 ? 'badge-green' : 'badge-red'}`}>
            {mockSentiment.label}
          </span>
        </div>
      </div>

      {/* Sentiment & Risk */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <SentimentGauge value={mockSentiment.value} label={mockSentiment.label} />
        </div>
        <div className="card p-4">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">Macro Risk</p>
            <div className={`text-2xl font-bold ${
              mockMacroRisk.level === 'Low' ? 'text-emerald-400' :
              mockMacroRisk.level === 'Moderate' ? 'text-amber-400' : 'text-red-400'
            }`}>
              {mockMacroRisk.score}
            </div>
            <p className={`text-sm font-medium ${
              mockMacroRisk.level === 'Low' ? 'text-emerald-400' :
              mockMacroRisk.level === 'Moderate' ? 'text-amber-400' : 'text-red-400'
            }`}>
              {mockMacroRisk.level}
            </p>
            <div className="mt-2 space-y-1">
              {mockMacroRisk.factors.slice(0, 3).map((f, i) => (
                <p key={i} className="text-[10px] text-gray-500 truncate">• {f}</p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Indexes */}
      <div>
        <SectionHeader title="Major Indexes" />
        <TabBar tabs={perfTabs} active={perfPeriod} onChange={setPerfPeriod} />
        <div className="mt-3 space-y-2">
          {mockIndexes.map(idx => (
            <div key={idx.symbol} className="card-compact p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{idx.symbol}</span>
                  <span className="text-xs text-gray-500 truncate">{idx.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-mono">{idx.value.toLocaleString()}</span>
                  <ChangeIndicator value={idx.performance[perfPeriod as keyof typeof idx.performance]} />
                </div>
              </div>
              <MiniSparkline data={idx.sparkline} color={idx.changePercent >= 0 ? '#10b981' : '#ef4444'} />
            </div>
          ))}
        </div>
      </div>

      {/* Sector Heatmap */}
      <div>
        <SectionHeader title="Sector Heatmap" />
        <div className="grid grid-cols-2 gap-2">
          {mockHeatmapData.map(sector => (
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

      {/* Top Opportunities */}
      <div>
        <SectionHeader title="Top Opportunities" />
        <div className="space-y-2">
          {topStocks.map((c, i) => (
            <div key={c.ticker} className="card-compact p-3 flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-accent-500/20 flex items-center justify-center text-xs font-bold text-accent-400">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{c.ticker}</span>
                  <span className="text-xs text-gray-500 truncate">{c.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">Score: {c.scores.overall}</span>
                  <span className="text-xs text-gray-600">•</span>
                  <ChangeIndicator value={c.changePercent} />
                </div>
              </div>
              <MiniSparkline data={c.sparkline} color={c.changePercent >= 0 ? '#10b981' : '#ef4444'} height={24} />
            </div>
          ))}
        </div>
      </div>

      {/* AI Summary */}
      <div>
        <SectionHeader title="AI Market Brief" />
        <div className="card p-4">
          <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
            {mockMarketSummary.split('**').map((part, i) =>
              i % 2 === 1 ? <strong key={i} className="text-white">{part}</strong> : <span key={i}>{part}</span>
            )}
          </div>
          <p className="text-[10px] text-gray-600 mt-3">Generated by AI · Based on mock data · Not financial advice</p>
        </div>
      </div>

      <Disclaimer />
    </div>
  );
}
