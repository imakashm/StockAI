import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ExternalLink,
  Loader2,
  Newspaper,
  RefreshCw,
  RotateCw,
  Search,
} from 'lucide-react';
import type { NewsArticle, NewsCategory } from '../types/market.ts';
import { isSafeExternalUrl } from '../lib/format.ts';

const NEWS_CATEGORIES: NewsCategory[] = [
  'Indian Stock Market',
  'NSE & BSE Updates',
  'Company News',
  'Corporate Results',
  'RBI & Economic News',
  'Global Market Updates',
];

interface NewsApiPayload {
  category: NewsCategory;
  articles: NewsArticle[];
  retrievedAt: string;
  cached: boolean;
  sourcesUsed?: string[];
  error?: string;
}

interface NewsErrorState {
  message: string;
  statusCode?: number;
  detail?: string;
}

export function MarketNewsView() {
  const [category, setCategory] = useState<NewsCategory>('Indian Stock Market');
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [retrievedAt, setRetrievedAt] = useState<string | null>(null);
  const [sourcesUsed, setSourcesUsed] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<NewsErrorState | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const loadNews = useCallback(
    async (
      targetCat: NewsCategory,
      options: { forceRefresh?: boolean; isRetry?: boolean } = {}
    ) => {
      const { forceRefresh = false, isRetry = false } = options;

      // Cancel any in-flight request when switching categories or retrying
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setRetrying(isRetry);
      setError(null);

      try {
        const url = `/api/news?category=${encodeURIComponent(targetCat)}${
          forceRefresh ? '&refresh=true' : ''
        }`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        // Explicitly verify Content-Type matches application/json before parsing the body
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        const isJsonResponse = contentType.includes('application/json');

        if (!isJsonResponse) {
          const rawPreview = (await response.text()).slice(0, 140).trim();
          const isHtmlFallback =
            rawPreview.toLowerCase().startsWith('<!doctype') ||
            rawPreview.toLowerCase().startsWith('<html');

          throw {
            message: isHtmlFallback
              ? 'Received an HTML page instead of JSON market news data.'
              : `Unexpected response content type (${contentType || 'missing'}).`,
            statusCode: response.status,
            detail:
              'Verify that the StockMind AI backend API server is running and retry the request.',
          } satisfies NewsErrorState;
        }

        let payload: NewsApiPayload;
        try {
          payload = (await response.json()) as NewsApiPayload;
        } catch {
          throw {
            message: 'The market news response contained malformed JSON.',
            statusCode: response.status,
            detail: 'Please click Retry to request a fresh feed snapshot.',
          } satisfies NewsErrorState;
        }

        if (!response.ok) {
          throw {
            message:
              typeof payload?.error === 'string' && payload.error.trim().length > 0
                ? payload.error
                : `Market news service returned HTTP ${response.status}.`,
            statusCode: response.status,
            detail:
              'Upstream financial publishers may be temporarily unreachable. Use Retry to try again.',
          } satisfies NewsErrorState;
        }

        const nextArticles = Array.isArray(payload.articles) ? payload.articles : [];
        setArticles(nextArticles);
        setRetrievedAt(payload.retrievedAt ?? null);
        setSourcesUsed(Array.isArray(payload.sourcesUsed) ? payload.sourcesUsed : []);
        setRetryCount(0);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }

        if (
          typeof err === 'object' &&
          err !== null &&
          'message' in err &&
          typeof (err as NewsErrorState).message === 'string'
        ) {
          setError(err as NewsErrorState);
        } else {
          setError({
            message: 'Unable to reach the market news service.',
            detail:
              'Check your network connection and click Retry to reload verified financial headlines.',
          });
        }
        setArticles([]);
        setSourcesUsed([]);
      } finally {
        if (abortRef.current === controller) {
          setLoading(false);
          setRetrying(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    setRetryCount(0);
    loadNews(category, { forceRefresh: false });
    return () => {
      abortRef.current?.abort();
    };
  }, [category, loadNews]);

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
    loadNews(category, { forceRefresh: true, isRetry: true });
  };

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) =>
        a.headline.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.source.toLowerCase().includes(q)
    );
  }, [articles, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-800/80 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            Indian Financial Market News
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Live headlines from verified Indian and global financial publishers across NSE, BSE, corporate results, RBI releases, and macro markets.
          </p>
          {sourcesUsed.length > 0 && !loading && !error && (
            <p className="mt-1 text-[11px] text-slate-500">
              Verified feeds: {sourcesUsed.join(' · ')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {retrievedAt && !error && (
            <span className="font-mono text-xs text-slate-400 tabular-nums whitespace-nowrap">
              Updated{' '}
              {new Date(retrievedAt).toLocaleTimeString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              IST
            </span>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={() => loadNews(category, { forceRefresh: true })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0D1321] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-blue-500 hover:text-blue-300 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Feed
          </button>
        </div>
      </div>

      {/* Category Filter Tabs + Local Search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label="Market news categories"
          className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-[#0D1321] p-1"
        >
          {NEWS_CATEGORIES.map((cat) => (
            <button
              key={cat}
              role="tab"
              aria-selected={category === cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                category === cat
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter headlines..."
            aria-label="Filter market news headlines"
            className="w-full rounded-lg border border-slate-700 bg-[#0D1321] py-1.5 pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Loading Spinner + Skeleton State */}
      {loading ? (
        <div className="space-y-4" role="status" aria-live="polite">
          <div className="flex items-center justify-center gap-2.5 rounded-xl border border-slate-800 bg-[#0D1321] py-5 px-4">
            <Loader2
              className="h-5 w-5 animate-spin text-blue-400 shrink-0"
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-slate-200">
              {retrying
                ? `Retrying ${category} news feed...`
                : `Loading verified ${category} headlines...`}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-xl border border-slate-800 bg-[#0D1321]"
              />
            ))}
          </div>
        </div>
      ) : error ? (
        /* Robust Error State with Specific Retry Mechanism */
        <div
          role="alert"
          className="rounded-xl border border-red-900/60 bg-[#0D1321] px-6 py-8 text-center"
        >
          <AlertCircle className="mx-auto h-7 w-7 text-red-400" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-slate-100">
            Unable to Load {category} News
          </h2>
          <p className="mx-auto mt-1.5 max-w-lg text-sm text-red-300">{error.message}</p>
          {error.detail && (
            <p className="mx-auto mt-1 max-w-lg text-xs text-slate-400">
              {error.detail}
            </p>
          )}
          <div className="mt-2 flex items-center justify-center gap-3 font-mono text-[11px] text-slate-500">
            {error.statusCode !== undefined && <span>HTTP {error.statusCode}</span>}
            {retryCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>Retry attempts: {retryCount}</span>
              </>
            )}
          </div>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors whitespace-nowrap"
            >
              <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </button>
          </div>
        </div>
      ) : filteredArticles.length === 0 ? (
        /* User-Friendly Empty State */
        <div className="rounded-xl border border-slate-800 bg-[#0D1321] px-6 py-12 text-center">
          <Newspaper className="mx-auto h-7 w-7 text-slate-500" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-slate-100">
            {searchQuery.trim()
              ? `No headlines match "${searchQuery.trim()}"`
              : `No ${category} updates available right now`}
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-400">
            {searchQuery.trim()
              ? 'Try a broader keyword or clear your search filter to view all verified stories in this category.'
              : 'Verified financial publishers did not return any recent articles for this category. Refresh the feed to check again.'}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            {searchQuery.trim() ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="rounded-lg border border-slate-700 bg-[#070B14] px-4 py-2 text-xs font-medium text-slate-200 hover:border-blue-500 hover:text-blue-300 transition-colors whitespace-nowrap"
              >
                Clear Search Filter
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors whitespace-nowrap"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Refresh Feed
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Verified Articles Grid */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredArticles.map((article) => (
            <article
              key={article.id}
              className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0D1321] p-5 transition-colors hover:border-slate-700"
            >
              <div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                  <span className="font-medium text-blue-400">{article.source}</span>
                  <span aria-hidden="true">·</span>
                  <span>{article.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{article.publishedLabel}</span>
                </div>

                <h2 className="mt-2 text-base font-semibold leading-snug text-slate-100">
                  {article.headline}
                </h2>

                <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
                  {article.summary}
                </p>
              </div>

              <div className="mt-4 border-t border-slate-800/80 pt-3">
                {isSafeExternalUrl(article.url) ? (
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:underline"
                  >
                    Read Original Article
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">Source URL unavailable</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
