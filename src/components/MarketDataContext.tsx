// MarketDataContext — provides live market data throughout the app
// Yahoo Finance for real prices, OpenAI for analysis
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { IndexData, Company, SectorPerformance, MarketSentiment, MacroRisk, PricePoint, Timeframe } from '../models/types';
import { marketDataService } from '../services/marketDataService';
import { mockIndexes, mockSectors, mockSentiment, mockMacroRisk, mockMarketSummary, mockHeatmapData } from '../data/mockMarketData';
import { mockCompanies } from '../data/mockCompanies';
import { useRefresh } from './RefreshContext';

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
  dataSource: string; // 'Yahoo Finance' | 'Demo Data' | 'Cached'
  lastUpdate: number;
  fetchHistory: (ticker: string, timeframe: Timeframe) => Promise<PricePoint[]>;
  fetchIndexHistory: (indexSymbol: string, timeframe: Timeframe) => Promise<PricePoint[]>;
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
  dataSource: 'Demo Data',
  lastUpdate: Date.now(),
  fetchHistory: async () => [],
  fetchIndexHistory: async () => [],
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
  const [dataSource, setDataSource] = useState('Demo Data');
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const fetchingRef = useRef(false);

  // Clear stale cache on app version change to ensure fresh sparkline data
  useEffect(() => {
    const cacheVersion = 'v2_sparklines';
    if (localStorage.getItem('invest_guide_cache_version') !== cacheVersion) {
      marketDataService.clearCache();
      localStorage.setItem('invest_guide_cache_version', cacheVersion);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);

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
      setCompanies(updatedCompanies);

      const gotRealStocks = Object.keys(stockData.companies).length > 0;

      setDataSource(gotRealIndexes || gotRealStocks ? 'Yahoo Finance' : 'Demo Data');

      // Step 3: Ask OpenAI to analyze the real data (if configured)
      if (marketDataService.isLive()) {
        const topStocks = updatedCompanies
          .sort((a, b) => b.scores.overall - a.scores.overall)
          .slice(0, 15)
          .map(c => ({ ticker: c.ticker, price: c.price, change: c.changePercent }));

        const analysis = await marketDataService.fetchAnalysis(marketData.indexes, marketData.sectors, topStocks);
        setSentiment(analysis.sentiment);
        setMacroRisk(analysis.macroRisk);
        setSummary(analysis.summary);
        setHeatmap(analysis.heatmap);
        if (gotRealIndexes || gotRealStocks) {
          setDataSource('Yahoo Finance + AI Analysis');
        }
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

  return (
    <MarketDataContext.Provider value={{
      indexes, companies, sectors, sentiment, macroRisk, summary, heatmap,
      isLive: marketDataService.isLive(),
      isLoading, dataSource, lastUpdate, fetchHistory, fetchIndexHistory,
    }}>
      {children}
    </MarketDataContext.Provider>
  );
}

export function useMarketData() {
  return useContext(MarketDataContext);
}
