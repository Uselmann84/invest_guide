// AI Agent Service — Replace with OpenAI API or local LLM
import { ChatMessage } from '../models/types';
import { mockCompanies } from '../data/mockCompanies';
import { mockTrends } from '../data/mockTrends';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const responses: Record<string, string> = {
  'ai stocks': `**Strongest AI Stocks Right Now:**

1. **NVDA (NVIDIA)** — Score: 88/100 — Dominant AI GPU maker, record data center revenue, 122% revenue growth. The undisputed AI infrastructure leader.

2. **MSFT (Microsoft)** — Score: 87/100 — Azure AI growth reaccelerating, Copilot adoption expanding. Best-positioned for enterprise AI monetization.

3. **AVGO (Broadcom)** — Score: 84/100 — Custom AI ASICs for hyperscalers, plus networking chips. VMware integration adds software margin.

4. **META (Meta)** — Score: 82/100 — AI-driven ad targeting improvements, massive Llama model investments. Reels engagement accelerating.

5. **PLTR (Palantir)** — Score: 70/100 — Highest momentum in AI software, but extreme valuation. AIP platform gaining enterprise traction rapidly.

**Key Risk:** AI spending cycle could face a "digestion phase" in 2025-2026 similar to early cloud computing adoption. Monitor for capex guidance changes from hyperscalers.`,

  'robotics': `**Companies Best Positioned for Robotics:**

1. **Tesla (TSLA)** — Optimus humanoid robot leverages existing AI/manufacturing capabilities. Highest upside optionality if successful.

2. **Intuitive Surgical (ISRG)** — Dominant surgical robotics platform. Da Vinci system has 67% market share. Proven revenue model.

3. **Rockwell Automation (ROK)** — Industrial automation leader. Benefits from reshoring and smart factory trends.

4. **ABB Ltd (ABB)** — Global robotics/automation diversified across industries. Strong in warehouse and logistics automation.

5. **NVIDIA (NVDA)** — Provides the AI "brain" for robotics. Isaac platform enables robot training in simulation.

**Emerging Players:** Serve Robotics (SMRT), Ouster (OUST) for LiDAR, Agility Robotics (private) for warehouse humanoids.

**Timeline:** Industrial robotics revenue impact: NOW. Humanoid robotics: 3-7 year timeline for meaningful revenue.`,

  default: `Based on current market analysis:

**Market Overview:**
The market is in a broad uptrend led by AI infrastructure spending. Key themes include data center buildout, nuclear power renaissance, and broadening market participation beyond mega-cap technology.

**Top Opportunities:**
• AI semiconductor supply chain (NVDA, AVGO, AMD)
• AI software platforms (MSFT, PLTR, CRM)
• Power infrastructure for AI (VST, CEG)
• Cybersecurity beneficiaries (CRWD, PANW)

**Key Risks:**
• AI spending cycle maturation
• Interest rates staying higher for longer
• Geopolitical tensions
• Concentration risk in mega-caps

**Recommendation:** Focus on companies with proven AI revenue (not just AI narrative) and strong competitive moats. Prefer diversified exposure across the AI value chain.`,
};

export const aiAgentService = {
  async chat(userMessage: string, _history: ChatMessage[]): Promise<ChatMessage> {
    // TODO: Replace with real OpenAI/Anthropic API call
    // const response = await fetch('https://api.openai.com/v1/chat/completions', { ... });
    await delay(800 + Math.random() * 1200);

    const msg = userMessage.toLowerCase();
    let content = responses.default;

    if (msg.includes('ai stock') || msg.includes('ai companies') || msg.includes('artificial intelligence')) {
      content = responses['ai stocks'];
    } else if (msg.includes('robot')) {
      content = responses['robotics'];
    } else if (msg.includes('compare')) {
      const tickers = mockCompanies.filter(c => msg.includes(c.ticker.toLowerCase())).slice(0, 5);
      if (tickers.length > 0) {
        content = `**Comparison:**\n\n${tickers.map(c =>
          `**${c.ticker} (${c.name})**\n• Score: ${c.scores.overall}/100\n• Revenue Growth: ${c.revenueGrowth}%\n• Margin: ${c.profitMargin}%\n• Risk: ${c.scores.risk}/100\n• AI Exposure: ${c.scores.technologyExposure}/100\n• ${c.summary}`
        ).join('\n\n')}`;
      }
    } else if (msg.includes('trend') || msg.includes('technology')) {
      const topTrends = [...mockTrends].sort((a, b) => b.momentumScore - a.momentumScore).slice(0, 5);
      content = `**Top Technology Trends by Momentum:**\n\n${topTrends.map((t, i) =>
        `${i + 1}. **${t.name}** ${t.icon}\n   Momentum: ${t.momentumScore}/100 | Demand: ${t.marketDemandScore}/100 | Revenue Impact: ${t.realRevenueImpactScore}/100\n   ${t.description}`
      ).join('\n\n')}`;
    } else if (msg.includes('overhype') || msg.includes('overvalue')) {
      const overhyped = mockCompanies.filter(c => c.scores.valuation < 35 && c.scores.momentum > 70);
      content = `**Potentially Overhyped Stocks:**\n\n${overhyped.map(c =>
        `• **${c.ticker}** — Valuation: ${c.scores.valuation}/100, Momentum: ${c.scores.momentum}/100\n  ${c.summary}`
      ).join('\n\n')}\n\n⚠️ High momentum + low valuation scores suggest prices may have run ahead of fundamentals. This doesn't mean they will decline — but risk/reward is less favorable.`;
    } else if (msg.includes('buy') && msg.includes('investor')) {
      content = `**What Famous Investors Are Buying (Based on Latest 13F Filings):**\n\n• **Berkshire Hathaway** — New position in Chubb (CB). Building insurance exposure. Continued Apple reduction.\n• **BlackRock** — Increased NVIDIA (+$5.8B), Broadcom (+$3.4B). New positions in ARM, CRDO.\n• **Renaissance Technologies** — Added NVIDIA, Broadcom. Reduced Novo Nordisk.\n• **ARK Invest** — Buying Tesla, Palantir, Rocket Lab. New positions in OKLO (nuclear) and IONQ (quantum).\n• **Bridgewater** — Added NVIDIA, Alphabet. Reducing consumer staples exposure.\n\n**Consensus Signal:** AI infrastructure is the dominant theme across all major institutional buyers.`;
    } else if (msg.includes('portfolio') || msg.includes('build')) {
      content = `**Suggested AI-Heavy Aggressive Portfolio:**\n\n| Ticker | Name | Allocation | Rationale |\n|--------|------|-----------|----------|\n| NVDA | NVIDIA | 20% | AI infrastructure leader |\n| MSFT | Microsoft | 18% | Enterprise AI + Cloud |\n| AVGO | Broadcom | 12% | AI networking + custom chips |\n| AMD | AMD | 10% | GPU competition + data center |\n| META | Meta | 10% | AI-driven ad platform |\n| CRWD | CrowdStrike | 8% | AI cybersecurity |\n| VST | Vistra | 7% | AI power demand |\n| PLTR | Palantir | 5% | AI software (high risk) |\n| GOOGL | Alphabet | 5% | Broad AI exposure |\n| Cash | — | 5% | Dry powder |\n\n**Expected Profile:** High growth, high volatility. Estimated risk score: 65/100.\n\n⚠️ This is a simulated portfolio for research purposes. Not financial advice.`;
    }

    // Append standard footer
    const confidence = msg.includes('ai') || msg.includes('nvda') ? 'High' : 'Moderate';
    content += `\n\n---\n📊 **Confidence:** ${confidence} | 📅 **Data as of:** May 2026 (mock data)\n⚠️ *This is not financial advice. All outputs are research-based estimates and simulations.*`;

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      confidence: confidence as 'High' | 'Moderate',
      risks: ['Data is simulated', 'Market conditions change rapidly'],
      dataFreshness: 'Mock data — connect real API for live data',
    };
  },

  getSuggestedPrompts(): string[] {
    return [
      'What are the strongest AI stocks right now?',
      'Which companies could benefit most from robotics?',
      'What are famous investors buying?',
      'Build me a simulated aggressive AI portfolio',
      'Which technology trend has the strongest 5-year potential?',
      'Which stocks are overhyped?',
      'Compare NVDA, MSFT, AMD, GOOGL, and META',
      'What is currently driving the market?',
    ];
  },
};
