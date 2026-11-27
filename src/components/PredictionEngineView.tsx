import { useState } from 'react';
import {
  AlertTriangle,
  BookmarkCheck,
  BookmarkPlus,
  Loader2,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react';
import { StockSearchAutocomplete } from './StockSearchAutocomplete.tsx';
import type {
  PredictionResult,
  PredictionTimeframe,
  StockSummary,
} from '../types/market.ts';
import { formatInr, formatSignedPercent } from '../lib/format.ts';
import { parseJsonResponse } from '../lib/http.ts';

interface PredictionEngineViewProps {
  stocks: StockSummary[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  onSavePrediction: (result: PredictionResult) => Promise<void>;
  isAuthenticated: boolean;
}

const TIMEFRAMES: { id: PredictionTimeframe; label: string }[] = [
  { id: '1D', label: 'Next Session (1D)' },
  { id: '5D', label: '5 Sessions' },
  { id: '10D', label: '10 Sessions' },
  { id: '30D', label: '30 Sessions' },
];

export function PredictionEngineView({
  selectedSymbol,
  onSelectSymbol,
  onSavePrediction,
  isAuthenticated,
}: PredictionEngineViewProps) {
  const [timeframe, setTimeframe] = useState<PredictionTimeframe>('5D');
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setSavedNotice(null);

    try {
      const res = await fetch('/api/predictions/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ symbol: selectedSymbol, timeframe }),
      });
      const data = await parseJsonResponse<PredictionResult>(res);
      setResult(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to run AI prediction right now.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    setSavedNotice(null);
    try {
      await onSavePrediction(result);
      setSavedNotice(
        isAuthenticated
          ? 'Saved to your Cloud SQL Prediction History.'
          : 'Logged in current browser session. Sign in with Google to persist in PostgreSQL.'
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save prediction log.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800/80 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          AI Stock Prediction Engine
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Multi-factor technical indicator scoring (RSI, MACD, EMA 20/50, SMA 200, Bollinger Bands, realized volatility) paired with Gemini analytical synthesis.
        </p>
      </div>

      {/* Transparent Model & Data Scope Banner */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1321] p-4 text-xs text-slate-300">
        <span className="font-semibold text-amber-300">Methodology &amp; Data Transparency: </span>
        Scenario probabilities are computed deterministically from each equity&apos;s{' '}
        <strong className="text-slate-100">Delayed Reference Feed</strong> OHLCV series (with
        transparent fallback to the benchmark Simulated Historical Dataset when offline) and
        synthesized into plain-language reasoning via server-side Gemini. This engine produces
        probabilistic educational estimates—never guaranteed future prices or fabricated historical accuracy.
      </div>

      {/* Control Bar */}
      <section className="rounded-xl border border-slate-800 bg-[#0D1321] p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="block text-xs font-medium text-slate-300">
                Select NSE / BSE Stock
              </span>
              <span className="font-mono text-xs font-semibold text-blue-400">
                Selected: {selectedSymbol}
              </span>
            </div>
            <StockSearchAutocomplete
              selectedSymbolHint={selectedSymbol}
              placeholder={`Selected: ${selectedSymbol} — Search any NSE/BSE equity...`}
              onSelectStock={(item) => {
                onSelectSymbol(item.symbol);
                setSavedNotice(null);
              }}
            />
          </div>

          <div className="lg:col-span-5">
            <span className="block text-xs font-medium text-slate-300 mb-1.5">
              Prediction Horizon
            </span>
            <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-[#070B14] p-1 sm:grid-cols-4">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setTimeframe(tf.id)}
                  className={`rounded-md px-2.5 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                    timeframe === tf.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analysing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Analysis
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Empty Initial State */}
      {!result && !loading && !error && (
        <div className="rounded-xl border border-slate-800 bg-[#0D1321] p-10 text-center">
          <Sparkles className="mx-auto h-7 w-7 text-blue-400" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-slate-100">
            Ready to Evaluate {selectedSymbol}
          </h2>
          <p className="mx-auto mt-1.5 max-w-lg text-xs leading-relaxed text-slate-400">
            Choose a trading horizon above and click &ldquo;Generate Analysis&rdquo; to inspect
            bullish, bearish, and sideways scenario probabilities backed by computed indicators and
            AI-synthesized technical reasoning.
          </p>
        </div>
      )}

      {/* Prediction Output */}
      {result && (
        <div className="space-y-6">
          {/* Top Scenario & Probability Card */}
          <section className="rounded-xl border border-slate-800 bg-[#0D1321] p-5">
            <div className="flex flex-col gap-4 border-b border-slate-800/80 pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="font-mono text-slate-200">{result.symbol}</span>
                  <span aria-hidden="true">·</span>
                  <span>{result.timeframeLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">Target Date: {result.targetDate}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-300">{result.dataMode}</span>
                </div>
                <h2 className="mt-1.5 text-xl font-semibold text-slate-50">
                  {result.stockName} — Potential {result.dominantTrend} Trend
                </h2>
                <p className="mt-1 font-mono text-xs tabular-nums text-slate-400">
                  Reference Close: {formatInr(result.referencePrice)} · 1σ Horizon Envelope:{' '}
                  {formatSignedPercent(result.expectedRangePercent.low)} to{' '}
                  {formatSignedPercent(result.expectedRangePercent.high)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || Boolean(savedNotice)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#070B14] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-blue-500 hover:text-blue-300 disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  {savedNotice ? (
                    <>
                      <BookmarkCheck className="h-4 w-4 text-emerald-400" />
                      Logged to History
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="h-4 w-4" />
                      {saving ? 'Saving...' : 'Save to Prediction History'}
                    </>
                  )}
                </button>
              </div>
            </div>

            {savedNotice && (
              <p className="mt-3 text-xs text-emerald-400">{savedNotice}</p>
            )}

            {/* Scenario Probabilities & Model Confidence */}
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-800 bg-[#070B14] p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Bullish Scenario</span>
                  <TrendingUp className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                </div>
                <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-emerald-400">
                  {result.probabilities.bullish}%
                </div>
                <div className="mt-1 text-[11px] text-slate-400">Upward continuation bias</div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-[#070B14] p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Sideways / Range</span>
                  <Minus className="h-4 w-4 text-blue-400" aria-hidden="true" />
                </div>
                <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-blue-400">
                  {result.probabilities.sideways}%
                </div>
                <div className="mt-1 text-[11px] text-slate-400">Consolidation regime</div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-[#070B14] p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Bearish Scenario</span>
                  <TrendingDown className="h-4 w-4 text-red-400" aria-hidden="true" />
                </div>
                <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-red-400">
                  {result.probabilities.bearish}%
                </div>
                <div className="mt-1 text-[11px] text-slate-400">Downside pressure risk</div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-[#070B14] p-4">
                <div className="text-xs text-slate-400">Model Confidence</div>
                <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-100">
                  {result.confidence}%
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Damped by realized volatility
                </div>
              </div>
            </div>

            {/* Combined Probability Bar */}
            <div className="mt-4">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="bg-emerald-500"
                  style={{ width: `${result.probabilities.bullish}%` }}
                  title={`Bullish ${result.probabilities.bullish}%`}
                />
                <div
                  className="bg-blue-500"
                  style={{ width: `${result.probabilities.sideways}%` }}
                  title={`Sideways ${result.probabilities.sideways}%`}
                />
                <div
                  className="bg-red-500"
                  style={{ width: `${result.probabilities.bearish}%` }}
                  title={`Bearish ${result.probabilities.bearish}%`}
                />
              </div>
            </div>
          </section>

          {/* Reasoning & Risk Factors */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section className="rounded-xl border border-slate-800 bg-[#0D1321] p-5 lg:col-span-7">
              <h3 className="text-base font-semibold text-slate-100">
                Model Reasoning & Analytical Explanation
              </h3>
              <p className="mt-1 text-xs text-slate-400 font-mono">
                Model: {result.modelVersion}
              </p>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300 whitespace-pre-line">
                {result.reasoning}
              </div>
              <div className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-400">
                <span className="font-medium text-slate-200">News Sentiment Note: </span>
                {result.newsSentimentNote}
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-[#0D1321] p-5 lg:col-span-5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
                <h3 className="text-base font-semibold text-slate-100">
                  Key Risk Factors & Uncertainty Drivers
                </h3>
              </div>
              <ul className="mt-4 space-y-3">
                {result.riskFactors.map((risk, idx) => (
                  <li
                    key={idx}
                    className="border-t border-slate-800/80 pt-3 first:border-t-0 first:pt-0 text-sm leading-relaxed text-slate-300"
                  >
                    {risk}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Supporting Technical Indicators Table */}
          <section className="rounded-xl border border-slate-800 bg-[#0D1321] p-5">
            <h3 className="text-base font-semibold text-slate-100">
              Supporting Technical Indicators Breakdown
            </h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
                    <th className="py-2.5 pr-3">Indicator</th>
                    <th className="px-3 py-2.5">Computed Value</th>
                    <th className="px-3 py-2.5">Signal Bias</th>
                    <th className="py-2.5 pl-3">Interpretation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {result.supportingIndicators.map((ind) => (
                    <tr key={ind.name}>
                      <td className="py-3 pr-3 font-medium text-slate-200">{ind.name}</td>
                      <td className="px-3 py-3 font-mono text-xs tabular-nums text-slate-200">
                        {ind.value}
                      </td>
                      <td
                        className={`px-3 py-3 text-xs font-medium ${
                          ind.signal === 'Bullish'
                            ? 'text-emerald-400'
                            : ind.signal === 'Bearish'
                            ? 'text-red-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {ind.signal}
                      </td>
                      <td className="py-3 pl-3 text-xs text-slate-400">{ind.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
