# StockMind AI — Architecture, Database Schema & Deployment Guide

## 1. Platform Overview
StockMind AI is an educational Indian Stock Market Analytics & AI Trend Prediction platform covering NSE and BSE benchmark equities and indices.

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Recharts, responsive SVG Candlestick charts, Lucide icons.
- **Backend Server (`server.ts`)**: Express + TypeScript server serving market analytics, technical indicator computation, server-side Gemini AI synthesis (`@google/genai`), Google Search grounded financial news, and authenticated user persistence APIs.
- **Database**: PostgreSQL (Google Cloud SQL) managed with Drizzle ORM (`src/db/schema.ts`).
- **Authentication**: Firebase Authentication (Google Sign-In) with server-side Firebase Admin ID token verification (`src/middleware/auth.ts`).

## 2. Database Schema (`src/db/schema.ts`)
- `users`: `id`, `uid` (unique Firebase Auth UID), `email`, `display_name`, `created_at`
- `watchlists`: `id`, `user_uid` (FK -> `users.uid`), `name`, `created_at`
- `watchlist_items`: `id`, `watchlist_id` (FK -> `watchlists.id`), `symbol`, `added_at` (unique `(watchlist_id, symbol)`)
- `portfolio_holdings`: `id`, `user_uid` (FK -> `users.uid`), `symbol`, `quantity`, `purchase_price`, `purchase_date`, `notes`, `created_at`
- `prediction_logs`: `id`, `user_uid` (FK -> `users.uid`), `symbol`, `timeframe`, `predicted_direction`, `bullish_prob`, `bearish_prob`, `sideways_prob`, `confidence`, `reference_price`, `target_date`, `actual_price`, `actual_return_pct`, `evaluation_status`, `model_version`, `data_mode`, `reasoning_summary`, `created_at`

## 3. Environment Variables
- `GEMINI_API_KEY`: Server-side Gemini API key (never exposed to browser bundles).
- `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`: Runtime Cloud SQL PostgreSQL connection pool credentials.
- `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`: Drizzle Kit schema migration credentials.

## 4. Python FastAPI + Scikit-learn / XGBoost Microservice Blueprint
To extend the built-in deterministic quantitative engine with walk-forward trained ML models on licensed historical NSE/BSE data:
1. Provision a Python 3.11+ FastAPI service using `scikit-learn`, `xgboost`, `pandas`, and `numpy`.
2. Ingest end-of-day or intraday OHLCV bars from a licensed Indian market data vendor (e.g., Kite Connect, Upstox API, TrueData, or Global Datafeeds) using backend-only credentials.
3. Engineer leak-free technical features (`RSI-14`, `MACD`, `EMA20/50`, `SMA200`, Bollinger position, realized volatility, volume ratio) and train calibrated classifiers using `TimeSeriesSplit`.
4. Proxy requests from `server.ts` (`/api/predictions/analyze`) to the Python FastAPI service and pass feature attributions to Gemini for natural-language explanations.

## 5. Deployment
- **Development**: `npm run dev` (runs `tsx server.ts` with Vite dev middleware on port 3000)
- **Production Build**: `npm run build` followed by `NODE_ENV=production npm start`
- **SEBI Compliance**: Keep all analytics educational and non-advisory unless registered as a SEBI Research Analyst (RA) or Investment Adviser (IA).
