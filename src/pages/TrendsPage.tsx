import React, { useState, useCallback, useRef } from 'react';
import { mockTrends } from '../data/mockTrends';
import { ScoreBar, SectionHeader, TabBar } from '../components/SharedComponents';
import { TechTrend, Company } from '../models/types';
import { useMarketData } from '../components/MarketDataContext';
import { CompanyDetail } from './StocksPage';

const sortOptions = [
  { id: 'momentum', label: 'Momentum' },
  { id: 'demand', label: 'Demand' },
  { id: 'investment', label: 'Investment' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'hype', label: 'Hype' },
];

function TrendCard({ trend, expanded, onToggle, onCompanyClick }: { trend: TechTrend; expanded: boolean; onToggle: () => void; onCompanyClick: (ticker: string) => void }) {
  return (
    <div className="card overflow-hidden">
      <button onClick={onToggle} className="w-full p-4 text-left">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{trend.icon}</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">{trend.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{trend.description}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-bold text-accent-400">{trend.momentumScore}</div>
            <p className="text-[10px] text-gray-500">Momentum</p>
          </div>
        </div>

        {/* Score bars */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <p className="text-[10px] text-gray-500 mb-0.5">Market Demand</p>
            <ScoreBar value={trend.marketDemandScore} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 mb-0.5">Investment Attention</p>
            <ScoreBar value={trend.investmentAttentionScore} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 mb-0.5">Public Hype</p>
            <ScoreBar value={trend.publicHypeScore} color="bg-purple-500" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 mb-0.5">Revenue Impact</p>
            <ScoreBar value={trend.realRevenueImpactScore} color="bg-blue-500" />
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Key Companies</p>
            <div className="flex flex-wrap gap-1.5">
              {trend.keyCompanies.map(t => (
                <button key={t} className="badge-blue active:scale-95 transition-transform" onClick={(e) => { e.stopPropagation(); onCompanyClick(t); }}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Emerging Players</p>
            <div className="flex flex-wrap gap-1.5">
              {trend.emergingCompanies.map(t => (
                <button key={t} className="badge-orange active:scale-95 transition-transform" onClick={(e) => { e.stopPropagation(); onCompanyClick(t); }}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Risks</p>
            <ul className="space-y-0.5">
              {trend.risks.map((r, i) => (
                <li key={i} className="text-xs text-red-400/80">• {r}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Long-term Impact</p>
            <p className="text-xs text-gray-300">{trend.longTermImpact}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Historical Comparison</p>
            <p className="text-xs text-gray-400 italic">{trend.historicalComparison}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrendsPage() {
  const { companies, trends, trendsGeneratedAt, aiStatus, runAiAnalysis, isLive } = useMarketData();
  const [sortBy, setSortBy] = useState('momentum');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const scrollPosRef = useRef(0);

  const handleCompanyClick = (ticker: string) => {
    const company = companies.find(c => c.ticker === ticker);
    if (company) {
      scrollPosRef.current = window.scrollY;
      setSelectedCompany(company);
    }
  };

  const sorted = [...trends].sort((a, b) => {
    switch (sortBy) {
      case 'demand': return b.marketDemandScore - a.marketDemandScore;
      case 'investment': return b.investmentAttentionScore - a.investmentAttentionScore;
      case 'revenue': return b.realRevenueImpactScore - a.realRevenueImpactScore;
      case 'hype': return b.publicHypeScore - a.publicHypeScore;
      default: return b.momentumScore - a.momentumScore;
    }
  });

  if (selectedCompany) return <CompanyDetail company={selectedCompany} onClose={() => { setSelectedCompany(null); requestAnimationFrame(() => window.scrollTo(0, scrollPosRef.current)); }} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Technology Trends</h1>
          <p className="text-xs text-gray-500 mt-0.5">Tracking trends that historically affect markets</p>
        </div>
        <button
          onClick={runAiAnalysis}
          disabled={aiStatus === 'running' || !isLive}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent-500/20 text-accent-400 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed active:bg-accent-500/30"
        >
          {aiStatus === 'running' ? (
            <>
              <div className="w-3 h-3 border-2 border-accent-400 border-t-transparent rounded-full animate-spin" />
              Updating...
            </>
          ) : (
            <>🤖 AI Update</>
          )}
        </button>
      </div>

      {aiStatus.startsWith('error') && (
        <div className="card p-3 flex items-center gap-2 border border-red-500/20">
          <span className="text-red-400">✗</span>
          <p className="text-xs text-red-400">{aiStatus.replace('error: ', '')}</p>
        </div>
      )}

      <TabBar tabs={sortOptions} active={sortBy} onChange={setSortBy} />

      {/* Trend ranking overview */}
      <div className="card p-4">
        <SectionHeader title="Trend Rankings" />
        <div className="space-y-2">
          {sorted.slice(0, 5).map((t, i) => (
            <div key={t.id} className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-500 w-4">{i + 1}</span>
              <span className="text-sm">{t.icon}</span>
              <span className="text-xs font-medium text-gray-300 flex-1">{t.name}</span>
              <div className="w-20">
                <ScoreBar value={sortBy === 'demand' ? t.marketDemandScore : sortBy === 'investment' ? t.investmentAttentionScore : sortBy === 'revenue' ? t.realRevenueImpactScore : sortBy === 'hype' ? t.publicHypeScore : t.momentumScore} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full trend cards */}
      <div className="space-y-3">
        {sorted.map(trend => (
          <TrendCard
            key={trend.id}
            trend={trend}
            expanded={expandedId === trend.id}
            onToggle={() => setExpandedId(expandedId === trend.id ? null : trend.id)}
            onCompanyClick={handleCompanyClick}
          />
        ))}
      </div>

      {trendsGeneratedAt && (
        <p className="text-[10px] text-gray-600 text-center">
          🤖 AI-updated · {new Date(trendsGeneratedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  );
}
