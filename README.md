# InvestGuide

A mobile-first AI-powered investment research and simulation app. iPhone-first, dark-mode, single-page React + TypeScript + Tailwind app.

> ⚠️ **This is not financial advice.** All outputs are research-based estimates and simulations. For research, simulation, and education only.

## Features

- **Dashboard** — Major indexes (S&P 500, Nasdaq 100, Dow, Russell 2000, DAX, Nikkei, MSCI World), sentiment gauge, macro risk, sector heatmap, AI market brief
- **Technology Trends** — 17 trends (AI, Robotics, EVs, Semis, Cloud, Cybersecurity, Quantum, Biotech, Defense, Space, Clean & Nuclear Energy, Fintech, Data Centers, Industrial Automation) scored across momentum, demand, attention, hype, and revenue impact
- **Stock Discovery** — 15 ranked companies with detailed scoring (momentum, fundamentals, valuation, institutional, tech exposure, risk, opportunity)
- **Institutional Tracker** — Berkshire, BlackRock, Vanguard, ARK, Bridgewater, Renaissance Technologies with holdings, recent buys/sells, sector exposure
- **Portfolio Simulator** — 6 scenarios (Base, Conservative, Optimistic, Crisis, Tech Boom, Rate Shock) with backtesting charts
- **AI Agent Chat** — Conversational research interface with suggested prompts
- **Settings** — Risk profile, sector preferences, score weighting, API configuration, ESG toggle

## Quick Start

```bash
npm install
npm run dev
```

App runs at http://localhost:5173/

## Build

```bash
npm run build
npm run preview
```

## Architecture

```
src/
  models/types.ts           # All TypeScript interfaces
  data/                     # Mock data (replace with API calls)
  services/                 # Data providers + business logic
    marketDataProvider.ts
    companyDataProvider.ts
    institutionalDataProvider.ts
    trendDataProvider.ts
    newsDataProvider.ts
    simulationEngine.ts
    aiAgentService.ts
    scoringEngine.ts
    riskEngine.ts
    userPreferenceService.ts
  components/               # Reusable UI components
  pages/                    # Top-level pages (1 per tab)
  App.tsx                   # Shell + bottom navigation
```

## Connecting Real APIs

Each provider in `src/services/` is mock-backed but API-ready. Look for `// TODO:` comments to wire up:

- **Stock prices**: Polygon.io, Alpha Vantage, Finnhub, Yahoo Finance
- **Fundamentals**: Financial Modeling Prep, SEC EDGAR
- **13F filings**: SEC EDGAR, WhaleWisdom
- **News**: NewsAPI, Benzinga, Alpha Vantage News
- **AI chat**: OpenAI, Anthropic, or local LLM

API keys can be entered in **Settings → API Configuration** (stored in localStorage only).

## Tech Stack

- React 18 + TypeScript
- Vite 6
- Tailwind CSS 3 (dark mode default)
- Recharts (portfolio charts)
- LocalStorage (preferences, portfolios, disclaimer state)

## Privacy

- All preferences stored locally on device
- No personal financial data sent externally
- API keys stored locally, never shared
- User controls all external data connections

## Disclaimer

This application:
- Does **not** provide financial advice
- Is **not** a licensed financial advisor
- Is for research, simulation, and education only
- Uses mock data unless real APIs are configured
- Does not guarantee past or future performance

The user is responsible for all investment decisions.
