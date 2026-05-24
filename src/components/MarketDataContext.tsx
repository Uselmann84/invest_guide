// MarketDataContext — provides live market data throughout the app
// Yahoo Finance for real prices, OpenAI for analysis
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { IndexData, Company, SectorPerformance, MarketSentiment, MacroRisk, PricePoint, Timeframe, TechTrend } from '../models/types';
import { marketDataService } from '../services/marketDataService';
import { mockIndexes, mockSectors, mockSentiment, mockMacroRisk, mockMarketSummary, mockHeatmapData } from '../data/mockMarketData';
import { mockCompanies } from '../data/mockCompanies';
import { mockTrends } from '../data/mockTrends';
import { useRefresh } from './RefreshContext';
import { scoringEngine } from '../services/scoringEngine';
import { userPreferenceService } from '../services/userPreferenceService';

interface MarketDataContextValue {
  indexes: IndexData[];
  companies: Company[];
  sectors: SectorPerformance[];
  sentiment: MarketSentiment;
  macroRisk: MacroRisk;
  summary: string;
  heatmap: typeof mockHeatmapData;
  isLive: boolean;
  isLoading: boolean;
  aiStatus: string; // '', 'running', 'done', 'error: ...'
  aiGeneratedAt: number | null; // timestamp of last AI generation
  dataSource: string; // 'Yahoo Finance' | 'Demo Data' | 'Cached'
  lastUpdate: number;
  trends: TechTrend[];
  trendsGeneratedAt: number | null;
  fetchHistory: (ticker: string, timeframe: Timeframe) => Promise<PricePoint[]>;
  fetchIndexHistory: (indexSymbol: string, timeframe: Timeframe) => Promise<PricePoint[]>;
  runAiAnalysis: () => Promise<void>;
  runDataSummary: () => void;
}

const MarketDataContext = createContext<MarketDataContextValue>({
  indexes: mockIndexes,
  companies: mockCompanies,
  sectors: mockSectors,
  sentiment: mockSentiment,
  macroRisk: mockMacroRisk,
  summary: mockMarketSummary,
  heatmap: mockHeatmapData,
  isLive: false,
  isLoading: false,
  aiStatus: '',
  aiGeneratedAt: null,
  dataSource: 'Demo Data',
  lastUpdate: Date.now(),
  trends: mockTrends,
  trendsGeneratedAt: null,
  fetchHistory: async () => [],
  fetchIndexHistory: async () => [],
  runAiAnalysis: async () => {},
  runDataSummary: () => {},
});

export function MarketDataProvider({ children }: { children: React.ReactNode }) {
  const { lastRefresh } = useRefresh();
  const [indexes, setIndexes] = useState<IndexData[]>(mockIndexes);
  const [companies, setCompanies] = useState<Company[]>(mockCompanies);
  const [sectors, setSectors] = useState<SectorPerformance[]>(mockSectors);
  const [sentiment, setSentiment] = useState<MarketSentiment>(mockSentiment);
  const [macroRisk, setMacroRisk] = useState<MacroRisk>(mockMacroRisk);
  const [summary, setSummary] = useState(mockMarketSummary);
  const [heatmap, setHeatmap] = useState(mockHeatmapData);
  const [isLoading, setIsLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  const [aiGeneratedAt, setAiGeneratedAt] = useState<number | null>(null);
  const [dataSource, setDataSource] = useState('Demo Data');
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [trends, setTrends] = useState<TechTrend[]>(mockTrends);
  const [trendsGeneratedAt, setTrendsGeneratedAt] = useState<number | null>(null);
  const fetchingRef = useRef(false);
  const refreshCountRef = useRef(0); // track manual refreshes vs initial load

  // Clear stale cache on app version change to ensure fresh sparkline data
  useEffect(() => {
    const cacheVersion = 'v5_structured_brief';
    if (localStorage.getItem('invest_guide_cache_version') !== cacheVersion) {
      marketDataService.clearCache();
      localStorage.setItem('invest_guide_cache_version', cacheVersion);
    }
  }, []);

  // Restore persisted AI brief and trends on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('invest_guide_ai_brief');
      if (stored) {
        const { summary: s, sentiment: sen, macroRisk: mr, heatmap: hm, generatedAt } = JSON.parse(stored);
        if (s) {
          // Strip any leaked JSON tail from older buggy generations
          let cleaned = s as string;
          const cutMatch = cleaned.match(/[",}\s]*"(heatmap|sentiment|macroRisk)"\s*:/);
          if (cutMatch && cutMatch.index !== undefined) cleaned = cleaned.slice(0, cutMatch.index);
          cleaned = cleaned.replace(/[\s",}\]]+$/g, '').trim();
          setSummary(cleaned); setAiStatus('done'); setAiGeneratedAt(generatedAt);
        }
        if (sen) setSentiment(sen);
        if (mr) setMacroRisk(mr);
        if (hm) setHeatmap(hm);
      }
    } catch { /* ignore corrupt data */ }
    const storedTrends = marketDataService.getPersistedTrends();
    if (storedTrends) {
      // Deduplicate by normalized name and require icon
      const seen = new Set<string>();
      const deduped = storedTrends.trends.filter(t => {
        if (!t.icon) return false;
        const key = t.name?.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setTrends(deduped);
      setTrendsGeneratedAt(storedTrends.generatedAt);

      // Fetch data for any tickers not in the static database
      const allTickers = new Set<string>();
      deduped.forEach(t => {
        (t.keyCompanies || []).forEach(tk => allTickers.add(tk));
        (t.emergingCompanies || []).forEach(tk => allTickers.add(tk));
      });
      const knownTickers = new Set(mockCompanies.map(c => c.ticker));
      const unknownTickers = [...allTickers].filter(t => !knownTickers.has(t));
      if (unknownTickers.length > 0) {
        marketDataService.fetchNewCompanies(unknownTickers).then(newCompanies => {
          if (newCompanies.length > 0) {
            setCompanies(prev => {
              const existing = new Set(prev.map(c => c.ticker));
              return [...prev, ...newCompanies.filter(c => !existing.has(c.ticker))];
            });
          }
        }).catch(() => {});
      }
    }
  }, []);

  const loadData = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);
    const isManualRefresh = refreshCountRef.current > 0;
    refreshCountRef.current++;

    try {
      // Step 1: Fetch real prices from Yahoo Finance (free, no key)
      const marketData = await marketDataService.fetchMarketData();
      setIndexes(marketData.indexes);
      setSectors(marketData.sectors);

      // Check if we got real data (price differs from mock)
      const gotRealIndexes = marketData.indexes.some(idx => {
        const mock = mockIndexes.find(m => m.symbol === idx.symbol);
        return mock && Math.abs(idx.value - mock.value) > 10;
      });

      // Step 2: Fetch real stock prices from Yahoo Finance
      const tickers = mockCompanies.map(c => c.ticker);
      const stockData = await marketDataService.fetchStockData(tickers);
      const updatedCompanies = marketDataService.getCompaniesWithLiveData(stockData);
      // Apply user's score weights to recalculate overall scores and user fit
      const prefs = userPreferenceService.getPreferences();
      const weights = prefs.scoreWeights;
      const scored = updatedCompanies.map(c => ({
        ...c,
        scores: {
          ...c.scores,
          overall: scoringEngine.calculateOverallScore(c.scores, weights),
          userFit: scoringEngine.calculateUserFitScore(c, prefs),
        },
      }));
      setCompanies(scored);

      const gotRealStocks = Object.keys(stockData.companies).length > 0;

      setDataSource(gotRealIndexes || gotRealStocks ? 'Yahoo Finance' : 'Demo Data');

      // Generate data-driven summary only if no persisted AI brief
      const hasPersistedAiBrief = !!localStorage.getItem('invest_guide_ai_brief');
      if ((gotRealIndexes || gotRealStocks) && !hasPersistedAiBrief) {
        setSummary(marketDataService.generateSummary(marketData.indexes, marketData.sectors, updatedCompanies));
      }

      setLastUpdate(Date.now());
    } catch (e) {
      console.error('Failed to load market data:', e);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // Reload when refresh is triggered
  useEffect(() => {
    loadData();
  }, [lastRefresh, loadData]);

  const fetchHistory = useCallback(async (ticker: string, timeframe: Timeframe): Promise<PricePoint[]> => {
    return marketDataService.fetchPriceHistory(ticker, timeframe);
  }, []);

  const fetchIndexHistory = useCallback(async (indexSymbol: string, timeframe: Timeframe): Promise<PricePoint[]> => {
    return marketDataService.fetchIndexHistory(indexSymbol, timeframe);
  }, []);

  const runAiAnalysis = useCallback(async () => {
    if (!marketDataService.isLive()) return;
    // 20-minute cooldown — keep showing previously cached data
    const COOLDOWN_MS = 20 * 60 * 1000;
    const lastGen = Math.max(aiGeneratedAt || 0, trendsGeneratedAt || 0);
    if (lastGen > 0) {
      const elapsed = Date.now() - lastGen;
      if (elapsed < COOLDOWN_MS) {
        const remainingMs = COOLDOWN_MS - elapsed;
        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        const remaining = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        setAiStatus(`cooldown: Next AI update available in ${remaining}`);
        return;
      }
    }
    setAiStatus('running');
    try {
      const topStocks = companies
        .sort((a, b) => b.scores.overall - a.scores.overall)
        .slice(0, 15)
        .map(c => ({ ticker: c.ticker, price: c.price, change: c.changePercent }));

      // Run market brief + trends analysis in parallel
      const [analysis, trendsResult] = await Promise.allSettled([
        marketDataService.fetchAnalysis(indexes, sectors, topStocks),
        marketDataService.fetchTrendsAnalysis(trends),
      ]);

      const now = Date.now();

      if (analysis.status === 'fulfilled') {
        setSentiment(analysis.value.sentiment);
        setMacroRisk(analysis.value.macroRisk);
        setSummary(analysis.value.summary);
        setHeatmap(analysis.value.heatmap);
        setAiGeneratedAt(now);
        setDataSource(prev => prev.includes('Yahoo') ? 'Yahoo Finance + AI Analysis' : prev);
        try {
          localStorage.setItem('invest_guide_ai_brief', JSON.stringify({
            summary: analysis.value.summary,
            sentiment: analysis.value.sentiment,
            macroRisk: analysis.value.macroRisk,
            heatmap: analysis.value.heatmap,
            generatedAt: now,
          }));
        } catch { /* storage full */ }
      }

      if (trendsResult.status === 'fulfilled') {
        setTrends(trendsResult.value.trends);
        setTrendsGeneratedAt(trendsResult.value.generatedAt);

        // Fetch data for any new tickers the AI introduced
        if (trendsResult.value.newTickers.length > 0) {
          const existingTickers = new Set(companies.map(c => c.ticker));
          const unknownTickers = trendsResult.value.newTickers.filter(t => !existingTickers.has(t));
          if (unknownTickers.length > 0) {
            marketDataService.fetchNewCompanies(unknownTickers).then(newCompanies => {
              if (newCompanies.length > 0) {
                setCompanies(prev => {
                  const existing = new Set(prev.map(c => c.ticker));
                  return [...prev, ...newCompanies.filter(c => !existing.has(c.ticker))];
                });
              }
            }).catch(() => { /* non-critical */ });
          }
        }
      }

      // Report status
      if (analysis.status === 'fulfilled' || trendsResult.status === 'fulfilled') {
        setAiStatus('done');
      } else {
        const err = analysis.status === 'rejected' ? analysis.reason : trendsResult.status === 'rejected' ? trendsResult.reason : new Error('Unknown');
        setAiStatus(`error: ${err.message || 'Unknown error'}`);
      }
    } catch (e: any) {
      console.error('AI analysis failed:', e);
      setAiStatus(`error: ${e.message || 'Unknown error'}`);
    }
  }, [companies, indexes, sectors, trends, aiGeneratedAt, trendsGeneratedAt]);

  const runDataSummary = useCallback(() => {
    setSummary(marketDataService.generateSummary(indexes, sectors, companies));
    setAiStatus('');
    setAiGeneratedAt(null);
    setDataSource(prev => prev.replace(' + AI Analysis', ''));
    localStorage.removeItem('invest_guide_ai_brief');
  }, [indexes, sectors, companies]);

  return (
    <MarketDataContext.Provider value={{
      indexes, companies, sectors, sentiment, macroRisk, summary, heatmap,
      isLive: marketDataService.isLive(),
      isLoading, aiStatus, aiGeneratedAt, dataSource, lastUpdate,
      trends, trendsGeneratedAt,
      fetchHistory, fetchIndexHistory, runAiAnalysis, runDataSummary,
    }}>
      {children}
    </MarketDataContext.Provider>
  );
}

export function useMarketData() {
  return useContext(MarketDataContext);
}
