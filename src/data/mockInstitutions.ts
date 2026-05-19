import { Institution } from '../models/types';

export const mockInstitutions: Institution[] = [
  {
    id: 'berkshire', name: 'Berkshire Hathaway', type: 'Conglomerate', aum: '$970B',
    topHoldings: [
      { ticker: 'AAPL', name: 'Apple', weight: 42.8, shares: 905000000, value: '$179.5B', change: -1.2 },
      { ticker: 'BAC', name: 'Bank of America', weight: 9.1, shares: 1032000000, value: '$38.2B', change: 0 },
      { ticker: 'AXP', name: 'American Express', weight: 8.4, shares: 151000000, value: '$35.8B', change: 2.1 },
      { ticker: 'KO', name: 'Coca-Cola', weight: 7.2, shares: 400000000, value: '$25.4B', change: 0 },
      { ticker: 'CVX', name: 'Chevron', weight: 5.8, shares: 118000000, value: '$18.2B', change: -3.4 },
    ],
    recentBuys: [
      { ticker: 'CB', name: 'Chubb Limited', action: 'Buy', shares: 25800000, value: '$6.7B', date: '2024-Q4' },
      { ticker: 'SU', name: 'Suncor Energy', action: 'Buy', shares: 4200000, value: '$142M', date: '2024-Q4' },
    ],
    recentSells: [
      { ticker: 'AAPL', name: 'Apple', action: 'Sell', shares: 100000000, value: '$19.8B', date: '2024-Q4' },
      { ticker: 'HPQ', name: 'HP Inc', action: 'Exit', shares: 11000000, value: '$354M', date: '2024-Q4' },
    ],
    newPositions: ['CB', 'ULTA'],
    reducedPositions: ['AAPL', 'CVX', 'HPQ'],
    sectorExposure: [
      { sector: 'Technology', weight: 43 }, { sector: 'Financials', weight: 28 },
      { sector: 'Consumer', weight: 14 }, { sector: 'Energy', weight: 10 },
      { sector: 'Other', weight: 5 },
    ],
    confidenceSignal: 'Very High',
    description: 'Warren Buffett\'s conglomerate. Value-oriented with massive Apple position. Recent trend: building cash, reducing equity exposure.',
  },
  {
    id: 'blackrock', name: 'BlackRock', type: 'Asset Manager', aum: '$10.5T',
    topHoldings: [
      { ticker: 'AAPL', name: 'Apple', weight: 6.8, shares: 1200000000, value: '$238B', change: 0.3 },
      { ticker: 'MSFT', name: 'Microsoft', weight: 6.2, shares: 482000000, value: '$200B', change: 1.2 },
      { ticker: 'NVDA', name: 'NVIDIA', weight: 5.8, shares: 1380000000, value: '$191B', change: 8.4 },
      { ticker: 'AMZN', name: 'Amazon', weight: 3.8, shares: 620000000, value: '$125B', change: 2.1 },
      { ticker: 'GOOGL', name: 'Alphabet', weight: 3.4, shares: 638000000, value: '$113B', change: 1.8 },
    ],
    recentBuys: [
      { ticker: 'NVDA', name: 'NVIDIA', action: 'Buy', shares: 42000000, value: '$5.8B', date: '2024-Q4' },
      { ticker: 'AVGO', name: 'Broadcom', action: 'Buy', shares: 18000000, value: '$3.4B', date: '2024-Q4' },
    ],
    recentSells: [
      { ticker: 'TSLA', name: 'Tesla', action: 'Sell', shares: 8000000, value: '$2.1B', date: '2024-Q4' },
    ],
    newPositions: ['ARM', 'CRDO'],
    reducedPositions: ['TSLA', 'DIS'],
    sectorExposure: [
      { sector: 'Technology', weight: 32 }, { sector: 'Healthcare', weight: 14 },
      { sector: 'Financials', weight: 13 }, { sector: 'Consumer', weight: 12 },
      { sector: 'Industrials', weight: 10 }, { sector: 'Other', weight: 19 },
    ],
    confidenceSignal: 'High',
    description: 'World\'s largest asset manager. Index-heavy but active positioning increasingly favors AI and technology infrastructure.',
  },
  {
    id: 'ark', name: 'ARK Invest', type: 'Asset Manager', aum: '$14B',
    topHoldings: [
      { ticker: 'TSLA', name: 'Tesla', weight: 12.4, shares: 4200000, value: '$1.1B', change: -2.1 },
      { ticker: 'COIN', name: 'Coinbase', weight: 8.8, shares: 3800000, value: '$880M', change: 5.4 },
      { ticker: 'ROKU', name: 'Roku', weight: 6.2, shares: 8400000, value: '$620M', change: 3.2 },
      { ticker: 'RKLB', name: 'Rocket Lab', weight: 5.8, shares: 28000000, value: '$580M', change: 12.4 },
      { ticker: 'PATH', name: 'UiPath', weight: 4.8, shares: 24000000, value: '$480M', change: -4.2 },
    ],
    recentBuys: [
      { ticker: 'TSLA', name: 'Tesla', action: 'Buy', shares: 180000, value: '$46M', date: '2024-Q4' },
      { ticker: 'PLTR', name: 'Palantir', action: 'Buy', shares: 420000, value: '$27M', date: '2024-Q4' },
      { ticker: 'RKLB', name: 'Rocket Lab', action: 'Buy', shares: 1200000, value: '$24M', date: '2024-Q4' },
    ],
    recentSells: [
      { ticker: 'NVDA', name: 'NVIDIA', action: 'Sell', shares: 52000, value: '$7.2M', date: '2024-Q4' },
    ],
    newPositions: ['OKLO', 'IONQ'],
    reducedPositions: ['NVDA', 'SQ'],
    sectorExposure: [
      { sector: 'Technology', weight: 42 }, { sector: 'Healthcare', weight: 18 },
      { sector: 'Fintech', weight: 15 }, { sector: 'Space', weight: 8 },
      { sector: 'Energy', weight: 7 }, { sector: 'Other', weight: 10 },
    ],
    confidenceSignal: 'Moderate',
    description: 'Cathie Wood\'s innovation-focused funds. High-conviction, high-volatility approach. Heavy on disruptive technology and autonomous systems.',
  },
  {
    id: 'renaissance', name: 'Renaissance Technologies', type: 'Hedge Fund', aum: '$106B',
    topHoldings: [
      { ticker: 'NVDA', name: 'NVIDIA', weight: 3.2, shares: 12400000, value: '$1.7B', change: 14.2 },
      { ticker: 'NVO', name: 'Novo Nordisk', weight: 2.8, shares: 8200000, value: '$1.5B', change: -8.4 },
      { ticker: 'MSFT', name: 'Microsoft', weight: 2.4, shares: 3400000, value: '$1.4B', change: 2.1 },
      { ticker: 'META', name: 'Meta', weight: 2.2, shares: 2200000, value: '$1.3B', change: 6.8 },
      { ticker: 'AVGO', name: 'Broadcom', weight: 1.8, shares: 5600000, value: '$1.0B', change: 22.4 },
    ],
    recentBuys: [
      { ticker: 'NVDA', name: 'NVIDIA', action: 'Buy', shares: 3200000, value: '$444M', date: '2024-Q4' },
      { ticker: 'AVGO', name: 'Broadcom', action: 'Buy', shares: 2800000, value: '$522M', date: '2024-Q4' },
    ],
    recentSells: [
      { ticker: 'NVO', name: 'Novo Nordisk', action: 'Sell', shares: 1800000, value: '$184M', date: '2024-Q4' },
    ],
    newPositions: ['CRDO', 'VRT'],
    reducedPositions: ['NVO', 'ISRG'],
    sectorExposure: [
      { sector: 'Technology', weight: 35 }, { sector: 'Healthcare', weight: 18 },
      { sector: 'Financials', weight: 15 }, { sector: 'Consumer', weight: 12 },
      { sector: 'Other', weight: 20 },
    ],
    confidenceSignal: 'Very High',
    description: 'Jim Simons\' legendary quant fund. Medallion fund has best track record in history. 13F shows institutional fund positions.',
  },
  {
    id: 'bridgewater', name: 'Bridgewater Associates', type: 'Hedge Fund', aum: '$97B',
    topHoldings: [
      { ticker: 'SPY', name: 'SPDR S&P 500', weight: 8.4, shares: 18200000, value: '$8.1B', change: 2.4 },
      { ticker: 'IVV', name: 'iShares Core S&P', weight: 6.2, shares: 12400000, value: '$6.0B', change: 2.1 },
      { ticker: 'GOOGL', name: 'Alphabet', weight: 3.8, shares: 22000000, value: '$3.9B', change: 5.2 },
      { ticker: 'PG', name: 'Procter & Gamble', weight: 3.4, shares: 18800000, value: '$3.3B', change: -1.2 },
      { ticker: 'NVDA', name: 'NVIDIA', weight: 2.8, shares: 20000000, value: '$2.8B', change: 18.4 },
    ],
    recentBuys: [
      { ticker: 'NVDA', name: 'NVIDIA', action: 'Buy', shares: 8400000, value: '$1.2B', date: '2024-Q4' },
      { ticker: 'GOOGL', name: 'Alphabet', action: 'Buy', shares: 4200000, value: '$742M', date: '2024-Q4' },
    ],
    recentSells: [
      { ticker: 'PG', name: 'Procter & Gamble', action: 'Sell', shares: 2400000, value: '$392M', date: '2024-Q4' },
    ],
    newPositions: ['PLTR'],
    reducedPositions: ['PG', 'JNJ', 'WMT'],
    sectorExposure: [
      { sector: 'Broad Market', weight: 28 }, { sector: 'Technology', weight: 22 },
      { sector: 'Consumer', weight: 18 }, { sector: 'Healthcare', weight: 14 },
      { sector: 'Other', weight: 18 },
    ],
    confidenceSignal: 'High',
    description: 'Ray Dalio\'s macro-focused fund. All-Weather portfolio approach. Recent shift toward technology and AI-related positions.',
  },
  {
    id: 'vanguard', name: 'Vanguard Group', type: 'Asset Manager', aum: '$8.6T',
    topHoldings: [
      { ticker: 'AAPL', name: 'Apple', weight: 6.5, shares: 1300000000, value: '$258B', change: 0.2 },
      { ticker: 'MSFT', name: 'Microsoft', weight: 6.1, shares: 498000000, value: '$207B', change: 0.8 },
      { ticker: 'NVDA', name: 'NVIDIA', weight: 5.4, shares: 1280000000, value: '$178B', change: 6.2 },
      { ticker: 'AMZN', name: 'Amazon', weight: 3.6, shares: 580000000, value: '$117B', change: 1.4 },
      { ticker: 'META', name: 'Meta', weight: 2.4, shares: 148000000, value: '$86B', change: 2.8 },
    ],
    recentBuys: [
      { ticker: 'NVDA', name: 'NVIDIA', action: 'Buy', shares: 32000000, value: '$4.4B', date: '2024-Q4' },
    ],
    recentSells: [],
    newPositions: [],
    reducedPositions: [],
    sectorExposure: [
      { sector: 'Technology', weight: 31 }, { sector: 'Healthcare', weight: 13 },
      { sector: 'Financials', weight: 13 }, { sector: 'Consumer', weight: 12 },
      { sector: 'Industrials', weight: 10 }, { sector: 'Other', weight: 21 },
    ],
    confidenceSignal: 'High',
    description: 'Second-largest asset manager. Predominantly index-tracking but portfolio shifts reflect broad market trends and ETF flows.',
  },
];
