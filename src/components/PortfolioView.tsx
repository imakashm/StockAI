import { useMemo, useState } from 'react';
import { LogIn, Plus, Trash2 } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { PortfolioHoldingRecord, StockSummary } from '../types/market.ts';
import {
  formatInr,
  formatSignedNumber,
  formatSignedPercent,
} from '../lib/format.ts';

interface PortfolioViewProps {
  stocks: StockSummary[];
  holdings: PortfolioHoldingRecord[];
  onAddHolding: (input: {
    symbol: string;
    quantity: number;
    purchasePrice: number;
    purchaseDate: string;
    notes?: string;
  }) => Promise<void>;
  onDeleteHolding: (id: number | string) => Promise<void>;
  onSelectStock: (symbol: string) => void;
  isAuthenticated: boolean;
  onSignIn: () => void;
  loading: boolean;
}

const ALLOCATION_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#94A3B8',
];

export function PortfolioView({
  stocks,
  holdings,
  onAddHolding,
  onDeleteHolding,
  onSelectStock,
  isAuthenticated,
  onSignIn,
  loading,
}: PortfolioViewProps) {
  const [symbol, setSymbol] = useState(stocks[0]?.symbol || 'RELIANCE');
  const [quantity, setQuantity] = useState('10');
  const [purchasePrice, setPurchasePrice] = useState(
    stocks[0] ? String(Math.round(stocks[0].price * 0.96)) : '1250'
  );
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stockMap = useMemo(() => {
    const map = new Map<string, StockSummary>();
    stocks.forEach((s) => map.set(s.symbol, s));
    return map;
  }, [stocks]);

  const enriched = useMemo(() => {
    const rows = holdings.map((h) => {
      const refStock = stockMap.get(h.symbol);
      const currentPrice = refStock?.price ?? h.purchasePrice;
      const investedValue = h.quantity * h.purchasePrice;
      const currentValue = h.quantity * currentPrice;
      const pnl = currentValue - investedValue;
      const returnPct = investedValue > 0 ? (pnl / investedValue) * 100 : 0;
      return {
        ...h,
        stockName: refStock?.name ?? h.symbol,
        sector: refStock?.sector ?? 'NSE Equity',
        currentPrice,
        investedValue,
        currentValue,
        pnl,
        returnPct,
      };
    });

    const totalInvested = rows.reduce((s, r) => s + r.investedValue, 0);
    const totalCurrent = rows.reduce((s, r) => s + r.currentValue, 0);
    const totalPnl = totalCurrent - totalInvested;
    const totalReturnPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    // Group allocation by symbol for the donut chart
    const allocMap = new Map<string, number>();
    rows.forEach((r) => {
      allocMap.set(r.symbol, (allocMap.get(r.symbol) ?? 0) + r.currentValue);
    });
    const allocation = Array.from(allocMap.entries())
      .map(([sym, value]) => ({
        symbol: sym,
        value: Number(value.toFixed(2)),
        percent: totalCurrent > 0 ? Number(((value / totalCurrent) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      rows: rows.map((r) => ({
        ...r,
        allocationPct:
          totalCurrent > 0 ? Number(((r.currentValue / totalCurrent) * 100).toFixed(1)) : 0,
      })),
      totalInvested,
      totalCurrent,
      totalPnl,
      totalReturnPct,
      allocation,
    };
  }, [holdings, stockMap]);

  const handleSymbolChange = (nextSym: string) => {
    setSymbol(nextSym);
    const s = stockMap.get(nextSym);
    if (s) {
      setPurchasePrice(s.price.toFixed(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = Number(quantity);
    const priceNum = Number(purchasePrice);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError('Enter a valid positive share quantity.');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setError('Enter a valid positive purchase price in INR.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
      setError('Select a valid purchase date.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onAddHolding({
        symbol,
        quantity: qtyNum,
        purchasePrice: priceNum,
        purchaseDate,
        notes: notes.trim() || undefined,
      });
      setNotes('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save holding.');
    } finally {
      setSubmitting(false);
    }
  };

  const pnlPositive = enriched.totalPnl >= 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-800/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            Portfolio Tracker
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Track manual NSE/BSE equity lots, cost basis, unrealised P&amp;L, and weight allocation.
          </p>
        </div>

        {!isAuthenticated && (
          <button
            type="button"
            onClick={onSignIn}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/50 bg-blue-600/15 px-3.5 py-2 text-xs font-medium text-blue-200 hover:bg-blue-600/25 whitespace-nowrap self-start sm:self-auto transition-colors"
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign in with Google to save portfolio
          </button>
        )}
      </div>

      {/* Clear Distinction Banner */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1321] px-4 py-3 text-xs text-slate-300">
        <span className="font-semibold text-amber-300">Valuation Basis Notice: </span>
        Purchase quantities, prices, and dates are{' '}
        <strong className="text-slate-100">User-Entered Records</strong>. Current values and
        unrealised P&amp;L are computed against StockMind AI&apos;s{' '}
        <strong className="text-slate-100">Simulated Historical Dataset</strong> reference prices
        (not verified live NSE/BSE broker feeds).
      </div>

      {/* KPI Strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-[#0D1321] p-4">
          <div className="text-xs text-slate-400">Total Invested (User-Entered)</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-50">
            {formatInr(enriched.totalInvested)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Across {enriched.rows.length} logged {enriched.rows.length === 1 ? 'lot' : 'lots'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1321] p-4">
          <div className="text-xs text-slate-400">Current Value (Reference Prices)</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-50">
            {formatInr(enriched.totalCurrent)}
          </div>
          <div className="mt-1 text-[11px] text-amber-300/90">
            Simulated Historical Dataset
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1321] p-4">
          <div className="text-xs text-slate-400">Unrealised Profit / Loss</div>
          <div
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
              pnlPositive ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {formatSignedNumber(enriched.totalPnl, '₹')}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {pnlPositive ? 'Net unrealised gain' : 'Net unrealised drawdown'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1321] p-4">
          <div className="text-xs text-slate-400">Portfolio Return (%)</div>
          <div
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
              pnlPositive ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {formatSignedPercent(enriched.totalReturnPct)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Simple cost-basis return
          </div>
        </div>
      </section>

      {/* Manual Entry Form + Allocation Chart */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-slate-800 bg-[#0D1321] p-5 lg:col-span-7">
          <h2 className="text-base font-semibold text-slate-100">
            Add Portfolio Holding (Manual Entry)
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Enter your execution details to track allocation and unrealised P&amp;L.
          </p>

          {error && (
            <div className="mt-3 rounded-lg border border-red-900/60 bg-red-950/20 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="pf-symbol"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Stock Symbol
              </label>
              <select
                id="pf-symbol"
                value={symbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 font-mono text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                {stocks.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} — {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="pf-qty"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Quantity (Shares)
              </label>
              <input
                id="pf-qty"
                type="number"
                step="any"
                min="0.01"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 font-mono text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="pf-price"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Purchase Price (₹)
              </label>
              <input
                id="pf-price"
                type="number"
                step="0.05"
                min="0.05"
                required
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 font-mono text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="pf-date"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Purchase Date
              </label>
              <input
                id="pf-date"
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 font-mono text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label
                  htmlFor="pf-notes"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Notes (Optional)
                </label>
                <input
                  id="pf-notes"
                  type="text"
                  maxLength={200}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Long-term core SIP lot"
                  className="w-full rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 whitespace-nowrap transition-colors"
              >
                <Plus className="h-4 w-4" />
                {submitting ? 'Saving...' : 'Add Position'}
              </button>
            </div>
          </form>
        </section>

        {/* Stock Allocation Donut */}
        <section className="rounded-xl border border-slate-800 bg-[#0D1321] p-5 lg:col-span-5 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Individual Stock Allocation
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Share of current reference portfolio valuation by symbol
            </p>
          </div>

          {enriched.allocation.length === 0 ? (
            <div className="py-14 text-center text-xs text-slate-400">
              Add holdings on the left to inspect portfolio allocation weights.
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-center">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={enriched.allocation}
                      dataKey="value"
                      nameKey="symbol"
                      cx="50%"
                      cy="50%"
                      innerRadius={44}
                      outerRadius={70}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {enriched.allocation.map((entry, idx) => (
                        <Cell
                          key={entry.symbol}
                          fill={ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0B1120',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(val: unknown) => [formatInr(Number(val)), 'Value']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {enriched.allocation.map((item, idx) => (
                  <div
                    key={item.symbol}
                    className="flex items-center justify-between text-xs font-mono tabular-nums"
                  >
                    <span className="inline-flex items-center gap-2 text-slate-200">
                      <span
                        className="h-2.5 w-2.5 rounded-sm shrink-0"
                        style={{
                          backgroundColor:
                            ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length],
                        }}
                      />
                      {item.symbol}
                    </span>
                    <span className="text-slate-400">{item.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Holdings Table */}
      <section className="rounded-xl border border-slate-800 bg-[#0D1321]">
        <div className="border-b border-slate-800 p-4">
          <h2 className="text-base font-semibold text-slate-100">
            Logged Equity Positions
          </h2>
        </div>

        {loading ? (
          <div className="p-6">
            <div className="h-24 animate-pulse rounded-lg bg-slate-800/40" />
          </div>
        ) : enriched.rows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-200">
              No portfolio positions entered yet.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Use the manual entry form above to record your first NSE/BSE stock lot.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
                  <th className="py-3 pl-4 pr-3">Symbol &amp; Date</th>
                  <th className="px-3 py-3 text-right">Qty</th>
                  <th className="px-3 py-3 text-right">Buy Price (Entered)</th>
                  <th className="px-3 py-3 text-right">Ref Price (Sim)</th>
                  <th className="px-3 py-3 text-right">Invested</th>
                  <th className="px-3 py-3 text-right">Current Value</th>
                  <th className="px-3 py-3 text-right">Unrealised P&amp;L</th>
                  <th className="px-3 py-3 text-right">Weight</th>
                  <th className="py-3 pl-3 pr-4 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {enriched.rows.map((row) => {
                  const up = row.pnl >= 0;
                  return (
                    <tr key={String(row.id)} className="hover:bg-slate-800/30">
                      <td className="py-3 pl-4 pr-3">
                        <button
                          type="button"
                          onClick={() => onSelectStock(row.symbol)}
                          className="font-mono font-semibold text-blue-400 hover:underline"
                        >
                          {row.symbol}
                        </button>
                        <div className="text-[11px] font-mono text-slate-400">
                          Bought {row.purchaseDate}
                          {row.notes ? ` · ${row.notes}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-200">
                        {row.quantity}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-300">
                        {formatInr(row.purchasePrice)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-100">
                        {formatInr(row.currentPrice)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-300">
                        {formatInr(row.investedValue)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-100">
                        {formatInr(row.currentValue)}
                      </td>
                      <td
                        className={`px-3 py-3 text-right font-mono text-xs tabular-nums ${
                          up ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        <div className="font-medium">
                          {formatSignedNumber(row.pnl, '₹')}
                        </div>
                        <div className="text-[11px] opacity-85">
                          {formatSignedPercent(row.returnPct)}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-slate-300">
                        {row.allocationPct}%
                      </td>
                      <td className="py-3 pl-3 pr-4 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteHolding(row.id)}
                          aria-label={`Delete ${row.symbol} holding`}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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
