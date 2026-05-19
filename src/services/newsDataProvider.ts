// News Data Provider — Replace with real API (e.g., NewsAPI, Benzinga, Alpha Vantage News)

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  timestamp: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  tickers: string[];
  summary: string;
}

const mockNews: NewsItem[] = [
  { id: '1', title: 'NVIDIA Reports Record Data Center Revenue, Beats All Estimates', source: 'Reuters', timestamp: '2h ago', sentiment: 'positive', tickers: ['NVDA'], summary: 'NVIDIA\'s data center revenue surged 154% YoY, driven by unprecedented AI chip demand.' },
  { id: '2', title: 'Fed Officials Signal Patience on Rate Cuts Amid Sticky Inflation', source: 'Bloomberg', timestamp: '3h ago', sentiment: 'negative', tickers: [], summary: 'Multiple Fed governors indicated rates may stay higher for longer than markets expect.' },
  { id: '3', title: 'Microsoft Azure Growth Reaccelerates to 31% on AI Workloads', source: 'CNBC', timestamp: '4h ago', sentiment: 'positive', tickers: ['MSFT'], summary: 'Azure cloud growth beat expectations as enterprise AI adoption drives compute demand.' },
  { id: '4', title: 'Nuclear Energy Stocks Surge as Big Tech Signs Power Agreements', source: 'WSJ', timestamp: '5h ago', sentiment: 'positive', tickers: ['VST', 'CEG', 'SMR'], summary: 'Google, Microsoft, and Amazon signing long-term nuclear power deals for data centers.' },
  { id: '5', title: 'Small Caps Rally as Market Breadth Expands Beyond Mega-Tech', source: 'Barron\'s', timestamp: '6h ago', sentiment: 'positive', tickers: [], summary: 'Russell 2000 outperforming as investors rotate into broader market participation.' },
  { id: '6', title: 'Tesla Faces Margin Pressure as EV Competition Intensifies in China', source: 'FT', timestamp: '8h ago', sentiment: 'negative', tickers: ['TSLA'], summary: 'BYD and other Chinese EV makers gaining share, forcing Tesla to cut prices further.' },
];

export const newsDataProvider = {
  async getLatestNews(limit = 10): Promise<NewsItem[]> {
    return mockNews.slice(0, limit);
  },

  async getNewsByTicker(ticker: string): Promise<NewsItem[]> {
    return mockNews.filter(n => n.tickers.includes(ticker));
  },
};
