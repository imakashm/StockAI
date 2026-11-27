import { useMemo, useState } from 'react';
import { CheckCircle2, Info, LogIn, Sparkles } from 'lucide-react';
import type { PredictionLogRecord } from '../types/market.ts';
import { formatInr, formatSignedPercent } from '../lib/format.ts';

interface PredictionHistoryViewProps {
  logs: PredictionLogRecord[];
  onEvaluateLog: (logId: number | string, actualPrice: number) => Promise<void>;
  onGoToPredictor: () => void;
  isAuthenticated: boolean;
  onSignIn: () => void;
  loading: boolean;
}

const MIN_SAMPLE_SIZE = 30;

export function PredictionHistoryView({
  logs,
  onEvaluateLog,
  onGoToPredictor,
  isAuthenticated,
  onSignIn,
  loading,
}: PredictionHistoryViewProps) {
  const [evaluatingId, setEvaluatingId] = useState<number | string | null>(null);
  const [actualPriceInput, setActualPriceInput] = useState('');
  const [savingEval, setSavingEval] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = logs.length;
    const evaluated = logs.filter((l) => l.evaluationStatus !== 'Pending Evaluation');
    const aligned = evaluated.filter((l) => l.evaluationStatus === 'Evaluated - Aligned');
    const pending = total - evaluated.length;
    const hasSufficientSample = evaluated.length >= MIN_SAMPLE_SIZE;
    const accuracyPct =
      hasSufficientSample && evaluated.length > 0
        ? Number(((aligned.length / evaluated.length) * 100).toFixed(1))
        : null;

    return {
      total,
      evaluatedCount: evaluated.length,
      alignedCount: aligned.length,
      pending,
      hasSufficientSample,
      accuracyPct,
    };
  }, [logs]);

  const handleSubmitEvaluation = async (logId: number | string) => {
    const price = Number(actualPriceInput);
    if (!Number.isFinite(price) || price <= 0) {
      setError('Enter a valid realized closing price in INR.');
      return;
    }
    setSavingEval(true);
    setError(null);
    try {
      await onEvaluateLog(logId, price);
      setEvaluatingId(null);
      setActualPriceInput('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to record evaluation.');
    } finally {
      setSavingEval(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-800/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            Prediction Performance &amp; Audit Log
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Track logged predictions, compare against realized subsequent market moves, and maintain strict statistical discipline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isAuthenticated && (
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/50 bg-blue-600/15 px-3.5 py-2 text-xs font-medium text-blue-200 hover:bg-blue-600/25 whitespace-nowrap transition-colors"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign in to persist history
            </button>
          )}
          <button
            type="button"
            onClick={onGoToPredictor}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 whitespace-nowrap transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            New Prediction
          </button>
        </div>
      </div>

      {/* Summary & Statistical Integrity Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-[#0D1321] p-4">
          <div className="text-xs text-slate-400">Logged Predictions</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-50">
            {stats.total}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {stats.pending} pending · {stats.evaluatedCount} evaluated
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1321] p-4">
          <div className="text-xs text-slate-400">Evaluated Outcomes</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-50">
            {stats.evaluatedCount} / {MIN_SAMPLE_SIZE}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Minimum sample required for accuracy stats
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1321] p-4">
          <div className="text-xs text-slate-400">Directional Alignment</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-100">
            {stats.evaluatedCount > 0
              ? `${stats.alignedCount} / ${stats.evaluatedCount}`
              : '—'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Raw count of aligned outcomes
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1321] p-4">
          <div className="text-xs text-slate-400">Historical Accuracy</div>
          <div className="mt-2 font-mono text-lg font-semibold tabular-nums text-amber-300">
            {stats.accuracyPct !== null
              ? `${stats.accuracyPct}%`
              : 'Insufficient Data'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {stats.hasSufficientSample
              ? `Based on N=${stats.evaluatedCount} verified evaluations`
              : `Requires ≥ ${MIN_SAMPLE_SIZE} verified outcomes`}
          </div>
        </div>
      </section>

      {/* Consistent Evaluation Methodology Disclosure */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1321] p-4">
        <div className="flex items-start gap-2.5 text-xs text-slate-300">
          <Info className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-100">
              Consistent Evaluation Methodology (Zero Fabricated Accuracy)
            </p>
            <p className="leading-relaxed text-slate-400">
              A logged prediction is evaluated strictly after its target date by comparing the
              realized NSE closing price against the initial reference price: Bullish aligns at{' '}
              <span className="font-mono text-slate-200">≥ +0.75%</span>, Bearish aligns at{' '}
              <span className="font-mono text-slate-200">≤ -0.75%</span>, and Sideways aligns within{' '}
              <span className="font-mono text-slate-200">±1.50%</span>. Headline historical accuracy
              is withheld until at least {MIN_SAMPLE_SIZE} independent predictions are verified.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-900/60 bg-red-950/20 px-4 py-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Prediction Log Table */}
      <section className="rounded-xl border border-slate-800 bg-[#0D1321]">
        <div className="border-b border-slate-800 p-4">
          <h2 className="text-base font-semibold text-slate-100">
            Prediction Audit Trail
          </h2>
        </div>

        {loading ? (
          <div className="p-6">
            <div className="h-28 animate-pulse rounded-lg bg-slate-800/40" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-200">
              No predictions have been logged yet.
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-xs text-slate-400">
              Run an analysis in the AI Prediction Engine and click &ldquo;Save to Prediction
              History&rdquo; to begin building a transparent, verifiable performance log.
            </p>
            <button
              type="button"
              onClick={onGoToPredictor}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
            >
              Open AI Prediction Engine
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
                  <th className="py-3 pl-4 pr-3">Logged Date &amp; Symbol</th>
                  <th className="px-3 py-3">Horizon</th>
                  <th className="px-3 py-3">Predicted Trend</th>
                  <th className="px-3 py-3 text-right">Ref Price</th>
                  <th className="px-3 py-3 text-right">Actual Movement</th>
                  <th className="px-3 py-3">Model Version</th>
                  <th className="py-3 pl-3 pr-4 text-right">Evaluation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {logs.map((log) => {
                  const isPending = log.evaluationStatus === 'Pending Evaluation';
                  const isEditing = evaluatingId === log.id;
                  return (
                    <tr key={String(log.id)} className="hover:bg-slate-800/30">
                      <td className="py-3 pl-4 pr-3">
                        <div className="font-mono font-semibold text-slate-100">
                          {log.symbol}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          Logged {log.createdAt.slice(0, 10)} · Target {log.targetDate}
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-300">
                        {log.timeframe}
                      </td>
                      <td className="px-3 py-3">
                        <div
                          className={`text-xs font-semibold ${
                            log.predictedDirection === 'Bullish'
                              ? 'text-emerald-400'
                              : log.predictedDirection === 'Bearish'
                              ? 'text-red-400'
                              : 'text-blue-400'
                          }`}
                        >
                          {log.predictedDirection} ({log.confidence}% conf)
                        </div>
                        <div className="font-mono text-[11px] tabular-nums text-slate-400">
                          B {log.bullishProb}% · S {log.sidewaysProb}% · Br {log.bearishProb}%
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-slate-200">
                        {formatInr(log.referencePrice)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs tabular-nums">
                        {log.actualPrice !== null && log.actualReturnPct !== null ? (
                          <div>
                            <div className="text-slate-100">{formatInr(log.actualPrice)}</div>
                            <div
                              className={
                                log.actualReturnPct >= 0
                                  ? 'text-emerald-400'
                                  : 'text-red-400'
                              }
                            >
                              {formatSignedPercent(log.actualReturnPct)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">Awaiting outcome</span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-[11px] text-slate-400">
                        <div>{log.modelVersion}</div>
                        <div className="text-amber-300/80">{log.dataMode}</div>
                      </td>
                      <td className="py-3 pl-3 pr-4 text-right">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="number"
                              step="0.05"
                              value={actualPriceInput}
                              onChange={(e) => setActualPriceInput(e.target.value)}
                              placeholder="Actual ₹"
                              className="w-24 rounded-md border border-slate-700 bg-[#070B14] px-2 py-1 font-mono text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={savingEval}
                              onClick={() => handleSubmitEvaluation(log.id)}
                              className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEvaluatingId(null);
                                setActualPriceInput('');
                              }}
                              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : isPending ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEvaluatingId(log.id);
                              setActualPriceInput(log.referencePrice.toFixed(2));
                              setError(null);
                            }}
                            className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-blue-500 hover:text-blue-300 whitespace-nowrap transition-colors"
                          >
                            Record Outcome
                          </button>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${
                              log.evaluationStatus === 'Evaluated - Aligned'
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {log.evaluationStatus.replace('Evaluated - ', '')}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
