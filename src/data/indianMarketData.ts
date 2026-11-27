import { computeTechnicalSeries } from '../lib/indicators.ts';
import type {
  DataSourceMode,
  MarketIndex,
  OhlcvBar,
  StockDetail,
  StockFundamentals,
  StockSummary,
} from '../types/market.ts';

export const DATA_SOURCE_MODE: DataSourceMode = 'Simulated Historical Dataset';

interface StockSeedConfig {
  symbol: string;
  bseCode: string;
  name: string;
  sector: string;
  anchorPrice: number;
  dailyVolatility: number;
  annualDrift: number;
  baseVolume: number;
  seed: number;
  fundamentals: StockFundamentals;
}

const STOCK_SEEDS: StockSeedConfig[] = [
  {
    symbol: 'RELIANCE',
    bseCode: '500325',
    name: 'Reliance Industries Ltd',
    sector: 'Energy & Digital Services',
    anchorPrice: 1318.4,
    dailyVolatility: 0.0145,
    annualDrift: 0.14,
    baseVolume: 11200000,
    seed: 101,
    fundamentals: {
      marketCapCr: 1784500,
      peRatio: 25.4,
      pbRatio: 2.18,
      roePercent: 9.2,
      dividendYieldPercent: 0.38,
      epsInr: 51.9,
      debtToEquity: 0.39,
      faceValueInr: 10,
      bookValueInr: 604.8,
      fundamentalsStatus: 'Reference Demo Figures',
    },
  },
  {
    symbol: 'TCS',
    bseCode: '532540',
    name: 'Tata Consultancy Services Ltd',
    sector: 'IT Services',
    anchorPrice: 4142.8,
    dailyVolatility: 0.0125,
    annualDrift: 0.11,
    baseVolume: 2450000,
    seed: 202,
    fundamentals: {
      marketCapCr: 1498800,
      peRatio: 30.8,
      pbRatio: 16.2,
      roePercent: 51.4,
      dividendYieldPercent: 1.42,
      epsInr: 134.5,
      debtToEquity: 0.08,
      faceValueInr: 1,
      bookValueInr: 255.7,
      fundamentalsStatus: 'Reference Demo Figures',
    },
  },
  {
    symbol: 'INFY',
    bseCode: '500209',
    name: 'Infosys Ltd',
    sector: 'IT Services',
    anchorPrice: 1864.5,
    dailyVolatility: 0.014,
    annualDrift: 0.13,
    baseVolume: 6850000,
    seed: 303,
    fundamentals: {
      marketCapCr: 774200,
      peRatio: 28.6,
      pbRatio: 8.75,
      roePercent: 31.8,
      dividendYieldPercent: 2.05,
      epsInr: 65.2,
      debtToEquity: 0.09,
      faceValueInr: 5,
      bookValueInr: 213.1,
      fundamentalsStatus: 'Reference Demo Figures',
    },
  },
  {
    symbol: 'HDFCBANK',
    bseCode: '500180',
    name: 'HDFC Bank Ltd',
    sector: 'Private Banking',
    anchorPrice: 1742.2,
    dailyVolatility: 0.012,
    annualDrift: 0.12,
    baseVolume: 14900000,
    seed: 404,
    fundamentals: {
      marketCapCr: 1328400,
      peRatio: 19.7,
      pbRatio: 2.88,
      roePercent: 16.1,
      dividendYieldPercent: 1.12,
      epsInr: 88.4,
      debtToEquity: null,
      faceValueInr: 1,
      bookValueInr: 604.9,
      fundamentalsStatus: 'Reference Demo Figures',
    },
  },
  {
    symbol: 'ICICIBANK',
    bseCode: '532174',
    name: 'ICICI Bank Ltd',
    sector: 'Private Banking',
    anchorPrice: 1296.6,
    dailyVolatility: 0.013,
    annualDrift: 0.18,
    baseVolume: 12400000,
    seed: 505,
    fundamentals: {
      marketCapCr: 913600,
      peRatio: 20.1,
      pbRatio: 3.46,
      roePercent: 18.7,
      dividendYieldPercent: 0.77,
      epsInr: 64.5,
      debtToEquity: null,
      faceValueInr: 2,
      bookValueInr: 374.7,
      fundamentalsStatus: 'Reference Demo Figures',
    },
  },
  {
    symbol: 'SBIN',
    bseCode: '500112',
    name: 'State Bank of India',
    sector: 'Public Sector Banking',
    anchorPrice: 842.35,
    dailyVolatility: 0.0165,
    annualDrift: 0.16,
    baseVolume: 16800000,
    seed: 606,
    fundamentals: {
      marketCapCr: 751800,
      peRatio: 10.9,
      pbRatio: 1.85,
      roePercent: 18.2,
      dividendYieldPercent: 1.62,
      epsInr: 77.3,
      debtToEquity: null,
      faceValueInr: 1,
      bookValueInr: 455.3,
      fundamentalsStatus: 'Reference Demo Figures',
    },
  },
  {
    symbol: 'ITC',
    bseCode: '500875',
    name: 'ITC Ltd',
    sector: 'FMCG & Consumer',
    anchorPrice: 486.9,
    dailyVolatility: 0.011,
    annualDrift: 0.09,
    baseVolume: 13200000,
    seed: 707,
    fundamentals: {
      marketCapCr: 608900,
      peRatio: 29.4,
      pbRatio: 8.42,
      roePercent: 28.6,
      dividendYieldPercent: 2.82,
      epsInr: 16.56,
      debtToEquity: 0.01,
      faceValueInr: 1,
      bookValueInr: 57.8,
      fundamentalsStatus: 'Reference Demo Figures',
    },
  },
  {
    symbol: 'TATAMOTORS',
    bseCode: '500570',
    name: 'Tata Motors Ltd',
    sector: 'Automobiles',
    anchorPrice: 894.5,
    dailyVolatility: 0.0205,
    annualDrift: -0.04,
    baseVolume: 11600000,
    seed: 808,
    fundamentals: {
      marketCapCr: 329200,
      peRatio: 10.6,
      pbRatio: 3.62,
      roePercent: 36.4,
      dividendYieldPercent: 0.67,
      epsInr: 84.3,
      debtToEquity: 1.06,
      faceValueInr: 2,
      bookValueInr: 247.1,
      fundamentalsStatus: 'Reference Demo Figures',
    },
  },
  {
    symbol: 'BHARTIARTL',
    bseCode: '532454',
    name: 'Bharti Airtel Ltd',
    sector: 'Telecom',
    anchorPrice: 1628.75,
    dailyVolatility: 0.0145,
    annualDrift: 0.24,
    baseVolume: 6150000,
    seed: 909,
    fundamentals: {
      marketCapCr: 926800,
      peRatio: 64.2,
      pbRatio: 10.8,
      roePercent: 16.5,
      dividendYieldPercent: 0.49,
      epsInr: 25.37,
      debtToEquity: 2.14,
      faceValueInr: 5,
      bookValueInr: 150.8,
      fundamentalsStatus: 'Reference Demo Figures',
    },
  },
  {
    symbol: 'LT',
    bseCode: '500510',
    name: 'Larsen & Toubro Ltd',
    sector: 'Infrastructure & EPC',
    anchorPrice: 3648.2,
    dailyVolatility: 0.015,
    annualDrift: 0.15,
    baseVolume: 2180000,
    seed: 1010,
    fundamentals: {
      marketCapCr: 501600,
      peRatio: 37.8,
      pbRatio: 5.75,
      roePercent: 15.1,
      dividendYieldPercent: 0.76,
      epsInr: 96.5,
      debtToEquity: 1.28,
      faceValueInr: 2,
      bookValueInr: 634.4,
      fundamentalsStatus: 'Reference Demo Figures',
    },
  },
  {
    symbol: 'BAJFINANCE',
    bseCode: '500034',
    name: 'Bajaj Finance Ltd',
    sector: 'Financial Services',
    anchorPrice: 7185.0,
    dailyVolatility: 0.0175,
    annualDrift: 0.06,
    baseVolume: 1240000,
    seed: 1111,
    fundamentals: {
      marketCapCr: 444900,
      peRatio: 29.5,
      pbRatio: 5.58,
      roePercent: 21.8,
      dividendYieldPercent: 0.5,
      epsInr: 243.5,
      debtToEquity: 3.74,
      faceValueInr: 2,
      bookValueInr: 1287.6,
      fundamentalsStatus: 'Reference Demo Figures',
    },
  },
  {
    symbol: 'ASIANPAINT',
    bseCode: '500820',
    name: 'Asian Paints Ltd',
    sector: 'Consumer Discretionary',
    anchorPrice: 2546.4,
    dailyVolatility: 0.0155,
    annualDrift: -0.11,
    baseVolume: 1890000,
    seed: 1212,
    fundamentals: {
      marketCapCr: 244200,
      peRatio: 49.6,
      pbRatio: 13.1,
      roePercent: 27.4,
      dividendYieldPercent: 1.31,
      epsInr: 51.3,
      debtToEquity: 0.14,
      faceValueInr: 1,
      bookValueInr: 194.4,
      fundamentalsStatus: 'Reference Demo Figures',
    },
  },
  {
    symbol: 'SUNPHARMA',
    bseCode: '524715',
    name: 'Sun Pharmaceutical Industries',
    sector: 'Pharmaceuticals',
    anchorPrice: 1848.6,
    dailyVolatility: 0.0135,
    annualDrift: 0.21,
    baseVolume: 2320000,
    seed: 1313,
    fundamentals: {
      marketCapCr: 443500,
      peRatio: 41.2,
      pbRatio: 6.72,
      roePercent: 16.8,
      dividendYieldPercent: 0.73,
      epsInr: 44.87,
      debtToEquity: 0.05,
      faceValueInr: 1,
      bookValueInr: 275.1,
      fundamentalsStatus: 'Reference Demo Figures',
    },
  },
  {
    symbol: 'WIPRO',
    bseCode: '507685',
    name: 'Wipro Ltd',
    sector: 'IT Services',
    anchorPrice: 564.25,
    dailyVolatility: 0.015,
    annualDrift: 0.1,
    baseVolume: 9450000,
    seed: 1414,
    fundamentals: {
      marketCapCr: 295400,
      peRatio: 25.1,
      pbRatio: 3.74,
      roePercent: 14.9,
      dividendYieldPercent: 0.18,
      epsInr: 22.48,
      debtToEquity: 0.22,
      faceValueInr: 2,
      bookValueInr: 150.9,
      fundamentalsStatus: 'Reference Demo Figures',
    },
  },
  {
    symbol: 'MARUTI',
    bseCode: '532500',
    name: 'Maruti Suzuki India Ltd',
    sector: 'Automobiles',
    anchorPrice: 12140.5,
    dailyVolatility: 0.014,
    annualDrift: 0.08,
    baseVolume: 520000,
    seed: 1515,
    fundamentals: {
      marketCapCr: 381700,
      peRatio: 26.8,
      pbRatio: 4.42,
      roePercent: 16.9,
      dividendYieldPercent: 1.03,
      epsInr: 453.0,
      debtToEquity: 0.02,
      faceValueInr: 5,
      bookValueInr: 2746.7,
      fundamentalsStatus: 'Reference Demo Figures',
    },
  },
];

// Mulberry32 deterministic PRNG so historical series are 100% reproducible
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function getRecentTradingDates(count: number): string[] {
  const dates: string[] = [];
  const d = new Date();
  // Anchor to the most recent weekday on or before today
  d.setUTCHours(10, 0, 0, 0);
  while (dates.length < count) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(d.toISOString().slice(0, 10));
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return dates.reverse();
}

function generateDeterministicOhlcv(config: StockSeedConfig, numDays = 260): OhlcvBar[] {
  const rand = mulberry32(config.seed * 7919 + 17);
  const dates = getRecentTradingDates(numDays);
  const dailyDrift = config.annualDrift / 252;

  // Generate raw path starting at 100, then scale to end near anchorPrice
  const rawCloses: number[] = [100];
  let regimeBias = 0;

  for (let i = 1; i < numDays; i++) {
    if (i % 28 === 0) {
      regimeBias = (rand() - 0.48) * 0.0022;
    }
    // Box-Muller normal draw
    const u1 = Math.max(rand(), 1e-7);
    const u2 = rand();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const dailyReturn = dailyDrift + regimeBias + config.dailyVolatility * z;
    const nextPrice = Math.max(10, rawCloses[i - 1] * Math.exp(dailyReturn));
    rawCloses.push(nextPrice);
  }

  const scale = config.anchorPrice / rawCloses[rawCloses.length - 1];
  const bars: OhlcvBar[] = [];

  for (let i = 0; i < numDays; i++) {
    const close = Number((rawCloses[i] * scale).toFixed(2));
    const prev = i === 0 ? close * 0.996 : bars[i - 1].close;
    const gapPct = (rand() - 0.5) * config.dailyVolatility * 0.55;
    const open = Number((prev * (1 + gapPct)).toFixed(2));
    const intraSpread = config.dailyVolatility * (0.45 + rand() * 0.95);
    const high = Number((Math.max(open, close) * (1 + intraSpread * 0.55)).toFixed(2));
    const low = Number(
      Math.max(0.5, Math.min(open, close) * (1 - intraSpread * 0.55)).toFixed(2)
    );
    const moveFactor = Math.abs(close - open) / Math.max(open, 1);
    const volume = Math.round(
      config.baseVolume * (0.68 + rand() * 0.72 + moveFactor * 16)
    );

    bars.push({
      date: dates[i],
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return bars;
}

const stockDetailCache = new Map<string, StockDetail>();

function buildStockDetail(config: StockSeedConfig): StockDetail {
  const bars = generateDeterministicOhlcv(config, 260);
  const { series, summary } = computeTechnicalSeries(bars);
  const last = series[series.length - 1];
  const prev = series[series.length - 2];

  const change = Number((last.close - prev.close).toFixed(2));
  const changePercent = Number(((change / prev.close) * 100).toFixed(2));
  const week52Slice = bars.slice(-252);
  const week52High = Number(Math.max(...week52Slice.map((b) => b.high)).toFixed(2));
  const week52Low = Number(Math.min(...week52Slice.map((b) => b.low)).toFixed(2));
  const avgVolume20d = Math.round(last.volumeSma20 ?? last.volume);

  return {
    symbol: config.symbol,
    bseCode: config.bseCode,
    name: config.name,
    sector: config.sector,
    exchange: 'NSE / BSE',
    price: last.close,
    prevClose: prev.close,
    change,
    changePercent,
    dayHigh: last.high,
    dayLow: last.low,
    open: last.open,
    volume: last.volume,
    avgVolume20d,
    week52High,
    week52Low,
    fundamentals: config.fundamentals,
    dataMode: DATA_SOURCE_MODE,
    asOfDate: last.date,
    history: series,
    technicalSummary: summary,
  };
}

export function getAllStockDetails(): StockDetail[] {
  if (stockDetailCache.size === 0) {
    for (const cfg of STOCK_SEEDS) {
      stockDetailCache.set(cfg.symbol, buildStockDetail(cfg));
    }
  }
  return Array.from(stockDetailCache.values());
}

export function getAllStockSummaries(): StockSummary[] {
  return getAllStockDetails().map(({ history: _h, technicalSummary: _t, ...summary }) => summary);
}

export function getStockDetail(symbol: string): StockDetail | null {
  const normalized = symbol.trim().toUpperCase();
  if (stockDetailCache.size === 0) {
    getAllStockDetails();
  }
  return stockDetailCache.get(normalized) ?? null;
}

export function getMarketIndices(): MarketIndex[] {
  const indexConfigs: {
    id: string;
    name: string;
    exchange: 'NSE' | 'BSE';
    anchor: number;
    vol: number;
    drift: number;
    seed: number;
  }[] = [
    { id: 'NIFTY50', name: 'NIFTY 50', exchange: 'NSE', anchor: 24385.6, vol: 0.0085, drift: 0.13, seed: 9101 },
    { id: 'SENSEX', name: 'SENSEX', exchange: 'BSE', anchor: 80142.35, vol: 0.0082, drift: 0.13, seed: 9202 },
    { id: 'BANKNIFTY', name: 'BANK NIFTY', exchange: 'NSE', anchor: 52180.4, vol: 0.011, drift: 0.14, seed: 9303 },
    { id: 'NIFTYIT', name: 'NIFTY IT', exchange: 'NSE', anchor: 42615.85, vol: 0.0125, drift: 0.12, seed: 9404 },
    { id: 'NIFTYMIDCAP', name: 'NIFTY MIDCAP', exchange: 'NSE', anchor: 56420.15, vol: 0.0118, drift: 0.17, seed: 9505 },
  ];

  const dates = getRecentTradingDates(35);

  return indexConfigs.map((cfg) => {
    const rand = mulberry32(cfg.seed * 3571);
    const raw: number[] = [100];
    for (let i = 1; i < dates.length; i++) {
      const u1 = Math.max(rand(), 1e-7);
      const u2 = rand();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      raw.push(raw[i - 1] * Math.exp(cfg.drift / 252 + cfg.vol * z));
    }
    const scale = cfg.anchor / raw[raw.length - 1];
    const sparkline = dates.map((date, idx) => ({
      date,
      value: Number((raw[idx] * scale).toFixed(2)),
    }));
    const lastVal = sparkline[sparkline.length - 1].value;
    const prevVal = sparkline[sparkline.length - 2].value;
    const change = Number((lastVal - prevVal).toFixed(2));
    const changePercent = Number(((change / prevVal) * 100).toFixed(2));
    const spread = cfg.vol * 0.65;

    return {
      id: cfg.id,
      name: cfg.name,
      exchange: cfg.exchange,
      value: lastVal,
      change,
      changePercent,
      dayHigh: Number((Math.max(lastVal, prevVal) * (1 + spread)).toFixed(2)),
      dayLow: Number((Math.min(lastVal, prevVal) * (1 - spread)).toFixed(2)),
      prevClose: prevVal,
      sparkline,
      dataMode: DATA_SOURCE_MODE,
    };
  });
}

export function getIndianMarketSessionStatus(): {
  isOpen: boolean;
  label: string;
  istTime: string;
  exchangeHours: string;
} {
  const now = new Date();
  const istString = now.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const istParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const weekday = istParts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(istParts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(istParts.find((p) => p.type === 'minute')?.value ?? '0');
  const totalMinutes = hour * 60 + minute;

  const isWeekend = weekday === 'Sat' || weekday === 'Sun';
  const isRegularSession = !isWeekend && totalMinutes >= 9 * 60 + 15 && totalMinutes <= 15 * 60 + 30;
  const isPreOpen = !isWeekend && totalMinutes >= 9 * 60 && totalMinutes < 9 * 60 + 15;

  let label = 'NSE / BSE Closed';
  if (isRegularSession) label = 'NSE / BSE Regular Session Open';
  else if (isPreOpen) label = 'NSE / BSE Pre-Open Session';
  else if (isWeekend) label = 'Weekend — Exchanges Closed';

  return {
    isOpen: isRegularSession,
    label,
    istTime: `${istString} IST`,
    exchangeHours: 'Mon–Fri · 09:15 – 15:30 IST',
  };
}

export function getNextTradingDate(fromDateStr: string, tradingDaysAhead: number): string {
  const d = new Date(`${fromDateStr}T10:00:00Z`);
  let added = 0;
  while (added < tradingDaysAhead) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }
  return d.toISOString().slice(0, 10);
}
