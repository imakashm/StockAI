import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CandlestickChart } from './CandlestickChart.tsx';
import { StockSearchAutocomplete } from './StockSearchAutocomplete.tsx';
import type { StockDetail, StockSummary } from '../types/market.ts';
import { formatIndianVolume, formatInr } from '../lib/format.ts';
import { parseJsonResponse } from '../lib/http.ts';

interface TechnicalAnalysisViewProps {
  stocks: StockSummary[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

type TechRange = '1M' | '3M' | '6M' | '1Y';

const SESSIONS_MAP: Record<TechRange, number> = {
  '1M': 24,
  '3M': 65,
  '6M': 130,
  '1Y': 252,
};

export function TechnicalAnalysisView({
  selectedSymbol,
  onSelectSymbol,
}: TechnicalAnalysisViewProps) {
  const [range, setRange] = useState<TechRange>('3M');
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(true);
  const [showSma200, setShowSma200] = useState(false);
  const [showBollinger, setShowBollinger] = useState(true);
  const [showSupportResistance, setShowSupportResistance] = useState(true);

  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/stocks/${encodeURIComponent(selectedSymbol)}`, {
      headers: { Accept: 'application/json' },
    })
      .then((res) => parseJsonResponse<StockDetail>(res))
      .then((data) => {
        if (active) {
          setDetail(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load chart data.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedSymbol]);

  const sliced = useMemo(() => {
    if (!detail) return [];
    return detail.history.slice(-SESSIONS_MAP[range]);
  }, [detail, range]);

  const ts = detail?.technicalSummary;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 border-b border-slate-800/80 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            Interactive Technical Analysis
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Candlestick price action, moving averages, Bollinger Bands, Support & Resistance levels, RSI (14), and MACD (12, 26, 9).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-72">
            <StockSearchAutocomplete
              size="compact"
              selectedSymbolHint={selectedSymbol}
              placeholder={`Active: ${selectedSymbol} — Search any NSE/BSE stock...`}
              onSelectStock={(item) => onSelectSymbol(item.symbol)}
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-[#0D1321] border border-slate-800 p-1">
            {(['1M', '3M', '6M', '1Y'] as TechRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-md px-2.5 py-1 font-mono text-xs font-medium transition-colors ${
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
      </div>

      {loading ? (
        <div className="h-96 animate-pulse rounded-xl border border-slate-800 bg-[#0D1321]" />
      ) : error || !detail || !ts ? (
        <div className="rounded-xl border border-red-900/60 bg-[#0D1321] p-6 text-sm text-red-400">
          {error || 'Technical indicator data unavailable.'}
        </div>
      ) : (
        <>
          {/* Trend & Level Summary Strip */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-[#0D1321] p-4">
              <div className="text-xs text-slate-400">Algorithmic Trend Identification</div>
              <div
                className={`mt-1.5 text-lg font-semibold ${
                  ts.overallTrend === 'Uptrend'
                    ? 'text-emerald-400'
                    : ts.overallTrend === 'Downtrend'
                    ? 'text-red-400'
                    : 'text-slate-200'
                }`}
              >
                {ts.overallTrend}
              </div>
              <div className="mt-1 font-mono text-xs tabular-nums text-slate-400">
                Composite Signal Score: {ts.trendScore >= 0 ? '+' : ''}
                {ts.trendScore} / 100
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0D1321] p-4">
              <div className="text-xs text-slate-400">Support Estimates (S1 / S2)</div>
              <div className="mt-1.5 font-mono text-base font-semibold tabular-nums text-emerald-400">
                {ts.supportLevels.slice(0, 2).map((l) => formatInr(l, 1)).join(' · ')}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Pivot & 60-session swing floor
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0D1321] p-4">
              <div className="text-xs text-slate-400">Resistance Estimates (R1 / R2)</div>
              <div className="mt-1.5 font-mono text-base font-semibold tabular-nums text-red-400">
                {ts.resistanceLevels.slice(0, 2).map((l) => formatInr(l, 1)).join(' · ')}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Pivot & upper envelope ceiling
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0D1321] p-4">
              <div className="text-xs text-slate-400">Volatility & Volume Ratio</div>
              <div className="mt-1.5 font-mono text-base font-semibold tabular-nums text-slate-100">
                {ts.annualizedVolatilityPercent.toFixed(1)}%{' '}
                <span className="text-xs font-normal text-slate-400">30D Ann.</span>
              </div>
              <div className="mt-1 font-mono text-xs tabular-nums text-slate-400">
                Volume vs 20D SMA: {ts.volumeRatio20d.toFixed(2)}x
              </div>
            </div>
          </section>

          {/* Main Candlestick Workspace */}
          <section className="rounded-xl border border-slate-800 bg-[#0D1321] p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  {detail.symbol} Candlestick & Overlay Study
                </h2>
                <p className="text-xs text-slate-400">
                  {detail.dataMode} · Hover across candles to inspect session OHLCV values
                </p>
              </div>

              {/* Interactive Overlay Toggles */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: 'EMA 20', active: showEma20, toggle: () => setShowEma20((v) => !v), color: 'text-blue-400' },
                  { label: 'EMA 50', active: showEma50, toggle: () => setShowEma50((v) => !v), color: 'text-amber-400' },
                  { label: 'SMA 200', active: showSma200, toggle: () => setShowSma200((v) => !v), color: 'text-slate-200' },
                  { label: 'Bollinger', active: showBollinger, toggle: () => setShowBollinger((v) => !v), color: 'text-blue-300' },
                  { label: 'S/R Levels', active: showSupportResistance, toggle: () => setShowSupportResistance((v) => !v), color: 'text-emerald-400' },
                ].map((ov) => (
                  <button
                    key={ov.label}
                    type="button"
                    onClick={ov.toggle}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                      ov.active
                        ? `border-slate-600 bg-slate-800/80 ${ov.color}`
                        : 'border-slate-800 bg-[#070B14] text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {ov.label}
                  </button>
                ))}
              </div>
            </div>

            <CandlestickChart
              data={sliced}
              showEma20={showEma20}
              showEma50={showEma50}
              showSma200={showSma200}
              showBollinger={showBollinger}
              showSupportResistance={showSupportResistance}
              supportLevels={ts.supportLevels}
              resistanceLevels={ts.resistanceLevels}
            />
          </section>

          {/* RSI (14) & MACD (12, 26, 9) Side-by-Side */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* RSI Chart */}
            <section className="rounded-xl border border-slate-800 bg-[#0D1321] p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    Relative Strength Index — RSI (14)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Overbought &gt; 70 · Oversold &lt; 30
                  </p>
                </div>
                <div className="text-right font-mono text-xs tabular-nums">
                  <span className="text-slate-100 font-semibold">{ts.rsi14.toFixed(1)}</span>{' '}
                  <span className="text-slate-400">({ts.rsiState})</span>
                </div>
              </div>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sliced} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#64748B', fontSize: 10 }}
                      tickFormatter={(v: string) => v.slice(5)}
                      minTickGap={30}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[30, 50, 70]}
                      orientation="right"
                      tick={{ fill: '#64748B', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0B1120',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <ReferenceLine y={70} stroke="#EF4444" strokeDasharray="4 4" strokeOpacity={0.7} />
                    <ReferenceLine y={30} stroke="#10B981" strokeDasharray="4 4" strokeOpacity={0.7} />
                    <Line
                      type="monotone"
                      dataKey="rsi14"
                      name="RSI (14)"
                      stroke="#3B82F6"
                      strokeWidth={1.8}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* MACD Chart */}
            <section className="rounded-xl border border-slate-800 bg-[#0D1321] p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    MACD (12, 26, 9) Momentum
                  </h3>
                  <p className="text-xs text-slate-400">
                    MACD Line (Blue) · Signal Line (Amber) · Histogram
                  </p>
                </div>
                <div className="text-right font-mono text-xs tabular-nums">
                  <span
                    className={
                      ts.macdHistogram >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'
                    }
                  >
                    Hist {ts.macdHistogram >= 0 ? '+' : ''}
                    {ts.macdHistogram.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={sliced} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#64748B', fontSize: 10 }}
                      tickFormatter={(v: string) => v.slice(5)}
                      minTickGap={30}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      orientation="right"
                      tick={{ fill: '#64748B', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0B1120',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                    <Bar dataKey="macdHistogram" name="Histogram" isAnimationActive={false}>
                      {sliced.map((entry, idx) => (
                        <Cell
                          key={`hist-${idx}`}
                          fill={(entry.macdHistogram ?? 0) >= 0 ? '#10B981' : '#EF4444'}
                          fillOpacity={0.65}
                        />
                      ))}
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="macd"
                      name="MACD"
                      stroke="#3B82F6"
                      strokeWidth={1.6}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="macdSignal"
                      name="Signal"
                      stroke="#F59E0B"
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {/* Volume vs 20-Day Moving Average */}
          <section className="rounded-xl border border-slate-800 bg-[#0D1321] p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Volume Analysis vs 20-Session Moving Average
                </h3>
                <p className="text-xs text-slate-400">
                  Green/Red bars indicate up/down sessions relative to 20-day average turnover
                </p>
              </div>
              <span className="font-mono text-xs tabular-nums text-slate-300">
                Latest: {formatIndianVolume(detail.volume)}
              </span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={sliced} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748B', fontSize: 10 }}
                    tickFormatter={(v: string) => v.slice(5)}
                    minTickGap={30}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    orientation="right"
                    tick={{ fill: '#64748B', fontSize: 10 }}
                    tickFormatter={(v: number) => formatIndianVolume(v)}
                    axisLine={false}
                    tickLine={false}
                    width={62}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0B1120',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(val: unknown, name: unknown) => [
                      formatIndianVolume(Number(val)),
                      String(name),
                    ]}
                  />
                  <Bar dataKey="volume" name="Session Volume" isAnimationActive={false}>
                    {sliced.map((entry, idx) => (
                      <Cell
                        key={`vol-${idx}`}
                        fill={entry.close >= entry.open ? '#10B981' : '#EF4444'}
                        fillOpacity={0.55}
                      />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="volumeSma20"
                    name="20D Volume SMA"
                    stroke="#3B82F6"
                    strokeWidth={1.7}
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
