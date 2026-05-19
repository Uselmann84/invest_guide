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
