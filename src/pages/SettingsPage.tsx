import React, { useState, useEffect } from 'react';
import { userPreferenceService } from '../services/userPreferenceService';
import { UserPreferences } from '../models/types';
import { SectionHeader, Disclaimer } from '../components/SharedComponents';

const SECTORS = ['Technology', 'Healthcare', 'Financials', 'Consumer Discretionary', 'Industrials', 'Energy', 'Communication', 'Materials', 'Utilities', 'Real Estate', 'Consumer Staples'];
const REGIONS = ['USA', 'Europe', 'China', 'Japan', 'Global'];
const SIZES = ['Large cap', 'Mid cap', 'Small cap', 'Micro cap'];

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input-field text-sm appearance-none"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function MultiSelect({ label, selected, options, onChange }: { label: string; selected: string[]; options: string[]; onChange: (v: string[]) => void }) {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  };
  return (
    <div>
      <label className="text-xs text-gray-400 block mb-2">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <button
            key={o}
            onClick={() => toggle(o)}
            className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
              selected.includes(o)
                ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, suffix, onChange }: { label: string; value: number; min: number; max: number; step: number; suffix: string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-gray-400">{label}</label>
        <span className="text-xs text-accent-400 font-mono">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent-500"
      />
    </div>
  );
}

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<UserPreferences>(() => userPreferenceService.getPreferences());
  const [saved, setSaved] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const update = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const updateWeight = (key: keyof UserPreferences['scoreWeights'], value: number) => {
    setPrefs(prev => ({ ...prev, scoreWeights: { ...prev.scoreWeights, [key]: value } }));
    setSaved(false);
  };

  const save = () => {
    userPreferenceService.savePreferences(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const reset = () => {
    const defaults = userPreferenceService.resetPreferences();
    setPrefs(defaults);
    setSaved(false);
  };

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-xs text-gray-500 mt-0.5">Investment preferences & AI configuration</p>
      </div>

      {/* Risk & Horizon */}
      <div className="card p-4">
        <SectionHeader title="Investment Profile" />
        <div className="space-y-4">
          <Select label="Risk Tolerance" value={prefs.riskTolerance}
            options={['Conservative', 'Balanced', 'Growth', 'Aggressive', 'Speculative']}
            onChange={v => update('riskTolerance', v as any)} />
          <Select label="Investment Horizon" value={prefs.investmentHorizon}
            options={['Short-term', '6 months', '1 year', '3 years', '5+ years', '10+ years']}
            onChange={v => update('investmentHorizon', v as any)} />
          <Select label="Growth Preference" value={prefs.growthPreference}
            options={['Low', 'Moderate', 'High', 'Aggressive']}
            onChange={v => update('growthPreference', v as any)} />
          <Select label="Dividend Preference" value={prefs.dividendPreference}
            options={['None', 'Low', 'Moderate', 'High']}
            onChange={v => update('dividendPreference', v as any)} />
          <Select label="AI/Tech Preference" value={prefs.aiTechPreference}
            options={['Low', 'Moderate', 'High']}
            onChange={v => update('aiTechPreference', v as any)} />
        </div>
      </div>

      {/* Sectors */}
      <div className="card p-4">
        <SectionHeader title="Sector Preferences" />
        <div className="space-y-4">
          <MultiSelect label="Preferred Sectors" selected={prefs.preferredSectors} options={SECTORS} onChange={v => update('preferredSectors', v)} />
          <MultiSelect label="Excluded Sectors" selected={prefs.excludedSectors} options={SECTORS} onChange={v => update('excludedSectors', v)} />
        </div>
      </div>

      {/* Regions & Size */}
      <div className="card p-4">
        <SectionHeader title="Market Preferences" />
        <div className="space-y-4">
          <MultiSelect label="Preferred Regions" selected={prefs.preferredRegions} options={REGIONS} onChange={v => update('preferredRegions', v)} />
          <MultiSelect label="Company Size" selected={prefs.companySize} options={SIZES} onChange={v => update('companySize', v)} />
          <Select label="Currency" value={prefs.currency}
            options={['USD', 'EUR', 'GBP', 'JPY', 'CHF']}
            onChange={v => update('currency', v)} />
        </div>
      </div>

      {/* Limits */}
      <div className="card p-4">
        <SectionHeader title="Risk Limits" />
        <div className="space-y-4">
          <Slider label="Max Position Size" value={prefs.maxPositionSize} min={1} max={50} step={1} suffix="%" onChange={v => update('maxPositionSize', v)} />
          <Slider label="Max Portfolio Drawdown" value={prefs.maxDrawdown} min={5} max={60} step={5} suffix="%" onChange={v => update('maxDrawdown', v)} />
          <div>
            <label className="text-xs text-gray-400 block mb-1">Starting Capital (Simulation)</label>
            <input
              type="number"
              value={prefs.startingCapital}
              onChange={e => update('startingCapital', Number(e.target.value))}
              className="input-field text-sm"
            />
          </div>
        </div>
      </div>

      {/* Score Weights */}
      <div className="card p-4">
        <SectionHeader title="AI Score Weights" />
        <p className="text-xs text-gray-500 mb-3">Adjust how the AI ranks investment opportunities</p>
        <div className="space-y-3">
          {(Object.keys(prefs.scoreWeights) as (keyof typeof prefs.scoreWeights)[]).map(key => (
            <Slider
              key={key}
              label={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
              value={prefs.scoreWeights[key]}
              min={0} max={30} step={1} suffix=""
              onChange={v => updateWeight(key, v)}
            />
          ))}
        </div>
      </div>

      {/* ESG */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">ESG Preference</p>
            <p className="text-xs text-gray-500 mt-0.5">Prioritize ESG-rated companies</p>
          </div>
          <button
            onClick={() => update('esgPreference', !prefs.esgPreference)}
            className={`w-12 h-7 rounded-full transition-all ${prefs.esgPreference ? 'bg-accent-500' : 'bg-white/10'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${prefs.esgPreference ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {/* OpenAI API Configuration */}
      <div className="card p-4">
        <SectionHeader title="AI Analysis" />
        <p className="text-xs text-gray-500 mb-3">Stock prices come from Yahoo Finance (free, always on). AI analysis requires an OpenAI API key.</p>

        {/* OpenAI Key */}
        <div className="mb-3">
          <label className="text-xs text-gray-400 block mb-1">OpenAI API Key</label>
          <input
            type="password"
            value={prefs.openaiApiKey}
            onChange={e => { update('openaiApiKey', e.target.value); if (e.target.value) update('liveMode', true); }}
            placeholder="sk-..."
            className="input-field text-sm"
          />
        </div>

        {/* Model Select */}
        <div className="mb-3">
          <Select label="Model" value={prefs.openaiModel}
            options={['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo']}
            onChange={v => update('openaiModel', v)} />
        </div>

        {prefs.openaiApiKey ? (
          <div className="mt-2 p-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs">
            ✓ AI enabled — Tap 🤖 AI on the Dashboard to generate analysis ({prefs.openaiModel})
          </div>
        ) : (
          <div className="mt-2 p-2 rounded-lg bg-white/5 text-gray-500 text-xs">
            Add an API key to enable AI analysis. Data-driven summaries work without it.
          </div>
        )}
        <p className="text-[10px] text-gray-600 mt-2">API keys are stored locally and never sent to third parties.</p>
      </div>

      {/* Auto Refresh */}
      <div className="card p-4">
        <SectionHeader title="Data Refresh" />
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium">Auto Refresh Prices</p>
            <p className="text-xs text-gray-500 mt-0.5">Auto-fetch latest stock prices from Yahoo Finance</p>
          </div>
          <button
            onClick={() => update('autoRefresh', !prefs.autoRefresh)}
            className={`w-12 h-7 rounded-full transition-all ${prefs.autoRefresh ? 'bg-accent-500' : 'bg-white/10'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${prefs.autoRefresh ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        {prefs.autoRefresh && (
          <Slider
            label="Refresh Interval"
            value={prefs.refreshIntervalSeconds}
            min={10} max={300} step={10}
            suffix="s"
            onChange={v => update('refreshIntervalSeconds', v)}
          />
        )}
        <p className="text-[10px] text-gray-600 mt-2">You can also manually refresh using the ↻ button in the header.</p>
      </div>

      {/* Disclaimer */}
      <button onClick={() => setShowDisclaimer(!showDisclaimer)} className="card p-4 w-full text-left">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Disclaimer & Privacy</p>
          <span className="text-gray-500">{showDisclaimer ? '▼' : '▶'}</span>
        </div>
        {showDisclaimer && (
          <div className="mt-3 text-xs text-gray-400 space-y-2 leading-relaxed">
            <p>• This application does not provide financial advice</p>
            <p>• It is not a licensed financial advisor</p>
            <p>• It is for research and simulation only</p>
            <p>• You are responsible for your investment decisions</p>
            <p>• Data may be delayed or incomplete</p>
            <p>• Simulations are hypothetical</p>
            <p>• Past performance does not guarantee future results</p>
            <hr className="border-white/10 my-2" />
            <p className="font-medium text-gray-300">Privacy</p>
            <p>• All preferences stored locally on your device</p>
            <p>• Simulated portfolios stored locally</p>
            <p>• No personal financial data sent anywhere</p>
            <p>• API keys stored locally, never shared</p>
          </div>
        )}
      </button>

      {/* Save / Reset */}
      <div className="flex gap-3">
        <button onClick={save} className="btn-primary flex-1">
          {saved ? '✓ Saved' : 'Save Preferences'}
        </button>
        <button onClick={reset} className="btn-secondary">Reset</button>
      </div>

      <Disclaimer />
    </div>
  );
}
