// OpenAI Service — real API integration
// When liveMode is enabled and an API key is set, this sends prompts to OpenAI
import { userPreferenceService } from './userPreferenceService';

const BASE_SYSTEM_PROMPT = `You are an AI-powered investment research agent. You analyze stock markets, technology trends, institutional activity, and macroeconomic signals to provide research-based insights.

IMPORTANT RULES:
1. Your output is for educational and research purposes only
2. Mention key risks naturally within your analysis
3. Note that data may be delayed or estimated
4. Be concise but thorough
5. Use markdown formatting: ## for sections, ### for subsections, **bold** for emphasis, bullet points for lists
6. When comparing stocks, use markdown tables with | column | headers |
7. Write in a polished, direct style without meta-commentary about confidence levels

You have access to general market knowledge up to your training cutoff. When asked about specific real-time prices, note that you're providing estimates based on recent data.`;

function getSystemPrompt(): string {
  const profile = userPreferenceService.getInvestorProfileContext();
  return `${BASE_SYSTEM_PROMPT}\n\nINVESTOR PROFILE:\n${profile}\nTailor all analysis, recommendations, and risk assessments to this investor's profile. Prioritize their preferred sectors, regions, and company sizes. Respect their risk tolerance and investment horizon when suggesting opportunities.`;
}

export const openaiService = {
  isConfigured(): boolean {
    const prefs = userPreferenceService.getPreferences();
    return prefs.liveMode && !!prefs.openaiApiKey;
  },

  async chat(userMessage: string, conversationHistory: { role: string; content: string }[]): Promise<string> {
    const prefs = userPreferenceService.getPreferences();
    if (!prefs.openaiApiKey) throw new Error('OpenAI API key not configured. Go to Settings → Live Mode & API.');

    const apiKey = prefs.openaiApiKey.trim();
    if (!apiKey.startsWith('sk-')) throw new Error('Invalid API key format. OpenAI keys start with "sk-".');

    const messages = [
      { role: 'system', content: getSystemPrompt() },
      ...conversationHistory.slice(-10).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ];

    const model = prefs.openaiModel || 'gpt-4.1-mini';
    const isGpt5 = model.startsWith('gpt-5') || model.startsWith('o3') || model.startsWith('o4');
    const body: Record<string, unknown> = {
      model,
      messages,
      max_completion_tokens: 2048,
    };
    if (!isGpt5) body.temperature = 0.7;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.error?.message || `HTTP ${res.status}`;
      if (res.status === 401) throw new Error('Invalid API key. Check your key in Settings.');
      if (res.status === 429) throw new Error('Rate limited. Wait a moment and try again.');
      if (res.status === 403) throw new Error('API key lacks permissions. Check your OpenAI plan.');
      throw new Error(`OpenAI error: ${msg}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'No response from AI.';
  },
};
