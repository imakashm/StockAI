export function ArchitectureView() {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800/80 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Platform Architecture, API &amp; Deployment Blueprint
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Full-stack API catalog, Cloud SQL PostgreSQL Drizzle schema, Python FastAPI + XGBoost ML microservice reference, and licensed NSE/BSE market data integration guide.
        </p>
      </div>

      {/* Live Backend API Routes */}
      <section className="rounded-xl border border-slate-800 bg-[#0D1321] p-5">
        <h2 className="text-base font-semibold text-slate-100">
          1. Active Server API Endpoints
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          All Gemini API keys and PostgreSQL credentials remain strictly server-side. User persistence routes enforce Firebase ID Token verification.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 pr-3">Method</th>
                <th className="px-3 py-2.5">Endpoint</th>
                <th className="px-3 py-2.5">Auth</th>
                <th className="py-2.5 pl-3">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono">
              {[
                ['GET', '/api/market/overview', 'Public', 'Indices (NIFTY 50, SENSEX, BANK NIFTY, IT, MIDCAP), IST session status, breadth, gainers/losers/active'],
                ['GET', '/api/stocks/:symbol', 'Public', '260-session OHLCV series, EMA 20/50, SMA 200, RSI 14, MACD, Bollinger Bands, S/R levels, fundamentals'],
                ['POST', '/api/predictions/analyze', 'Public', 'Deterministic technical scenario scoring + server-side Gemini natural-language reasoning & risks'],
                ['POST', '/api/ai/chat', 'Public', 'AI Stock Analyst chatbot with dataset snapshot injection + Google Search grounding citations'],
                ['GET', '/api/news?category=...', 'Public', 'Google Search grounded Indian market news across 6 categories with verified publisher links'],
                ['GET / POST / DELETE', '/api/watchlists', 'Bearer ID Token', 'Multi-watchlist CRUD persisted to Cloud SQL PostgreSQL'],
                ['GET / POST / DELETE', '/api/portfolio', 'Bearer ID Token', 'User-entered manual portfolio lots persisted to Cloud SQL PostgreSQL'],
                ['GET / POST / PATCH', '/api/predictions/history', 'Bearer ID Token', 'Prediction audit log creation and post-horizon outcome evaluation'],
              ].map(([method, endpoint, auth, purpose]) => (
                <tr key={endpoint}>
                  <td className="py-2.5 pr-3 text-emerald-400 font-semibold">{method}</td>
                  <td className="px-3 py-2.5 text-slate-100">{endpoint}</td>
                  <td className="px-3 py-2.5 text-blue-400">{auth}</td>
                  <td className="py-2.5 pl-3 font-sans text-slate-300">{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* PostgreSQL Schema */}
      <section className="rounded-xl border border-slate-800 bg-[#0D1321] p-5">
        <h2 className="text-base font-semibold text-slate-100">
          2. PostgreSQL Relational Schema (Drizzle ORM)
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              table: 'users',
              cols: ['id (serial PK)', 'uid (text unique — Firebase UID)', 'email (text)', 'display_name (text)', 'created_at (timestamp)'],
            },
            {
              table: 'watchlists & watchlist_items',
              cols: ['watchlists.id (PK)', 'watchlists.user_uid (FK -> users.uid)', 'watchlists.name (text)', 'watchlist_items.watchlist_id (FK)', 'watchlist_items.symbol (unique pair)'],
            },
            {
              table: 'portfolio_holdings',
              cols: ['id (serial PK)', 'user_uid (FK -> users.uid)', 'symbol (text)', 'quantity (double precision)', 'purchase_price (double precision)', 'purchase_date (YYYY-MM-DD)'],
            },
            {
              table: 'prediction_logs',
              cols: ['id (serial PK)', 'user_uid (FK -> users.uid)', 'symbol, timeframe, predicted_direction', 'bullish_prob, bearish_prob, sideways_prob, confidence', 'reference_price, target_date', 'actual_price, actual_return_pct, evaluation_status'],
            },
          ].map((schema) => (
            <div
              key={schema.table}
              className="rounded-lg border border-slate-800 bg-[#070B14] p-4"
            >
              <div className="font-mono text-xs font-semibold text-blue-400">
                {schema.table}
              </div>
              <ul className="mt-2.5 space-y-1 font-mono text-[11px] text-slate-300">
                {schema.cols.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Python FastAPI + XGBoost + Real Market Data Blueprint */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-[#0D1321] p-5">
          <h2 className="text-base font-semibold text-slate-100">
            3. Python FastAPI &amp; XGBoost ML Extension
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            For production time-series backtesting with Scikit-learn and XGBoost, connect an external Python FastAPI inference microservice behind the server proxy.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-[#070B14] p-3.5 font-mono text-[11px] leading-relaxed text-slate-300">
{`# ml_service/main.py (FastAPI + XGBoost Walk-Forward Pipeline)
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import xgboost as xgb
import pandas as pd

app = FastAPI(title="StockMind ML Inference")

class PredictRequest(BaseModel):
    symbol: str
    horizon_sessions: int  # 1, 5, 10, 30

@app.post("/v1/predict")
async def predict(req: PredictRequest):
    # 1. Fetch licensed NSE/BSE OHLCV bars from authorized provider
    # 2. Compute lag-safe RSI-14, MACD, EMA20/50, SMA200, ATR, Vol Ratio
    # 3. Run calibrated TimeSeriesSplit XGBClassifier -> [p_bear, p_flat, p_bull]
    # 4. Return probabilities + SHAP feature attributions (never guaranteed prices)
    return {"status": "ready_for_licensed_feed"}`}
          </pre>
        </section>

        <section className="rounded-xl border border-slate-800 bg-[#0D1321] p-5">
          <h2 className="text-base font-semibold text-slate-100">
            4. Licensed Indian Market Data &amp; Deployment Checklist
          </h2>
          <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-300">
            <li>
              <strong className="text-slate-100">Authorized NSE/BSE Feeds:</strong> Integrate a licensed Indian market data vendor (such as Zerodha Kite Connect, Upstox Market Data API, Angel One SmartAPI, or NSE/BSE authorized redistribution vendors like Global Datafeeds / TrueData) strictly on the backend server using environment secrets.
            </li>
            <li>
              <strong className="text-slate-100">Rate Limits &amp; Caching:</strong> Cache end-of-day OHLCV bars and index quotes in PostgreSQL or Redis to respect exchange licensing terms and API rate ceilings.
            </li>
            <li>
              <strong className="text-slate-100">Deployment:</strong> Frontend builds via <span className="font-mono text-blue-400">npm run build</span> (Netlify or Cloud Run); backend runs <span className="font-mono text-blue-400">server.ts</span> with Cloud SQL PostgreSQL connection pooling and Firebase ID Token auth.
            </li>
            <li>
              <strong className="text-slate-100">SEBI Compliance Gate:</strong> Keep all outputs framed strictly as educational analytics and quantitative estimates; never deploy personalized buy/sell advisory signals without SEBI Research Analyst / Investment Adviser registration.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
