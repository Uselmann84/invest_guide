// Risk Engine — Risk analysis for investments
import { RiskAssessment, RiskFactor, Company } from '../models/types';

export const riskEngine = {
  assessCompanyRisk(company: Company): RiskAssessment {
    const factors: RiskFactor[] = [];

    // Valuation risk
    if (company.scores.valuation < 40) {
      factors.push({ name: 'Overvaluation', level: 'High', score: 100 - company.scores.valuation, description: `Valuation score of ${company.scores.valuation}/100 suggests premium pricing relative to fundamentals.` });
    }

    // Debt risk
    if (company.debtToEquity > 1.5) {
      factors.push({ name: 'High Debt', level: 'High', score: Math.min(100, company.debtToEquity * 30), description: `Debt-to-equity ratio of ${company.debtToEquity}x is above comfort levels.` });
    }

    // Profitability
    if (company.profitMargin < 5) {
      factors.push({ name: 'Low Profitability', level: 'Moderate', score: Math.max(0, 50 - company.profitMargin * 5), description: `Profit margin of ${company.profitMargin}% leaves limited buffer.` });
    }

    // Insider selling
    if (company.insiderActivity === 'Heavy Selling' || company.insiderActivity === 'Selling') {
      factors.push({ name: 'Insider Selling', level: company.insiderActivity === 'Heavy Selling' ? 'High' : 'Moderate', score: company.insiderActivity === 'Heavy Selling' ? 75 : 50, description: `Insiders are ${company.insiderActivity.toLowerCase()}, which may signal concerns.` });
    }

    // Revenue growth
    if (company.revenueGrowth < 5) {
      factors.push({ name: 'Weak Revenue Growth', level: 'Moderate', score: Math.max(0, 50 - company.revenueGrowth * 5), description: `Revenue growth of ${company.revenueGrowth}% is below market average.` });
    }

    // Hype risk
    if (company.scores.momentum > 85 && company.scores.valuation < 35) {
      factors.push({ name: 'Hype Risk', level: 'High', score: 80, description: 'High momentum combined with stretched valuation suggests potential hype-driven pricing.' });
    }

    if (factors.length === 0) {
      factors.push({ name: 'Standard Market Risk', level: 'Low', score: 20, description: 'No elevated risk factors detected.' });
    }

    const upsideDrivers = [];
    if (company.scores.momentum > 70) upsideDrivers.push('Strong price momentum');
    if (company.scores.technologyExposure > 70) upsideDrivers.push('High technology trend exposure');
    if (company.scores.institutionalInterest > 70) upsideDrivers.push('Strong institutional support');
    if (company.revenueGrowth > 20) upsideDrivers.push('Exceptional revenue growth');
    if (company.scores.fundamental > 80) upsideDrivers.push('Solid fundamentals');

    const downsideRisks = factors.filter(f => f.level !== 'Low').map(f => f.name);

    return {
      ticker: company.ticker,
      overallRisk: company.scores.risk,
      factors,
      upsideDrivers: upsideDrivers.length > 0 ? upsideDrivers : ['Market participation'],
      downsideRisks: downsideRisks.length > 0 ? downsideRisks : ['General market risk'],
      invalidation: `Thesis weakens if ${company.ticker} revenue growth falls below ${Math.max(0, company.revenueGrowth - 10)}% or key technology trends decelerate.`,
      watchItems: ['Earnings reports', 'Institutional flow changes', 'Sector rotation signals', 'Macro policy shifts'],
    };
  },
};
