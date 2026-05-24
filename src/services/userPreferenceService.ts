// User Preference Service — Local storage persistence
import { UserPreferences } from '../models/types';

const STORAGE_KEY = 'invest_guide_preferences';

const DEFAULT_PREFERENCES: UserPreferences = {
  riskTolerance: 'Growth',
  investmentHorizon: '3 years',
  preferredSectors: ['Technology', 'Healthcare'],
  excludedSectors: [],
  preferredRegions: ['USA', 'Global'],
  companySize: ['Large cap', 'Mid cap'],
  dividendPreference: 'Low',
  growthPreference: 'High',
  aiTechPreference: 'High',
  esgPreference: false,
  currency: 'USD',
  scoreWeights: {
    growth: 15,
    safety: 10,
    momentum: 15,
    value: 10,
    technologyExposure: 15,
    institutionalActivity: 10,
    dividend: 5,
    shortTermPerformance: 10,
    longTermPotential: 10,
  },
  liveMode: false,
  openaiApiKey: '',
  openaiModel: 'gpt-4.1-mini',
  analysisModel: 'gpt-4.1-nano',
  refreshIntervalSeconds: 60,
  autoRefresh: false,
};

export const userPreferenceService = {
  getPreferences(): UserPreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        // Merge with defaults so new fields are present on existing installs
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch { /* use defaults */ }
    return { ...DEFAULT_PREFERENCES };
  },

  savePreferences(prefs: UserPreferences): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  },

  resetPreferences(): UserPreferences {
    localStorage.removeItem(STORAGE_KEY);
    return { ...DEFAULT_PREFERENCES };
  },

  getDefaultPreferences(): UserPreferences {
    return { ...DEFAULT_PREFERENCES };
  },

  /** Build a concise investor profile string for AI prompt injection */
  getInvestorProfileContext(): string {
    const p = this.getPreferences();
    const parts: string[] = [
      `Risk tolerance: ${p.riskTolerance}`,
      `Investment horizon: ${p.investmentHorizon}`,
      `Growth preference: ${p.growthPreference}`,
      `Dividend preference: ${p.dividendPreference}`,
      `AI/Tech preference: ${p.aiTechPreference}`,
    ];
    if (p.preferredSectors.length) parts.push(`Preferred sectors: ${p.preferredSectors.join(', ')}`);
    if (p.excludedSectors.length) parts.push(`Excluded sectors: ${p.excludedSectors.join(', ')}`);
    if (p.preferredRegions.length) parts.push(`Preferred regions: ${p.preferredRegions.join(', ')}`);
    if (p.companySize.length) parts.push(`Company size: ${p.companySize.join(', ')}`);
    if (p.esgPreference) parts.push('ESG: prioritized');
    if (p.currency !== 'USD') parts.push(`Currency: ${p.currency}`);
    return parts.join('. ') + '.';
  },
};
