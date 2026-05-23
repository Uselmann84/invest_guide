// Conversation persistence for the AI Agent page
import { Conversation, ChatMessage } from '../models/types';

const KEY = 'invest_guide_agent_conversations';
const ACTIVE_KEY = 'invest_guide_agent_active_conversation';

function load(): Conversation[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(list: Conversation[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* quota */ }
}

function titleFrom(messages: ChatMessage[]): string {
  const first = messages.find(m => m.role === 'user');
  if (!first) return 'New chat';
  const t = first.content.trim().replace(/\s+/g, ' ');
  return t.length > 48 ? t.slice(0, 48) + '…' : t;
}

export const conversationService = {
  list(): Conversation[] {
    return load().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  get(id: string): Conversation | null {
    return load().find(c => c.id === id) ?? null;
  },

  /** Persist messages under the given id (create if missing). Auto-titles. */
  upsert(id: string, messages: ChatMessage[]): Conversation {
    const all = load();
    const idx = all.findIndex(c => c.id === id);
    const now = new Date().toISOString();
    if (idx === -1) {
      const conv: Conversation = {
        id,
        title: titleFrom(messages),
        createdAt: now,
        updatedAt: now,
        messages,
      };
      all.push(conv);
      save(all);
      return conv;
    }
    const existing = all[idx];
    // Keep manual title if user set one, otherwise refresh from first user msg
    const newTitle = existing.title === 'New chat' || !existing.title
      ? titleFrom(messages)
      : existing.title;
    const updated: Conversation = {
      ...existing,
      title: newTitle,
      updatedAt: now,
      messages,
    };
    all[idx] = updated;
    save(all);
    return updated;
  },

  delete(id: string) {
    save(load().filter(c => c.id !== id));
    if (this.getActiveId() === id) this.clearActive();
  },

  rename(id: string, title: string) {
    const all = load();
    const idx = all.findIndex(c => c.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], title, updatedAt: new Date().toISOString() };
      save(all);
    }
  },

  getActiveId(): string | null {
    try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
  },

  setActiveId(id: string) {
    try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* */ }
  },

  clearActive() {
    try { localStorage.removeItem(ACTIVE_KEY); } catch { /* */ }
  },

  newId(): string {
    return crypto.randomUUID();
  },
};
