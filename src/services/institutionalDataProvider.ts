// Institutional Data Provider — Replace with real API (e.g., SEC EDGAR 13F, WhaleWisdom)
import { Institution } from '../models/types';
import { mockInstitutions } from '../data/mockInstitutions';

export const institutionalDataProvider = {
  async getInstitutions(): Promise<Institution[]> {
    return mockInstitutions;
  },

  async getInstitutionById(id: string): Promise<Institution | undefined> {
    return mockInstitutions.find(i => i.id === id);
  },

  async getRecentBuys() {
    return mockInstitutions.flatMap(i =>
      i.recentBuys.map(t => ({ ...t, institution: i.name }))
    );
  },

  async getRecentSells() {
    return mockInstitutions.flatMap(i =>
      i.recentSells.map(t => ({ ...t, institution: i.name }))
    );
  },
};
