import React, { useState } from 'react';
import { TabId } from './models/types';
import DashboardPage from './pages/DashboardPage';
import TrendsPage from './pages/TrendsPage';
import StocksPage from './pages/StocksPage';
import InstitutionsPage from './pages/InstitutionsPage';
import SimulatorPage from './pages/SimulatorPage';
import AgentPage from './pages/AgentPage';
import SettingsPage from './pages/SettingsPage';

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'trends', label: 'Trends', icon: '◎' },
  { id: 'stocks', label: 'Stocks', icon: '◈' },
  { id: 'institutions', label: 'Inst.', icon: '◉' },
  { id: 'simulator', label: 'Sim', icon: '◧' },
  { id: 'agent', label: 'Agent', icon: '◬' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

function NavIcon({ id, active }: { id: TabId; active: boolean }) {
  const icons: Record<TabId, JSX.Element> = {
    home: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 1.5}>
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1m-2 0h2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    trends: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 1.5}>
        <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    stocks: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 1.5}>
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    institutions: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 1.5}>
        <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    simulator: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 1.5}>
        <path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm10 0a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    agent: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 1.5}>
        <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    settings: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 1.5}>
        <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };
  return icons[id];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [showDisclaimer, setShowDisclaimer] = useState(() => !localStorage.getItem('invest_guide_disclaimer_accepted'));

  if (showDisclaimer) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center text-3xl mx-auto mb-6 shadow-lg shadow-accent-500/20">
            📊
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">InvestGuide</h1>
          <p className="text-sm text-gray-400 mb-6">AI-Powered Investment Research</p>

          <div className="card p-5 text-left mb-6">
            <h2 className="text-sm font-semibold text-amber-400 mb-3">⚠️ Important Disclaimer</h2>
            <div className="text-xs text-gray-400 space-y-2 leading-relaxed">
              <p><strong className="text-gray-300">This is not financial advice.</strong> All outputs are research-based estimates and simulations.</p>
              <p>• This application is for research, simulation, and education only</p>
              <p>• It is not a licensed financial advisor</p>
              <p>• You are responsible for your own investment decisions</p>
              <p>• Data may be delayed, incomplete, or simulated</p>
              <p>• Past performance does not guarantee future results</p>
              <p>• Simulations are hypothetical and may not reflect real outcomes</p>
            </div>
          </div>

          <div className="card p-4 text-left mb-6">
            <h3 className="text-xs font-semibold text-gray-300 mb-2">🔒 Privacy</h3>
            <div className="text-xs text-gray-500 space-y-1">
              <p>• All data stored locally on your device</p>
              <p>• No personal financial data sent externally</p>
              <p>• You control all API connections</p>
            </div>
          </div>

          <button
            onClick={() => {
              localStorage.setItem('invest_guide_disclaimer_accepted', 'true');
              setShowDisclaimer(false);
            }}
            className="btn-primary w-full text-base py-3"
          >
            I Understand — Continue
          </button>
          <p className="text-[10px] text-gray-600 mt-3">By continuing, you acknowledge this is not financial advice</p>
        </div>
      </div>
    );
  }

  const pages: Record<TabId, JSX.Element> = {
    home: <DashboardPage />,
    trends: <TrendsPage />,
    stocks: <StocksPage />,
    institutions: <InstitutionsPage />,
    simulator: <SimulatorPage />,
    agent: <AgentPage />,
    settings: <SettingsPage />,
  };

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      {/* Status bar spacer */}
      <div className="h-[env(safe-area-inset-top,0px)]" />

      {/* Main content */}
      <main className="px-4 pt-2 pb-24 max-w-lg mx-auto">
        {pages[activeTab]}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface-900/95 backdrop-blur-xl border-t border-white/5 safe-bottom z-40">
        <div className="max-w-lg mx-auto flex items-center justify-around px-1 py-1.5">
          {tabs.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${
                  active ? 'text-accent-400' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <NavIcon id={tab.id} active={active} />
                <span className={`text-[9px] font-medium ${active ? 'text-accent-400' : 'text-gray-500'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
