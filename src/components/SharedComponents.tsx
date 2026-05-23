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
  // Needle angle: value 0 → points left (180°), value 100 → points right (0°)
  const angleRad = ((1 - value / 100) * Math.PI);
  const gaugeColor = value >= 70 ? '#10b981' : value >= 40 ? '#f59e0b' : '#ef4444';
  const desc = value >= 80 ? 'Extreme optimism — markets may be overbought'
    : value >= 60 ? 'Investors are risk-on, buying aggressively'
    : value >= 40 ? 'Balanced sentiment — no strong bias'
    : value >= 20 ? 'Caution rising — investors are selling'
    : 'Panic selling — markets may be oversold';

  return (
    <div className="flex flex-col items-center">
      <p className="text-[10px] text-gray-500 mb-1">Market Sentiment</p>
      <svg width="130" height="80" viewBox="0 0 130 80">
        <path d="M 15 70 A 50 50 0 0 1 115 70" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" strokeLinecap="round" />
        <path d="M 15 70 A 50 50 0 0 1 115 70" fill="none" stroke={gaugeColor} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${(value / 100) * 157} 157`} />
        <line x1="65" y1="70" x2={65 + 35 * Math.cos(angleRad)} y2={70 - 35 * Math.sin(angleRad)}
          stroke="white" strokeWidth="2" strokeLinecap="round" />
        <circle cx="65" cy="70" r="3" fill="white" />
        {/* Labels outside the arc */}
        <text x="4" y="78" fontSize="8" fill="#ef4444" textAnchor="start">Fear</text>
        <text x="65" y="10" fontSize="8" fill="#f59e0b" textAnchor="middle">Neutral</text>
        <text x="126" y="78" fontSize="8" fill="#10b981" textAnchor="end">Greed</text>
      </svg>
      <div className="text-center -mt-1">
        <span className="text-lg font-bold">{value}</span>
        <p className="text-xs font-medium" style={{ color: gaugeColor }}>{label}</p>
        <p className="text-[9px] text-gray-500 mt-0.5 max-w-[110px] leading-tight">{desc}</p>
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

export const APP_VERSION = 'v1.2.1';

export function Disclaimer() {
  return (
    <p className="text-[9px] text-gray-600 text-center leading-snug py-3 px-4">
      Not financial advice · Estimates only · Past performance ≠ future results · {APP_VERSION}
    </p>
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
