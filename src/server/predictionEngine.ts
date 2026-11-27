import { Type } from '@google/genai';
import { getGeminiClient } from './gemini.ts';
import { getNextTradingDate } from '../data/indianMarketData.ts';
import { resolveStockDetail } from './stockMasterService.ts';
import type {
  PredictionResult,
  PredictionTimeframe,
  StockDetail,
} from '../types/market.ts';

const TIMEFRAME_META: Record<
  PredictionTimeframe,
  { days: number; label: string }
> = {
  '1D': { days: 1, label: 'Next Trading Session' },
  '5D': { days: 5, label: 'Next 5 Trading Sessions' },
  '10D': { days: 10, label: 'Next 10 Trading Sessions' },
  '30D': { days: 30, label: 'Next 30 Trading Sessions' },
};

const LEGAL_DISCLAIMER =
  'StockMind AI provides educational market analytics and algorithmic estimates. Predictions are uncertain and are not guaranteed. Nothing on this platform constitutes personalised investment advice or a recommendation to buy, sell or hold securities. Users should independently evaluate investment risks.';

function computeDeterministicProbabilities(
  stock: StockDetail,
  timeframe: PredictionTimeframe
) {
  const { technicalSummary: ts } = stock;
  const { days } = TIMEFRAME_META[timeframe];

  // Horizon uncertainty damping: shorter horizons have higher noise/sideways probability
  const horizonDamping =
    timeframe === '1D' ? 0.65 : timeframe === '5D' ? 0.8 : timeframe === '10D' ? 0.9 : 1.0;

  // Volatility penalty lowers confidence when realized volatility is elevated
  const volFactor = Math.min(1, Math.max(0.25, (ts.annualizedVolatilityPercent - 12) / 35));
  const rawDirectionalBias = (ts.trendScore / 100) * horizonDamping;

  let sideways = Math.round(30 + volFactor * 16 - Math.abs(rawDirectionalBias) * 14);
  sideways = Math.max(18, Math.min(48, sideways));

  const remaining = 100 - sideways;
  const bullishShare = 0.5 + rawDirectionalBias * 0.36;
  let bullish = Math.round(remaining * Math.max(0.15, Math.min(0.85, bullishShare)));
  let bearish = remaining - bullish;

  // Ensure exact sum of 100
  const sum = bullish + bearish + sideways;
  if (sum !== 100) {
    sideways += 100 - sum;
  }

  let dominantTrend: 'Bullish' | 'Bearish' | 'Sideways' = 'Sideways';
  if (bullish >= bearish && bullish >= sideways && bullish - bearish >= 5) {
    dominantTrend = 'Bullish';
  } else if (bearish > bullish && bearish >= sideways && bearish - bullish >= 5) {
    dominantTrend = 'Bearish';
  }

  // Honest model confidence bounded strictly below 78% to avoid overconfidence claims
  const indicatorAlignment = Math.abs(ts.trendScore) / 100;
  const confidence = Math.round(
    Math.max(38, Math.min(74, 48 + indicatorAlignment * 24 - volFactor * 12))
  );

  // 1-sigma horizon volatility range (%)
  const sigmaHorizon =
    ts.annualizedVolatilityPercent * Math.sqrt(days / 252);
  const driftBias = rawDirectionalBias * sigmaHorizon * 0.35;
  const lowPct = Number((driftBias - sigmaHorizon).toFixed(2));
  const highPct = Number((driftBias + sigmaHorizon).toFixed(2));

  const supportingIndicators: PredictionResult['supportingIndicators'] = [
    {
      name: 'RSI (14)',
      value: ts.rsi14.toFixed(1),
      signal:
        ts.rsi14 >= 55 && ts.rsi14 <= 70
          ? 'Bullish'
          : ts.rsi14 > 70
          ? 'Bearish'
          : ts.rsi14 < 30
          ? 'Bullish'
          : ts.rsi14 <= 45
          ? 'Bearish'
          : 'Neutral',
      detail:
        ts.rsiState === 'Overbought'
          ? 'Overbought zone (>70): elevated short-term pullback risk'
          : ts.rsiState === 'Oversold'
          ? 'Oversold zone (<30): potential mean-reversion bounce'
          : `Neutral momentum band (${ts.rsi14.toFixed(1)})`,
    },
    {
      name: 'MACD (12, 26, 9)',
      value: `${ts.macd.toFixed(2)} / Sig ${ts.macdSignal.toFixed(2)}`,
      signal:
        ts.macdHistogram > 0.15
          ? 'Bullish'
          : ts.macdHistogram < -0.15
          ? 'Bearish'
          : 'Neutral',
      detail: `Histogram at ${ts.macdHistogram >= 0 ? '+' : ''}${ts.macdHistogram.toFixed(2)} (${ts.macdCrossover})`,
    },
    {
      name: 'EMA 20 vs EMA 50',
      value: `₹${ts.ema20.toFixed(1)} / ₹${ts.ema50.toFixed(1)}`,
      signal:
        stock.price > ts.ema20 && ts.ema20 > ts.ema50
          ? 'Bullish'
          : stock.price < ts.ema20 && ts.ema20 < ts.ema50
          ? 'Bearish'
          : 'Neutral',
      detail:
        ts.ema20 > ts.ema50
          ? 'Short-term EMA 20 trades above medium-term EMA 50'
          : 'Short-term EMA 20 trades below medium-term EMA 50',
    },
    {
      name: 'SMA 200 Trend Filter',
      value: `₹${ts.sma200.toFixed(1)}`,
      signal: stock.price > ts.sma200 ? 'Bullish' : 'Bearish',
      detail:
        stock.price > ts.sma200
          ? `Price sits ${(((stock.price - ts.sma200) / ts.sma200) * 100).toFixed(1)}% above 200-day moving average`
          : `Price sits ${(((ts.sma200 - stock.price) / ts.sma200) * 100).toFixed(1)}% below 200-day moving average`,
    },
    {
      name: 'Bollinger Bands (20, 2σ)',
      value: `${ts.bbPositionPercent.toFixed(0)}% band position`,
      signal:
        ts.bbPositionPercent > 82
          ? 'Bearish'
          : ts.bbPositionPercent < 18
          ? 'Bullish'
          : 'Neutral',
      detail: `Range ₹${ts.bbLower.toFixed(1)} – ₹${ts.bbUpper.toFixed(1)} (Mid ₹${ts.bbMiddle.toFixed(1)})`,
    },
    {
      name: 'Volume & Volatility',
      value: `${ts.volumeRatio20d.toFixed(2)}x avg · ${ts.annualizedVolatilityPercent.toFixed(1)}% vol`,
      signal:
        ts.volumeRatio20d > 1.2 && stock.changePercent > 0
          ? 'Bullish'
          : ts.volumeRatio20d > 1.2 && stock.changePercent < 0
          ? 'Bearish'
          : 'Neutral',
      detail: `30-session annualized realized volatility is ${ts.annualizedVolatilityPercent.toFixed(1)}%`,
    },
  ];

  return {
    dominantTrend,
    probabilities: { bullish, bearish, sideways },
    confidence,
    expectedRangePercent: { low: lowPct, high: highPct },
    supportingIndicators,
  };
}

export async function runStockPrediction(
  symbol: string,
  timeframe: PredictionTimeframe
): Promise<PredictionResult> {
  const stock = await resolveStockDetail(symbol);
  if (!stock) {
    throw new Error(
      `Historical OHLCV data for "${symbol}" is currently unavailable from the delayed market feed. Predictions require at least 5 sessions of price history.`
    );
  }

  const meta = TIMEFRAME_META[timeframe];
  const quant = computeDeterministicProbabilities(stock, timeframe);
  const targetDate = getNextTradingDate(stock.asOfDate, meta.days);
  const ts = stock.technicalSummary;

  const ai = getGeminiClient();
  const prompt = `You are a quantitative financial research analyst writing an educational trend assessment for an Indian NSE/BSE equity.

IMPORTANT CONSTRAINTS:
- The market OHLCV data below comes from StockMind AI's "${stock.dataMode}" (not a real-time exchange tick feed). Acknowledge this clearly and never claim guaranteed future prices or personalized buy/sell advice.
- Ground your explanation strictly in the deterministic indicators provided below. Do not invent fake earnings dates, fake news headlines, or fabricated historical accuracy rates.

STOCK CONTEXT:
- Symbol: ${stock.symbol} (${stock.name}) | Sector: ${stock.sector}
- Reference Close: ₹${stock.price.toFixed(2)} (Daily Change: ${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%)
- 52-Week Range: ₹${stock.week52Low.toFixed(2)} – ₹${stock.week52High.toFixed(2)}
- Prediction Horizon: ${meta.label} (${timeframe}, target date ${targetDate})

COMPUTED TECHNICAL INDICATORS:
- RSI (14): ${ts.rsi14.toFixed(2)} (${ts.rsiState})
- MACD (12,26,9): ${ts.macd.toFixed(2)}, Signal: ${ts.macdSignal.toFixed(2)}, Histogram: ${ts.macdHistogram.toFixed(2)} (${ts.macdCrossover})
- EMA 20: ₹${ts.ema20.toFixed(2)} | EMA 50: ₹${ts.ema50.toFixed(2)} | SMA 200: ₹${ts.sma200.toFixed(2)}
- Bollinger Bands (20,2): Lower ₹${ts.bbLower.toFixed(2)}, Middle ₹${ts.bbMiddle.toFixed(2)}, Upper ₹${ts.bbUpper.toFixed(2)} (Position: ${ts.bbPositionPercent}%)
- Realized Volatility (30d annualized): ${ts.annualizedVolatilityPercent}%
- 20-Day Volume Ratio: ${ts.volumeRatio20d}x
- Support Levels: ${ts.supportLevels.map((v) => `₹${v.toFixed(2)}`).join(', ')}
- Resistance Levels: ${ts.resistanceLevels.map((v) => `₹${v.toFixed(2)}`).join(', ')}

DETERMINISTIC SCENARIO PROBABILITIES:
- Dominant Scenario: ${quant.dominantTrend}
- Bullish: ${quant.probabilities.bullish}% | Bearish: ${quant.probabilities.bearish}% | Sideways: ${quant.probabilities.sideways}%
- Model Confidence: ${quant.confidence}%
- 1-Sigma Horizon Envelope: ${quant.expectedRangePercent.low}% to +${quant.expectedRangePercent.high}%

Return structured JSON explaining the technical reasoning, 3-4 concrete risk factors specific to this stock/sector and technical setup, and a concise note on how financial news sentiment should be incorporated alongside these simulated historical indicators.`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction:
        'You are an educational quantitative market analyst for Indian equities. Be objective, concise, mathematically grounded, and compliant with SEBI educational non-advisory boundaries.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reasoning: {
            type: Type.STRING,
            description:
              'Clear 2-paragraph educational explanation of how the computed technical indicators and volatility produce the bullish/bearish/sideways scenario probabilities.',
          },
          riskFactors: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              '3 to 4 concrete technical, volatility, and Indian sector-specific risk factors.',
          },
          newsSentimentNote: {
            type: Type.STRING,
            description:
              'One concise sentence explaining the news sentiment limitation or sector catalysts to monitor on NSE/BSE.',
          },
        },
        required: ['reasoning', 'riskFactors', 'newsSentimentNote'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    reasoning?: string;
    riskFactors?: string[];
    newsSentimentNote?: string;
  };

  if (!parsed.reasoning || !Array.isArray(parsed.riskFactors)) {
    throw new Error('AI explanation response was incomplete. Please try again.');
  }

  return {
    symbol: stock.symbol,
    stockName: stock.name,
    timeframe,
    timeframeLabel: meta.label,
    referencePrice: stock.price,
    asOfDate: stock.asOfDate,
    targetDate,
    dataMode: stock.dataMode,
    modelVersion: 'Quant-TA-v1.0 + Gemini-4-Hydrogen',
    dominantTrend: quant.dominantTrend,
    probabilities: quant.probabilities,
    confidence: quant.confidence,
    expectedRangePercent: quant.expectedRangePercent,
    supportingIndicators: quant.supportingIndicators,
    riskFactors: parsed.riskFactors.slice(0, 5),
    newsSentimentNote:
      parsed.newsSentimentNote ||
      'News sentiment is evaluated separately via verified Google Search market feeds.',
    reasoning: parsed.reasoning,
    disclaimer: LEGAL_DISCLAIMER,
  };
}
