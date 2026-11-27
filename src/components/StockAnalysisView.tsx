import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Database,
  Loader2,
  RefreshCw,
  Sparkles,
  Star,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StockSearchAutocomplete } from './StockSearchAutocomplete.tsx';
import type { StockDetail, StockSummary } from '../types/market.ts';
import {
  formatIndianVolume,
  formatInr,
  formatMarketCapCr,
  formatSignedNumber,
  formatSignedPercent,
} from '../lib/format.ts';
import { parseJsonResponse } from '../lib/http.ts';

interface StockAnalysisViewProps {
  stocks: StockSummary[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  onOpenTechnicals: (symbol: string) => void;
  onOpenPrediction: (symbol: string) => void;
  watchedSymbols: Set<string>;
  onToggleWatchlist: (symbol: string) => void;
}

interface MasterStatus {
  total: number;
  dualCount: number;
  nseOnlyCount: number;
  bseOnlyCount: number;
  lastSyncedAt: string | null;
  canManualSync: boolean;
}

type ChartRange = '1M' | '3M' | '6M' | '1Y';

const RANGE_SESSIONS: Record<ChartRange, number> = {
  '1M': 22,
  '3M': 65,
  '6M': 130,
  '1Y': 252,
};

export function StockAnalysisView({
  stocks,
  selectedSymbol,
  onSelectSymbol,
  onOpenTechnicals,
  onOpenPrediction,
  watchedSymbols,
  onToggleWatchlist,
}: StockAnalysisViewProps) {
  const [range, setRange] = useState<ChartRange>('6M');
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [masterStatus, setMasterStatus] = useState<MasterStatus | null>(null);
  const [syncingMaster, setSyncingMaster] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const loadMasterStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/stocks/master/status', {
        headers: { Accept: 'application/json' },
      });
      const status = await parseJsonResponse<MasterStatus>(res);
      setMasterStatus(status);
    } catch {
      // Non-fatal metadata fetch
    }
  }, []);

  useEffect(() => {
    loadMasterStatus();
  }, [loadMasterStatus]);

  const handleSyncMaster = async () => {
    setSyncingMaster(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/stocks/master/sync', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const data = await parseJsonResponse<{
        skipped: boolean;
        message?: string;
        status: MasterStatus;
      }>(res);
      setMasterStatus(data.status);
      setSyncMessage(
        data.skipped
          ? data.message ?? 'Master list already up to date.'
          : `Synced ${data.status.total.toLocaleString('en-IN')} NSE & BSE equities.`
      );
    } catch (err: unknown) {
      setSyncMessage(
        err instanceof Error ? err.message : 'Unable to refresh master directory.'
      );
    } finally {
      setSyncingMaster(false);
    }
  };

  const fetchStockDetail = useCallback(async (symbol: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stocks/${encodeURIComponent(symbol)}`, {
        headers: { Accept: 'application/json' },
      });
      const data = await parseJsonResponse<StockDetail>(res);
      setDetail(data);
    } catch (err: unknown) {
      setDetail(null);
      setError(err instanceof Error ? err.message : 'Unable to fetch stock data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStockDetail(selectedSymbol);
  }, [selectedSymbol, fetchStockDetail]);

  const chartData = useMemo(() => {
    if (!detail) return [];
    const sliceLen = RANGE_SESSIONS[range];
    return detail.history.slice(-sliceLen);
  }, [detail, range]);

  const isUp = (detail?.change ?? 0) >= 0;
  const isWatched = watchedSymbols.has(selectedSymbol);
  const isDelayedFeed = detail?.dataMode === 'Delayed Reference Feed';

  const range52Pos = useMemo(() => {
    if (!detail) return 50;
    const span = Math.max(detail.week52High - detail.week52Low, 0.01);
    return Math.min(100, Math.max(0, ((detail.price - detail.week52Low) / span) * 100));
  }, [detail]);

  const selectedInBenchmarks = stocks.some((s) => s.symbol === selectedSymbol);

  return (
    <div className="space-y-6">
      {/* Header & Full-Universe Autocomplete Search */}
      <div className="flex flex-col gap-4 border-b border-slate-800/80 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            NSE &amp; BSE Stock Analysis
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Search the full PostgreSQL NSE &amp; BSE listed equity universe by company name, NSE symbol, or 6-digit BSE scrip code.
          </p>
        </div>

        <div className="w-full lg:w-[440px]">
          <StockSearchAutocomplete
            selectedSymbolHint={selectedSymbol}
            placeholder="Search any NSE/BSE equity (e.g. HAL, MRF, 500325, Tata)..."
            onSelectStock={(item) => onSelectSymbol(item.symbol)}
          />
        </div>
      </div>

      {/* PostgreSQL Master Directory Metadata Strip */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-slate-800 bg-[#0D1321] px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-300">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-100">
            <Database className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
            NSE/BSE Master Directory
          </span>
          {masterStatus ? (
            <>
              <span className="font-mono tabular-nums text-emerald-400">
                {masterStatus.total.toLocaleString('en-IN')} equities indexed
              </span>
              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="font-mono tabular-nums text-slate-400">
                {masterStatus.dualCount.toLocaleString('en-IN')} Dual NSE/BSE ·{' '}
                {masterStatus.nseOnlyCount.toLocaleString('en-IN')} NSE ·{' '}
                {masterStatus.bseOnlyCount.toLocaleString('en-IN')} BSE
              </span>
            </>
          ) : (
            <span className="text-slate-400">PostgreSQL Drizzle ORM directory active</span>
          )}
          {syncMessage && (
            <span className="text-blue-300 font-medium">{syncMessage}</span>
          )}
        </div>

        <button
          type="button"
          disabled={syncingMaster}
          onClick={handleSyncMaster}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#070B14] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-blue-500 hover:text-blue-300 disabled:opacity-60 whitespace-nowrap self-start sm:self-auto transition-colors"
        >
          {syncingMaster ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Syncing Master...
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Sync NSE/BSE Master
            </>
          )}
        </button>
      </div>

      {/* Benchmark Quick-Switch Strip (Always includes current searched symbol if outside benchmarks) */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium text-slate-500">
          Popular Benchmark Shortcuts (use search above for all 5,500+ NSE/BSE equities)
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {!selectedInBenchmarks && (
            <button
              type="button"
              onClick={() => onSelectSymbol(selectedSymbol)}
              className="flex items-center gap-2 rounded-lg border border-blue-500 bg-blue-600/15 px-3 py-1.5 text-xs text-slate-50 whitespace-nowrap shrink-0"
            >
              <span className="font-mono font-semibold">{selectedSymbol}</span>
              <span className="text-[10px] text-blue-300">Active</span>
            </button>
          )}
          {stocks.map((s) => {
            const active = s.symbol === selectedSymbol;
            const pos = s.changePercent >= 0;
            return (
              <button
                key={s.symbol}
                type="button"
                onClick={() => onSelectSymbol(s.symbol)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'border-blue-500 bg-blue-600/15 text-slate-50'
                    : 'border-slate-800 bg-[#0D1321] text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="font-mono font-semibold">{s.symbol}</span>
                <span
                  className={`font-mono tabular-nums ${
                    pos ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {formatSignedPercent(s.changePercent)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-[#0D1321] px-5 py-4 text-xs text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            <span>
              Resolving {selectedSymbol} from NSE/BSE master and loading historical OHLCV data...
            </span>
          </div>
          <div className="h-32 animate-pulse rounded-xl border border-slate-800 bg-[#0D1321]" />
          <div className="h-80 animate-pulse rounded-xl border border-slate-800 bg-[#0D1321]" />
        </div>
      ) : error || !detail ? (
        <div className="rounded-xl border border-red-900/60 bg-[#0D1321] p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-3">
              <div className="text-sm font-medium text-red-300">
                {error || 'Stock details unavailable.'}
              </div>
              <button
                type="button"
                onClick={() => fetchStockDetail(selectedSymbol)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#070B14] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-blue-500 hover:text-blue-300 whitespace-nowrap"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry Lookup
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Equity Summary Header */}
          <section className="rounded-xl border border-slate-800 bg-[#0D1321] p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400">
                  <span className="font-mono text-slate-200">{detail.exchange}</span>
                  {detail.bseCode && detail.bseCode !== '—' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">BSE {detail.bseCode}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{detail.sector}</span>
                  <span aria-hidden="true">·</span>
                  <span className={isDelayedFeed ? 'text-blue-400 font-medium' : 'text-amber-300 font-medium'}>
                    {detail.dataMode}
                  </span>
                </div>

                <h2 className="mt-1.5 text-2xl font-semibold text-slate-50">
                  {detail.name}{' '}
                  <span className="font-mono text-lg font-medium text-slate-400">
                    ({detail.symbol})
                  </span>
                </h2>

                <div className="mt-3 flex flex-wrap items-baseline gap-3">
                  <span className="font-mono text-3xl font-semibold tabular-nums text-slate-50">
                    {formatInr(detail.price)}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 font-mono text-sm font-medium tabular-nums ${
                      isUp ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {isUp ? (
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
                    )}
                    {formatSignedNumber(detail.change, '₹')} (
                    {formatSignedPercent(detail.changePercent)})
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Session {detail.asOfDate}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onToggleWatchlist(detail.symbol)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                    isWatched
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                      : 'border-slate-700 bg-[#070B14] text-slate-200 hover:border-slate-500'
                  }`}
                >
                  <Star className="h-3.5 w-3.5" fill={isWatched ? 'currentColor' : 'none'} />
                  {isWatched ? 'In Watchlist' : 'Add to Watchlist'}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenTechnicals(detail.symbol)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#070B14] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-blue-500 hover:text-blue-300 whitespace-nowrap transition-colors"
                >
                  <Activity className="h-3.5 w-3.5" />
                  Technical Charts
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPrediction(detail.symbol)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 whitespace-nowrap transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Run AI Prediction
                </button>
              </div>
            </div>

            {/* Session OHLC & 52W Range */}
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-800/80 pt-4 sm:grid-cols-4 lg:grid-cols-6">
              <div>
                <div className="text-xs text-slate-400">Open</div>
                <div className="mt-0.5 font-mono text-sm tabular-nums text-slate-100">
                  {formatInr(detail.open)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Prev Close</div>
                <div className="mt-0.5 font-mono text-sm tabular-nums text-slate-100">
                  {formatInr(detail.prevClose)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Day High / Low</div>
                <div className="mt-0.5 font-mono text-sm tabular-nums text-slate-100">
                  {formatInr(detail.dayHigh, 1)} / {formatInr(detail.dayLow, 1)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Volume (20D Avg)</div>
                <div className="mt-0.5 font-mono text-sm tabular-nums text-slate-100">
                  {formatIndianVolume(detail.volume)}{' '}
                  <span className="text-xs text-slate-400">
                    ({formatIndianVolume(detail.avgVolume20d)})
                  </span>
                </div>
              </div>
              <div className="col-span-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>52-Week Low: {formatInr(detail.week52Low, 1)}</span>
                  <span>52-Week High: {formatInr(detail.week52High, 1)}</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${range52Pos}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Historical Price & Volume Charts */}
          <section className="rounded-xl border border-slate-800 bg-[#0D1321] p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Historical Price &amp; Trading Volume
                </h3>
                <p className="text-xs text-slate-400">
                  Daily close series and share volume ({detail.dataMode})
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-[#070B14] p-1">
                {(['1M', '3M', '6M', '1Y'] as ChartRange[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={`rounded-md px-3 py-1 text-xs font-mono font-medium transition-colors ${
                      range === r
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Area Chart */}
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="stockPriceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={isUp ? '#10B981' : '#EF4444'}
                        stopOpacity={0.28}
                      />
                      <stop
                        offset="100%"
                        stopColor={isUp ? '#10B981' : '#EF4444'}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    tickFormatter={(v: string) => v.slice(5)}
                    minTickGap={30}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    orientation="right"
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    tickFormatter={(v: number) => `₹${v.toFixed(0)}`}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0B1120',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(val: unknown) => [formatInr(Number(val)), 'Close']}
                  />
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke={isUp ? '#10B981' : '#EF4444'}
                    strokeWidth={2}
                    fill="url(#stockPriceGrad)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Synchronized Volume Chart */}
            <div className="mt-4 border-t border-slate-800/80 pt-3">
              <div className="mb-2 text-xs font-medium text-slate-400">
                Daily Share Volume
              </div>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#64748B', fontSize: 10 }}
                      tickFormatter={(v: string) => v.slice(5)}
                      minTickGap={35}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      orientation="right"
                      tick={{ fill: '#64748B', fontSize: 10 }}
                      tickFormatter={(v: number) => formatIndianVolume(v)}
                      axisLine={false}
                      tickLine={false}
                      width={64}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0B1120',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(val: unknown) => [formatIndianVolume(Number(val)), 'Volume']}
                    />
                    <Bar dataKey="volume" fill="#3B82F6" fillOpacity={0.55} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* Fundamental Metrics Section */}
          <section className="rounded-xl border border-slate-800 bg-[#0D1321] p-5">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-base font-semibold text-slate-100">
                Fundamental Metrics Snapshot
              </h3>
              <span className="text-xs text-amber-300">
                {detail.fundamentals.fundamentalsStatus} — Verify against NSE/BSE filings before acting
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {[
                {
                  label: 'Market Capitalisation',
                  value:
                    detail.fundamentals.marketCapCr > 0
                      ? formatMarketCapCr(detail.fundamentals.marketCapCr)
                      : 'Unavailable',
                },
                {
                  label: 'P/E Ratio (TTM)',
                  value: detail.fundamentals.peRatio !== null ? `${detail.fundamentals.peRatio.toFixed(1)}x` : 'N/A',
                },
                {
                  label: 'P/B Ratio',
                  value: detail.fundamentals.pbRatio !== null ? `${detail.fundamentals.pbRatio.toFixed(2)}x` : 'N/A',
                },
                {
                  label: 'Return on Equity (ROE)',
                  value: detail.fundamentals.roePercent !== null ? `${detail.fundamentals.roePercent.toFixed(1)}%` : 'N/A',
                },
                {
                  label: 'Dividend Yield',
                  value:
                    detail.fundamentals.dividendYieldPercent !== null
                      ? `${detail.fundamentals.dividendYieldPercent.toFixed(2)}%`
                      : 'N/A',
                },
                {
                  label: 'EPS (TTM)',
                  value: detail.fundamentals.epsInr !== null ? formatInr(detail.fundamentals.epsInr) : 'N/A',
                },
                {
                  label: 'Book Value / Share',
                  value:
                    detail.fundamentals.bookValueInr !== null
                      ? formatInr(detail.fundamentals.bookValueInr)
                      : 'N/A',
                },
                {
                  label: 'Debt / Equity',
                  value:
                    detail.fundamentals.debtToEquity !== null
                      ? detail.fundamentals.debtToEquity.toFixed(2)
                      : detail.sector.toLowerCase().includes('bank')
                      ? 'N/A (Bank)'
                      : 'N/A',
                },
                {
                  label: 'Face Value',
                  value:
                    detail.fundamentals.faceValueInr > 0
                      ? formatInr(detail.fundamentals.faceValueInr, 0)
                      : 'Unavailable',
                },
                {
                  label: 'Technical Trend State',
                  value: detail.technicalSummary.overallTrend,
                },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="border-t border-slate-800/80 pt-3"
                >
                  <div className="text-xs text-slate-400">{metric.label}</div>
                  <div className="mt-1 font-mono text-sm font-medium tabular-nums text-slate-100">
                    {metric.value}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
