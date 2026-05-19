// Simulation Engine — Portfolio backtesting and scenario simulation
import { SimulatedPortfolio, PortfolioPosition, PortfolioPerformance } from '../models/types';

const generateValueHistory = (start: number, months: number, annualReturn: number, volatility: number) => {
  const history: { date: string; value: number }[] = [];
  let value = start;
  const monthlyReturn = annualReturn / 12;
  const monthlyVol = volatility / Math.sqrt(12);

  for (let i = 0; i <= months; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - (months - i));
    const randomReturn = monthlyReturn + (Math.random() - 0.5) * 2 * monthlyVol;
    value = value * (1 + randomReturn / 100);
    history.push({ date: date.toISOString().split('T')[0], value: Math.round(value * 100) / 100 });
  }
  return history;
};

export const simulationEngine = {
  createPortfolio(name: string, startingAmount: number, strategy: string, positions: PortfolioPosition[]): SimulatedPortfolio {
    const totalAllocation = positions.reduce((sum, p) => sum + p.allocation, 0);
    const currentValue = positions.reduce((sum, p) => sum + p.shares * p.currentPrice, 0);
    const totalReturn = currentValue - startingAmount;
    const history = generateValueHistory(startingAmount, 12, 18, 15);

    const performance: PortfolioPerformance = {
      totalReturn,
      totalReturnPercent: (totalReturn / startingAmount) * 100,
      monthlyReturns: Array.from({ length: 12 }, () => (Math.random() - 0.3) * 8),
      maxDrawdown: -12.4,
      volatility: 18.2,
      sharpeRatio: 1.42,
      riskScore: 58,
      vs_sp500: 4.2,
      vs_nasdaq: -2.1,
      valueHistory: history,
    };

    return {
      id: crypto.randomUUID(),
      name,
      startingAmount,
      currentValue: history[history.length - 1].value,
      strategy,
      positions,
      performance,
      createdAt: new Date().toISOString(),
    };
  },

  getDefaultPortfolios(): SimulatedPortfolio[] {
    const aggressive: PortfolioPosition[] = [
      { ticker: 'NVDA', name: 'NVIDIA', allocation: 25, shares: 18, avgPrice: 120.00, currentPrice: 138.72, gain: 337.0, gainPercent: 15.6 },
      { ticker: 'MSFT', name: 'Microsoft', allocation: 20, shares: 5, avgPrice: 380.00, currentPrice: 415.28, gain: 176.4, gainPercent: 9.3 },
      { ticker: 'AMD', name: 'AMD', allocation: 15, shares: 10, avgPrice: 140.00, currentPrice: 154.62, gain: 146.2, gainPercent: 10.4 },
      { ticker: 'AVGO', name: 'Broadcom', allocation: 15, shares: 8, avgPrice: 160.00, currentPrice: 186.45, gain: 211.6, gainPercent: 16.5 },
      { ticker: 'PLTR', name: 'Palantir', allocation: 10, shares: 16, avgPrice: 42.00, currentPrice: 64.28, gain: 356.5, gainPercent: 53.0 },
      { ticker: 'META', name: 'Meta', allocation: 10, shares: 2, avgPrice: 480.00, currentPrice: 582.14, gain: 204.3, gainPercent: 21.3 },
      { ticker: 'CASH', name: 'Cash', allocation: 5, shares: 1, avgPrice: 5000, currentPrice: 5000, gain: 0, gainPercent: 0 },
    ];

    const portfolio = this.createPortfolio('AI Growth Portfolio', 100000, 'Aggressive Growth', aggressive);
    return [portfolio];
  },

  runScenario(portfolio: SimulatedPortfolio, scenario: string): PortfolioPerformance {
    const multipliers: Record<string, number> = {
      conservative: 0.4,
      base: 1.0,
      optimistic: 1.8,
      crisis: -2.5,
      'tech-boom': 2.5,
      'rate-shock': -1.2,
    };
    const mult = multipliers[scenario] || 1.0;
    return {
      ...portfolio.performance,
      totalReturnPercent: portfolio.performance.totalReturnPercent * mult,
      totalReturn: portfolio.performance.totalReturn * mult,
      valueHistory: generateValueHistory(
        portfolio.startingAmount,
        12,
        portfolio.performance.totalReturnPercent * mult,
        portfolio.performance.volatility * Math.abs(mult)
      ),
    };
  },
};
