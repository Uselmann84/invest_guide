import React, { useMemo } from 'react';

// ---- Inline bold/italic renderer ----
function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={j} className="text-white font-semibold">{part.slice(2, -2)}</strong>
      : <span key={j}>{part}</span>
  );
}

// ---- Clean AI response: strip confidence level section & trailing disclaimer ----
function cleanAiResponse(text: string): string {
  // Remove "## Confidence Level" section (heading + all lines until next ## or end)
  let cleaned = text.replace(/## Confidence Level[:\s]*\w*\n(?:(?!## ).+\n?)*/gi, '');
  // Remove trailing disclaimer line
  cleaned = cleaned.replace(/⚠️[^\n]*not financial advice[^\n]*/gi, '');
  // Remove leading "Not financial advice" boilerplate line
  cleaned = cleaned.replace(/^Not financial advice[^\n]*\n*/i, '');
  return cleaned.trim();
}

/** Full markdown renderer — handles ##, ###, tables, bullets, numbered lists, bold, hr */
export function MarkdownContent({ text }: { text: string }) {
  const elements = useMemo(() => {
    const cleaned = cleanAiResponse(text);
    const lines = cleaned.split('\n');
    const result: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Horizontal rule
      if (line.startsWith('---')) {
        result.push(<hr key={i} className="border-white/10 my-3" />);
        i++;
        continue;
      }

      // ## Heading
      if (line.startsWith('## ')) {
        result.push(
          <h2 key={i} className="text-base font-bold text-white mt-4 mb-1.5">{renderInline(line.slice(3))}</h2>
        );
        i++;
        continue;
      }

      // ### Subheading
      if (line.startsWith('### ')) {
        result.push(
          <h3 key={i} className="text-sm font-semibold text-gray-200 mt-3 mb-1">{renderInline(line.slice(4))}</h3>
        );
        i++;
        continue;
      }

      // Table: collect all consecutive | lines, parse into a real table
      if (line.startsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].startsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        // Parse header + separator + body
        if (tableLines.length >= 2) {
          const parseRow = (row: string) => row.split('|').slice(1, -1).map(c => c.trim());
          const headers = parseRow(tableLines[0]);
          // Skip separator row (|---|---|)
          const startIdx = tableLines[1].includes('---') ? 2 : 1;
          const bodyRows = tableLines.slice(startIdx).map(parseRow);

          result.push(
            <div key={`table-${i}`} className="overflow-x-auto my-2 rounded-lg border border-white/10">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/5">
                    {headers.map((h, hi) => (
                      <th key={hi} className="text-left px-2.5 py-2 text-gray-400 font-semibold whitespace-nowrap">{renderInline(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bodyRows.map((row, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? '' : 'bg-white/[0.02]'}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-2.5 py-2 text-gray-300 leading-relaxed">{renderInline(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        continue;
      }

      // Bullet list item (- or •)
      if (line.match(/^\s*[-•]\s/)) {
        const items: { indent: number; text: string }[] = [];
        while (i < lines.length && lines[i].match(/^\s*[-•]\s/)) {
          const match = lines[i].match(/^(\s*)[-•]\s(.*)/)!;
          items.push({ indent: match[1].length, text: match[2] });
          i++;
        }
        result.push(
          <ul key={`ul-${i}`} className="space-y-1 my-1.5">
            {items.map((item, li) => (
              <li key={li} className="flex gap-2 text-sm text-gray-300 leading-relaxed" style={{ paddingLeft: item.indent > 0 ? '1rem' : 0 }}>
                <span className="text-accent-500 mt-0.5 shrink-0">•</span>
                <span>{renderInline(item.text)}</span>
              </li>
            ))}
          </ul>
        );
        continue;
      }

      // Numbered list
      if (line.match(/^\d+\.\s/)) {
        const items: string[] = [];
        while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
          items.push(lines[i].replace(/^\d+\.\s/, ''));
          i++;
        }
        result.push(
          <ol key={`ol-${i}`} className="space-y-1 my-1.5">
            {items.map((item, li) => (
              <li key={li} className="flex gap-2 text-sm text-gray-300 leading-relaxed">
                <span className="text-accent-400 font-semibold shrink-0 w-5 text-right">{li + 1}.</span>
                <span>{renderInline(item)}</span>
              </li>
            ))}
          </ol>
        );
        continue;
      }

      // Empty line = spacer
      if (line.trim() === '') {
        i++;
        continue;
      }

      // Regular paragraph
      result.push(
        <p key={i} className="text-sm text-gray-300 leading-relaxed">
          {renderInline(line)}
        </p>
      );
      i++;
    }

    return result;
  }, [text]);

  return <div className="space-y-0.5">{elements}</div>;
}

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

export const APP_VERSION = 'v1.3.0';

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
