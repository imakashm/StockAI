import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import type {
  StockSearchResponse,
  StockSearchResultItem,
} from '../types/market.ts';
import { formatInr, formatSignedPercent } from '../lib/format.ts';
import { parseJsonResponse } from '../lib/http.ts';

type ExchangeFilter = 'ALL' | 'NSE / BSE' | 'NSE' | 'BSE';

interface StockSearchAutocompleteProps {
  onSelectStock: (item: StockSearchResultItem) => void;
  placeholder?: string;
  size?: 'compact' | 'default';
  showExchangeFilter?: boolean;
  initialQuery?: string;
  ariaLabel?: string;
  className?: string;
  selectedSymbolHint?: string;
}

const EXCHANGE_OPTIONS: { id: ExchangeFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'NSE / BSE', label: 'NSE/BSE' },
  { id: 'NSE', label: 'NSE' },
  { id: 'BSE', label: 'BSE' },
];

export function StockSearchAutocomplete({
  onSelectStock,
  placeholder = 'Search 5,500+ NSE & BSE stocks by name, symbol, or BSE code...',
  size = 'default',
  showExchangeFilter = true,
  initialQuery = '',
  ariaLabel = 'Search Indian NSE and BSE stocks',
  className = '',
  selectedSymbolHint,
}: StockSearchAutocompleteProps) {
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [exchange, setExchange] = useState<ExchangeFilter>('ALL');
  const [open, setOpen] = useState(false);

  const [items, setItems] = useState<StockSearchResultItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [masterTotalCount, setMasterTotalCount] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Debounce user typing (280ms)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const fetchResults = useCallback(
    async (
      searchText: string,
      exchangeFilter: ExchangeFilter,
      targetPage: number,
      append: boolean
    ) => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams({
          q: searchText,
          exchange: exchangeFilter,
          page: String(targetPage),
          limit: size === 'compact' ? '10' : '15',
        });

        const res = await fetch(`/api/stocks/search?${params.toString()}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });

        const payload = await parseJsonResponse<StockSearchResponse>(res);
        setItems((prev) => (append ? [...prev, ...payload.items] : payload.items));
        setPage(payload.page);
        setTotal(payload.total);
        setHasMore(payload.hasMore);
        setMasterTotalCount(payload.masterTotalCount);
        if (!append) {
          setActiveIndex(payload.items.length > 0 ? 0 : -1);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to search NSE/BSE stock directory.'
        );
      } finally {
        if (abortRef.current === controller) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [size]
  );

  // Trigger search whenever dropdown is open and query/exchange changes
  useEffect(() => {
    if (!open) return;
    fetchResults(debouncedQuery, exchange, 1, false);
  }, [open, debouncedQuery, exchange, fetchResults]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSelect = (item: StockSearchResultItem) => {
    onSelectStock(item);
    setOpen(false);
    setQuery('');
    setDebouncedQuery('');
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (items.length === 0 ? -1 : (prev + 1) % items.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        items.length === 0 ? -1 : prev <= 0 ? items.length - 1 : prev - 1
      );
    } else if (e.key === 'Enter' && activeIndex >= 0 && items[activeIndex]) {
      e.preventDefault();
      handleSelect(items[activeIndex]);
    }
  };

  const isCompact = size === 'compact';

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative">
        <Search
          className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 ${
            isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'
          }`}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          value={query}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          placeholder={placeholder}
          className={`w-full rounded-lg border border-slate-700/90 bg-[#0D1321] text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none ${
            isCompact ? 'py-1.5 pl-9 pr-8 text-xs' : 'py-2.5 pl-10 pr-9 text-sm'
          }`}
        />

        {loading && open ? (
          <Loader2
            className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-blue-400"
            aria-hidden="true"
          />
        ) : query.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setDebouncedQuery('');
              inputRef.current?.focus();
            }}
            aria-label="Clear stock search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {open && (
        <div
          role="listbox"
          aria-label="Matching NSE and BSE stocks"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-slate-700/90 bg-[#0B1120] shadow-2xl"
        >
          {/* Dropdown Header: Exchange Filter + Universe Count */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#070B14]/80 px-3 py-2">
            {showExchangeFilter ? (
              <div className="flex items-center gap-1">
                {EXCHANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setExchange(opt.id)}
                    className={`rounded px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
                      exchange === opt.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-[11px] font-medium text-slate-400">
                NSE &amp; BSE Master Directory
              </span>
            )}

            <span className="font-mono text-[10px] tabular-nums text-slate-400">
              {masterTotalCount !== null
                ? `${masterTotalCount.toLocaleString('en-IN')} listed equities`
                : 'PostgreSQL Master'}
            </span>
          </div>

          {/* Results Body */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                <span>Searching NSE &amp; BSE equity master...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-2.5 px-4 py-6 text-center">
                <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                <p className="text-xs text-red-300">{error}</p>
                <button
                  type="button"
                  onClick={() => fetchResults(debouncedQuery, exchange, 1, false)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0D1321] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-blue-500 hover:text-blue-300 whitespace-nowrap"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry Search
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs font-medium text-slate-200">
                  No NSE/BSE stocks matched &ldquo;{debouncedQuery}&rdquo;
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Try an NSE symbol (e.g. HAL, MRF, ZOMATO), a 6-digit BSE scrip code (e.g. 500325), or a partial company name.
                </p>
              </div>
            ) : (
              items.map((item, idx) => {
                const highlighted = idx === activeIndex;
                const isSelected = selectedSymbolHint === item.symbol;
                const hasPrice = item.lastPrice !== null;
                const isUp = (item.changePercent ?? 0) >= 0;

                return (
                  <button
                    key={`${item.isin}-${item.symbol}`}
                    type="button"
                    role="option"
                    aria-selected={highlighted}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleSelect(item)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors ${
                      highlighted
                        ? 'bg-blue-600/15'
                        : isSelected
                        ? 'bg-slate-800/50'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-mono text-xs font-semibold text-slate-100">
                          {item.symbol}
                        </span>
                        <span className="font-mono text-[10px] text-blue-300">
                          {item.exchange}
                        </span>
                        {item.bseCode && (
                          <span className="font-mono text-[10px] text-slate-400">
                            BSE {item.bseCode}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-300">
                        {item.companyName}
                      </div>
                    </div>

                    <div className="shrink-0 text-right font-mono tabular-nums">
                      {hasPrice ? (
                        <>
                          <div className="text-xs font-medium text-slate-100">
                            {formatInr(item.lastPrice!)}
                          </div>
                          <div className="flex items-center justify-end gap-1.5 text-[10px]">
                            {item.changePercent !== null && (
                              <span
                                className={
                                  isUp ? 'text-emerald-400' : 'text-red-400'
                                }
                              >
                                {formatSignedPercent(item.changePercent)}
                              </span>
                            )}
                            <span
                              className={
                                item.priceSource === 'Delayed Reference Feed'
                                  ? 'text-blue-400'
                                  : 'text-amber-300'
                              }
                            >
                              {item.priceSource === 'Delayed Reference Feed'
                                ? 'Delayed'
                                : 'Simulated'}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-[10px] text-slate-500">
                          Quote on select
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Pagination Footer */}
          {items.length > 0 && !error && (
            <div className="flex items-center justify-between gap-2 border-t border-slate-800 bg-[#070B14]/90 px-3 py-2">
              <span className="font-mono text-[11px] tabular-nums text-slate-400">
                Showing {items.length} of {total.toLocaleString('en-IN')} matches
              </span>

              {hasMore && (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => fetchResults(debouncedQuery, exchange, page + 1, true)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-[#0D1321] px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-blue-500 hover:text-blue-300 disabled:opacity-50 whitespace-nowrap"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" />
                      Load More
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
