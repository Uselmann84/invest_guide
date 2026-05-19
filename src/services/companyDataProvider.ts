// Company Data Provider — Replace with real API (e.g., Financial Modeling Prep, Finnhub, SEC EDGAR)
import { Company } from '../models/types';
import { mockCompanies } from '../data/mockCompanies';

export const companyDataProvider = {
  async getCompanies(): Promise<Company[]> {
    return mockCompanies;
  },

  async getCompanyByTicker(ticker: string): Promise<Company | undefined> {
    return mockCompanies.find(c => c.ticker === ticker);
  },

  async searchCompanies(query: string): Promise<Company[]> {
    const q = query.toLowerCase();
    return mockCompanies.filter(
      c => c.ticker.toLowerCase().includes(q) ||
           c.name.toLowerCase().includes(q) ||
           c.sector.toLowerCase().includes(q)
    );
  },

  async getTopCompanies(sortBy: keyof Company['scores'] = 'overall', limit = 10): Promise<Company[]> {
    return [...mockCompanies]
      .sort((a, b) => b.scores[sortBy] - a.scores[sortBy])
      .slice(0, limit);
  },
};
