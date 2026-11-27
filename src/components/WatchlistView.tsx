import { useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  BellRing,
  CheckCircle2,
  FolderPlus,
  LogIn,
  RefreshCw,
  RotateCcw,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { StockSearchAutocomplete } from './StockSearchAutocomplete.tsx';
import type {
  PriceAlertCondition,
  PriceAlertRecord,
  StockSummary,
  WatchlistRecord,
} from '../types/market.ts';
import {
  formatIndianVolume,
  formatInr,
  formatSignedPercent,
} from '../lib/format.ts';

interface WatchlistViewProps {
  stocks: StockSummary[];
  watchlists: WatchlistRecord[];
  activeWatchlistId: number | string;
  onSelectWatchlist: (id: number | string) => void;
  onCreateWatchlist: (name: string) => Promise<void>;
  onDeleteWatchlist: (id: number | string) => Promise<void>;
  onAddSymbol: (watchlistId: number | string, symbol: string) => Promise<void>;
  onRemoveSymbol: (watchlistId: number | string, symbol: string) => Promise<void>;
  onSelectStock: (symbol: string) => void;
  onPredictStock: (symbol: string) => void;
  priceAlerts: PriceAlertRecord[];
  onCreatePriceAlert: (input: {
    symbol: string;
    condition: PriceAlertCondition;
    targetPrice: number;
  }) => Promise<void>;
  onDeletePriceAlert: (id: number | string) => Promise<void>;
  onResetPriceAlert: (id: number | string) => Promise<void>;
  onSimulatePriceTick: () => void;
  autoTickEnabled: boolean;
  onToggleAutoTick: () => void;
  isAuthenticated: boolean;
  onSignIn: () => void;
  loading: boolean;
}

export function WatchlistView({
  stocks,
  watchlists,
  activeWatchlistId,
  onSelectWatchlist,
  onCreateWatchlist,
  onDeleteWatchlist,
  onAddSymbol,
  onRemoveSymbol,
  onSelectStock,
  onPredictStock,
  priceAlerts,
  onCreatePriceAlert,
  onDeletePriceAlert,
  onResetPriceAlert,
  onSimulatePriceTick,
  autoTickEnabled,
  onToggleAutoTick,
  isAuthenticated,
  onSignIn,
  loading,
}: WatchlistViewProps) {
  const [newListName, setNewListName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Price Alert Form State
  const [alertSymbol, setAlertSymbol] = useState(stocks[0]?.symbol || 'RELIANCE');
  const [alertCondition, setAlertCondition] = useState<PriceAlertCondition>('above');
  const [alertTargetInput, setAlertTargetInput] = useState(
    stocks[0] ? (stocks[0].price * 1.01).toFixed(2) : '1330.00'
  );
  const [alertSubmitting, setAlertSubmitting] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [alertFilter, setAlertFilter] = useState<'active' | 'triggered' | 'all'>('active');
  const alertSectionRef = useRef<HTMLElement | null>(null);

  const stockMap = useMemo(() => {
    const map = new Map<string, StockSummary>();
    stocks.forEach((s) => map.set(s.symbol, s));
    return map;
  }, [stocks]);

  const activeWatchlist =
    watchlists.find((w) => w.id === activeWatchlistId) ?? watchlists[0] ?? null;

  const activeAlertsCount = useMemo(
    () => priceAlerts.filter((a) => a.status === 'active').length,
    [priceAlerts]
  );

  const triggeredAlertsCount = useMemo(
    () => priceAlerts.filter((a) => a.status === 'triggered').length,
    [priceAlerts]
  );

  const filteredAlerts = useMemo(() => {
    if (alertFilter === 'all') return priceAlerts;
    return priceAlerts.filter((a) => a.status === alertFilter);
  }, [priceAlerts, alertFilter]);

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newListName.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreateWatchlist(trimmed);
      setNewListName('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to create watchlist.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddFromSearch = async (symbol: string) => {
    if (!activeWatchlist) return;
    if (activeWatchlist.symbols.includes(symbol)) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAddSymbol(activeWatchlist.id, symbol);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to add stock.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAlertSymbolChange = (nextSym: string) => {
    setAlertSymbol(nextSym);
    const s = stockMap.get(nextSym);
    if (s) {
      const multiplier = alertCondition === 'above' ? 1.01 : 0.99;
      setAlertTargetInput((s.price * multiplier).toFixed(2));
    }
  };

  const handleQuickSetAlert = (sym: string) => {
    const s = stockMap.get(sym);
    setAlertSymbol(sym);
    setAlertCondition('above');
    if (s) {
      setAlertTargetInput((s.price * 1.01).toFixed(2));
    }
    setAlertError(null);
    alertSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericTarget = Number(alertTargetInput);
    if (!Number.isFinite(numericTarget) || numericTarget <= 0) {
      setAlertError('Please enter a valid target price in INR.');
      return;
    }

    setAlertSubmitting(true);
    setAlertError(null);
    try {
      await onCreatePriceAlert({
        symbol: alertSymbol,
        condition: alertCondition,
        targetPrice: Number(numericTarget.toFixed(2)),
      });
    } catch (err: unknown) {
      setAlertError(err instanceof Error ? err.message : 'Unable to create price alert.');
    } finally {
      setAlertSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-800/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            Custom Watchlists &amp; Price Alerts
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Organise NSE &amp; BSE stocks into dedicated watchlists and configure automated target-price toast alerts.
          </p>
        </div>

        {!isAuthenticated && (
          <button
            type="button"
            onClick={onSignIn}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/50 bg-blue-600/15 px-3.5 py-2 text-xs font-medium text-blue-200 hover:bg-blue-600/25 whitespace-nowrap self-start sm:self-auto transition-colors"
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign in with Google to sync watchlists &amp; alerts
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-900/60 bg-red-950/20 px-4 py-3 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Watchlist Switcher & Creator */}
        <aside className="space-y-4 lg:col-span-4">
          <div className="rounded-xl border border-slate-800 bg-[#0D1321] p-4">
            <h2 className="text-sm font-semibold text-slate-100">Your Watchlists</h2>
            <div className="mt-3 space-y-1.5">
              {loading ? (
                <div className="h-24 animate-pulse rounded-lg bg-slate-800/40" />
              ) : (
                watchlists.map((list) => {
                  const isActive = activeWatchlist?.id === list.id;
                  return (
                    <div
                      key={String(list.id)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors ${
                        isActive
                          ? 'border-blue-500/60 bg-blue-600/15 text-slate-50'
                          : 'border-slate-800 bg-[#070B14] text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectWatchlist(list.id)}
                        className="flex-1 text-left"
                      >
                        <div className="text-sm font-medium truncate">{list.name}</div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {list.symbols.length}{' '}
                          {list.symbols.length === 1 ? 'stock' : 'stocks'}
                        </div>
                      </button>

                      {watchlists.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeleteWatchlist(list.id)}
                          aria-label={`Delete watchlist ${list.name}`}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* New Watchlist Form */}
            <form
              onSubmit={handleCreateList}
              className="mt-4 border-t border-slate-800 pt-4 space-y-2"
            >
              <label
                htmlFor="new-watchlist-name"
                className="block text-xs font-medium text-slate-300"
              >
                Create New Watchlist
              </label>
              <div className="flex gap-2">
                <input
                  id="new-watchlist-name"
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g. Banking Leaders"
                  maxLength={60}
                  className="flex-1 rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={submitting || !newListName.trim()}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 whitespace-nowrap transition-colors"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  Create
                </button>
              </div>
            </form>
          </div>
        </aside>

        {/* Active Watchlist Table */}
        <section className="rounded-xl border border-slate-800 bg-[#0D1321] lg:col-span-8">
          <div className="flex flex-col gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                {activeWatchlist ? activeWatchlist.name : 'Watchlist'}
              </h2>
              <p className="text-xs text-slate-400">
                Simulated Historical Dataset prices · Click any symbol for full equity analysis
              </p>
            </div>

            {activeWatchlist && (
              <div className="w-full sm:w-72">
                <StockSearchAutocomplete
                  size="compact"
                  placeholder="Add any NSE/BSE stock to watchlist..."
                  onSelectStock={(item) => handleAddFromSearch(item.symbol)}
                />
              </div>
            )}
          </div>

          {!activeWatchlist || activeWatchlist.symbols.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-slate-200">
                This watchlist has no stocks yet.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Use the selector above to add Indian equities like RELIANCE, TCS, or HDFCBANK.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[660px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
                    <th className="py-3 pl-4 pr-3">Symbol</th>
                    <th className="px-3 py-3 text-right">Ref Price</th>
                    <th className="px-3 py-3 text-right">Daily Change</th>
                    <th className="px-3 py-3 text-right">Volume</th>
                    <th className="py-3 pl-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {activeWatchlist.symbols.map((sym) => {
                    const s = stockMap.get(sym);
                    const up = (s?.change ?? 0) >= 0;
                    const hasActiveAlert = priceAlerts.some(
                      (a) => a.symbol === sym && a.status === 'active'
                    );
                    return (
                      <tr
                        key={sym}
                        onClick={() => onSelectStock(sym)}
                        className="cursor-pointer transition-colors hover:bg-slate-800/40"
                      >
                        <td className="py-3 pl-4 pr-3">
                          <div className="font-mono font-semibold text-slate-100">
                            {sym}
                          </div>
                          <div className="text-xs text-slate-400">
                            {s ? s.name : 'NSE / BSE Master Equity'}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-100">
                          {s ? formatInr(s.price) : <span className="text-xs text-slate-400">Click to load</span>}
                        </td>
                        <td
                          className={`px-3 py-3 text-right font-mono text-xs tabular-nums ${
                            !s
                              ? 'text-slate-500'
                              : up
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}
                        >
                          {s ? (
                            <span className="inline-flex items-center gap-1 font-medium">
                              {up ? (
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDownRight className="h-3.5 w-3.5" />
                              )}
                              {formatSignedPercent(s.changePercent)}
                            </span>
                          ) : (
                            'Delayed feed'
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-slate-300">
                          {s ? formatIndianVolume(s.volume) : '—'}
                        </td>
                        <td
                          className="py-3 pl-3 pr-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleQuickSetAlert(sym)}
                              aria-label={`Set price alert for ${sym}`}
                              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                                hasActiveAlert
                                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                                  : 'border-slate-700 text-slate-200 hover:border-blue-500 hover:text-blue-300'
                              }`}
                            >
                              <Bell className="h-3.5 w-3.5" />
                              Alert
                            </button>
                            <button
                              type="button"
                              onClick={() => onPredictStock(sym)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-blue-500 hover:text-blue-300 whitespace-nowrap transition-colors"
                            >
                              <TrendingUp className="h-3.5 w-3.5" />
                              Predict
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveSymbol(activeWatchlist.id, sym)}
                              aria-label={`Remove ${sym} from watchlist`}
                              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
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

      {/* Price Alerts Section inside Watchlist View */}
      <section
        ref={alertSectionRef}
        aria-label="Stock Price Alerts"
        className="rounded-xl border border-slate-800 bg-[#0D1321]"
      >
        <div className="flex flex-col gap-3 border-b border-slate-800 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-blue-400" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-100">
                Active Price Alerts
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Set target thresholds for NSE/BSE stocks. A toast notification triggers automatically when a stock reaches your target price.
            </p>
          </div>

          {/* Interactive Simulation Controls for Testing Alert Thresholds */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSimulatePriceTick}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#070B14] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-blue-500 hover:text-blue-300 whitespace-nowrap transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Simulate Price Tick
            </button>
            <button
              type="button"
              onClick={onToggleAutoTick}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                autoTickEnabled
                  ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-700 bg-[#070B14] text-slate-300 hover:border-slate-500'
              }`}
            >
              {autoTickEnabled ? 'Auto-Tick On (5s)' : 'Auto-Tick Off'}
            </button>
          </div>
        </div>

        {/* Create Alert Form */}
        <form
          onSubmit={handleCreateAlert}
          className="border-b border-slate-800/80 bg-[#0A0F1C] p-5"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-4">
              <label
                htmlFor="alert-symbol-select"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Stock Symbol
              </label>
              <select
                id="alert-symbol-select"
                value={alertSymbol}
                onChange={(e) => handleAlertSymbolChange(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 font-mono text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                {stocks.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} — Current {formatInr(s.price)}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-3">
              <label
                htmlFor="alert-condition-select"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Trigger Condition
              </label>
              <select
                id="alert-condition-select"
                value={alertCondition}
                onChange={(e) =>
                  setAlertCondition(e.target.value as PriceAlertCondition)
                }
                className="w-full rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                <option value="above">Reaches or Exceeds (≥)</option>
                <option value="below">Drops to or Below (≤)</option>
              </select>
            </div>

            <div className="lg:col-span-3">
              <label
                htmlFor="alert-target-input"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Target Price (₹)
              </label>
              <input
                id="alert-target-input"
                type="number"
                step="0.05"
                min="0.05"
                required
                value={alertTargetInput}
                onChange={(e) => setAlertTargetInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 font-mono text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="lg:col-span-2">
              <button
                type="submit"
                disabled={alertSubmitting}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 whitespace-nowrap transition-colors"
              >
                <Bell className="h-3.5 w-3.5" />
                {alertSubmitting ? 'Setting...' : 'Set Alert'}
              </button>
            </div>
          </div>

          {alertError && (
            <p className="mt-2.5 text-xs text-red-400">{alertError}</p>
          )}
        </form>

        {/* Active / Triggered Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-5 py-3">
          <div className="flex items-center gap-1 rounded-lg bg-[#070B14] p-1">
            {(
              [
                { id: 'active', label: `Active (${activeAlertsCount})` },
                { id: 'triggered', label: `Triggered (${triggeredAlertsCount})` },
                { id: 'all', label: `All (${priceAlerts.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAlertFilter(tab.id)}
                className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                  alertFilter === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-slate-400">
            Evaluated against displayed Simulated Dataset prices
          </span>
        </div>

        {/* Alerts Table */}
        {filteredAlerts.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-slate-200">
              {alertFilter === 'active'
                ? 'No active price alerts configured.'
                : alertFilter === 'triggered'
                ? 'No alerts have triggered yet.'
                : 'You have not set any stock price alerts yet.'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Use the form above to set a target price (or click &ldquo;Alert&rdquo; on any watchlist row).
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
                  <th className="py-3 pl-5 pr-3">Stock</th>
                  <th className="px-3 py-3">Condition &amp; Target</th>
                  <th className="px-3 py-3 text-right">Current Ref Price</th>
                  <th className="px-3 py-3 text-right">Gap to Target</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="py-3 pl-3 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredAlerts.map((alert) => {
                  const s = stockMap.get(alert.symbol);
                  const currentPrice = s?.price ?? alert.targetPrice;
                  const diffPct =
                    currentPrice > 0
                      ? ((alert.targetPrice - currentPrice) / currentPrice) * 100
                      : 0;
                  const isTriggered = alert.status === 'triggered';

                  return (
                    <tr key={String(alert.id)} className="hover:bg-slate-800/30">
                      <td className="py-3 pl-5 pr-3">
                        <button
                          type="button"
                          onClick={() => onSelectStock(alert.symbol)}
                          className="font-mono font-semibold text-blue-400 hover:underline"
                        >
                          {alert.symbol}
                        </button>
                        <div className="text-[11px] text-slate-400">
                          {s?.name ?? 'NSE Equity'}
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs tabular-nums text-slate-200">
                        {alert.condition === 'above' ? 'At or Above ≥ ' : 'At or Below ≤ '}
                        <strong>{formatInr(alert.targetPrice)}</strong>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-slate-100">
                        {formatInr(currentPrice)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-slate-400">
                        {isTriggered
                          ? `Hit at ${formatInr(alert.triggeredPrice ?? currentPrice)}`
                          : `${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(2)}%`}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {isTriggered ? (
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Triggered
                          </span>
                        ) : (
                          <span className="font-medium text-blue-400">Monitoring</span>
                        )}
                      </td>
                      <td className="py-3 pl-3 pr-5 text-right">
                        <div className="inline-flex items-center gap-2">
                          {isTriggered && (
                            <button
                              type="button"
                              onClick={() => onResetPriceAlert(alert.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-blue-500 hover:text-blue-300 whitespace-nowrap transition-colors"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Re-arm
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeletePriceAlert(alert.id)}
                            aria-label={`Delete price alert for ${alert.symbol}`}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
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
