import React from 'react';

export function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const barColor = color || (pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500');
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right font-mono">{value}</span>
    </div>
  );
}

export function ChangeIndicator({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const isPositive = value >= 0;
  return (
    <span className={`font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
      {isPositive ? '+' : ''}{value.toFixed(2)}{suffix}
    </span>
  );
}

export function MiniSparkline({ data, color = '#f97316', height = 32 }: { data: number[]; color?: string; height?: number }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 4)}`).join(' ');

  return (
    <svg width={w} height={height} className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function SentimentGauge({ value, label }: { value: number; label: string }) {
  const angle = (value / 100) * 180 - 90;
  const gaugeColor = value >= 70 ? '#10b981' : value >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="70" viewBox="0 0 120 70">
        <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" strokeLinecap="round" />
        <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke={gaugeColor} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${(value / 100) * 157} 157`} />
        <line x1="60" y1="65" x2={60 + 35 * Math.cos((angle * Math.PI) / 180)} y2={65 + 35 * Math.sin((angle * Math.PI) / 180)}
          stroke="white" strokeWidth="2" strokeLinecap="round" />
        <circle cx="60" cy="65" r="3" fill="white" />
      </svg>
      <div className="text-center -mt-1">
        <span className="text-lg font-bold">{value}</span>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  );
}

export function LoadingPulse() {
  return (
    <div className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" />
      <div className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
      <div className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
    </div>
  );
}

export function EmptyState({ icon, title, message }: { icon: string; title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-4xl mb-3">{icon}</span>
      <h3 className="text-lg font-semibold text-gray-300 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-xs">{message}</p>
    </div>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-xs text-accent-400 hover:text-accent-300 transition-colors">
          {action}
        </button>
      )}
    </div>
  );
}

export function Disclaimer() {
  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-400/80 leading-relaxed">
      ⚠️ This is not financial advice. All outputs are research-based estimates and simulations.
      Past performance does not guarantee future results. Data may be delayed or incomplete.
    </div>
  );
}

export function TabBar({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto no-scrollbar">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
            active === tab.id ? 'bg-accent-500/20 text-accent-400' : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
