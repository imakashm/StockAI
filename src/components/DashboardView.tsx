import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Star,
  TrendingUp,
} from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import type { MarketIndex, StockSummary } from '../types/market.ts';
import {
  formatIndianVolume,
  formatIndexValue,
  formatInr,
  formatMarketCapCr,
  formatSignedNumber,
  formatSignedPercent,
} from '../lib/format.ts';

interface MarketOverviewPayload {
  dataMode: string;
  asOfDate: string;
  session: {
    isOpen: boolean;
    label: string;
    istTime: string;
    exchangeHours: string;
  };
  indices: MarketIndex[];
  breadth: {
    advancers: number;
    decliners: number;
    unchanged: number;
    total: number;
  };
  topGainers: StockSummary[];
  topLosers: StockSummary[];
  mostActive: StockSummary[];
  stocks: StockSummary[];
}

interface DashboardViewProps {
  overview: MarketOverviewPayload | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectStock: (symbol: string) => void;
  onPredictStock: (symbol: string) => void;
  watchedSymbols: Set<string>;
  onToggleWatchlist: (symbol: string) => void;
}

type TableTab = 'gainers' | 'losers' | 'active' | 'all';

export function DashboardView({
  overview,
  loading,
  error,
  onRetry,
  onSelectStock,
  onPredictStock,
  watchedSymbols,
  onToggleWatchlist,
}: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<TableTab>('gainers');
  const [sectorFilter, setSectorFilter] = useState<string>('All');

  const sectors = useMemo(() => {
    if (!overview) return ['All'];
    return ['All', ...Array.from(new Set(overview.stocks.map((s) => s.sector))).sort()];
  }, [overview]);

  const tableRows = useMemo(() => {
    if (!overview) return [];
    let rows: StockSummary[] = [];
    if (activeTab === 'gainers') rows = overview.topGainers;
    else if (activeTab === 'losers') rows = overview.topLosers;
    else if (activeTab === 'active') rows = overview.mostActive;
    else rows = overview.stocks;

    if (sectorFilter !== 'All') {
      rows = rows.filter((r) => r.sector === sectorFilter);
    }
    return rows;
  }, [overview, activeTab, sectorFilter]);

  if (loading && !overview) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl border border-slate-800 bg-[#0D1321]"
            />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl border border-slate-800 bg-[#0D1321]" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="rounded-xl border border-red-900/60 bg-[#0D1321] p-6 text-center">
        <p className="text-sm font-medium text-red-400">
          {error || 'Unable to load Indian market overview.'}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
        >
          Retry Market Feed
        </button>
      </div>
    );
  }

  const advPct = Math.round((overview.breadth.advancers / Math.max(overview.breadth.total, 1)) * 100);
  const decPct = Math.round((overview.breadth.decliners / Math.max(overview.breadth.total, 1)) * 100);

  return (
    <div className="space-y-6">
      {/* Market Status & Data Mode Header */}
      <div className="flex flex-col gap-4 border-b border-slate-800/80 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            Indian Market Overview
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <Clock className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
              {overview.session.label}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{overview.session.istTime}</span>
            <span aria-hidden="true">·</span>
            <span>{overview.session.exchangeHours}</span>
          </div>
        </div>

        <div className="flex flex-col items-start md:items-end text-xs">
          <span className="font-medium text-amber-300">
            Data Mode: {overview.dataMode}
          </span>
          <span className="mt-0.5 text-slate-400 font-mono tabular-nums">
            Reference Session: {overview.asOfDate} (Simulated Demo OHLCV — Not Live Exchange Ticks)
          </span>
        </div>
      </div>

      {/* 5 Major Indian Market Indices */}
      <section aria-label="Indian Market Indices">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {overview.indices.map((idx) => {
            const isPositive = idx.change >= 0;
            const rangeSpan = Math.max(idx.dayHigh - idx.dayLow, 0.01);
            const rangePos = Math.min(
              100,
              Math.max(0, ((idx.value - idx.dayLow) / rangeSpan) * 100)
            );
            const strokeColor = isPositive ? '#10B981' : '#EF4444';

            return (
              <div
                key={idx.id}
                className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0D1321] p-4 transition-colors hover:border-slate-700"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                    <span className="font-semibold text-slate-200 tracking-tight">
                      {idx.name}
                    </span>
                    <span className="font-mono">{idx.exchange}</span>
                  </div>

                  <div className="mt-2 font-mono text-xl font-semibold tabular-nums text-slate-50">
                    {formatIndexValue(idx.value)}
                  </div>

                  <div
                    className={`mt-1 flex items-center gap-1 font-mono text-xs tabular-nums ${
                      isPositive ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {isPositive ? (
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span>{formatSignedNumber(idx.change)}</span>
                    <span>({formatSignedPercent(idx.changePercent)})</span>
                  </div>
                </div>

                {/* Mini Sparkline */}
                <div className="my-2.5 h-10 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={idx.sparkline} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
                      <defs>
                        <linearGradient id={`grad-${idx.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.28} />
                          <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={strokeColor}
                        strokeWidth={1.6}
                        fill={`url(#grad-${idx.id})`}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Intraday Range */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-mono text-[11px] tabular-nums text-slate-400">
                    <span>L {formatIndexValue(idx.dayLow)}</span>
                    <span>H {formatIndexValue(idx.dayHigh)}</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ width: `${rangePos}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Market Breadth Bar */}
      <section
        aria-label="Market Breadth"
        className="rounded-xl border border-slate-800 bg-[#0D1321] p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Market Breadth — Tracked NSE Large-Cap Universe
            </h2>
            <p className="text-xs text-slate-400">
              Advancers vs Decliners across {overview.breadth.total} benchmark constituents
            </p>
          </div>
          <div className="flex items-center gap-5 font-mono text-xs tabular-nums">
            <span className="text-emerald-400">
              Advancers: <strong>{overview.breadth.advancers}</strong> ({advPct}%)
            </span>
            <span className="text-red-400">
              Decliners: <strong>{overview.breadth.decliners}</strong> ({decPct}%)
            </span>
            <span className="text-slate-400">
              Unchanged: <strong>{overview.breadth.unchanged}</strong>
            </span>
          </div>
        </div>
        <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${advPct}%` }}
          />
          <div
            className="h-full bg-red-500 transition-all duration-300"
            style={{ width: `${decPct}%` }}
          />
        </div>
      </section>

      {/* Top Gainers / Top Losers / Most Active / All Stocks Grid */}
      <section className="rounded-xl border border-slate-800 bg-[#0D1321]">
        <div className="flex flex-col gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#070B14] p-1">
            {(
              [
                { id: 'gainers', label: 'Top Gainers' },
                { id: 'losers', label: 'Top Losers' },
                { id: 'active', label: 'Most Active' },
                { id: 'all', label: `All Stocks (${overview.stocks.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="sector-filter" className="text-xs text-slate-400 whitespace-nowrap">
              Sector
            </label>
            <select
              id="sector-filter"
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-[#070B14] px-3 py-1.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              {sectors.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
                <th className="py-3 pl-4 pr-3">Symbol & Company</th>
                <th className="px-3 py-3">Sector</th>
                <th className="px-3 py-3 text-right">Ref Price (₹)</th>
                <th className="px-3 py-3 text-right">Daily Change</th>
                <th className="px-3 py-3 text-right">Day Range</th>
                <th className="px-3 py-3 text-right">Volume</th>
                <th className="px-3 py-3 text-right">Market Cap</th>
                <th className="py-3 pl-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-xs text-slate-400">
                    No stocks match the selected sector filter in this tab.
                  </td>
                </tr>
              ) : (
                tableRows.map((stock) => {
                  const isUp = stock.change >= 0;
                  const isWatched = watchedSymbols.has(stock.symbol);
                  return (
                    <tr
                      key={stock.symbol}
                      onClick={() => onSelectStock(stock.symbol)}
                      className="cursor-pointer transition-colors hover:bg-slate-800/40"
                    >
                      <td className="py-3 pl-4 pr-3">
                        <div className="font-mono text-sm font-semibold text-slate-100">
                          {stock.symbol}
                        </div>
                        <div className="text-xs text-slate-400 truncate max-w-[200px]">
                          {stock.name}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-300">{stock.sector}</td>
                      <td className="px-3 py-3 text-right font-mono text-sm font-medium tabular-nums text-slate-100">
                        {formatInr(stock.price)}
                      </td>
                      <td
                        className={`px-3 py-3 text-right font-mono text-xs tabular-nums ${
                          isUp ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        <div className="inline-flex items-center justify-end gap-1 font-medium">
                          {isUp ? (
                            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {formatSignedPercent(stock.changePercent)}
                        </div>
                        <div className="text-[11px] opacity-80">
                          {formatSignedNumber(stock.change, '₹')}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-slate-400">
                        {formatInr(stock.dayLow, 1)} – {formatInr(stock.dayHigh, 1)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-slate-300">
                        {formatIndianVolume(stock.volume)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-slate-300">
                        {formatMarketCapCr(stock.fundamentals.marketCapCr)}
                      </td>
                      <td
                        className="py-3 pl-3 pr-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onToggleWatchlist(stock.symbol)}
                            aria-label={
                              isWatched
                                ? `Remove ${stock.symbol} from watchlist`
                                : `Add ${stock.symbol} to watchlist`
                            }
                            className={`rounded-md p-1.5 transition-colors ${
                              isWatched
                                ? 'text-amber-400 hover:bg-slate-800'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                          >
                            <Star
                              className="h-4 w-4"
                              fill={isWatched ? 'currentColor' : 'none'}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => onPredictStock(stock.symbol)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-blue-500 hover:text-blue-300 transition-colors whitespace-nowrap"
                          >
                            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                            Predict
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
