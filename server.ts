import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  DATA_SOURCE_MODE,
  getAllStockSummaries,
  getIndianMarketSessionStatus,
  getMarketIndices,
  getStockDetail,
} from './src/data/indianMarketData.ts';
import {
  addSymbolToWatchlist,
  createPortfolioHolding,
  createUserPriceAlert,
  createUserWatchlist,
  deletePortfolioHolding,
  deleteUserPriceAlert,
  deleteUserWatchlist,
  evaluatePredictionLog,
  listUserPortfolio,
  listUserPredictionLogs,
  listUserPriceAlerts,
  listUserWatchlists,
  removeSymbolFromWatchlist,
  savePredictionLog,
  updateUserPriceAlertStatus,
} from './src/db/repository.ts';
import { requireAuth } from './src/middleware/auth.ts';
import type { AuthRequest } from './src/middleware/auth.ts';
import { runStockPrediction } from './src/server/predictionEngine.ts';
import {
  fetchGroundedMarketNews,
  isValidNewsCategory,
} from './src/server/newsService.ts';
import { generateAnalystReply } from './src/server/chatService.ts';
import {
  ensureStockMasterPopulated,
  findMasterRecord,
  getStockMasterStatus,
  resolveStockDetail,
  searchStockMaster,
  syncStockMasterFromExchanges,
} from './src/server/stockMasterService.ts';
import type { PredictionTimeframe } from './src/types/market.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const SYMBOL_REGEX = /^[A-Z0-9&.-]{1,24}$/;
const VALID_TIMEFRAMES: PredictionTimeframe[] = ['1D', '5D', '10D', '30D'];

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // --- Market Data Endpoints ---
  app.get('/api/market/overview', (_req, res) => {
    const stocks = getAllStockSummaries();
    const indices = getMarketIndices();
    const session = getIndianMarketSessionStatus();

    const advancers = stocks.filter((s) => s.changePercent > 0).length;
    const decliners = stocks.filter((s) => s.changePercent < 0).length;
    const unchanged = stocks.length - advancers - decliners;

    const topGainers = [...stocks]
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 6);
    const topLosers = [...stocks]
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, 6);
    const mostActive = [...stocks]
      .sort((a, b) => b.volume * b.price - a.volume * a.price)
      .slice(0, 6);

    res.json({
      dataMode: DATA_SOURCE_MODE,
      asOfDate: stocks[0]?.asOfDate ?? new Date().toISOString().slice(0, 10),
      session,
      indices,
      breadth: { advancers, decliners, unchanged, total: stocks.length },
      topGainers,
      topLosers,
      mostActive,
      stocks,
    });
  });

  app.get('/api/stocks', (req, res) => {
    const q = String(req.query.q ?? '').trim().toLowerCase();
    const sector = String(req.query.sector ?? '').trim().toLowerCase();
    let stocks = getAllStockSummaries();

    if (q) {
      stocks = stocks.filter(
        (s) =>
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.sector.toLowerCase().includes(q) ||
          s.bseCode.includes(q)
      );
    }
    if (sector && sector !== 'all') {
      stocks = stocks.filter((s) => s.sector.toLowerCase() === sector);
    }

    res.json({
      dataMode: DATA_SOURCE_MODE,
      count: stocks.length,
      stocks,
    });
  });

  // Comprehensive server-side NSE & BSE PostgreSQL stock master search with pagination
  app.get('/api/stocks/search', async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const q = String(req.query.q ?? '').trim().slice(0, 80);
      const exchange = String(req.query.exchange ?? 'ALL').trim().toUpperCase();
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 12);

      const allowedExchanges = new Set(['ALL', 'NSE', 'BSE', 'NSE / BSE', 'DUAL']);
      const safeExchange = allowedExchanges.has(exchange) ? exchange : 'ALL';

      const payload = await searchStockMaster({
        q,
        exchange: safeExchange,
        page: Number.isFinite(page) ? page : 1,
        limit: Number.isFinite(limit) ? limit : 12,
      });

      res.status(200).json(payload);
    } catch (error: unknown) {
      console.error('Stock search API error:', error);
      res.status(503).json({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to query the NSE/BSE stock master directory right now.',
      });
    }
  });

  app.get('/api/stocks/master/status', async (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      await ensureStockMasterPopulated();
      const status = await getStockMasterStatus();
      res.status(200).json(status);
    } catch (error: unknown) {
      console.error('Stock master status error:', error);
      res.status(503).json({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load NSE/BSE directory status.',
      });
    }
  });

  app.post('/api/stocks/master/sync', async (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const status = await getStockMasterStatus();
      if (status.total >= 100 && !status.canManualSync) {
        res.status(200).json({
          skipped: true,
          message: 'Master directory was refreshed within the last 5 minutes.',
          status,
        });
        return;
      }

      const synced = await syncStockMasterFromExchanges();
      const updatedStatus = await getStockMasterStatus();
      res.status(200).json({
        skipped: false,
        synced,
        status: updatedStatus,
      });
    } catch (error: unknown) {
      console.error('Stock master sync error:', error);
      res.status(503).json({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to refresh NSE/BSE master directory right now.',
      });
    }
  });

  app.get('/api/stocks/:symbol', async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const symbol = String(req.params.symbol || '').trim().toUpperCase();
      if (!SYMBOL_REGEX.test(symbol)) {
        res.status(400).json({ error: 'Invalid stock symbol, BSE code, or ISIN format.' });
        return;
      }

      const detail = await resolveStockDetail(symbol);
      if (!detail) {
        const master = await findMasterRecord(symbol);
        if (master) {
          res.status(404).json({
            error: `Verified ${master.exchange} listing found (${master.companyName} · ${
              master.nseSymbol ? `NSE ${master.nseSymbol}` : ''
            }${master.nseSymbol && master.bseCode ? ' / ' : ''}${
              master.bseCode ? `BSE ${master.bseCode}` : ''
            }), but historical OHLCV price data is currently unavailable from the delayed market feed. StockMind AI does not fabricate prices.`,
          });
          return;
        }
        res.status(404).json({
          error: `Stock "${symbol}" was not found in the NSE/BSE listed equity master.`,
        });
        return;
      }

      res.status(200).json(detail);
    } catch (error: unknown) {
      console.error('Stock detail API error:', error);
      res.status(503).json({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load equity market details right now.',
      });
    }
  });

  // --- AI Prediction Engine Endpoint ---
  app.post('/api/predictions/analyze', async (req, res) => {
    try {
      const rawSymbol = String(req.body?.symbol ?? '').trim().toUpperCase();
      const rawTimeframe = String(req.body?.timeframe ?? '5D').trim().toUpperCase();

      if (!SYMBOL_REGEX.test(rawSymbol)) {
        res.status(400).json({ error: 'Please select a valid NSE/BSE stock symbol.' });
        return;
      }

      if (!VALID_TIMEFRAMES.includes(rawTimeframe as PredictionTimeframe)) {
        res.status(400).json({ error: 'Timeframe must be one of 1D, 5D, 10D, or 30D.' });
        return;
      }

      const result = await runStockPrediction(
        rawSymbol,
        rawTimeframe as PredictionTimeframe
      );
      res.json(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Prediction analysis could not be completed.';
      console.error('Prediction error:', error);
      res.status(502).json({ error: message });
    }
  });

  // --- Live Verified Financial Market News Endpoint ---
  app.get('/api/news', async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const rawCategory = String(req.query.category ?? 'Indian Stock Market').trim();
      const forceRefresh = req.query.refresh === 'true';

      if (!isValidNewsCategory(rawCategory)) {
        res.status(400).json({ error: 'Unsupported news category.' });
        return;
      }

      const payload = await fetchGroundedMarketNews(rawCategory, forceRefresh);
      res.status(200).json(payload);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to retrieve verified market news right now.';
      console.error('News retrieval error:', error);
      res.status(503).json({ error: message });
    }
  });

  // --- AI Stock Analyst Chatbot Endpoint ---
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const message = String(req.body?.message ?? '').trim();
      if (!message || message.length > 1500) {
        res
          .status(400)
          .json({ error: 'Please enter a question between 1 and 1,500 characters.' });
        return;
      }

      const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];
      const history = rawHistory
        .filter(
          (item: unknown): item is { role: 'user' | 'assistant'; content: string } =>
            typeof item === 'object' &&
            item !== null &&
            ((item as { role?: string }).role === 'user' ||
              (item as { role?: string }).role === 'assistant') &&
            typeof (item as { content?: unknown }).content === 'string'
        )
        .slice(-8);

      const reply = await generateAnalystReply(message, history);
      res.json(reply);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'AI Analyst could not generate a response right now.';
      console.error('Chat analyst error:', error);
      res.status(502).json({ error: message });
    }
  });

  // --- Watchlists (Authenticated Cloud SQL PostgreSQL) ---
  app.get('/api/watchlists', requireAuth, async (req: AuthRequest, res) => {
    try {
      const watchlists = await listUserWatchlists(req.user!.uid);
      res.json({ watchlists });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to load watchlists.',
      });
    }
  });

  app.post('/api/watchlists', requireAuth, async (req: AuthRequest, res) => {
    try {
      const name = String(req.body?.name ?? '').trim();
      if (!name || name.length > 60) {
        res.status(400).json({ error: 'Watchlist name must be 1–60 characters.' });
        return;
      }
      const created = await createUserWatchlist(req.user!.uid, name);
      res.status(201).json({ watchlist: created });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create watchlist.',
      });
    }
  });

  app.delete('/api/watchlists/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const watchlistId = Number(req.params.id);
      if (!Number.isInteger(watchlistId) || watchlistId <= 0) {
        res.status(400).json({ error: 'Invalid watchlist ID.' });
        return;
      }
      const deleted = await deleteUserWatchlist(req.user!.uid, watchlistId);
      if (!deleted) {
        res.status(404).json({ error: 'Watchlist not found.' });
        return;
      }
      res.json({ success: true });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete watchlist.',
      });
    }
  });

  app.post('/api/watchlists/:id/items', requireAuth, async (req: AuthRequest, res) => {
    try {
      const watchlistId = Number(req.params.id);
      const symbol = String(req.body?.symbol ?? '').trim().toUpperCase();
      if (!Number.isInteger(watchlistId) || watchlistId <= 0) {
        res.status(400).json({ error: 'Invalid watchlist ID.' });
        return;
      }
      if (!SYMBOL_REGEX.test(symbol)) {
        res.status(400).json({ error: 'Invalid NSE/BSE stock symbol format.' });
        return;
      }
      const masterRecord = await findMasterRecord(symbol);
      const canonicalSymbol = masterRecord?.symbol ?? (getStockDetail(symbol) ? symbol : null);
      if (!canonicalSymbol) {
        res.status(400).json({ error: 'Stock symbol not found in NSE/BSE equity master.' });
        return;
      }
      const ok = await addSymbolToWatchlist(req.user!.uid, watchlistId, canonicalSymbol);
      if (!ok) {
        res.status(404).json({ error: 'Watchlist not found.' });
        return;
      }
      res.status(201).json({ success: true, symbol: canonicalSymbol });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to add stock.',
      });
    }
  });

  app.delete(
    '/api/watchlists/:id/items/:symbol',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const watchlistId = Number(req.params.id);
        const symbol = String(req.params.symbol ?? '').trim().toUpperCase();
        if (!Number.isInteger(watchlistId) || watchlistId <= 0 || !SYMBOL_REGEX.test(symbol)) {
          res.status(400).json({ error: 'Invalid watchlist ID or stock symbol.' });
          return;
        }
        const ok = await removeSymbolFromWatchlist(req.user!.uid, watchlistId, symbol);
        if (!ok) {
          res.status(404).json({ error: 'Watchlist not found.' });
          return;
        }
        res.json({ success: true });
      } catch (error: unknown) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to remove stock.',
        });
      }
    }
  );

  // --- Portfolio Tracker (Authenticated Cloud SQL PostgreSQL) ---
  app.get('/api/portfolio', requireAuth, async (req: AuthRequest, res) => {
    try {
      const holdings = await listUserPortfolio(req.user!.uid);
      res.json({ holdings });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch portfolio.',
      });
    }
  });

  app.post('/api/portfolio', requireAuth, async (req: AuthRequest, res) => {
    try {
      const symbol = String(req.body?.symbol ?? '').trim().toUpperCase();
      const quantity = Number(req.body?.quantity);
      const purchasePrice = Number(req.body?.purchasePrice);
      const purchaseDate = String(req.body?.purchaseDate ?? '').trim();
      const notes =
        typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 200) : null;

      if (!SYMBOL_REGEX.test(symbol)) {
        res.status(400).json({ error: 'Please choose a valid NSE/BSE stock symbol.' });
        return;
      }
      const masterRecord = await findMasterRecord(symbol);
      const canonicalSymbol = masterRecord?.symbol ?? (getStockDetail(symbol) ? symbol : null);
      if (!canonicalSymbol) {
        res.status(400).json({ error: 'Stock symbol not found in NSE/BSE equity master.' });
        return;
      }
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10_000_000) {
        res.status(400).json({ error: 'Quantity must be a positive number.' });
        return;
      }
      if (!Number.isFinite(purchasePrice) || purchasePrice <= 0 || purchasePrice > 10_000_000) {
        res.status(400).json({ error: 'Purchase price must be a positive INR amount.' });
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
        res.status(400).json({ error: 'Purchase date must follow YYYY-MM-DD format.' });
        return;
      }

      const holding = await createPortfolioHolding({
        userUid: req.user!.uid,
        symbol: canonicalSymbol,
        quantity,
        purchasePrice,
        purchaseDate,
        notes,
      });
      res.status(201).json({ holding });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to save holding.',
      });
    }
  });

  app.delete('/api/portfolio/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid holding ID.' });
        return;
      }
      const deleted = await deletePortfolioHolding(req.user!.uid, id);
      if (!deleted) {
        res.status(404).json({ error: 'Holding not found.' });
        return;
      }
      res.json({ success: true });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete holding.',
      });
    }
  });

  // --- Prediction History & Evaluation (Authenticated Cloud SQL PostgreSQL) ---
  app.get('/api/predictions/history', requireAuth, async (req: AuthRequest, res) => {
    try {
      const logs = await listUserPredictionLogs(req.user!.uid);
      res.json({ logs });
    } catch (error: unknown) {
      res.status(500).json({
        error:
          error instanceof Error ? error.message : 'Failed to load prediction history.',
      });
    }
  });

  app.post('/api/predictions/history', requireAuth, async (req: AuthRequest, res) => {
    try {
      const body = req.body ?? {};
      const symbol = String(body.symbol ?? '').trim().toUpperCase();
      const timeframe = String(body.timeframe ?? '').trim().toUpperCase();
      const predictedDirection = String(body.predictedDirection ?? '').trim();
      const bullishProb = Number(body.bullishProb);
      const bearishProb = Number(body.bearishProb);
      const sidewaysProb = Number(body.sidewaysProb);
      const confidence = Number(body.confidence);
      const referencePrice = Number(body.referencePrice);
      const targetDate = String(body.targetDate ?? '').trim();
      const modelVersion = String(body.modelVersion ?? 'Quant-TA-v1.0 + Gemini-4-Hydrogen').slice(0, 80);
      const dataMode = String(body.dataMode ?? DATA_SOURCE_MODE).slice(0, 80);
      const reasoningSummary = String(body.reasoningSummary ?? '').trim().slice(0, 1500);

      if (!SYMBOL_REGEX.test(symbol) || !VALID_TIMEFRAMES.includes(timeframe as PredictionTimeframe)) {
        res.status(400).json({ error: 'Invalid symbol or prediction timeframe.' });
        return;
      }
      if (!['Bullish', 'Bearish', 'Sideways'].includes(predictedDirection)) {
        res.status(400).json({ error: 'Invalid predicted direction.' });
        return;
      }
      if (!Number.isFinite(referencePrice) || referencePrice <= 0) {
        res.status(400).json({ error: 'Invalid reference price.' });
        return;
      }

      const log = await savePredictionLog({
        userUid: req.user!.uid,
        symbol,
        timeframe,
        predictedDirection,
        bullishProb: Math.round(bullishProb),
        bearishProb: Math.round(bearishProb),
        sidewaysProb: Math.round(sidewaysProb),
        confidence: Math.round(confidence),
        referencePrice,
        targetDate: /^\d{4}-\d{2}-\d{2}$/.test(targetDate)
          ? targetDate
          : new Date().toISOString().slice(0, 10),
        modelVersion,
        dataMode,
        reasoningSummary: reasoningSummary || 'Logged quantitative trend estimate.',
      });

      res.status(201).json({ log });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to log prediction.',
      });
    }
  });

  app.patch(
    '/api/predictions/history/:id/evaluate',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const logId = Number(req.params.id);
        const actualPrice = Number(req.body?.actualPrice);
        if (!Number.isInteger(logId) || logId <= 0) {
          res.status(400).json({ error: 'Invalid prediction log ID.' });
          return;
        }
        if (!Number.isFinite(actualPrice) || actualPrice <= 0) {
          res.status(400).json({ error: 'Please provide a valid realized closing price in INR.' });
          return;
        }

        const existingLogs = await listUserPredictionLogs(req.user!.uid);
        const target = existingLogs.find((l) => l.id === logId);
        if (!target) {
          res.status(404).json({ error: 'Prediction record not found.' });
          return;
        }

        const actualReturnPct = Number(
          (((actualPrice - target.referencePrice) / target.referencePrice) * 100).toFixed(2)
        );

        let aligned = false;
        if (target.predictedDirection === 'Bullish') aligned = actualReturnPct >= 0.75;
        else if (target.predictedDirection === 'Bearish') aligned = actualReturnPct <= -0.75;
        else aligned = Math.abs(actualReturnPct) < 1.5;

        const evaluationStatus = aligned
          ? 'Evaluated - Aligned'
          : 'Evaluated - Diverged';

        const updated = await evaluatePredictionLog({
          userUid: req.user!.uid,
          logId,
          actualPrice,
          actualReturnPct,
          evaluationStatus,
        });

        res.json({ log: updated });
      } catch (error: unknown) {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to record evaluation outcome.',
        });
      }
    }
  );

  // --- Price Alerts (Authenticated Cloud SQL PostgreSQL) ---
  app.get('/api/alerts', requireAuth, async (req: AuthRequest, res) => {
    try {
      const alerts = await listUserPriceAlerts(req.user!.uid);
      res.json({ alerts });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to load price alerts.',
      });
    }
  });

  app.post('/api/alerts', requireAuth, async (req: AuthRequest, res) => {
    try {
      const symbol = String(req.body?.symbol ?? '').trim().toUpperCase();
      const condition = String(req.body?.condition ?? '').trim().toLowerCase();
      const targetPrice = Number(req.body?.targetPrice);
      const status =
        req.body?.status === 'triggered' ? 'triggered' : 'active';
      const triggeredPrice =
        status === 'triggered' && Number.isFinite(Number(req.body?.triggeredPrice))
          ? Number(req.body.triggeredPrice)
          : null;

      if (!SYMBOL_REGEX.test(symbol)) {
        res.status(400).json({ error: 'Invalid NSE/BSE stock symbol format.' });
        return;
      }
      const masterRecord = await findMasterRecord(symbol);
      const canonicalSymbol = masterRecord?.symbol ?? (getStockDetail(symbol) ? symbol : null);
      if (!canonicalSymbol) {
        res.status(400).json({ error: 'Stock symbol not found in NSE/BSE equity master.' });
        return;
      }
      if (condition !== 'above' && condition !== 'below') {
        res.status(400).json({ error: 'Alert condition must be "above" or "below".' });
        return;
      }
      if (!Number.isFinite(targetPrice) || targetPrice <= 0 || targetPrice > 10_000_000) {
        res.status(400).json({ error: 'Target price must be a positive INR amount.' });
        return;
      }

      const alert = await createUserPriceAlert({
        userUid: req.user!.uid,
        symbol: canonicalSymbol,
        condition,
        targetPrice,
        status,
        triggeredPrice,
        triggeredAt: status === 'triggered' ? new Date() : null,
      });
      res.status(201).json({ alert });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create price alert.',
      });
    }
  });

  app.patch('/api/alerts/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const alertId = Number(req.params.id);
      const status = String(req.body?.status ?? '').trim().toLowerCase();
      if (!Number.isInteger(alertId) || alertId <= 0) {
        res.status(400).json({ error: 'Invalid price alert ID.' });
        return;
      }
      if (status !== 'active' && status !== 'triggered') {
        res.status(400).json({ error: 'Status must be "active" or "triggered".' });
        return;
      }
      const triggeredPrice =
        status === 'triggered' && Number.isFinite(Number(req.body?.triggeredPrice))
          ? Number(req.body.triggeredPrice)
          : null;

      const updated = await updateUserPriceAlertStatus({
        userUid: req.user!.uid,
        alertId,
        status,
        triggeredPrice,
        triggeredAt: status === 'triggered' ? new Date() : null,
      });
      if (!updated) {
        res.status(404).json({ error: 'Price alert not found.' });
        return;
      }
      res.json({ alert: updated });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to update price alert.',
      });
    }
  });

  app.delete('/api/alerts/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const alertId = Number(req.params.id);
      if (!Number.isInteger(alertId) || alertId <= 0) {
        res.status(400).json({ error: 'Invalid price alert ID.' });
        return;
      }
      const deleted = await deleteUserPriceAlert(req.user!.uid, alertId);
      if (!deleted) {
        res.status(404).json({ error: 'Price alert not found.' });
        return;
      }
      res.json({ success: true });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete price alert.',
      });
    }
  });

  // Guarantee that any unmatched /api/* route always returns JSON (never SPA HTML)
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Guarantee Express errors on /api/* return structured JSON instead of HTML
  app.use(
    (
      err: unknown,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (req.path.startsWith('/api')) {
        console.error('Unhandled API error:', err);
        const message =
          err instanceof Error ? err.message : 'Internal server error.';
        res.status(500).json({ error: message });
        return;
      }
      next(err);
    }
  );

  // --- Frontend Serving (Vite Middleware in Dev / Static dist in Production) ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StockMind AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting StockMind AI server:', err);
  process.exit(1);
});
