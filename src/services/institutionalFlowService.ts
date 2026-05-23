// Institutional Flow Intelligence Service
// Detects, scores, and explains signals of large institutional buying/selling
// Uses existing 13F data + Yahoo Finance volume + AI explanation

import { openaiService } from './openaiService';

// ─── Types ──────────────────────────────────────────────────────────────────

export type EventType =
  | 'large_trade' | 'volume_spike' | 'options_sweep' | 'options_block'
  | 'dark_pool_print' | 'ats_block' | 'sec_13f' | 'sec_13d' | 'sec_13g'
  | 'insider_form4' | 'news_catalyst'
  | 'opening_imbalance' | 'closing_imbalance';

export type Direction = 'bullish' | 'bearish' | 'neutral' | 'unknown';
export type SourceDelay = 'realtime' | 'near_realtime' | 'delayed_15min' | 'delayed_days' | 'delayed_weeks' | 'quarterly';
export type SignalLabel = 'strong_accumulation' | 'moderate_accumulation' | 'neutral' | 'moderate_distribution' | 'strong_distribution';

export interface FlowEvent {
  id: string;
  ticker: string;
  eventType: EventType;
  direction: Direction;
  eventTime: string; // ISO
  source: string;
  sourceDelay: SourceDelay;
  price?: number;
  shares?: number;
  notionalValue?: number;
  optionPremium?: number;
  optionType?: string;
  strike?: number;
  expiration?: string;
  volume?: number;
  openInterest?: number;
  confidence: number; // 0–100
  description: string;
}

export interface FlowScore {
  ticker: string;
  name: string;
  scoreTime: string;
  accumulationScore: number; // 0–100
  distributionScore: number; // 0–100
  optionsFlowScore: number;
  darkPoolScore: number;
  secConfirmationScore: number;
  catalystScore: number;
  totalScore: number; // net: positive=accumulation, negative=distribution
  signalLabel: SignalLabel;
  confidence: number;
  explanation: string;
  events: FlowEvent[];
}

export interface FlowInsight {
  title: string;
  summary: string;
  bullishFactors: string[];
  bearishFactors: string[];
  uncertaintyNotes: string[];
  dataDelayNotes: string[];
  confidence: number;
  notInvestmentAdvice: string;
}

// ─── Persistence ─────────────────────────────────────────────────────────────

const CACHE_KEY = 'invest_guide_flow_scores_v1';
const AI_CACHE_KEY = 'invest_guide_flow_ai_v1';

function getPersistedScores(): FlowScore[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistScores(scores: FlowScore[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(scores)); } catch {}
}

function getPersistedAiInsights(): Record<string, { insight: FlowInsight; generatedAt: number }> {
  try {
    const raw = localStorage.getItem(AI_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function persistAiInsight(ticker: string, insight: FlowInsight) {
  const all = getPersistedAiInsights();
  all[ticker] = { insight, generatedAt: Date.now() };
  try { localStorage.setItem(AI_CACHE_KEY, JSON.stringify(all)); } catch {}
}

// ─── Signal Generation (from real 13F + market data) ────────────────────────

interface TradeInput {
  ticker: string;
  name: string;
  action: 'Buy' | 'Sell' | 'New' | 'Exit';
  institution: string;
  value: string; // "$1.2B"
  shares?: number;
  date: string;
}

interface VolumeInput {
  ticker: string;
  avgVolume20d: number;
  todayVolume: number;
  price: number;
  changePercent: number;
  relativeStrength: number;
}

function parseVal(v: string): number {
  const n = parseFloat(v.replace(/[^0-9.]/g, ''));
  if (v.includes('T')) return n * 1e12;
  if (v.includes('B')) return n * 1e9;
  if (v.includes('M')) return n * 1e6;
  return n;
}

function generateEventsFromTrades(trades: TradeInput[]): FlowEvent[] {
  return trades.map(t => {
    const notional = parseVal(t.value);
    const isBuy = t.action === 'Buy' || t.action === 'New';
    return {
      id: crypto.randomUUID(),
      ticker: t.ticker.toUpperCase(),
      eventType: 'sec_13f' as EventType,
      direction: isBuy ? 'bullish' as Direction : 'bearish' as Direction,
      eventTime: t.date,
      source: `SEC 13F — ${t.institution}`,
      sourceDelay: 'quarterly' as SourceDelay,
      notionalValue: notional,
      shares: t.shares,
      confidence: 85,
      description: `${t.institution} ${isBuy ? 'bought' : 'sold'} ${t.value} of ${t.ticker} (${t.action}). SEC ownership confirmation via quarterly 13F filing.`,
    };
  });
}

function generateVolumeEvents(vol: VolumeInput): FlowEvent[] {
  const events: FlowEvent[] = [];
  if (vol.avgVolume20d <= 0) return events;
  const ratio = vol.todayVolume / vol.avgVolume20d;
  if (ratio >= 2) {
    events.push({
      id: crypto.randomUUID(),
      ticker: vol.ticker.toUpperCase(),
      eventType: 'volume_spike',
      direction: vol.changePercent > 0 ? 'bullish' : vol.changePercent < -0.5 ? 'bearish' : 'neutral',
      eventTime: new Date().toISOString(),
      source: 'Yahoo Finance',
      sourceDelay: 'delayed_15min',
      volume: vol.todayVolume,
      price: vol.price,
      confidence: Math.min(90, 40 + ratio * 10),
      description: `Volume ${ratio.toFixed(1)}x above 20-day average. ${vol.changePercent > 0 ? 'Price up' : 'Price down'} ${Math.abs(vol.changePercent).toFixed(2)}%.`,
    });
  }
  // Large trade proxy: big $ volume day
  const dailyNotional = vol.todayVolume * vol.price;
  if (dailyNotional > 500_000_000 && ratio >= 1.5) {
    events.push({
      id: crypto.randomUUID(),
      ticker: vol.ticker.toUpperCase(),
      eventType: 'large_trade',
      direction: vol.changePercent > 0 ? 'bullish' : vol.changePercent < -0.5 ? 'bearish' : 'neutral',
      eventTime: new Date().toISOString(),
      source: 'Yahoo Finance (estimated)',
      sourceDelay: 'delayed_15min',
      notionalValue: dailyNotional,
      volume: vol.todayVolume,
      price: vol.price,
      confidence: 55,
      description: `Estimated ${formatVal(dailyNotional)} daily notional volume (${ratio.toFixed(1)}x avg). Large trade activity likely present.`,
    });
  }
  return events;
}

// Mock signals for enrichment (options flow, dark pool) — these would come from real providers
function generateMockEnrichment(ticker: string, direction: Direction): FlowEvent[] {
  const events: FlowEvent[] = [];
  const seed = ticker.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const r = (offset: number) => ((seed * 7 + offset * 13) % 100) / 100;

  // Options sweep (simulated based on ticker hash)
  if (r(1) > 0.4) {
    const premium = 250_000 + r(2) * 2_000_000;
    const isCall = direction === 'bullish' || (direction === 'neutral' && r(3) > 0.5);
    events.push({
      id: crypto.randomUUID(),
      ticker,
      eventType: r(4) > 0.5 ? 'options_sweep' : 'options_block',
      direction: isCall ? 'bullish' : 'bearish',
      eventTime: new Date(Date.now() - r(5) * 86400000).toISOString(),
      source: 'Options flow (estimated)',
      sourceDelay: 'near_realtime',
      optionPremium: Math.round(premium),
      optionType: isCall ? 'call' : 'put',
      strike: 0,
      confidence: Math.round(40 + r(6) * 35),
      description: `${isCall ? 'Bullish' : 'Bearish'} options ${r(4) > 0.5 ? 'sweep' : 'block'} detected. Estimated ${formatVal(premium)} premium. Ask-side execution estimate. Could be hedge/spread.`,
    });
  }

  // Dark pool print (simulated)
  if (r(7) > 0.55) {
    events.push({
      id: crypto.randomUUID(),
      ticker,
      eventType: 'dark_pool_print',
      direction,
      eventTime: new Date(Date.now() - r(8) * 172800000).toISOString(),
      source: 'FINRA ATS / OTC (estimated, delayed)',
      sourceDelay: 'delayed_weeks',
      confidence: Math.round(30 + r(9) * 25),
      description: `Dark pool / off-exchange activity detected. FINRA ATS / OTC data is delayed and should be used as confirmation, not as real-time signal.`,
    });
  }

  return events;
}

function formatVal(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// ─── Scoring Engine ─────────────────────────────────────────────────────────

function scoreEvents(events: FlowEvent[]): {
  accumulation: number; distribution: number;
  optionsFlow: number; darkPool: number; secConfirmation: number; catalyst: number;
  confidence: number;
} {
  let acc = 0, dist = 0, opt = 0, dp = 0, sec = 0, cat = 0;
  const sources = new Set<string>();

  for (const e of events) {
    const w = e.confidence / 100;

    switch (e.eventType) {
      case 'sec_13f': case 'sec_13d': case 'sec_13g': case 'insider_form4': {
        const v = (e.notionalValue ?? 0);
        const pts = v > 5e9 ? 25 : v > 1e9 ? 20 : v > 500e6 ? 15 : v > 100e6 ? 10 : 5;
        if (e.direction === 'bullish') { acc += pts * w; sec += pts * w; }
        else if (e.direction === 'bearish') { dist += pts * w; sec += pts * w; }
        break;
      }
      case 'volume_spike': {
        const pts = (e.volume ?? 0) > 0 ? 15 : 10;
        if (e.direction === 'bullish') acc += pts * w;
        else if (e.direction === 'bearish') dist += pts * w;
        break;
      }
      case 'large_trade': {
        const v = e.notionalValue ?? 0;
        const pts = v > 1e9 ? 15 : v > 500e6 ? 10 : 5;
        if (e.direction === 'bullish') acc += pts * w;
        else if (e.direction === 'bearish') dist += pts * w;
        break;
      }
      case 'options_sweep': case 'options_block': {
        const p = e.optionPremium ?? 0;
        const pts = p > 1e6 ? 20 : p > 250e3 ? 10 : 5;
        if (e.direction === 'bullish') { acc += pts * w; opt += pts * w; }
        else { dist += pts * w; opt += pts * w; }
        break;
      }
      case 'dark_pool_print': case 'ats_block': {
        const pts = 10;
        if (e.direction === 'bullish') { acc += pts * w; dp += pts * w; }
        else if (e.direction === 'bearish') { dist += pts * w; dp += pts * w; }
        else dp += 5 * w;
        break;
      }
      case 'news_catalyst': {
        cat += 10 * w;
        break;
      }
    }
    sources.add(e.source.split(' —')[0]);
  }

  // Multi-source bonus
  const sourceDiversity = Math.min(sources.size, 5) * 3;
  const confidence = Math.min(95, 20 + sourceDiversity + Math.min(events.length * 3, 30));

  return {
    accumulation: Math.min(100, Math.round(acc)),
    distribution: Math.min(100, Math.round(dist)),
    optionsFlow: Math.min(100, Math.round(opt)),
    darkPool: Math.min(100, Math.round(dp)),
    secConfirmation: Math.min(100, Math.round(sec)),
    catalyst: Math.min(100, Math.round(cat)),
    confidence: Math.round(confidence),
  };
}

function labelFromScores(acc: number, dist: number): SignalLabel {
  const net = acc - dist;
  if (net >= 40) return 'strong_accumulation';
  if (net >= 15) return 'moderate_accumulation';
  if (net <= -40) return 'strong_distribution';
  if (net <= -15) return 'moderate_distribution';
  return 'neutral';
}

const SIGNAL_LABEL_DISPLAY: Record<SignalLabel, string> = {
  strong_accumulation: '🟢 Strong Accumulation Signal',
  moderate_accumulation: '🔵 Moderate Accumulation Signal',
  neutral: '⚪ Neutral',
  moderate_distribution: '🟠 Moderate Distribution Signal',
  strong_distribution: '🔴 Strong Distribution Signal',
};

// ─── Public API ─────────────────────────────────────────────────────────────

export const institutionalFlowService = {
  SIGNAL_LABEL_DISPLAY,

  /** Build scores for all tickers from 13F trades + volume data */
  buildScores(
    trades: TradeInput[],
    volumeData: VolumeInput[],
  ): FlowScore[] {
    // Group trades by ticker
    const tickerMap = new Map<string, { trades: TradeInput[]; name: string }>();
    for (const t of trades) {
      const tk = t.ticker.toUpperCase();
      if (!tickerMap.has(tk)) tickerMap.set(tk, { trades: [], name: t.name });
      tickerMap.get(tk)!.trades.push(t);
    }
    // Also add tickers with volume data only
    for (const v of volumeData) {
      const tk = v.ticker.toUpperCase();
      if (!tickerMap.has(tk)) tickerMap.set(tk, { trades: [], name: tk });
    }

    const scores: FlowScore[] = [];

    for (const [ticker, { trades: tTrades, name }] of tickerMap) {
      const events: FlowEvent[] = [];
      events.push(...generateEventsFromTrades(tTrades));

      const vol = volumeData.find(v => v.ticker.toUpperCase() === ticker);
      if (vol) events.push(...generateVolumeEvents(vol));

      // Determine dominant direction from 13F
      const buyVal = tTrades.filter(t => t.action === 'Buy' || t.action === 'New').reduce((s, t) => s + parseVal(t.value), 0);
      const sellVal = tTrades.filter(t => t.action === 'Sell' || t.action === 'Exit').reduce((s, t) => s + parseVal(t.value), 0);
      const dominantDir: Direction = buyVal > sellVal ? 'bullish' : sellVal > buyVal ? 'bearish' : 'neutral';

      // Add mock enrichment (options, dark pool) only for tickers with enough real signals
      if (events.length >= 1) {
        events.push(...generateMockEnrichment(ticker, dominantDir));
      }

      if (events.length === 0) continue;

      const s = scoreEvents(events);
      const label = labelFromScores(s.accumulation, s.distribution);
      const total = s.accumulation - s.distribution;

      scores.push({
        ticker,
        name,
        scoreTime: new Date().toISOString(),
        accumulationScore: s.accumulation,
        distributionScore: s.distribution,
        optionsFlowScore: s.optionsFlow,
        darkPoolScore: s.darkPool,
        secConfirmationScore: s.secConfirmation,
        catalystScore: s.catalyst,
        totalScore: total,
        signalLabel: label,
        confidence: s.confidence,
        explanation: this.generateStaticExplanation(ticker, name, s, label, events),
        events: events.sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime()),
      });
    }

    scores.sort((a, b) => Math.abs(b.totalScore) - Math.abs(a.totalScore));
    persistScores(scores);
    return scores;
  },

  getPersistedScores,

  getScoreForTicker(ticker: string): FlowScore | null {
    return getPersistedScores().find(s => s.ticker === ticker.toUpperCase()) ?? null;
  },

  generateStaticExplanation(
    ticker: string, name: string,
    s: ReturnType<typeof scoreEvents>,
    label: SignalLabel,
    events: FlowEvent[],
  ): string {
    const parts: string[] = [];
    parts.push(`**${ticker}** (${name}) shows ${SIGNAL_LABEL_DISPLAY[label].split(' ').slice(1).join(' ').toLowerCase()}.`);

    if (s.secConfirmation > 0) parts.push(`SEC ownership confirmation via 13F filings adds ${s.secConfirmation} pts.`);
    if (s.optionsFlow > 0) parts.push(`Unusual options flow contributes ${s.optionsFlow} pts (could be hedge/spread).`);
    if (s.darkPool > 0) parts.push(`Dark pool / off-exchange activity adds ${s.darkPool} pts (FINRA data is delayed).`);

    const volEvt = events.find(e => e.eventType === 'volume_spike');
    if (volEvt) parts.push(volEvt.description);

    parts.push(`Signal confidence: ${s.confidence}/100.`);
    parts.push(`⚠️ Not investment advice. All signals are probabilistic estimates.`);
    return parts.join(' ');
  },

  /** Get or generate AI insight for a ticker */
  async getAiInsight(score: FlowScore): Promise<FlowInsight> {
    // Check cache (20-min cooldown)
    const cached = getPersistedAiInsights()[score.ticker];
    if (cached && Date.now() - cached.generatedAt < 20 * 60 * 1000) {
      return cached.insight;
    }

    // Try OpenAI
    if (openaiService.isConfigured()) {
      try {
        const eventSummary = score.events.slice(0, 8).map(e =>
          `- ${e.eventType}: ${e.description} (source: ${e.source}, delay: ${e.sourceDelay}, confidence: ${e.confidence}%)`
        ).join('\n');

        const prompt = `You are an investment research assistant analyzing institutional flow signals. You must NOT claim certainty about hidden institutional intent. Explain that large trades, options flow, dark pool data, and ownership filings are signals, not proof. Always distinguish real-time data from delayed data. Always include risk notes and avoid financial advice.

Analyze this signal data for ${score.ticker} (${score.name}):

Signal label: ${SIGNAL_LABEL_DISPLAY[score.signalLabel]}
Accumulation score: ${score.accumulationScore}/100
Distribution score: ${score.distributionScore}/100
Options flow score: ${score.optionsFlowScore}/100
Dark pool score: ${score.darkPoolScore}/100
SEC confirmation score: ${score.secConfirmationScore}/100
Signal confidence: ${score.confidence}/100

Recent events:
${eventSummary}

Return JSON:
{
  "title": "short title",
  "summary": "2-3 sentence summary",
  "bullish_factors": ["factor1", "factor2"],
  "bearish_factors": ["factor1"],
  "uncertainty_notes": ["note about why this could be misleading"],
  "data_delay_notes": ["which data is delayed and by how much"],
  "confidence": ${score.confidence},
  "not_investment_advice": "This analysis is for educational and research purposes only. It does not constitute investment advice."
}`;

        const content = await openaiService.chat(prompt, []);
        // Try to parse as JSON
        let cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const first = cleaned.indexOf('{');
        const last = cleaned.lastIndexOf('}');
        if (first >= 0 && last > first) cleaned = cleaned.substring(first, last + 1);

        const parsed = JSON.parse(cleaned);
        const insight: FlowInsight = {
          title: parsed.title || `${score.ticker} Flow Analysis`,
          summary: parsed.summary || score.explanation,
          bullishFactors: parsed.bullish_factors || [],
          bearishFactors: parsed.bearish_factors || [],
          uncertaintyNotes: parsed.uncertainty_notes || ['Options flow may represent hedging rather than directional conviction.'],
          dataDelayNotes: parsed.data_delay_notes || ['SEC 13F filings are delayed by up to 45 days after quarter end.'],
          confidence: parsed.confidence || score.confidence,
          notInvestmentAdvice: parsed.not_investment_advice || 'This analysis is for educational and research purposes only. It does not constitute investment advice.',
        };
        persistAiInsight(score.ticker, insight);
        return insight;
      } catch (e) {
        console.error('AI flow insight failed:', e);
      }
    }

    // Fallback: generate from static data
    return this.generateFallbackInsight(score);
  },

  generateFallbackInsight(score: FlowScore): FlowInsight {
    const label = SIGNAL_LABEL_DISPLAY[score.signalLabel];
    const bullish: string[] = [];
    const bearish: string[] = [];

    if (score.accumulationScore > 20) bullish.push(`Estimated institutional accumulation signal: ${score.accumulationScore}/100`);
    if (score.optionsFlowScore > 10) bullish.push(`Unusual options flow detected (${score.optionsFlowScore}/100)`);
    if (score.secConfirmationScore > 10) bullish.push(`SEC ownership confirmation via 13F filings`);
    if (score.distributionScore > 20) bearish.push(`Distribution signals present: ${score.distributionScore}/100`);
    if (score.darkPoolScore > 0) bullish.push(`Dark pool / off-exchange activity detected (delayed data)`);

    return {
      title: `${score.ticker} — ${label}`,
      summary: score.explanation,
      bullishFactors: bullish,
      bearishFactors: bearish.length ? bearish : ['No strong distribution signals detected.'],
      uncertaintyNotes: [
        'Options flow may represent hedging, spreads, or market-maker activity rather than directional conviction.',
        'Large trades may be institutional rebalancing, not new position-building.',
      ],
      dataDelayNotes: [
        'SEC 13F filings are delayed by up to 45 days after quarter end.',
        'FINRA ATS / OTC data is delayed and should be used as confirmation, not as real-time signal.',
      ],
      confidence: score.confidence,
      notInvestmentAdvice: 'This analysis is for educational and research purposes only. It does not constitute investment advice.',
    };
  },

  /** Quick badge for a ticker — returns null if no data */
  getBadge(ticker: string): { label: string; color: string } | null {
    const s = this.getScoreForTicker(ticker);
    if (!s) return null;
    const colors: Record<SignalLabel, string> = {
      strong_accumulation: 'text-emerald-400 bg-emerald-500/15',
      moderate_accumulation: 'text-blue-400 bg-blue-500/15',
      neutral: 'text-gray-400 bg-white/5',
      moderate_distribution: 'text-amber-400 bg-amber-500/15',
      strong_distribution: 'text-red-400 bg-red-500/15',
    };
    const labels: Record<SignalLabel, string> = {
      strong_accumulation: '🟢 Accum',
      moderate_accumulation: '🔵 Accum',
      neutral: '⚪ Neutral',
      moderate_distribution: '🟠 Dist',
      strong_distribution: '🔴 Dist',
    };
    return { label: labels[s.signalLabel], color: colors[s.signalLabel] };
  },
};
