import React, { useState, useRef, useEffect, useMemo } from 'react';
import { aiAgentService } from '../services/aiAgentService';
import { conversationService } from '../services/conversationService';
import { ChatMessage, Conversation } from '../models/types';
import { LoadingPulse, MarkdownContent } from '../components/SharedComponents';

export default function AgentPage() {
  const [conversationId, setConversationId] = useState<string>(() => {
    const active = conversationService.getActiveId();
    return active ?? conversationService.newId();
  });
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const active = conversationService.getActiveId();
    if (active) return conversationService.get(active)?.messages ?? [];
    return [];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>(() => conversationService.list());
  const scrollRef = useRef<HTMLDivElement>(null);
  const suggestedPrompts = useMemo(() => aiAgentService.getSuggestedPrompts(), []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) return;
    conversationService.upsert(conversationId, messages);
    conversationService.setActiveId(conversationId);
    setConversations(conversationService.list());
  }, [messages, conversationId]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await aiAgentService.chat(text, [...messages, userMsg]);
      setMessages(prev => [...prev, response]);
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date().toISOString(),
      }]);
    }

    setLoading(false);
  };

  const newConversation = () => {
    setMessages([]);
    const id = conversationService.newId();
    setConversationId(id);
    conversationService.setActiveId(id);
    setHistoryOpen(false);
  };

  const loadConversation = (id: string) => {
    const conv = conversationService.get(id);
    if (!conv) return;
    setConversationId(id);
    setMessages(conv.messages);
    conversationService.setActiveId(id);
    setHistoryOpen(false);
  };

  const deleteConversation = (id: string) => {
    conversationService.delete(id);
    const list = conversationService.list();
    setConversations(list);
    if (id === conversationId) {
      if (list.length > 0) loadConversation(list[0].id);
      else newConversation();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">AI Agent</h1>
          <p className="text-xs text-gray-500 mt-0.5">Ask about markets, stocks, trends, and strategies</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={newConversation}
            title="New chat"
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 active:bg-accent-500/20 flex items-center justify-center text-gray-400 hover:text-white transition-all"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2}>
              <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={() => setHistoryOpen(o => !o)}
            title="History"
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              historyOpen ? 'bg-accent-500/20 text-accent-400' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2}>
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Slide-down history panel */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          historyOpen ? 'max-h-[60vh] opacity-100 mb-3' : 'max-h-0 opacity-0 mb-0'
        }`}
      >
        <div className="card p-2 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center justify-between px-2 py-1.5 mb-1">
            <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Conversations</span>
            <span className="text-[10px] text-gray-600">{conversations.length}</span>
          </div>
          {conversations.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">No saved conversations yet.</p>
          ) : (
            <div className="space-y-1">
              {conversations.map(c => (
                <div
                  key={c.id}
                  className={`group flex items-center gap-2 rounded-lg px-2 py-2 transition-all ${
                    c.id === conversationId ? 'bg-accent-500/10 border border-accent-500/30' : 'hover:bg-white/5'
                  }`}
                >
                  <button onClick={() => loadConversation(c.id)} className="flex-1 min-w-0 text-left">
                    <p className={`text-xs font-medium truncate ${c.id === conversationId ? 'text-accent-400' : 'text-gray-200'}`}>{c.title}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {new Date(c.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {c.messages.length} msg
                    </p>
                  </button>
                  <button
                    onClick={() => deleteConversation(c.id)}
                    title="Delete"
                    className="opacity-40 hover:opacity-100 active:opacity-100 text-gray-400 hover:text-red-400 transition-all w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-500/10"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth={2}>
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-accent-500/10 flex items-center justify-center text-3xl mb-4">🤖</div>
            <h3 className="text-base font-semibold text-gray-300 mb-1">Investment Research Agent</h3>
            <p className="text-xs text-gray-500 mb-6 max-w-xs">
              Ask me about market trends, stock analysis, institutional activity, or portfolio strategies.
            </p>
            <div className="space-y-2 w-full max-w-sm">
              {suggestedPrompts.slice(0, 6).map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => send(prompt)}
                  className="w-full text-left p-3 card-compact text-xs text-gray-300 hover:border-accent-500/30 hover:text-white transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-2xl p-3.5 ${
              msg.role === 'user'
                ? 'bg-accent-500 text-white rounded-br-md'
                : 'card rounded-bl-md'
            }`}>
              {msg.role === 'user' ? (
                <p className="text-sm">{msg.content}</p>
              ) : (
                <MarkdownContent text={msg.content} />
              )}
              <p className="text-[10px] mt-2 opacity-50">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="card rounded-2xl rounded-bl-md p-4">
              <LoadingPulse />
              <p className="text-xs text-gray-500 mt-2">Analyzing...</p>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="pt-2 border-t border-white/5">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send(input)}
            placeholder="Ask about markets, stocks, trends..."
            className="input-field flex-1 py-2.5 text-sm"
            disabled={loading}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="btn-primary px-4 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ↑
          </button>
        </div>
        <p className="text-[10px] text-gray-600 text-center mt-2">Not financial advice · Research only · Mock data</p>
      </div>
    </div>
  );
}
