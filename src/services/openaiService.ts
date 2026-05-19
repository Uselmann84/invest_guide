// OpenAI Service — real API integration
// When liveMode is enabled and an API key is set, this sends prompts to OpenAI
import { userPreferenceService } from './userPreferenceService';

const SYSTEM_PROMPT = `You are an AI-powered investment research agent. You analyze stock markets, technology trends, institutional activity, and macroeconomic signals to provide research-based insights.

IMPORTANT RULES:
1. Always state that your output is NOT financial advice
2. Include a confidence level (High, Moderate, Low)
3. Mention key risks
4. Note that data may be delayed or estimated
5. Be concise but thorough
6. Use markdown formatting with bold headers and bullet points
7. When comparing stocks, use tables
8. Always end with the disclaimer: "⚠️ This is not financial advice. All outputs are research-based estimates and simulations."

You have access to general market knowledge up to your training cutoff. When asked about specific real-time prices, note that you're providing estimates based on recent data.`;

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
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory.slice(-10).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: prefs.openaiModel || 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
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
