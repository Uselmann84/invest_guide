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
  maxPositionSize: 15,
  maxDrawdown: 25,
  dividendPreference: 'Low',
  growthPreference: 'High',
  aiTechPreference: 'High',
  esgPreference: false,
  currency: 'USD',
  startingCapital: 100000,
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
  openaiModel: 'gpt-4o-mini',
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
};
