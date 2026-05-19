import React, { useState } from 'react';
import { mockInstitutions } from '../data/mockInstitutions';
import { SectionHeader, TabBar, ChangeIndicator } from '../components/SharedComponents';
import { Institution, Company } from '../models/types';
import { useMarketData } from '../components/MarketDataContext';
import { CompanyDetail } from './StocksPage';

function InstitutionDetail({ inst, onClose, onTickerClick }: { inst: Institution; onClose: () => void; onTickerClick: (ticker: string) => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-surface-950/95 overflow-y-auto">
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
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">{inst.description}</p>
        </div>

        {/* Top Holdings */}
        <div className="card p-4 mb-3">
          <SectionHeader title="Top Holdings" />
          <div className="space-y-2">
            {inst.topHoldings.map(h => (
              <button key={h.ticker} onClick={() => onTickerClick(h.ticker)} className="flex items-center gap-3 w-full text-left active:bg-white/5 rounded-lg -mx-1 px-1 py-0.5 transition-colors">
                <span className="text-sm font-semibold w-12 text-accent-400">{h.ticker}</span>
                <span className="text-xs text-gray-400 flex-1 truncate">{h.name}</span>
                <span className="text-xs text-gray-300 font-mono">{h.weight}%</span>
                <span className="text-xs text-gray-500">{h.value}</span>
                {h.change !== 0 && (
                  <span className={`text-[10px] ${h.change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {h.change > 0 ? '↑' : '↓'}{Math.abs(h.change)}%
                  </span>
                )}
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
    </div>
  );
}

export default function InstitutionsPage() {
  const { companies } = useMarketData();
  const [selected, setSelected] = useState<Institution | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [view, setView] = useState('investors');

  const allBuys = mockInstitutions.flatMap(i => i.recentBuys.map(t => ({ ...t, institution: i.name })));
  const allSells = mockInstitutions.flatMap(i => i.recentSells.map(t => ({ ...t, institution: i.name })));

  const handleTickerClick = (ticker: string) => {
    const company = companies.find(c => c.ticker === ticker);
    if (company) setSelectedCompany(company);
  };

  if (selectedCompany) return <CompanyDetail company={selectedCompany} onClose={() => setSelectedCompany(null)} />;
  if (selected) return <InstitutionDetail inst={selected} onClose={() => setSelected(null)} onTickerClick={handleTickerClick} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Institutional Tracker</h1>
        <p className="text-xs text-gray-500 mt-0.5">Track publicly available institutional investor data</p>
      </div>

      <TabBar
        tabs={[{ id: 'investors', label: 'Investors' }, { id: 'buys', label: 'Recent Buys' }, { id: 'sells', label: 'Recent Sells' }]}
        active={view}
        onChange={setView}
      />

      {view === 'investors' && (
        <div className="space-y-2">
          {mockInstitutions.map(inst => (
            <button
              key={inst.id}
              onClick={() => setSelected(inst)}
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
                <span className={`text-[10px] ${
                  inst.confidenceSignal === 'Very High' ? 'badge-green' :
                  inst.confidenceSignal === 'High' ? 'badge-blue' : 'badge-orange'
                }`}>{inst.confidenceSignal}</span>
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
        <div className="card p-4">
          <SectionHeader title="Recent Institutional Buys" />
          <div className="space-y-3">
            {allBuys.map((t, i) => (
              <button key={i} onClick={() => handleTickerClick(t.ticker)} className="flex items-center gap-3 pb-2 border-b border-white/5 last:border-0 w-full text-left active:bg-white/5 rounded-lg transition-colors">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] text-emerald-400">+</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-accent-400">{t.ticker}</span>
                  <span className="text-xs text-gray-500 ml-2">{t.name}</span>
                  <p className="text-[10px] text-gray-500 mt-0.5">{(t as any).institution}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-emerald-400">{t.value}</p>
                  <p className="text-[10px] text-gray-500">{t.date}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {view === 'sells' && (
        <div className="card p-4">
          <SectionHeader title="Recent Institutional Sells" />
          <div className="space-y-3">
            {allSells.map((t, i) => (
              <button key={i} onClick={() => handleTickerClick(t.ticker)} className="flex items-center gap-3 pb-2 border-b border-white/5 last:border-0 w-full text-left active:bg-white/5 rounded-lg transition-colors">
                <span className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center text-[10px] text-red-400">−</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-accent-400">{t.ticker}</span>
                  <span className="text-xs text-gray-500 ml-2">{t.name}</span>
                  <p className="text-[10px] text-gray-500 mt-0.5">{(t as any).institution}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-red-400">{t.value}</p>
                  <p className="text-[10px] text-gray-500">{t.date}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
