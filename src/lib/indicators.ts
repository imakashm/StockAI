import type { OhlcvBar, TechnicalPoint, TechnicalSummary } from '../types/market.ts';

function computeSma(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) {
      sum -= values[i - period];
    }
    if (i >= period - 1) {
      result[i] = Number((sum / period).toFixed(2));
    }
  }
  return result;
}

function computeEma(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return result;

  let seedSum = 0;
  for (let i = 0; i < period; i++) {
    seedSum += values[i];
  }
  let ema = seedSum / period;
  result[period - 1] = Number(ema.toFixed(2));

  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result[i] = Number(ema.toFixed(2));
  }
  return result;
}

function computeRsi(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return result;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }

  avgGain /= period;
  avgLoss /= period;

  const firstRs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result[period] = Number((avgLoss === 0 ? 100 : 100 - 100 / (1 + firstRs)).toFixed(2));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      result[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i] = Number((100 - 100 / (1 + rs)).toFixed(2));
    }
  }
  return result;
}

function computeBollinger(
  closes: number[],
  period = 20,
  multiplier = 2
): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
} {
  const upper: (number | null)[] = new Array(closes.length).fill(null);
  const middle: (number | null)[] = new Array(closes.length).fill(null);
  const lower: (number | null)[] = new Array(closes.length).fill(null);

  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += closes[j];
    }
    const mean = sum / period;
    let sqDiff = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = closes[j] - mean;
      sqDiff += d * d;
    }
    const std = Math.sqrt(sqDiff / period);
    middle[i] = Number(mean.toFixed(2));
    upper[i] = Number((mean + multiplier * std).toFixed(2));
    lower[i] = Number((mean - multiplier * std).toFixed(2));
  }

  return { upper, middle, lower };
}

function computeMacd(closes: number[]): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const ema12 = computeEma(closes, 12);
  const ema26 = computeEma(closes, 26);

  const macd: (number | null)[] = new Array(closes.length).fill(null);
  const validMacdValues: number[] = [];
  const validIndices: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (ema12[i] !== null && ema26[i] !== null) {
      const val = Number(((ema12[i] as number) - (ema26[i] as number)).toFixed(2));
      macd[i] = val;
      validMacdValues.push(val);
      validIndices.push(i);
    }
  }

  const signalRaw = computeEma(validMacdValues, 9);
  const signal: (number | null)[] = new Array(closes.length).fill(null);
  const histogram: (number | null)[] = new Array(closes.length).fill(null);

  for (let idx = 0; idx < validIndices.length; idx++) {
    const barIdx = validIndices[idx];
    const sigVal = signalRaw[idx];
    if (sigVal !== null && macd[barIdx] !== null) {
      signal[barIdx] = sigVal;
      histogram[barIdx] = Number(((macd[barIdx] as number) - sigVal).toFixed(2));
    }
  }

  return { macd, signal, histogram };
}

export function computeTechnicalSeries(bars: OhlcvBar[]): {
  series: TechnicalPoint[];
  summary: TechnicalSummary;
} {
  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);

  const ema20 = computeEma(closes, 20);
  const ema50 = computeEma(closes, 50);
  const sma200 = computeSma(closes, 200);
  const bb = computeBollinger(closes, 20, 2);
  const rsi14 = computeRsi(closes, 14);
  const macdObj = computeMacd(closes);
  const volSma20 = computeSma(volumes, 20);

  const series: TechnicalPoint[] = bars.map((bar, i) => ({
    ...bar,
    ema20: ema20[i],
    ema50: ema50[i],
    sma200: sma200[i],
    bbUpper: bb.upper[i],
    bbMiddle: bb.middle[i],
    bbLower: bb.lower[i],
    rsi14: rsi14[i],
    macd: macdObj.macd[i],
    macdSignal: macdObj.signal[i],
    macdHistogram: macdObj.histogram[i],
    volumeSma20: volSma20[i],
  }));

  const last = series[series.length - 1];
  const latestClose = last.close;
  const latestRsi = last.rsi14 ?? 50;
  const latestMacd = last.macd ?? 0;
  const latestSignal = last.macdSignal ?? 0;
  const latestHist = last.macdHistogram ?? 0;
  const latestEma20 = last.ema20 ?? latestClose;
  const latestEma50 = last.ema50 ?? latestClose;
  const latestSma200 = last.sma200 ?? latestClose;
  const latestBbUpper = last.bbUpper ?? latestClose * 1.05;
  const latestBbMiddle = last.bbMiddle ?? latestClose;
  const latestBbLower = last.bbLower ?? latestClose * 0.95;

  // Annualized 30-session realized volatility
  const recentCloses = closes.slice(-31);
  const logReturns: number[] = [];
  for (let i = 1; i < recentCloses.length; i++) {
    logReturns.push(Math.log(recentCloses[i] / recentCloses[i - 1]));
  }
  const meanRet =
    logReturns.reduce((acc, r) => acc + r, 0) / Math.max(logReturns.length, 1);
  const variance =
    logReturns.reduce((acc, r) => acc + (r - meanRet) ** 2, 0) /
    Math.max(logReturns.length - 1, 1);
  const annualizedVolatilityPercent = Number(
    (Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(2)
  );

  // Support & resistance estimation from last 60 sessions + classic pivot levels
  const window60 = bars.slice(-60);
  const high60 = Math.max(...window60.map((b) => b.high));
  const low60 = Math.min(...window60.map((b) => b.low));
  const pivot = (last.high + last.low + last.close) / 3;
  const r1 = 2 * pivot - last.low;
  const s1 = 2 * pivot - last.high;
  const r2 = pivot + (last.high - last.low);
  const s2 = pivot - (last.high - last.low);

  const supportLevels = Array.from(
    new Set([
      Number(Math.min(s1, latestClose * 0.985).toFixed(2)),
      Number(Math.min(s2, latestEma50, latestClose * 0.955).toFixed(2)),
      Number(low60.toFixed(2)),
    ])
  )
    .filter((v) => v < latestClose)
    .sort((a, b) => b - a)
    .slice(0, 3);

  const resistanceLevels = Array.from(
    new Set([
      Number(Math.max(r1, latestClose * 1.015).toFixed(2)),
      Number(Math.max(r2, latestBbUpper, latestClose * 1.045).toFixed(2)),
      Number(high60.toFixed(2)),
    ])
  )
    .filter((v) => v > latestClose)
    .sort((a, b) => a - b)
    .slice(0, 3);

  const bbSpan = Math.max(latestBbUpper - latestBbLower, 0.01);
  const bbPositionPercent = Number(
    Math.min(100, Math.max(0, ((latestClose - latestBbLower) / bbSpan) * 100)).toFixed(1)
  );

  const volumeRatio20d = Number(
    (last.volume / Math.max(last.volumeSma20 ?? last.volume, 1)).toFixed(2)
  );

  // Deterministic quantitative trend score (-100 to +100)
  let score = 0;
  if (latestClose > latestEma20) score += 20;
  else score -= 20;

  if (latestEma20 > latestEma50) score += 20;
  else score -= 20;

  if (latestClose > latestSma200) score += 20;
  else score -= 20;

  if (latestHist > 0) score += 18;
  else if (latestHist < 0) score -= 18;

  if (latestRsi >= 52 && latestRsi <= 68) score += 14;
  else if (latestRsi > 70) score -= 6; // stretched/overbought mean-reversion risk
  else if (latestRsi <= 48 && latestRsi >= 32) score -= 14;
  else if (latestRsi < 30) score += 6; // oversold bounce potential

  if (volumeRatio20d > 1.15) {
    score += last.close >= last.open ? 8 : -8;
  }

  const clampedScore = Math.max(-100, Math.min(100, score));
  const overallTrend: TechnicalSummary['overallTrend'] =
    clampedScore >= 20
      ? 'Uptrend'
      : clampedScore <= -20
      ? 'Downtrend'
      : 'Consolidation';

  const rsiState: TechnicalSummary['rsiState'] =
    latestRsi >= 70 ? 'Overbought' : latestRsi <= 30 ? 'Oversold' : 'Neutral';

  const macdCrossover: TechnicalSummary['macdCrossover'] =
    latestHist > 0.15
      ? 'Bullish Momentum'
      : latestHist < -0.15
      ? 'Bearish Momentum'
      : 'Neutral';

  return {
    series,
    summary: {
      rsi14: latestRsi,
      rsiState,
      macd: latestMacd,
      macdSignal: latestSignal,
      macdHistogram: latestHist,
      macdCrossover,
      ema20: latestEma20,
      ema50: latestEma50,
      sma200: latestSma200,
      bbUpper: latestBbUpper,
      bbMiddle: latestBbMiddle,
      bbLower: latestBbLower,
      bbPositionPercent,
      annualizedVolatilityPercent,
      volumeRatio20d,
      supportLevels:
        supportLevels.length > 0
          ? supportLevels
          : [Number((latestClose * 0.97).toFixed(2)), Number((latestClose * 0.93).toFixed(2))],
      resistanceLevels:
        resistanceLevels.length > 0
          ? resistanceLevels
          : [Number((latestClose * 1.03).toFixed(2)), Number((latestClose * 1.07).toFixed(2))],
      overallTrend,
      trendScore: clampedScore,
    },
  };
}
