// Persists "Ask Agent for Details" responses so users don't pay for the
// same lookup twice. Keyed by an arbitrary string (e.g. "stock:NVDA" or
// "inst:abc123") so it can serve both stock and investor detail pages.

const KEY = 'invest_guide_ask_cache_v1';

type AskMap = Record<string, { content: string; ts: number }>;

function load(): AskMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function save(map: AskMap) {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* quota */ }
}

export const askCacheService = {
  get(key: string): string | undefined {
    return load()[key]?.content;
  },
  set(key: string, content: string) {
    const map = load();
    map[key] = { content, ts: Date.now() };
    save(map);
  },
  clear(key: string) {
    const map = load();
    delete map[key];
    save(map);
  },
};
