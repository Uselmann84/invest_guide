// ---- Market & Index ----
export interface IndexData {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  performance: {
    daily: number;
    weekly: number;
    monthly: number;
    sixMonth: number;
    yearly: number;
    fiveYear: number;
  };
  sparkline: number[];
}

export interface SectorPerformance {
  name: string;
  change: number;
  volume: number;
  marketCap: string;
}

export interface MarketSentiment {
  label: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';
  value: number; // 0-100
}

export interface MacroRisk {
  level: 'Low' | 'Moderate' | 'Elevated' | 'High' | 'Extreme';
  score: number;
  factors: string[];
}

// ---- Company ----
export interface Company {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  marketCap: number;
  marketCapLabel: string;
  price: number;
  change: number;
  changePercent: number;
  revenueGrowth: number;
  profitMargin: number;
  debtToEquity: number;
  analystSentiment: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
  institutionalOwnership: number;
  insiderActivity: 'Heavy Buying' | 'Buying' | 'Neutral' | 'Selling' | 'Heavy Selling';
  relativeStrength: number;
  aiTrendConnection: string[];
  sparkline: number[];
  scores: CompanyScores;
  summary: string;
}

export interface CompanyScores {
  momentum: number;
  fundamental: number;
  valuation: number;
  institutionalInterest: number;
  technologyExposure: number;
  marketDemand: number;
  risk: number;
  opportunity: number;
  userFit: number;
  overall: number;
}

// ---- Technology Trends ----
export interface TechTrend {
  id: string;
  name: string;
  icon: string;
  momentumScore: number;
  marketDemandScore: number;
  investmentAttentionScore: number;
  publicHypeScore: number;
  realRevenueImpactScore: number;
  keyCompanies: string[];
  emergingCompanies: string[];
  risks: string[];
  longTermImpact: string;
  historicalComparison: string;
  description: string;
}

// ---- Institutional Investors ----
export interface Institution {
  id: string;
  name: string;
  type: 'Hedge Fund' | 'Asset Manager' | 'Conglomerate' | 'ETF Issuer' | 'Individual' | 'Family Office' | 'Activist Investor';
  aum: string;
  topHoldings: InstitutionHolding[];
  recentBuys: InstitutionTrade[];
  recentSells: InstitutionTrade[];
  newPositions: string[];
  reducedPositions: string[];
  sectorExposure: { sector: string; weight: number }[];
  confidenceSignal: 'Very High' | 'High' | 'Moderate' | 'Low';
  description: string;
}

export interface InstitutionHolding {
  ticker: string;
  name: string;
  weight: number;
  shares: number;
  value: string;
  change: number;
}

export interface InstitutionTrade {
  ticker: string;
  name: string;
  action: 'Buy' | 'Sell' | 'New' | 'Exit';
  shares: number;
  value: string;
  date: string;
}

// ---- Portfolio Simulation ----
export interface SimulatedPortfolio {
  id: string;
  name: string;
  startingAmount: number;
  currentValue: number;
  strategy: string;
  positions: PortfolioPosition[];
  performance: PortfolioPerformance;
  createdAt: string;
}

export interface PortfolioPosition {
  ticker: string;
  name: string;
  allocation: number;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  gain: number;
  gainPercent: number;
}

export interface PortfolioPerformance {
  totalReturn: number;
  totalReturnPercent: number;
  monthlyReturns: number[];
  maxDrawdown: number;
  volatility: number;
  sharpeRatio: number;
  riskScore: number;
  vs_sp500: number;
  vs_nasdaq: number;
  valueHistory: { date: string; value: number }[];
}

// ---- User Preferences ----
export interface UserPreferences {
  riskTolerance: 'Conservative' | 'Balanced' | 'Growth' | 'Aggressive' | 'Speculative';
  investmentHorizon: 'Short-term' | '6 months' | '1 year' | '3 years' | '5+ years' | '10+ years';
  preferredSectors: string[];
  excludedSectors: string[];
  preferredRegions: string[];
  companySize: string[];
  maxPositionSize: number;
  maxDrawdown: number;
  dividendPreference: 'None' | 'Low' | 'Moderate' | 'High';
  growthPreference: 'Low' | 'Moderate' | 'High' | 'Aggressive';
  aiTechPreference: 'Low' | 'Moderate' | 'High';
  esgPreference: boolean;
  currency: string;
  startingCapital: number;
  scoreWeights: ScoreWeights;
  // Live mode + API configuration
  liveMode: boolean;
  openaiApiKey: string;
  openaiModel: string;
  refreshIntervalSeconds: number; // 0 = manual only
  autoRefresh: boolean;
}

// ---- Pricing / Historical ----
export type Timeframe = '1D' | '1W' | '1M' | '6M' | '1Y' | '5Y' | '10Y' | 'ALL';

export interface PricePoint {
  date: string; // ISO or label depending on timeframe
  value: number;
}

// ---- Simulator scenario tuning ----
export interface ScenarioParams {
  expectedAnnualReturn: number; // %
  volatility: number;           // %
  interestRateShock: number;    // basis points
  inflationShock: number;       // %
  techMultiplier: number;       // 0.5 .. 2.0
  durationMonths: number;       // 1 .. 120
}

export interface ScoreWeights {
  growth: number;
  safety: number;
  momentum: number;
  value: number;
  technologyExposure: number;
  institutionalActivity: number;
  dividend: number;
  shortTermPerformance: number;
  longTermPotential: number;
}

// ---- Chat ----
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  confidence?: 'High' | 'Moderate' | 'Low';
  risks?: string[];
  dataFreshness?: string;
}

// ---- Risk ----
export interface RiskAssessment {
  ticker: string;
  overallRisk: number;
  factors: RiskFactor[];
  upsideDrivers: { label: string; explanation: string }[];
  downsideRisks: { label: string; explanation: string }[];
  invalidation: string;
  watchItems: string[];
}

export interface RiskFactor {
  name: string;
  level: 'Low' | 'Moderate' | 'High' | 'Critical';
  score: number;
  description: string;
}

// ---- My Portfolio ----
export interface StockHolding {
  id: string;
  ticker: string;
  name: string;
  shares: number;
  buyPrice: number;
  buyDate: string; // ISO date
}

export interface RsuGrant {
  id: string;
  ticker: string;
  name: string;
  totalShares: number;
  grantDate: string; // ISO date
  grantPrice: number;
  vestingYears: number;
  vestingFrequencyMonths: 3 | 6; // vest every 3 or 6 months
  cliffPeriods: number; // how many periods before first vest (e.g. 4 = wait 4 periods, then vest all at once)
}

export interface VestedRsuEvent {
  date: string;
  shares: number;
  cumulative: number;
  isCliff: boolean;
}

export interface TaxSettings {
  capitalGainsTaxRate: number; // % for long-term
  shortTermCapGainsTaxRate: number; // % for short-term (<1yr)
  incomeTaxRate: number; // % for RSU income
}

// ---- Navigation ----
export type TabId = 'home' | 'trends' | 'stocks' | 'institutions' | 'portfolio' | 'agent' | 'settings';
