import { IndexData, SectorPerformance, MarketSentiment, MacroRisk } from '../models/types';

const spark = (base: number, count = 30): number[] =>
  Array.from({ length: count }, (_, i) => base + (Math.sin(i * 0.5) * base * 0.03) + (Math.random() - 0.4) * base * 0.01);

export const mockIndexes: IndexData[] = [
  {
    symbol: 'SPX', name: 'S&P 500', value: 5892.34, change: 32.18, changePercent: 0.55,
    performance: { daily: 0.55, weekly: 1.82, monthly: 3.14, sixMonth: 12.7, yearly: 24.3, fiveYear: 87.2 },
    sparkline: spark(5892),
  },
  {
    symbol: 'NDX', name: 'Nasdaq 100', value: 21284.56, change: 178.92, changePercent: 0.85,
    performance: { daily: 0.85, weekly: 2.41, monthly: 4.67, sixMonth: 18.2, yearly: 32.8, fiveYear: 142.5 },
    sparkline: spark(21284),
  },
  {
    symbol: 'DJI', name: 'Dow Jones', value: 43287.12, change: -42.67, changePercent: -0.10,
    performance: { daily: -0.10, weekly: 0.92, monthly: 1.86, sixMonth: 8.4, yearly: 16.7, fiveYear: 52.3 },
    sparkline: spark(43287),
  },
  {
    symbol: 'RUT', name: 'Russell 2000', value: 2312.89, change: 18.45, changePercent: 0.80,
    performance: { daily: 0.80, weekly: 1.56, monthly: 2.94, sixMonth: 7.8, yearly: 11.2, fiveYear: 34.1 },
    sparkline: spark(2312),
  },
  {
    symbol: 'DAX', name: 'DAX', value: 19842.67, change: 124.33, changePercent: 0.63,
    performance: { daily: 0.63, weekly: 1.34, monthly: 2.71, sixMonth: 14.2, yearly: 21.4, fiveYear: 62.8 },
    sparkline: spark(19842),
  },
  {
    symbol: 'NKY', name: 'Nikkei 225', value: 38924.11, change: -186.23, changePercent: -0.48,
    performance: { daily: -0.48, weekly: 0.12, monthly: -1.23, sixMonth: 5.6, yearly: 18.9, fiveYear: 71.3 },
    sparkline: spark(38924),
  },
  {
    symbol: 'MXWO', name: 'MSCI World', value: 3642.78, change: 14.56, changePercent: 0.40,
    performance: { daily: 0.40, weekly: 1.28, monthly: 2.45, sixMonth: 10.8, yearly: 20.1, fiveYear: 68.4 },
    sparkline: spark(3642),
  },
];

export const mockSectors: SectorPerformance[] = [
  { name: 'Technology', change: 2.34, volume: 284000000, marketCap: '$18.2T' },
  { name: 'Healthcare', change: 1.12, volume: 142000000, marketCap: '$7.8T' },
  { name: 'Financials', change: 0.87, volume: 198000000, marketCap: '$9.4T' },
  { name: 'Consumer Discretionary', change: 0.45, volume: 156000000, marketCap: '$6.2T' },
  { name: 'Industrials', change: 0.32, volume: 112000000, marketCap: '$5.1T' },
  { name: 'Energy', change: -0.78, volume: 168000000, marketCap: '$4.3T' },
  { name: 'Communication', change: 1.56, volume: 134000000, marketCap: '$5.8T' },
  { name: 'Materials', change: -0.23, volume: 78000000, marketCap: '$2.4T' },
  { name: 'Utilities', change: -0.45, volume: 56000000, marketCap: '$1.7T' },
  { name: 'Real Estate', change: 0.12, volume: 67000000, marketCap: '$1.3T' },
  { name: 'Consumer Staples', change: -0.34, volume: 89000000, marketCap: '$4.1T' },
];

export const mockSentiment: MarketSentiment = {
  label: 'Greed',
  value: 72,
};

export const mockMacroRisk: MacroRisk = {
  level: 'Moderate',
  score: 45,
  factors: [
    'Elevated interest rates',
    'Persistent core inflation',
    'AI-driven capex boom',
    'Geopolitical tensions in Middle East',
    'US election uncertainty',
  ],
};

export const mockMarketSummary = `Markets advanced broadly as AI-related earnings beat expectations across the board. The Nasdaq led gains with a 0.85% advance, driven by semiconductor and cloud computing leaders. The S&P 500 reached new highs on expanding breadth.

Key drivers today:
• **AI infrastructure spending** remains the dominant theme — data center REITs and power companies saw continued inflows
• **Interest rate expectations** shifted dovish after softer-than-expected CPI components
• **Earnings season** showing 12% YoY growth, strongest in 6 quarters
• **Sector rotation** into small caps suggests broadening participation

Risk watch: VIX at 14.2 (low), credit spreads stable, yield curve normalizing. Monitor geopolitical developments and upcoming Fed commentary.`;

export const mockHeatmapData = [
  { sector: 'Technology', subsectors: [
    { name: 'Semiconductors', change: 3.2 }, { name: 'Software', change: 1.8 },
    { name: 'Cloud', change: 2.1 }, { name: 'Hardware', change: 0.4 },
  ]},
  { sector: 'Healthcare', subsectors: [
    { name: 'Biotech', change: 1.5 }, { name: 'Pharma', change: 0.8 },
    { name: 'Med Devices', change: -0.3 }, { name: 'Services', change: 0.2 },
  ]},
  { sector: 'Financials', subsectors: [
    { name: 'Banks', change: 0.9 }, { name: 'Insurance', change: 0.3 },
    { name: 'Fintech', change: 2.4 }, { name: 'Asset Mgmt', change: 0.6 },
  ]},
  { sector: 'Energy', subsectors: [
    { name: 'Oil & Gas', change: -1.2 }, { name: 'Renewables', change: 1.8 },
    { name: 'Nuclear', change: 4.1 }, { name: 'Utilities', change: -0.4 },
  ]},
];
