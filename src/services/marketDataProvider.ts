// Market Data Provider — Replace with real API (e.g., Alpha Vantage, Polygon.io, Yahoo Finance)
import { IndexData, SectorPerformance, MarketSentiment, MacroRisk } from '../models/types';
import { mockIndexes, mockSectors, mockSentiment, mockMacroRisk, mockMarketSummary, mockHeatmapData } from '../data/mockMarketData';

export const marketDataProvider = {
  async getIndexes(): Promise<IndexData[]> {
    // TODO: Replace with real API call
    // Example: const res = await fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${key}`);
    return mockIndexes;
  },

  async getSectors(): Promise<SectorPerformance[]> {
    return mockSectors;
  },

  async getSentiment(): Promise<MarketSentiment> {
    return mockSentiment;
  },

  async getMacroRisk(): Promise<MacroRisk> {
    return mockMacroRisk;
  },

  async getMarketSummary(): Promise<string> {
    // TODO: Replace with OpenAI API call for dynamic summary
    return mockMarketSummary;
  },

  async getHeatmapData() {
    return mockHeatmapData;
  },
};
