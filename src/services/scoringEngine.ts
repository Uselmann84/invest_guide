// Scoring Engine — AI scoring model for stocks and assets
import { Company, CompanyScores, ScoreWeights, UserPreferences } from '../models/types';

const DEFAULT_WEIGHTS: ScoreWeights = {
  growth: 15,
  safety: 10,
  momentum: 15,
  value: 10,
  technologyExposure: 15,
  institutionalActivity: 10,
  dividend: 5,
  shortTermPerformance: 10,
  longTermPotential: 10,
};

export const scoringEngine = {
  calculateOverallScore(scores: CompanyScores, weights: ScoreWeights = DEFAULT_WEIGHTS): number {
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    const weighted =
      scores.fundamental * (weights.growth / totalWeight) +
      (100 - scores.risk) * (weights.safety / totalWeight) +
      scores.momentum * (weights.momentum / totalWeight) +
      scores.valuation * (weights.value / totalWeight) +
      scores.technologyExposure * (weights.technologyExposure / totalWeight) +
      scores.institutionalInterest * (weights.institutionalActivity / totalWeight) +
      scores.marketDemand * (weights.dividend / totalWeight) +
      scores.momentum * (weights.shortTermPerformance / totalWeight) +
      scores.opportunity * (weights.longTermPotential / totalWeight);

    return Math.round(weighted);
  },

  calculateUserFitScore(company: Company, prefs: UserPreferences): number {
    let score = 50;

    // Risk alignment
    const riskMap = { Conservative: 20, Balanced: 40, Growth: 60, Aggressive: 75, Speculative: 90 };
    const userRiskTarget = riskMap[prefs.riskTolerance];
    const riskDiff = Math.abs(company.scores.risk - userRiskTarget);
    score += Math.max(0, 30 - riskDiff);

    // Sector preference
    if (prefs.preferredSectors.includes(company.sector)) score += 15;
    if (prefs.excludedSectors.includes(company.sector)) score -= 40;

    // Tech preference
    if (prefs.aiTechPreference === 'High' && company.scores.technologyExposure > 70) score += 10;

    // Growth preference — boost high-growth companies for aggressive growth investors
    const growthMap = { Low: 0, Moderate: 5, High: 10, Aggressive: 15 };
    if (company.revenueGrowth > 20) score += growthMap[prefs.growthPreference] || 0;
    if (prefs.growthPreference === 'Low' && company.revenueGrowth > 40) score -= 5;

    // Dividend preference — boost companies with strong dividends
    const divMap = { None: -5, Low: 0, Moderate: 5, High: 10 };
    if (company.scores.marketDemand > 60) score += divMap[prefs.dividendPreference] || 0;

    // Company size — boost matching market cap tiers
    if (prefs.companySize.length > 0) {
      const capLabel = company.marketCapLabel;
      const isLarge = company.marketCap >= 10e9;
      const isMid = company.marketCap >= 2e9 && company.marketCap < 10e9;
      const isSmall = company.marketCap >= 300e6 && company.marketCap < 2e9;
      const isMicro = company.marketCap < 300e6;
      const match = (prefs.companySize.includes('Large cap') && isLarge) ||
                    (prefs.companySize.includes('Mid cap') && isMid) ||
                    (prefs.companySize.includes('Small cap') && isSmall) ||
                    (prefs.companySize.includes('Micro cap') && isMicro);
      if (match) score += 8;
      else if (prefs.companySize.length <= 2) score -= 5; // penalize non-matching sizes when user is specific
    }

    // ESG preference
    if (prefs.esgPreference && company.scores.fundamental > 60) score += 5;

    return Math.min(100, Math.max(0, score));
  },

  rankCompanies(companies: Company[], weights: ScoreWeights = DEFAULT_WEIGHTS): Company[] {
    return [...companies].sort((a, b) => {
      const scoreA = this.calculateOverallScore(a.scores, weights);
      const scoreB = this.calculateOverallScore(b.scores, weights);
      return scoreB - scoreA;
    });
  },
};
