import React, { useState } from 'react';
import { TabId } from './models/types';
import DashboardPage from './pages/DashboardPage';
import TrendsPage from './pages/TrendsPage';
import StocksPage from './pages/StocksPage';
import InstitutionsPage from './pages/InstitutionsPage';

import AgentPage from './pages/AgentPage';
import SettingsPage from './pages/SettingsPage';
import PortfolioPage from './pages/PortfolioPage';
import { RefreshProvider, useRefresh } from './components/RefreshContext';
import { MarketDataProvider } from './components/MarketDataContext';
import { userPreferenceService } from './services/userPreferenceService';

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'trends', label: 'Trends', icon: '◎' },
  { id: 'stocks', label: 'Stocks', icon: '◈' },
  { id: 'institutions', label: 'Inst.', icon: '◉' },
  { id: 'portfolio', label: 'Portfolio', icon: '◫' },
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
    agent: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 1.5}>
        <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    portfolio: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 1.5}>
        <path d="M3 10h18M3 6h18M3 14h10m-10 4h6m5-8v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1h14a1 1 0 011 1v2" strokeLinecap="round" strokeLinejoin="round" />
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
    portfolio: <PortfolioPage />,
    agent: <AgentPage />,
    settings: <SettingsPage />,
  };

  return (
    <RefreshProvider>
      <MarketDataProvider>
        <AppContent activeTab={activeTab} setActiveTab={setActiveTab} pages={pages} />
      </MarketDataProvider>
    </RefreshProvider>
  );
}

function AppContent({ activeTab, setActiveTab, pages }: {
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
  pages: Record<TabId, JSX.Element>;
}) {
  const { lastRefresh, isRefreshing, triggerRefresh } = useRefresh();
  const prefs = userPreferenceService.getPreferences();

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      {/* Top header bar — fixed with safe area inset */}
      <header className="fixed top-0 left-0 right-0 z-30 bg-surface-950/90 backdrop-blur-xl border-b border-white/5" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-accent-400">InvestGuide</span>
            {prefs.liveMode && prefs.openaiApiKey && (
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[9px] font-semibold uppercase tracking-wider">Live</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {prefs.autoRefresh && (
              <span className="text-[9px] text-gray-500">
                {prefs.refreshIntervalSeconds}s
              </span>
            )}
            <span className="text-[9px] text-gray-600">
              {new Date(lastRefresh).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button
              onClick={triggerRefresh}
              disabled={isRefreshing}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                isRefreshing ? 'bg-accent-500/20 animate-spin' : 'bg-white/5 hover:bg-white/10 active:bg-accent-500/20'
              }`}
              aria-label="Refresh data"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2}>
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main content — offset for fixed header */}
      <main className="px-4 pb-24 max-w-lg mx-auto" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 52px)' }}>
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
