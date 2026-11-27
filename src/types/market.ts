export type DataSourceMode = 'Simulated Historical Dataset' | 'Delayed Reference Feed' | 'Live Exchange Feed';

export interface OhlcvBar {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalPoint extends OhlcvBar {
  ema20: number | null;
  ema50: number | null;
  sma200: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  volumeSma20: number | null;
}

export interface MarketIndex {
  id: string;
  name: string;
  exchange: 'NSE' | 'BSE';
  value: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  prevClose: number;
  sparkline: { date: string; value: number }[];
  dataMode: DataSourceMode;
}

export interface StockFundamentals {
  marketCapCr: number;
  peRatio: number | null;
  pbRatio: number | null;
  roePercent: number | null;
  dividendYieldPercent: number | null;
  epsInr: number | null;
  debtToEquity: number | null;
  faceValueInr: number;
  bookValueInr: number | null;
  fundamentalsStatus:
    | 'Reference Demo Figures'
    | 'Verified Provider Data'
    | 'Unavailable in Delayed Feed';
}

export interface StockSummary {
  symbol: string;
  bseCode: string;
  name: string;
  sector: string;
  exchange: 'NSE / BSE' | 'NSE' | 'BSE';
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  open: number;
  volume: number;
  avgVolume20d: number;
  week52High: number;
  week52Low: number;
  fundamentals: StockFundamentals;
  dataMode: DataSourceMode;
  asOfDate: string;
}

export interface StockDetail extends StockSummary {
  history: TechnicalPoint[];
  technicalSummary: TechnicalSummary;
}

export interface TechnicalSummary {
  rsi14: number;
  rsiState: 'Overbought' | 'Oversold' | 'Neutral';
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  macdCrossover: 'Bullish Momentum' | 'Bearish Momentum' | 'Neutral';
  ema20: number;
  ema50: number;
  sma200: number;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  bbPositionPercent: number;
  annualizedVolatilityPercent: number;
  volumeRatio20d: number;
  supportLevels: number[];
  resistanceLevels: number[];
  overallTrend: 'Uptrend' | 'Downtrend' | 'Consolidation';
  trendScore: number; // -100 to +100 deterministic quantitative composite
}

export type PredictionTimeframe = '1D' | '5D' | '10D' | '30D';

export interface PredictionResult {
  symbol: string;
  stockName: string;
  timeframe: PredictionTimeframe;
  timeframeLabel: string;
  referencePrice: number;
  asOfDate: string;
  targetDate: string;
  dataMode: DataSourceMode;
  modelVersion: string;
  dominantTrend: 'Bullish' | 'Bearish' | 'Sideways';
  probabilities: {
    bullish: number;
    bearish: number;
    sideways: number;
  };
  confidence: number;
  expectedRangePercent: {
    low: number;
    high: number;
  };
  supportingIndicators: {
    name: string;
    value: string;
    signal: 'Bullish' | 'Bearish' | 'Neutral';
    detail: string;
  }[];
  riskFactors: string[];
  newsSentimentNote: string;
  reasoning: string;
  disclaimer: string;
}

export interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  publishedAt: string;
  publishedLabel: string;
  category: NewsCategory;
  summary: string;
  url: string;
  verifiedSource: boolean;
}

export type NewsCategory =
  | 'Indian Stock Market'
  | 'NSE & BSE Updates'
  | 'Company News'
  | 'Corporate Results'
  | 'RBI & Economic News'
  | 'Global Market Updates';

export interface WatchlistRecord {
  id: number | string;
  name: string;
  symbols: string[];
  createdAt?: string;
}

export interface PortfolioHoldingRecord {
  id: number | string;
  symbol: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
  notes?: string | null;
}

export interface PredictionLogRecord {
  id: number | string;
  symbol: string;
  timeframe: string;
  predictedDirection: string;
  bullishProb: number;
  bearishProb: number;
  sidewaysProb: number;
  confidence: number;
  referencePrice: number;
  targetDate: string;
  actualPrice: number | null;
  actualReturnPct: number | null;
  evaluationStatus: string;
  modelVersion: string;
  dataMode: string;
  reasoningSummary: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: { title: string; url: string }[];
  timestamp: string;
  error?: boolean;
}

export type PriceAlertCondition = 'above' | 'below';
export type PriceAlertStatus = 'active' | 'triggered';

export interface PriceAlertRecord {
  id: number | string;
  symbol: string;
  condition: PriceAlertCondition;
  targetPrice: number;
  status: PriceAlertStatus;
  triggeredPrice: number | null;
  triggeredAt: string | null;
  createdAt: string;
}

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  symbol?: string;
  tone: 'bullish' | 'bearish' | 'info';
  timestamp: string;
}

export interface StockSearchResultItem {
  id: number;
  isin: string;
  symbol: string;
  nseSymbol: string | null;
  bseCode: string | null;
  bseSymbol: string | null;
  companyName: string;
  shortName: string | null;
  exchange: 'NSE / BSE' | 'NSE' | 'BSE';
  series: string | null;
  sector: string | null;
  lastPrice: number | null;
  changePercent: number | null;
  priceSource: DataSourceMode | null;
  priceUpdatedAt: string | null;
}

export interface StockSearchResponse {
  query: string;
  exchange: string;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  masterTotalCount: number;
  lastSyncedAt: string | null;
  items: StockSearchResultItem[];
}


