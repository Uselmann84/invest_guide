// SEC EDGAR 13F Filing Fetcher
// Fetches institutional holdings from public SEC 13F-HR filings
// Free API, no key required. Rate limit: 10 req/sec
// User-Agent required per SEC fair access policy

const SEC_BASE = 'https://data.sec.gov';
const SEC_ARCHIVES = 'https://www.sec.gov/Archives/edgar/data';
const USER_AGENT = 'InvestGuide/1.1 (invest-guide-app@proton.me)';

// CIK numbers for tracked institutions (10-digit zero-padded)
export const INSTITUTION_CIKS: Record<string, string> = {
  'Berkshire Hathaway': '0001067983',
  'BlackRock': '0001364742',
  'ARK Invest': '0001803916',
  'Renaissance Technologies': '0001037389',
  'Bridgewater Associates': '0001350694',
  'Vanguard Group': '0000102909',
  'Soros Fund Management': '0001029160',
  'Duquesne Family Office': '0001536411',
  'Pershing Square Capital': '0001336528',
  'Icahn Enterprises': '0000810197',
  'Greenlight Capital': '0001079114',
  'Appaloosa Management': '0001135730',
  'Coatue Management': '0001535392',
  'Tiger Global Management': '0001167483',
  'Elliott Management': '0001048445',
  'Citadel Advisors': '0001423053',
};

// Issuer name (from 13F XML) → ticker mapping
const ISSUER_TICKERS: Record<string, string> = {
  'APPLE INC': 'AAPL', 'MICROSOFT CORP': 'MSFT', 'NVIDIA CORP': 'NVDA',
  'AMAZON COM INC': 'AMZN', 'ALPHABET INC': 'GOOGL', 'META PLATFORMS INC': 'META',
  'TESLA INC': 'TSLA', 'BROADCOM INC': 'AVGO', 'BERKSHIRE HATHAWAY INC': 'BRK.B',
  'JPMORGAN CHASE & CO': 'JPM', 'UNITEDHEALTH GROUP INC': 'UNH', 'VISA INC': 'V',
  'ELI LILLY & CO': 'LLY', 'ELI LILLY AND CO': 'LLY', 'JOHNSON & JOHNSON': 'JNJ',
  'WALMART INC': 'WMT', 'PROCTER & GAMBLE CO': 'PG', 'MASTERCARD INC': 'MA',
  'HOME DEPOT INC': 'HD', 'ABBVIE INC': 'ABBV', 'COCA COLA CO': 'KO',
  'SALESFORCE INC': 'CRM', 'CHEVRON CORP': 'CVX', 'MERCK & CO INC': 'MRK',
  'BANK OF AMERICA CORP': 'BAC', 'AMERICAN EXPRESS CO': 'AXP', 'PEPSICO INC': 'PEP',
  'COSTCO WHOLESALE CORP': 'COST', 'EXXON MOBIL CORP': 'XOM',
  'ADVANCED MICRO DEVICES INC': 'AMD', 'ADOBE INC': 'ADBE', 'NETFLIX INC': 'NFLX',
  'INTUIT INC': 'INTU', 'CISCO SYSTEMS INC': 'CSCO', 'TEXAS INSTRUMENTS INC': 'TXN',
  'QUALCOMM INC': 'QCOM', 'COMCAST CORP': 'CMCSA', 'ORACLE CORP': 'ORCL',
  'SERVICENOW INC': 'NOW', 'UBER TECHNOLOGIES INC': 'UBER',
  'PALANTIR TECHNOLOGIES INC': 'PLTR', 'COINBASE GLOBAL INC': 'COIN',
  'CROWDSTRIKE HOLDINGS INC': 'CRWD', 'SNOWFLAKE INC': 'SNOW', 'ROKU INC': 'ROKU',
  'ROCKET LAB USA INC': 'RKLB', 'SUNCOR ENERGY INC': 'SU', 'CHUBB LTD': 'CB',
  'NOVO NORDISK': 'NVO', 'NOVO NORDISK A S': 'NVO',
  'CONSTELLATION ENERGY CORP': 'CEG', 'VISTRA CORP': 'VST',
  'HILTON WORLDWIDE HOLDINGS INC': 'HLT', 'RESTAURANT BRANDS INTL INC': 'QSR',
  'CHIPOTLE MEXICAN GRILL INC': 'CMG', 'BROOKFIELD CORP': 'BN',
  'ALIBABA GROUP HOLDING LTD': 'BABA', 'HP INC': 'HPQ',
  'HEWLETT PACKARD ENTERPRISE CO': 'HPE', 'PINTEREST INC': 'PINS',
  'SUPER MICRO COMPUTER INC': 'SMCI', 'GREEN PLAINS INC': 'GPRE',
  'FORD MOTOR CO': 'F', 'OCCIDENTAL PETROLEUM CORP': 'OXY', 'LOWES COS INC': 'LOW',
  'ULTA BEAUTY INC': 'ULTA', 'UIPATH INC': 'PATH', 'TWILIO INC': 'TWLO',
  'BRISTOL MYERS SQUIBB CO': 'BMY', 'PALO ALTO NETWORKS INC': 'PANW',
  'ARM HOLDINGS PLC': 'ARM', 'SPDR S&P 500 ETF TR': 'SPY',
  'ISHARES TR': 'IVV', 'OKLO INC': 'OKLO', 'IONQ INC': 'IONQ',
  'POOL CORP': 'POOL', 'CVR ENERGY INC': 'CVI', 'TECK RESOURCES LTD': 'TECK',
  'ODP CORP': 'ODP', 'CONSOL ENERGY INC': 'CEIX',
};

export interface Holding13F {
  nameOfIssuer: string;
  ticker: string;
  cusip: string;
  value: number;     // dollars (converted from thousands in filing)
  shares: number;
}

export interface Filing13F {
  accessionNumber: string;
  filingDate: string;
  reportDate: string; // quarter end date, e.g. '2026-03-31'
  quarter: string;    // e.g. '2026-Q1'
  holdings: Holding13F[];
  totalValue: number; // sum of all holdings in dollars
}

function dateToQuarter(dateStr: string): string {
  const d = new Date(dateStr);
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `${d.getFullYear()}-Q${q}`;
}

// Determine which quarter's 13F data should be the latest available
// 13F deadline: 45 days after quarter end
export function getExpectedLatestQuarter(now = new Date()): string {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  // Q4 (Dec 31) → due Feb 14
  // Q1 (Mar 31) → due May 15
  // Q2 (Jun 30) → due Aug 14
  // Q3 (Sep 30) → due Nov 14
  if (month >= 11 && day >= 15) return `${year}-Q3`;
  if (month >= 8 && day >= 15) return `${year}-Q2`;
  if (month >= 8) return `${year}-Q1`;
  if (month >= 5 && day >= 16) return `${year}-Q1`;
  if (month >= 5) return `${year - 1}-Q4`;
  if (month >= 2 && day >= 15) return `${year - 1}-Q4`;
  return `${year - 1}-Q3`;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchSEC(url: string): Promise<Response> {
  await delay(120); // stay under 10 req/sec
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json, text/xml, text/html, */*',
    },
  });
  if (!res.ok) throw new Error(`SEC HTTP ${res.status} for ${url}`);
  return res;
}

function issuerToTicker(name: string): string {
  const normalized = name.toUpperCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
  if (ISSUER_TICKERS[normalized]) return ISSUER_TICKERS[normalized];
  // Fuzzy: try removing common suffixes
  for (const suffix of [' NEW', ' CL A', ' CL B', ' CL C', ' CLASS A', ' CLASS B', ' CLASS C', ' COM', ' SHS', ' DEL', ' HLDGS', ' HOLDINGS']) {
    const stripped = normalized.replace(suffix, '').trim();
    if (ISSUER_TICKERS[stripped]) return ISSUER_TICKERS[stripped];
  }
  return '';
}

function parseInfoTableXML(xmlText: string): Holding13F[] {
  // Strip namespace prefixes and xmlns declarations for simpler parsing
  let cleaned = xmlText
    .replace(/<(\/?)[\w]+:/g, '<$1')
    .replace(/xmlns(:\w+)?="[^"]*"/g, '');

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleaned, 'text/xml');
  if (doc.querySelector('parsererror')) {
    console.warn('Failed to parse 13F XML');
    return [];
  }

  const entries = doc.querySelectorAll('infoTable');
  const holdings: Holding13F[] = [];

  entries.forEach(entry => {
    const nameOfIssuer = entry.querySelector('nameOfIssuer')?.textContent?.trim() || '';
    const cusip = entry.querySelector('cusip')?.textContent?.trim() || '';
    const valueStr = entry.querySelector('value')?.textContent || '0';
    const sharesStr = entry.querySelector('sshPrnamt')?.textContent || '0';
    const putCall = entry.querySelector('putCall')?.textContent?.trim();

    if (putCall) return; // Skip options

    const value = parseInt(valueStr, 10) * 1000; // filing reports in thousands
    const shares = parseInt(sharesStr, 10);
    const ticker = issuerToTicker(nameOfIssuer);

    holdings.push({ nameOfIssuer, ticker, cusip, value, shares });
  });

  return holdings;
}

// Fetch the 2 most recent 13F-HR filings for an institution
export async function getLatest13FFilings(institutionName: string): Promise<Filing13F[]> {
  const cik = INSTITUTION_CIKS[institutionName];
  if (!cik) throw new Error(`Unknown institution: ${institutionName}`);

  // Step 1: Get filing list
  const subUrl = `${SEC_BASE}/submissions/CIK${cik}.json`;
  const subRes = await fetchSEC(subUrl);
  const subData = await subRes.json();
  const recent = subData.filings?.recent;
  if (!recent) return [];

  // Find 13F-HR filings
  interface FilingRef {
    accessionNumber: string;
    filingDate: string;
    reportDate: string;
  }
  const filingRefs: FilingRef[] = [];
  for (let i = 0; i < recent.form.length && filingRefs.length < 2; i++) {
    if (recent.form[i] === '13F-HR') {
      filingRefs.push({
        accessionNumber: recent.accessionNumber[i],
        filingDate: recent.filingDate[i],
        reportDate: recent.reportDate[i],
      });
    }
  }

  if (filingRefs.length === 0) return [];

  // Step 2: For each filing, fetch the infotable
  const results: Filing13F[] = [];
  const cikNum = parseInt(cik, 10).toString();

  for (const ref of filingRefs) {
    const accPath = ref.accessionNumber.replace(/-/g, '');

    // Try common infotable filenames first
    let holdings: Holding13F[] = [];
    const tryNames = ['infotable.xml', 'InfoTable.xml', 'INFOTABLE.XML', 'informationtable.xml'];
    for (const name of tryNames) {
      try {
        const url = `${SEC_ARCHIVES}/${cikNum}/${accPath}/${name}`;
        const res = await fetchSEC(url);
        const xml = await res.text();
        holdings = parseInfoTableXML(xml);
        if (holdings.length > 0) break;
      } catch { /* try next */ }
    }

    // Fallback: fetch filing index and find the infotable document
    if (holdings.length === 0) {
      try {
        const idxUrl = `${SEC_ARCHIVES}/${cikNum}/${accPath}/index.json`;
        const idxRes = await fetchSEC(idxUrl);
        const idx = await idxRes.json();
        const items = idx.directory?.item || [];
        const infoDoc = items.find((item: { name: string; type?: string }) =>
          item.name.toLowerCase().includes('infotable') ||
          item.name.toLowerCase().includes('information') ||
          (item.type && item.type.toLowerCase().includes('information table'))
        );
        if (infoDoc) {
          const docUrl = `${SEC_ARCHIVES}/${cikNum}/${accPath}/${infoDoc.name}`;
          const docRes = await fetchSEC(docUrl);
          const xml = await docRes.text();
          holdings = parseInfoTableXML(xml);
        }
      } catch (e) {
        console.warn(`Failed to fetch filing index for ${institutionName}:`, e);
      }
    }

    const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
    results.push({
      accessionNumber: ref.accessionNumber,
      filingDate: ref.filingDate,
      reportDate: ref.reportDate,
      quarter: dateToQuarter(ref.reportDate),
      holdings,
      totalValue,
    });
  }

  return results;
}
