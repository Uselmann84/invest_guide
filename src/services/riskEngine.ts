// Risk Engine — Risk analysis for investments
import { RiskAssessment, RiskFactor, Company } from '../models/types';

export const riskEngine = {
  assessCompanyRisk(company: Company): RiskAssessment {
    const factors: RiskFactor[] = [];

    // Valuation risk
    if (company.scores.valuation < 40) {
      factors.push({ name: 'Overvaluation', level: 'High', score: 100 - company.scores.valuation, description: `Trading at elevated multiples relative to earnings growth. P/E and revenue multiples suggest the market is pricing in significant future growth that may already be reflected.` });
    } else if (company.scores.valuation < 55) {
      factors.push({ name: 'Full Valuation', level: 'Moderate', score: 100 - company.scores.valuation, description: `Current valuation leaves limited margin of safety. Stock is fairly valued based on fundamentals, meaning any earnings miss could trigger a pullback.` });
    }

    // Debt risk
    if (company.debtToEquity > 1.5) {
      factors.push({ name: 'High Leverage', level: 'High', score: Math.min(100, company.debtToEquity * 30), description: `Debt-to-equity of ${company.debtToEquity}x increases sensitivity to rising interest rates and could constrain future capital allocation or dividend growth.` });
    } else if (company.debtToEquity > 0.8) {
      factors.push({ name: 'Moderate Debt', level: 'Moderate', score: Math.min(100, company.debtToEquity * 30), description: `Debt-to-equity of ${company.debtToEquity}x is manageable but worth monitoring, especially if rates stay elevated or revenue growth slows.` });
    }

    // Profitability
    if (company.profitMargin < 5) {
      factors.push({ name: 'Thin Margins', level: company.profitMargin < 0 ? 'High' : 'Moderate', score: Math.max(0, 50 - company.profitMargin * 5), description: `Profit margin of ${company.profitMargin}% means the business has little room to absorb cost increases, pricing pressure, or demand slowdowns without turning unprofitable.` });
    }

    // Insider selling
    if (company.insiderActivity === 'Heavy Selling' || company.insiderActivity === 'Selling') {
      factors.push({ name: 'Insider Selling', level: company.insiderActivity === 'Heavy Selling' ? 'High' : 'Moderate', score: company.insiderActivity === 'Heavy Selling' ? 75 : 50, description: `Company executives and directors have been ${company.insiderActivity.toLowerCase()} shares. While this can be routine (tax, diversification), sustained selling by multiple insiders may indicate reduced confidence in near-term outlook.` });
    }

    // Revenue growth
    if (company.revenueGrowth < 5) {
      factors.push({ name: 'Stagnant Revenue', level: 'Moderate', score: Math.max(0, 50 - company.revenueGrowth * 5), description: `Revenue growing at only ${company.revenueGrowth}% year-over-year, below inflation in many markets. This signals potential market saturation, competitive pressure, or weakening demand.` });
    }

    // Hype risk
    if (company.scores.momentum > 85 && company.scores.valuation < 35) {
      factors.push({ name: 'Hype-Driven Pricing', level: 'High', score: 80, description: `Stock price has been driven largely by momentum and narrative rather than fundamentals. The disconnect between price action and underlying financials creates risk of a sharp correction when sentiment shifts.` });
    }

    // Concentration risk
    if (company.sector === 'Technology' && company.aiTrendConnection.length > 3) {
      factors.push({ name: 'AI Narrative Dependency', level: 'Moderate', score: 45, description: `Heavily tied to the AI investment theme. If AI spending cycles slow, monetization disappoints, or regulatory headwinds emerge, multiple compression could be severe.` });
    }

    if (factors.length === 0) {
      factors.push({ name: 'Standard Market Risk', level: 'Low', score: 20, description: 'No elevated company-specific risk factors detected beyond normal market volatility.' });
    }

    // Build upside drivers with real business explanations
    const upsideDrivers: { label: string; explanation: string }[] = [];

    if (company.revenueGrowth > 20) {
      upsideDrivers.push({ label: 'Accelerating revenue growth', explanation: `Revenue is growing ${company.revenueGrowth}% YoY, driven by expanding demand in ${company.industry}. This pace of growth, if sustained, supports further multiple expansion and earnings beats.` });
    } else if (company.revenueGrowth > 10) {
      upsideDrivers.push({ label: 'Healthy revenue growth', explanation: `${company.revenueGrowth}% YoY revenue growth outpaces the broader market and reflects solid demand for ${company.name}'s products and services.` });
    }

    if (company.profitMargin > 20) {
      upsideDrivers.push({ label: 'High-margin business model', explanation: `${company.profitMargin}% profit margin indicates strong pricing power and operational efficiency. High margins generate substantial free cash flow for reinvestment, buybacks, or dividends.` });
    }

    if (company.aiTrendConnection.length > 0) {
      const trends = company.aiTrendConnection.slice(0, 3).join(', ');
      upsideDrivers.push({ label: `Positioned in ${company.aiTrendConnection[0]}`, explanation: `Connected to secular growth themes: ${trends}. These multi-year tailwinds can drive sustained demand growth independent of economic cycles.` });
    }

    if (company.analystSentiment === 'Strong Buy' || company.analystSentiment === 'Buy') {
      upsideDrivers.push({ label: `${company.analystSentiment} analyst consensus`, explanation: `Wall Street consensus is ${company.analystSentiment} with a median price target suggesting ${company.analystSentiment === 'Strong Buy' ? 'significant' : 'moderate'} upside. Analyst coverage reflects conviction in the company's growth trajectory and competitive positioning.` });
    }

    if (company.insiderActivity === 'Buying' || company.insiderActivity === 'Heavy Buying') {
      upsideDrivers.push({ label: 'Insider buying', explanation: `Company insiders are ${company.insiderActivity.toLowerCase()} shares with their own capital, which historically correlates with outperformance. Insiders have the best visibility into the business pipeline and outlook.` });
    }

    if (company.scores.institutionalInterest > 70) {
      upsideDrivers.push({ label: 'Strong institutional ownership', explanation: `High institutional interest (${company.institutionalOwnership}% institutional ownership) provides price stability and reflects due diligence by professional fund managers who see long-term value.` });
    }

    if (company.debtToEquity < 0.2 && company.profitMargin > 10) {
      upsideDrivers.push({ label: 'Fortress balance sheet', explanation: `Near-zero debt (${company.debtToEquity}x D/E) combined with healthy profitability gives the company maximum financial flexibility for acquisitions, R&D investment, or weathering downturns.` });
    }

    // Build downside risks with real business explanations
    const downsideRisks = factors.filter(f => f.level !== 'Low').map(f => ({ label: f.name, explanation: f.description }));

    return {
      ticker: company.ticker,
      overallRisk: company.scores.risk,
      factors,
      upsideDrivers: upsideDrivers.length > 0 ? upsideDrivers : [{ label: 'Market participation', explanation: 'No standout catalysts identified. Returns will likely track broader market performance and sector trends.' }],
      downsideRisks: downsideRisks.length > 0 ? downsideRisks : [{ label: 'General market risk', explanation: 'No elevated company-specific risks, but macroeconomic shifts, geopolitical events, or broad market selloffs can still impact the stock.' }],
      invalidation: `Thesis weakens if ${company.ticker} revenue growth falls below ${Math.max(0, company.revenueGrowth - 10)}% or key technology trends decelerate.`,
      watchItems: ['Earnings reports', 'Institutional flow changes', 'Sector rotation signals', 'Macro policy shifts'],
    };
  },
};
