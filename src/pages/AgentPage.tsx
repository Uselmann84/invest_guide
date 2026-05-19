import React, { useState, useRef, useEffect } from 'react';
import { aiAgentService } from '../services/aiAgentService';
import { ChatMessage } from '../models/types';
import { LoadingPulse, Disclaimer } from '../components/SharedComponents';

export default function AgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const suggestedPrompts = aiAgentService.getSuggestedPrompts();

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const renderMarkdown = (text: string) => {
    // Simple markdown rendering
    return text.split('\n').map((line, i) => {
      if (line.startsWith('---')) return <hr key={i} className="border-white/10 my-2" />;
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="font-semibold text-white">{line.replace(/\*\*/g, '')}</p>;
      }
      if (line.startsWith('| ')) {
        return <p key={i} className="text-xs font-mono text-gray-400">{line}</p>;
      }
      // Bold within text
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <p key={i} className="text-sm text-gray-300 leading-relaxed">
          {parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={j} className="text-white font-semibold">{part.slice(2, -2)}</strong>
              : part.startsWith('•') || part.startsWith('✓') || part.startsWith('✗')
                ? <span key={j}>{part}</span>
                : part.startsWith('⚠️') || part.startsWith('📊') || part.startsWith('📅')
                  ? <span key={j} className="text-xs text-gray-400">{part}</span>
                  : <span key={j}>{part}</span>
          )}
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-3">
        <h1 className="text-xl font-bold">AI Agent</h1>
        <p className="text-xs text-gray-500 mt-0.5">Ask about markets, stocks, trends, and strategies</p>
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
                <div className="space-y-1">{renderMarkdown(msg.content)}</div>
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
