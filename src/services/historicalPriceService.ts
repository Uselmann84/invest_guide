// Historical Price Service — generates mock price history per timeframe
// TODO: Replace with real API (Polygon.io, Alpha Vantage, Yahoo Finance)
import { PricePoint, Timeframe } from '../models/types';
import { mockCompanies } from '../data/mockCompanies';

function generateHistory(basePrice: number, points: number, trend: number, vol: number): PricePoint[] {
  const out: PricePoint[] = [];
  let price = basePrice * (1 - trend * points * 0.4 / 100); // walk backward from current
  const now = Date.now();
  for (let i = 0; i < points; i++) {
    const frac = i / points;
    const drift = trend / points;
    const noise = (Math.random() - 0.5) * 2 * vol / Math.sqrt(points);
    price = price * (1 + drift + noise);
    const ts = now - (points - i) * (24 * 60 * 60 * 1000 * (points > 60 ? 7 : 1)); // rough spacing
    const d = new Date(ts);
    const label = points <= 30
      ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    out.push({ date: label, value: Math.round(price * 100) / 100 });
  }
  return out;
}

const pointsForTimeframe: Record<Timeframe, number> = {
  '1D': 24,   // hourly
  '1W': 7,
  '1M': 30,
  '6M': 130,   // daily
  '1Y': 252,   // daily
  '5Y': 260,   // weekly
  '10Y': 520,  // weekly
  'ALL': 780,
};

export const historicalPriceService = {
  getHistory(ticker: string, timeframe: Timeframe, livePrice?: number, liveChangePercent?: number): PricePoint[] {
    const company = mockCompanies.find(c => c.ticker === ticker);
    if (!company) return [];
    const basePrice = livePrice || company.price;
    const changePct = liveChangePercent ?? company.changePercent;
    const points = pointsForTimeframe[timeframe];
    const trend = changePct > 0 ? 0.12 : changePct < 0 ? -0.08 : 0.02;
    const vol = 0.015 + (company.scores.risk / 100) * 0.03;
    const data = generateHistory(basePrice, points, trend, vol);
    // For 1D, label with hours
    if (timeframe === '1D') {
      return data.map((p, i) => ({
        ...p,
        date: `${(9 + Math.floor(i * 6.5 / 24))}:${String(((i * 30) % 60)).padStart(2, '0')}`,
      }));
    }
    return data;
  },
};
