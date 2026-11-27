import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Briefcase,
  History,
  Layers,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  MessageSquareText,
  Newspaper,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { StockAnalysisView } from './components/StockAnalysisView.tsx';
import { TechnicalAnalysisView } from './components/TechnicalAnalysisView.tsx';
import { PredictionEngineView } from './components/PredictionEngineView.tsx';
import { AnalystChatView } from './components/AnalystChatView.tsx';
import { MarketNewsView } from './components/MarketNewsView.tsx';
import { WatchlistView } from './components/WatchlistView.tsx';
import { PortfolioView } from './components/PortfolioView.tsx';
import { PredictionHistoryView } from './components/PredictionHistoryView.tsx';
import { ArchitectureView } from './components/ArchitectureView.tsx';
import { DisclaimerBanner } from './components/DisclaimerBanner.tsx';
import { ToastContainer } from './components/ToastContainer.tsx';
import { StockSearchAutocomplete } from './components/StockSearchAutocomplete.tsx';
import type {
  MarketIndex,
  PortfolioHoldingRecord,
  PredictionLogRecord,
  PredictionResult,
  PriceAlertCondition,
  PriceAlertRecord,
  StockSummary,
  ToastNotification,
  WatchlistRecord,
} from './types/market.ts';
import { formatInr } from './lib/format.ts';
import { parseJsonResponse } from './lib/http.ts';

type NavSection =
  | 'dashboard'
  | 'analysis'
  | 'technicals'
  | 'predictions'
  | 'chat'
  | 'news'
  | 'watchlist'
  | 'portfolio'
  | 'history'
  | 'architecture';

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

const NAV_ITEMS: {
  id: NavSection;
  label: string;
  icon: typeof LayoutDashboard;
  group: 'Market Intelligence' | 'AI & Research' | 'Personal Desk' | 'Platform';
}[] = [
  { id: 'dashboard', label: 'Market Overview', icon: LayoutDashboard, group: 'Market Intelligence' },
  { id: 'analysis', label: 'Stock Analysis', icon: BarChart3, group: 'Market Intelligence' },
  { id: 'technicals', label: 'Technical Analysis', icon: Activity, group: 'Market Intelligence' },
  { id: 'predictions', label: 'AI Predictions', icon: Sparkles, group: 'AI & Research' },
  { id: 'chat', label: 'AI Stock Analyst', icon: MessageSquareText, group: 'AI & Research' },
  { id: 'news', label: 'Market News', icon: Newspaper, group: 'AI & Research' },
  { id: 'watchlist', label: 'Watchlists', icon: Star, group: 'Personal Desk' },
  { id: 'portfolio', label: 'Portfolio Tracker', icon: Briefcase, group: 'Personal Desk' },
  { id: 'history', label: 'Prediction History', icon: History, group: 'Personal Desk' },
  { id: 'architecture', label: 'Architecture & API', icon: Layers, group: 'Platform' },
];

const DEFAULT_GUEST_WATCHLISTS: WatchlistRecord[] = [
  {
    id: 'guest-core',
    name: 'Core NSE Watchlist',
    symbols: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK'],
  },
];

function StockMindWorkspace() {
  const { user, loading: authLoading, authError, signInWithGoogle, signOut, getIdToken } =
    useAuth();

  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('RELIANCE');

  // Market overview state
  const [overview, setOverview] = useState<MarketOverviewPayload | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // User data (synced to Cloud SQL when signed in, guest session otherwise)
  const [watchlists, setWatchlists] = useState<WatchlistRecord[]>(DEFAULT_GUEST_WATCHLISTS);
  const [activeWatchlistId, setActiveWatchlistId] = useState<number | string>('guest-core');
  const [portfolio, setPortfolio] = useState<PortfolioHoldingRecord[]>([]);
  const [predictionLogs, setPredictionLogs] = useState<PredictionLogRecord[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlertRecord[]>([]);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [autoTickEnabled, setAutoTickEnabled] = useState(false);
  const [userDataLoading, setUserDataLoading] = useState(false);

  const pushToast = useCallback(
    (toast: Omit<ToastNotification, 'id' | 'timestamp'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const timestamp = new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setToasts((prev) => [{ ...toast, id, timestamp: `${timestamp} IST` }, ...prev].slice(0, 5));
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 7500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await fetch('/api/market/overview', {
        headers: { Accept: 'application/json' },
      });
      const data = await parseJsonResponse<MarketOverviewPayload>(res);
      setOverview(data);
    } catch (err: unknown) {
      setOverviewError(
        err instanceof Error ? err.message : 'Unable to reach market overview service.'
      );
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const authFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      const token = await getIdToken();
      if (!token) throw new Error('Please sign in with Google to sync your account.');
      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${token}`);
      headers.set('Accept', 'application/json');
      if (init?.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      const res = await fetch(url, { ...init, headers });
      return parseJsonResponse<Record<string, unknown>>(res);
    },
    [getIdToken]
  );

  // Synchronize Watchlists, Portfolio, Prediction History, and Price Alerts from Cloud SQL on sign-in
  useEffect(() => {
    if (!user) {
      setWatchlists(DEFAULT_GUEST_WATCHLISTS);
      setActiveWatchlistId('guest-core');
      return;
    }

    let cancelled = false;
    setUserDataLoading(true);

    Promise.all([
      authFetch('/api/watchlists'),
      authFetch('/api/portfolio'),
      authFetch('/api/predictions/history'),
      authFetch('/api/alerts'),
    ])
      .then(([wlData, pfData, histData, alertData]) => {
        if (cancelled) return;
        const nextLists = (wlData.watchlists ?? []) as WatchlistRecord[];
        setWatchlists(nextLists);
        if (nextLists.length > 0) {
          setActiveWatchlistId(nextLists[0].id);
        }
        setPortfolio((pfData.holdings ?? []) as PortfolioHoldingRecord[]);
        setPredictionLogs((histData.logs ?? []) as PredictionLogRecord[]);
        setPriceAlerts((alertData.alerts ?? []) as PriceAlertRecord[]);
      })
      .catch((err) => {
        console.error('Failed to sync persisted user workspace:', err);
      })
      .finally(() => {
        if (!cancelled) setUserDataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, authFetch]);

  const stocks = overview?.stocks ?? [];

  const watchedSymbols = useMemo(() => {
    const active =
      watchlists.find((w) => w.id === activeWatchlistId) ?? watchlists[0];
    return new Set(active?.symbols ?? []);
  }, [watchlists, activeWatchlistId]);

  // --- Watchlist Handlers ---
  const handleCreateWatchlist = async (name: string) => {
    if (user) {
      const data = await authFetch('/api/watchlists', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      const created = data.watchlist as WatchlistRecord;
      setWatchlists((prev) => [...prev, created]);
      setActiveWatchlistId(created.id);
    } else {
      const created: WatchlistRecord = {
        id: `guest-${Date.now()}`,
        name,
        symbols: [],
      };
      setWatchlists((prev) => [...prev, created]);
      setActiveWatchlistId(created.id);
    }
  };

  const handleDeleteWatchlist = async (id: number | string) => {
    if (user) {
      await authFetch(`/api/watchlists/${id}`, { method: 'DELETE' });
    }
    setWatchlists((prev) => {
      const next = prev.filter((w) => w.id !== id);
      if (activeWatchlistId === id && next.length > 0) {
        setActiveWatchlistId(next[0].id);
      }
      return next;
    });
  };

  const handleAddSymbol = async (watchlistId: number | string, symbol: string) => {
    if (user) {
      await authFetch(`/api/watchlists/${watchlistId}/items`, {
        method: 'POST',
        body: JSON.stringify({ symbol }),
      });
    }
    setWatchlists((prev) =>
      prev.map((w) =>
        w.id === watchlistId && !w.symbols.includes(symbol)
          ? { ...w, symbols: [...w.symbols, symbol] }
          : w
      )
    );
  };

  const handleRemoveSymbol = async (watchlistId: number | string, symbol: string) => {
    if (user) {
      await authFetch(`/api/watchlists/${watchlistId}/items/${encodeURIComponent(symbol)}`, {
        method: 'DELETE',
      });
    }
    setWatchlists((prev) =>
      prev.map((w) =>
        w.id === watchlistId
          ? { ...w, symbols: w.symbols.filter((s) => s !== symbol) }
          : w
      )
    );
  };

  const handleToggleWatchlist = async (symbol: string) => {
    const active =
      watchlists.find((w) => w.id === activeWatchlistId) ?? watchlists[0];
    if (!active) return;
    if (active.symbols.includes(symbol)) {
      await handleRemoveSymbol(active.id, symbol);
    } else {
      await handleAddSymbol(active.id, symbol);
    }
  };

  // --- Portfolio Handlers ---
  const handleAddHolding = async (input: {
    symbol: string;
    quantity: number;
    purchasePrice: number;
    purchaseDate: string;
    notes?: string;
  }) => {
    if (user) {
      const data = await authFetch('/api/portfolio', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setPortfolio((prev) => [data.holding as PortfolioHoldingRecord, ...prev]);
    } else {
      const created: PortfolioHoldingRecord = {
        id: `guest-pf-${Date.now()}`,
        symbol: input.symbol,
        quantity: input.quantity,
        purchasePrice: input.purchasePrice,
        purchaseDate: input.purchaseDate,
        notes: input.notes ?? null,
      };
      setPortfolio((prev) => [created, ...prev]);
    }
  };

  const handleDeleteHolding = async (id: number | string) => {
    if (user) {
      await authFetch(`/api/portfolio/${id}`, { method: 'DELETE' });
    }
    setPortfolio((prev) => prev.filter((h) => h.id !== id));
  };

  // --- Prediction History Handlers ---
  const handleSavePrediction = async (res: PredictionResult) => {
    if (user) {
      const data = await authFetch('/api/predictions/history', {
        method: 'POST',
        body: JSON.stringify({
          symbol: res.symbol,
          timeframe: res.timeframe,
          predictedDirection: res.dominantTrend,
          bullishProb: res.probabilities.bullish,
          bearishProb: res.probabilities.bearish,
          sidewaysProb: res.probabilities.sideways,
          confidence: res.confidence,
          referencePrice: res.referencePrice,
          targetDate: res.targetDate,
          modelVersion: res.modelVersion,
          dataMode: res.dataMode,
          reasoningSummary: res.reasoning.slice(0, 600),
        }),
      });
      setPredictionLogs((prev) => [data.log as PredictionLogRecord, ...prev]);
    } else {
      const localLog: PredictionLogRecord = {
        id: `guest-pred-${Date.now()}`,
        symbol: res.symbol,
        timeframe: res.timeframe,
        predictedDirection: res.dominantTrend,
        bullishProb: res.probabilities.bullish,
        bearishProb: res.probabilities.bearish,
        sidewaysProb: res.probabilities.sideways,
        confidence: res.confidence,
        referencePrice: res.referencePrice,
        targetDate: res.targetDate,
        actualPrice: null,
        actualReturnPct: null,
        evaluationStatus: 'Pending Evaluation',
        modelVersion: res.modelVersion,
        dataMode: res.dataMode,
        reasoningSummary: res.reasoning.slice(0, 600),
        createdAt: new Date().toISOString(),
      };
      setPredictionLogs((prev) => [localLog, ...prev]);
    }
  };

  const handleEvaluateLog = async (logId: number | string, actualPrice: number) => {
    if (user) {
      const data = await authFetch(`/api/predictions/history/${logId}/evaluate`, {
        method: 'PATCH',
        body: JSON.stringify({ actualPrice }),
      });
      const updated = data.log as PredictionLogRecord;
      setPredictionLogs((prev) => prev.map((l) => (l.id === logId ? updated : l)));
    } else {
      setPredictionLogs((prev) =>
        prev.map((l) => {
          if (l.id !== logId) return l;
          const actualReturnPct = Number(
            (((actualPrice - l.referencePrice) / l.referencePrice) * 100).toFixed(2)
          );
          let aligned = false;
          if (l.predictedDirection === 'Bullish') aligned = actualReturnPct >= 0.75;
          else if (l.predictedDirection === 'Bearish') aligned = actualReturnPct <= -0.75;
          else aligned = Math.abs(actualReturnPct) < 1.5;

          return {
            ...l,
            actualPrice,
            actualReturnPct,
            evaluationStatus: aligned ? 'Evaluated - Aligned' : 'Evaluated - Diverged',
          };
        })
      );
    }
  };

  // --- Price Alerts Evaluation & CRUD ---
  const evaluateAlertsAgainstStocks = useCallback(
    (currentStocks: StockSummary[], currentAlerts: PriceAlertRecord[]) => {
      if (currentStocks.length === 0 || currentAlerts.length === 0) return;
      const priceMap = new Map<string, number>();
      currentStocks.forEach((s) => priceMap.set(s.symbol, s.price));

      const newlyTriggered: { alert: PriceAlertRecord; hitPrice: number }[] = [];

      for (const alert of currentAlerts) {
        if (alert.status !== 'active') continue;
        const currentPrice = priceMap.get(alert.symbol);
        if (currentPrice === undefined) continue;

        const crossed =
          (alert.condition === 'above' && currentPrice >= alert.targetPrice) ||
          (alert.condition === 'below' && currentPrice <= alert.targetPrice);

        if (crossed) {
          newlyTriggered.push({ alert, hitPrice: currentPrice });
        }
      }

      if (newlyTriggered.length === 0) return;

      const hitMap = new Map<number | string, number>();
      newlyTriggered.forEach(({ alert, hitPrice }) => hitMap.set(alert.id, hitPrice));
      const nowIso = new Date().toISOString();

      setPriceAlerts((prev) =>
        prev.map((a) => {
          const hitPrice = hitMap.get(a.id);
          if (hitPrice === undefined) return a;
          return {
            ...a,
            status: 'triggered',
            triggeredPrice: hitPrice,
            triggeredAt: nowIso,
          };
        })
      );

      newlyTriggered.forEach(({ alert, hitPrice }) => {
        pushToast({
          title: `Price Alert Hit: ${alert.symbol}`,
          message: `${alert.symbol} reached ${formatInr(hitPrice)} (${
            alert.condition === 'above' ? '≥' : '≤'
          } target ${formatInr(alert.targetPrice)}).`,
          symbol: alert.symbol,
          tone: alert.condition === 'above' ? 'bullish' : 'bearish',
        });

        if (user && typeof alert.id === 'number') {
          authFetch(`/api/alerts/${alert.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              status: 'triggered',
              triggeredPrice: hitPrice,
            }),
          }).catch((err) => {
            console.error('Failed to persist triggered alert status:', err);
          });
        }
      });
    },
    [pushToast, user, authFetch]
  );

  // Re-evaluate active price alerts whenever displayed stock prices change
  useEffect(() => {
    if (!overview) return;
    evaluateAlertsAgainstStocks(overview.stocks, priceAlerts);
  }, [overview, priceAlerts, evaluateAlertsAgainstStocks]);

  const handleSimulatePriceTick = useCallback(() => {
    setOverview((prev) => {
      if (!prev) return prev;
      const activeBySymbol = new Map<string, PriceAlertRecord[]>();
      priceAlerts
        .filter((a) => a.status === 'active')
        .forEach((a) => {
          const list = activeBySymbol.get(a.symbol) ?? [];
          list.push(a);
          activeBySymbol.set(a.symbol, list);
        });

      const updatedStocks = prev.stocks.map((s) => {
        // Apply realistic +/- 0.4% to 1.4% simulated price tick
        let pctMove = (Math.random() - 0.5) * 0.022;
        // Gently bias slightly toward near-range active alerts so users can test crossings smoothly
        const symAlerts = activeBySymbol.get(s.symbol);
        if (symAlerts && symAlerts.length > 0) {
          const nearest = symAlerts[0];
          const gapRatio = (nearest.targetPrice - s.price) / Math.max(s.price, 1);
          if (Math.abs(gapRatio) <= 0.03) {
            pctMove = gapRatio + (nearest.condition === 'above' ? 0.002 : -0.002);
          }
        }
        const nextPrice = Number(Math.max(1, s.price * (1 + pctMove)).toFixed(2));
        const nextChange = Number((nextPrice - s.prevClose).toFixed(2));
        const nextChangePct = Number(((nextChange / s.prevClose) * 100).toFixed(2));
        return {
          ...s,
          price: nextPrice,
          change: nextChange,
          changePercent: nextChangePct,
          dayHigh: Math.max(s.dayHigh, nextPrice),
          dayLow: Math.min(s.dayLow, nextPrice),
        };
      });

      const topGainers = [...updatedStocks]
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, 6);
      const topLosers = [...updatedStocks]
        .sort((a, b) => a.changePercent - b.changePercent)
        .slice(0, 6);
      const mostActive = [...updatedStocks]
        .sort((a, b) => b.volume * b.price - a.volume * a.price)
        .slice(0, 6);

      return {
        ...prev,
        stocks: updatedStocks,
        topGainers,
        topLosers,
        mostActive,
      };
    });
  }, [priceAlerts]);

  useEffect(() => {
    if (!autoTickEnabled) return;
    const intervalId = window.setInterval(() => {
      handleSimulatePriceTick();
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [autoTickEnabled, handleSimulatePriceTick]);

  const handleCreatePriceAlert = async (input: {
    symbol: string;
    condition: PriceAlertCondition;
    targetPrice: number;
  }) => {
    const currentStock = stocks.find((s) => s.symbol === input.symbol);
    const currentPrice = currentStock?.price;
    const alreadyMet =
      currentPrice !== undefined &&
      ((input.condition === 'above' && currentPrice >= input.targetPrice) ||
        (input.condition === 'below' && currentPrice <= input.targetPrice));

    if (user) {
      const data = await authFetch('/api/alerts', {
        method: 'POST',
        body: JSON.stringify({
          symbol: input.symbol,
          condition: input.condition,
          targetPrice: input.targetPrice,
          status: alreadyMet ? 'triggered' : 'active',
          triggeredPrice: alreadyMet ? currentPrice : null,
        }),
      });
      const created = data.alert as PriceAlertRecord;
      setPriceAlerts((prev) => [created, ...prev]);
    } else {
      const localAlert: PriceAlertRecord = {
        id: `guest-alert-${Date.now()}`,
        symbol: input.symbol,
        condition: input.condition,
        targetPrice: input.targetPrice,
        status: alreadyMet ? 'triggered' : 'active',
        triggeredPrice: alreadyMet && currentPrice !== undefined ? currentPrice : null,
        triggeredAt: alreadyMet ? new Date().toISOString() : null,
        createdAt: new Date().toISOString(),
      };
      setPriceAlerts((prev) => [localAlert, ...prev]);
    }

    if (alreadyMet && currentPrice !== undefined) {
      pushToast({
        title: `Price Alert Hit: ${input.symbol}`,
        message: `${input.symbol} is already at ${formatInr(currentPrice)} (${
          input.condition === 'above' ? '≥' : '≤'
        } target ${formatInr(input.targetPrice)}).`,
        symbol: input.symbol,
        tone: input.condition === 'above' ? 'bullish' : 'bearish',
      });
    } else {
      pushToast({
        title: `Alert Active: ${input.symbol}`,
        message: `Monitoring ${input.symbol} for price ${
          input.condition === 'above' ? 'at or above' : 'at or below'
        } ${formatInr(input.targetPrice)}.`,
        symbol: input.symbol,
        tone: 'info',
      });
    }
  };

  const handleDeletePriceAlert = async (id: number | string) => {
    if (user && typeof id === 'number') {
      await authFetch(`/api/alerts/${id}`, { method: 'DELETE' });
    }
    setPriceAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleResetPriceAlert = async (id: number | string) => {
    if (user && typeof id === 'number') {
      const data = await authFetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' }),
      });
      const updated = data.alert as PriceAlertRecord;
      setPriceAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } else {
      setPriceAlerts((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, status: 'active', triggeredPrice: null, triggeredAt: null }
            : a
        )
      );
    }
  };

  const navigateToStock = (sym: string, target: NavSection = 'analysis') => {
    setSelectedSymbol(sym);
    setActiveNav(target);
    setMobileMenuOpen(false);
  };

  const activeNavMeta = NAV_ITEMS.find((n) => n.id === activeNav) ?? NAV_ITEMS[0];
  const groups = ['Market Intelligence', 'AI & Research', 'Personal Desk', 'Platform'] as const;

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#0B1120] border-r border-slate-800/90">
      <div className="flex h-15 items-center justify-between border-b border-slate-800/90 px-5">
        <button
          type="button"
          onClick={() => {
            setActiveNav('dashboard');
            setMobileMenuOpen(false);
          }}
          className="text-left text-lg font-bold tracking-tight text-slate-50 whitespace-nowrap"
        >
          StockMind <span className="text-emerald-400">AI</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation menu"
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Primary navigation">
        {groups.map((group) => (
          <div key={group}>
            <div className="px-3 pb-1.5 text-[11px] font-medium text-slate-500">
              {group}
            </div>
            <div className="space-y-0.5">
              {NAV_ITEMS.filter((i) => i.group === group).map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveNav(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-blue-600/15 text-blue-300'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        active ? 'text-blue-400' : 'text-slate-500'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Quiet Account Footer inside Sidebar */}
      <div className="border-t border-slate-800/90 p-3">
        {user ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-[#070B14] px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-slate-200">
                {user.displayName || 'Signed In'}
              </div>
              <div className="truncate text-[11px] text-slate-400">{user.email}</div>
            </div>
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={authLoading}
            onClick={signInWithGoogle}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 text-xs font-medium text-slate-200 hover:border-blue-500 hover:text-blue-300 transition-colors whitespace-nowrap"
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign in with Google
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Clean Single-Row Top Bar */}
        <header className="sticky top-0 z-30 flex h-15 items-center justify-between gap-4 border-b border-slate-800/90 bg-[#070B14]/95 px-4 backdrop-blur-sm sm:px-6">
          {/* Zone 1: Mobile Menu Trigger + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg border border-slate-800 bg-[#0D1321] p-2 text-slate-300 hover:text-white lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-500 whitespace-nowrap">
                StockMind AI
              </span>
              <span className="hidden sm:inline text-slate-700" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-slate-100 truncate">
                {activeNavMeta.label}
              </span>
            </div>
          </div>

          {/* Zone 2: Global Full-Universe NSE/BSE Stock Search */}
          <div className="w-full max-w-md">
            <StockSearchAutocomplete
              size="compact"
              selectedSymbolHint={selectedSymbol}
              placeholder="Search NSE & BSE stocks (name, symbol, or BSE code 500325)..."
              onSelectStock={(item) => navigateToStock(item.symbol, 'analysis')}
            />
          </div>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setActiveNav('predictions')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors whitespace-nowrap"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">AI Predict</span>
            </button>
          </div>
        </header>

        {authError && (
          <div className="mx-4 mt-4 rounded-lg border border-red-900/60 bg-red-950/20 px-4 py-2.5 text-xs text-red-300 sm:mx-6">
            {authError}
          </div>
        )}

        {/* Active Workspace Viewport */}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 space-y-8">
          {activeNav === 'dashboard' && (
            <DashboardView
              overview={overview}
              loading={overviewLoading}
              error={overviewError}
              onRetry={loadOverview}
              onSelectStock={(sym) => navigateToStock(sym, 'analysis')}
              onPredictStock={(sym) => navigateToStock(sym, 'predictions')}
              watchedSymbols={watchedSymbols}
              onToggleWatchlist={handleToggleWatchlist}
            />
          )}

          {activeNav === 'analysis' && (
            <StockAnalysisView
              stocks={stocks}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={setSelectedSymbol}
              onOpenTechnicals={(sym) => navigateToStock(sym, 'technicals')}
              onOpenPrediction={(sym) => navigateToStock(sym, 'predictions')}
              watchedSymbols={watchedSymbols}
              onToggleWatchlist={handleToggleWatchlist}
            />
          )}

          {activeNav === 'technicals' && (
            <TechnicalAnalysisView
              stocks={stocks}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={setSelectedSymbol}
            />
          )}

          {activeNav === 'predictions' && (
            <PredictionEngineView
              stocks={stocks}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={setSelectedSymbol}
              onSavePrediction={handleSavePrediction}
              isAuthenticated={Boolean(user)}
            />
          )}

          {activeNav === 'chat' && <AnalystChatView />}

          {activeNav === 'news' && <MarketNewsView />}

          {activeNav === 'watchlist' && (
            <WatchlistView
              stocks={stocks}
              watchlists={watchlists}
              activeWatchlistId={activeWatchlistId}
              onSelectWatchlist={setActiveWatchlistId}
              onCreateWatchlist={handleCreateWatchlist}
              onDeleteWatchlist={handleDeleteWatchlist}
              onAddSymbol={handleAddSymbol}
              onRemoveSymbol={handleRemoveSymbol}
              onSelectStock={(sym) => navigateToStock(sym, 'analysis')}
              onPredictStock={(sym) => navigateToStock(sym, 'predictions')}
              priceAlerts={priceAlerts}
              onCreatePriceAlert={handleCreatePriceAlert}
              onDeletePriceAlert={handleDeletePriceAlert}
              onResetPriceAlert={handleResetPriceAlert}
              onSimulatePriceTick={handleSimulatePriceTick}
              autoTickEnabled={autoTickEnabled}
              onToggleAutoTick={() => setAutoTickEnabled((v) => !v)}
              isAuthenticated={Boolean(user)}
              onSignIn={signInWithGoogle}
              loading={userDataLoading}
            />
          )}

          {activeNav === 'portfolio' && (
            <PortfolioView
              stocks={stocks}
              holdings={portfolio}
              onAddHolding={handleAddHolding}
              onDeleteHolding={handleDeleteHolding}
              onSelectStock={(sym) => navigateToStock(sym, 'analysis')}
              isAuthenticated={Boolean(user)}
              onSignIn={signInWithGoogle}
              loading={userDataLoading}
            />
          )}

          {activeNav === 'history' && (
            <PredictionHistoryView
              logs={predictionLogs}
              onEvaluateLog={handleEvaluateLog}
              onGoToPredictor={() => setActiveNav('predictions')}
              isAuthenticated={Boolean(user)}
              onSignIn={signInWithGoogle}
              loading={userDataLoading}
            />
          )}

          {activeNav === 'architecture' && <ArchitectureView />}

          {/* Prominent Legal & Risk Disclaimer Footer */}
          <div className="pt-2">
            <DisclaimerBanner />
          </div>
        </main>
      </div>

      {/* Price Alert Toast Notifications */}
      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
        onViewStock={(sym) => navigateToStock(sym, 'analysis')}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StockMindWorkspace />
    </AuthProvider>
  );
}
