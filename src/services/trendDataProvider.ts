// Trend Data Provider — Replace with real data sources
import { TechTrend } from '../models/types';
import { mockTrends } from '../data/mockTrends';

export const trendDataProvider = {
  async getTrends(): Promise<TechTrend[]> {
    return mockTrends;
  },

  async getTrendById(id: string): Promise<TechTrend | undefined> {
    return mockTrends.find(t => t.id === id);
  },

  async getTopTrends(limit = 5): Promise<TechTrend[]> {
    return [...mockTrends]
      .sort((a, b) => b.momentumScore - a.momentumScore)
      .slice(0, limit);
  },
};
