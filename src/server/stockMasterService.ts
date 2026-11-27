import zlib from 'zlib';
import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { stockMaster } from '../db/schema.ts';
import { computeTechnicalSeries } from '../lib/indicators.ts';
import {
  getAllStockDetails,
  getStockDetail as getSimulatedStockDetail,
} from '../data/indianMarketData.ts';
import type {
  DataSourceMode,
  OhlcvBar,
  StockDetail,
  StockSearchResponse,
  StockSearchResultItem,
} from '../types/market.ts';

// Strictly allowlisted official Indian exchange instrument master feeds (Upstox daily exchange dumps)
const OFFICIAL_NSE_MASTER_URL =
  'https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz';
const OFFICIAL_BSE_MASTER_URL =
  'https://assets.upstox.com/market-quote/instruments/exchange/BSE.json.gz';

const VALID_NSE_SERIES = new Set(['EQ', 'BE', 'BZ', 'SM', 'ST']);
const VALID_BSE_GROUPS = new Set([
  'A',
  'B',
  'T',
  'X',
  'XT',
  'M',
  'MT',
  'TS',
  'Z',
  'P',
  'R',
]);

interface UpstoxInstrumentRow {
  segment?: string;
  name?: string;
  short_name?: string;
  exchange?: string;
  isin?: string;
  instrument_type?: string;
  exchange_token?: string;
  trading_symbol?: string;
}

interface QuoteCacheEntry {
  fetchedAt: number;
  detail: StockDetail;
}

const quoteCache = new Map<string, QuoteCacheEntry>();
const QUOTE_CACHE_TTL_MS = 3 * 60 * 1000;

let activeSyncPromise: Promise<{ syncedCount: number; nseCount: number; bseCount: number }> | null =
  null;
let lastSyncTimestampMs = 0;

function toReadableCompanyName(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (!cleaned) return cleaned;
  // Convert ALL CAPS exchange master names into clean title case while preserving acronyms
  if (cleaned === cleaned.toUpperCase()) {
    const acronyms = new Set([
      'LTD',
      'LIMITED',
      'PVT',
      'INDIA',
      'NSE',
      'BSE',
      'IT',
      'PSU',
      'IIFL',
      'HDFC',
      'ICICI',
      'IDFC',
      'SBI',
      'ONGC',
      'NTPC',
      'BHEL',
      'GAIL',
      'HAL',
      'BEL',
      'BPCL',
      'HPCL',
      'IOC',
      'MRF',
      'ITC',
      'TCS',
      'HCL',
      'L&T',
      'IRCTC',
      'CDSL',
      'MCX',
      'NHPC',
      'PFC',
      'REC',
      'SAIL',
      'NMDC',
      'HUDCO',
      'NBCC',
      'SJVN',
      'NLC',
      'MOIL',
      'KIOCL',
      'FACT',
      'RCF',
      'GNFC',
      'GSFC',
      'KPR',
      'SRF',
      'PI',
      'UPL',
      'JSW',
      'JSL',
      'APL',
      'KEI',
      'CG',
      'ABB',
      'SKF',
      'ZF',
      'TVS',
      'CEAT',
      'JK',
      'DLF',
      'NCC',
      'KNR',
      'PNC',
      'HG',
      'GR',
      'GMR',
      'GVK',
      'RBL',
      'DCB',
      'CUB',
      'KVB',
      'CSB',
      'AU',
      'PNB',
      'BOB',
      'BOI',
      'IOB',
      'UCO',
      'IDBI',
      'LIC',
      'GIC',
      'NIACL',
      'AMC',
      'HFCL',
      'MTNL',
      'ITI',
      'KPIT',
      'LTIM',
      'LTTS',
    ]);
    return cleaned
      .split(' ')
      .map((word) => {
        const bare = word.replace(/[.,()]/g, '');
        if (acronyms.has(bare)) return word;
        if (bare.length <= 2 && /^[A-Z]+$/.test(bare)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }
  return cleaned;
}

async function fetchGzipJson(url: string): Promise<UpstoxInstrumentRow[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'StockMindAI-MasterSync/1.0',
        Accept: 'application/json, application/gzip, */*',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Instrument master fetch failed (${res.status}) for ${url}`);
    }
    const rawBuf = Buffer.from(await res.arrayBuffer());
    const text =
      rawBuf[0] === 0x1f && rawBuf[1] === 0x8b
        ? zlib.gunzipSync(rawBuf).toString('utf8')
        : rawBuf.toString('utf8');
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as UpstoxInstrumentRow[]) : [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncStockMasterFromExchanges(): Promise<{
  syncedCount: number;
  nseCount: number;
  bseCount: number;
}> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    try {
      const [nseRaw, bseRaw] = await Promise.all([
        fetchGzipJson(OFFICIAL_NSE_MASTER_URL),
        fetchGzipJson(OFFICIAL_BSE_MASTER_URL),
      ]);

      const nseEquities = nseRaw.filter(
        (r) =>
          r.segment === 'NSE_EQ' &&
          r.instrument_type &&
          VALID_NSE_SERIES.has(r.instrument_type) &&
          typeof r.isin === 'string' &&
          r.isin.startsWith('INE') &&
          typeof r.trading_symbol === 'string' &&
          r.trading_symbol.trim().length > 0
      );

      const bseEquities = bseRaw.filter(
        (r) =>
          r.segment === 'BSE_EQ' &&
          r.instrument_type &&
          VALID_BSE_GROUPS.has(r.instrument_type) &&
          typeof r.isin === 'string' &&
          r.isin.startsWith('INE') &&
          typeof r.trading_symbol === 'string' &&
          r.trading_symbol.trim().length > 0
      );

      // Build reference sector lookup from known benchmark stocks (without inventing fake prices)
      const sectorBySymbol = new Map<string, string>();
      for (const s of getAllStockDetails()) {
        sectorBySymbol.set(s.symbol, s.sector);
      }

      const mergedByIsin = new Map<
        string,
        {
          isin: string;
          symbol: string;
          nseSymbol: string | null;
          bseCode: string | null;
          bseSymbol: string | null;
          companyName: string;
          shortName: string | null;
          exchange: 'NSE / BSE' | 'NSE' | 'BSE';
          series: string | null;
          sector: string | null;
        }
      >();

      for (const r of nseEquities) {
        const isin = r.isin!.trim().toUpperCase();
        const nseSym = r.trading_symbol!.trim().toUpperCase();
        const companyName = toReadableCompanyName(r.name || r.short_name || nseSym);
        const shortName = r.short_name ? toReadableCompanyName(r.short_name) : null;

        // Prefer primary EQ series if duplicate ISIN appears in NSE
        const prev = mergedByIsin.get(isin);
        if (prev && prev.series === 'EQ' && r.instrument_type !== 'EQ') {
          continue;
        }

        mergedByIsin.set(isin, {
          isin,
          symbol: nseSym,
          nseSymbol: nseSym,
          bseCode: null,
          bseSymbol: null,
          companyName,
          shortName,
          exchange: 'NSE',
          series: r.instrument_type ?? 'EQ',
          sector: sectorBySymbol.get(nseSym) ?? null,
        });
      }

      for (const r of bseEquities) {
        const isin = r.isin!.trim().toUpperCase();
        const bseSym = r.trading_symbol!.trim().toUpperCase();
        const bseCode = r.exchange_token ? String(r.exchange_token).trim() : null;
        const bseName = toReadableCompanyName(r.name || r.short_name || bseSym);

        const existing = mergedByIsin.get(isin);
        if (existing) {
          existing.bseCode = bseCode || existing.bseCode;
          existing.bseSymbol = bseSym || existing.bseSymbol;
          existing.exchange = 'NSE / BSE';
          // Prefer cleaner full company name when BSE provides full suffix (e.g. "Tata Consultancy Services Ltd.")
          if (bseName.length > existing.companyName.length && !existing.companyName.includes('Limited')) {
            existing.companyName = bseName.replace(/\.$/, '');
          }
        } else {
          mergedByIsin.set(isin, {
            isin,
            symbol: bseSym,
            nseSymbol: null,
            bseCode,
            bseSymbol: bseSym,
            companyName: bseName.replace(/\.$/, ''),
            shortName: r.short_name ? toReadableCompanyName(r.short_name) : null,
            exchange: 'BSE',
            series: r.instrument_type ?? 'B',
            sector: sectorBySymbol.get(bseSym) ?? null,
          });
        }
      }

      const records = Array.from(mergedByIsin.values());
      const now = new Date();
      const BATCH_SIZE = 400;

      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE).map((rec) => ({
          ...rec,
          updatedAt: now,
        }));

        await db
          .insert(stockMaster)
          .values(batch)
          .onConflictDoUpdate({
            target: stockMaster.isin,
            set: {
              symbol: sql`excluded.symbol`,
              nseSymbol: sql`excluded.nse_symbol`,
              bseCode: sql`excluded.bse_code`,
              bseSymbol: sql`excluded.bse_symbol`,
              companyName: sql`excluded.company_name`,
              shortName: sql`excluded.short_name`,
              exchange: sql`excluded.exchange`,
              series: sql`excluded.series`,
              sector: sql`COALESCE(excluded.sector, ${stockMaster.sector})`,
              updatedAt: now,
            },
          });
      }

      lastSyncTimestampMs = Date.now();
      return {
        syncedCount: records.length,
        nseCount: nseEquities.length,
        bseCount: bseEquities.length,
      };
    } catch (error) {
      console.error('Failed to sync NSE/BSE stock master:', error);
      throw new Error('Unable to synchronize official NSE/BSE stock master list.', {
        cause: error,
      });
    } finally {
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}

export async function ensureStockMasterPopulated(): Promise<{
  totalCount: number;
  lastSyncedAt: string | null;
}> {
  try {
    const [stats] = await db
      .select({
        count: sql<number>`count(*)::int`,
        lastUpdated: sql<Date | null>`max(${stockMaster.updatedAt})`,
      })
      .from(stockMaster);

    const currentCount = stats?.count ?? 0;
    if (currentCount < 100) {
      const synced = await syncStockMasterFromExchanges();
      return {
        totalCount: synced.syncedCount,
        lastSyncedAt: new Date().toISOString(),
      };
    }

    return {
      totalCount: currentCount,
      lastSyncedAt: stats?.lastUpdated ? new Date(stats.lastUpdated).toISOString() : null,
    };
  } catch (error) {
    console.error('Failed to inspect stock_master table:', error);
    throw new Error('Database error while checking NSE/BSE stock directory.', {
      cause: error,
    });
  }
}

export async function getStockMasterStatus() {
  try {
    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        dualCount: sql<number>`count(*) filter (where ${stockMaster.exchange} = 'NSE / BSE')::int`,
        nseOnlyCount: sql<number>`count(*) filter (where ${stockMaster.exchange} = 'NSE')::int`,
        bseOnlyCount: sql<number>`count(*) filter (where ${stockMaster.exchange} = 'BSE')::int`,
        lastSyncedAt: sql<Date | null>`max(${stockMaster.updatedAt})`,
      })
      .from(stockMaster);

    return {
      total: stats?.total ?? 0,
      dualCount: stats?.dualCount ?? 0,
      nseOnlyCount: stats?.nseOnlyCount ?? 0,
      bseOnlyCount: stats?.bseOnlyCount ?? 0,
      lastSyncedAt: stats?.lastSyncedAt ? new Date(stats.lastSyncedAt).toISOString() : null,
      canManualSync: Date.now() - lastSyncTimestampMs > 5 * 60 * 1000,
    };
  } catch (error) {
    console.error('Failed to read stock master status:', error);
    throw new Error('Unable to fetch stock master status.', { cause: error });
  }
}

export async function searchStockMaster(params: {
  q: string;
  exchange?: string;
  page?: number;
  limit?: number;
}): Promise<StockSearchResponse> {
  const meta = await ensureStockMasterPopulated();

  const rawQuery = params.q.trim();
  const normalizedUpper = rawQuery.toUpperCase();
  const exchangeFilter = (params.exchange || 'ALL').trim().toUpperCase();
  const page = Math.max(1, Math.min(500, Math.floor(params.page ?? 1)));
  const limit = Math.max(5, Math.min(50, Math.floor(params.limit ?? 12)));
  const offset = (page - 1) * limit;

  const conditions = [];

  if (exchangeFilter === 'NSE') {
    conditions.push(
      or(eq(stockMaster.exchange, 'NSE'), eq(stockMaster.exchange, 'NSE / BSE'))
    );
  } else if (exchangeFilter === 'BSE') {
    conditions.push(
      or(eq(stockMaster.exchange, 'BSE'), eq(stockMaster.exchange, 'NSE / BSE'))
    );
  } else if (exchangeFilter === 'NSE / BSE' || exchangeFilter === 'DUAL') {
    conditions.push(eq(stockMaster.exchange, 'NSE / BSE'));
  }

  if (rawQuery.length > 0) {
    const pattern = `%${rawQuery}%`;
    conditions.push(
      or(
        ilike(stockMaster.symbol, pattern),
        ilike(stockMaster.nseSymbol, pattern),
        ilike(stockMaster.bseCode, pattern),
        ilike(stockMaster.bseSymbol, pattern),
        ilike(stockMaster.companyName, pattern),
        ilike(stockMaster.shortName, pattern),
        ilike(stockMaster.isin, pattern)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  try {
    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(stockMaster)
      .where(whereClause);

    const total = countRow?.total ?? 0;

    // Relevance ranking: exact symbol/BSE code -> prefix symbol/BSE code -> prefix company name -> dual-listed NSE/BSE -> alphabetical
    const orderByExpr =
      rawQuery.length > 0
        ? sql`
            CASE
              WHEN UPPER(${stockMaster.symbol}) = ${normalizedUpper}
                OR UPPER(COALESCE(${stockMaster.nseSymbol}, '')) = ${normalizedUpper}
                OR COALESCE(${stockMaster.bseCode}, '') = ${rawQuery} THEN 0
              WHEN UPPER(${stockMaster.symbol}) LIKE ${`${normalizedUpper}%`}
                OR UPPER(COALESCE(${stockMaster.nseSymbol}, '')) LIKE ${`${normalizedUpper}%`}
                OR COALESCE(${stockMaster.bseCode}, '') LIKE ${`${rawQuery}%`} THEN 1
              WHEN UPPER(${stockMaster.companyName}) LIKE ${`${normalizedUpper}%`} THEN 2
              WHEN ${stockMaster.exchange} = 'NSE / BSE' THEN 3
              WHEN ${stockMaster.exchange} = 'NSE' THEN 4
              ELSE 5
            END ASC,
            CASE WHEN ${stockMaster.exchange} = 'NSE / BSE' THEN 0 WHEN ${stockMaster.exchange} = 'NSE' THEN 1 ELSE 2 END ASC,
            ${stockMaster.symbol} ASC
          `
        : sql`
            CASE WHEN ${stockMaster.lastPrice} IS NOT NULL THEN 0 ELSE 1 END ASC,
            CASE WHEN ${stockMaster.exchange} = 'NSE / BSE' THEN 0 WHEN ${stockMaster.exchange} = 'NSE' THEN 1 ELSE 2 END ASC,
            ${stockMaster.symbol} ASC
          `;

    const rows = await db
      .select()
      .from(stockMaster)
      .where(whereClause)
      .orderBy(orderByExpr)
      .limit(limit)
      .offset(offset);

    // Enrich benchmark simulated stocks with fallback price note ONLY if no delayed price cached yet
    const simulatedBySymbol = new Map(
      getAllStockDetails().map((s) => [s.symbol, s])
    );

    const items: StockSearchResultItem[] = rows.map((row) => {
      const sim = simulatedBySymbol.get(row.symbol);
      const hasCachedPrice = row.lastPrice !== null && row.priceSource !== null;

      return {
        id: row.id,
        isin: row.isin,
        symbol: row.symbol,
        nseSymbol: row.nseSymbol,
        bseCode: row.bseCode,
        bseSymbol: row.bseSymbol,
        companyName: row.companyName,
        shortName: row.shortName,
        exchange: (row.exchange as 'NSE / BSE' | 'NSE' | 'BSE') || 'NSE',
        series: row.series,
        sector: row.sector ?? sim?.sector ?? null,
        lastPrice: hasCachedPrice ? row.lastPrice : sim?.price ?? null,
        changePercent: hasCachedPrice
          ? row.changePercent
          : sim?.changePercent ?? null,
        priceSource: hasCachedPrice
          ? (row.priceSource as DataSourceMode)
          : sim
          ? 'Simulated Historical Dataset'
          : null,
        priceUpdatedAt: row.priceUpdatedAt
          ? new Date(row.priceUpdatedAt).toISOString()
          : null,
      };
    });

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      query: rawQuery,
      exchange: exchangeFilter,
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
      masterTotalCount: meta.totalCount,
      lastSyncedAt: meta.lastSyncedAt,
      items,
    };
  } catch (error) {
    console.error('Stock master search query failed:', error);
    throw new Error('Failed to query NSE/BSE stock directory.', { cause: error });
  }
}

export async function findMasterRecord(identifier: string) {
  await ensureStockMasterPopulated();
  const trimmed = identifier.trim();
  const upper = trimmed.toUpperCase();

  try {
    const rows = await db
      .select()
      .from(stockMaster)
      .where(
        or(
          eq(stockMaster.symbol, upper),
          eq(stockMaster.nseSymbol, upper),
          eq(stockMaster.bseCode, trimmed),
          eq(stockMaster.bseSymbol, upper),
          eq(stockMaster.isin, upper)
        )
      )
      .limit(1);

    return rows[0] ?? null;
  } catch (error) {
    console.error('Failed to look up stock master record:', error);
    return null;
  }
}

async function fetchYahooOhlcv(yahooTicker: string): Promise<{
  bars: OhlcvBar[];
  regularMarketPrice: number | null;
  week52High: number | null;
  week52Low: number | null;
} | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7500);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yahooTicker
    )}?range=1y&interval=1d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StockMindAI/1.0)',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            fiftyTwoWeekHigh?: number;
            fiftyTwoWeekLow?: number;
          };
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              open?: (number | null)[];
              high?: (number | null)[];
              low?: (number | null)[];
              close?: (number | null)[];
              volume?: (number | null)[];
            }>;
          };
        }>;
      };
    };

    const result = data.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const q = result?.indicators?.quote?.[0];
    if (!result || timestamps.length < 5 || !q) return null;

    const bars: OhlcvBar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const open = q.open?.[i];
      const high = q.high?.[i];
      const low = q.low?.[i];
      const close = q.close?.[i];
      const volume = q.volume?.[i] ?? 0;

      if (
        typeof open !== 'number' ||
        typeof high !== 'number' ||
        typeof low !== 'number' ||
        typeof close !== 'number' ||
        !Number.isFinite(close) ||
        close <= 0
      ) {
        continue;
      }

      const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
      bars.push({
        date,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: Math.max(0, Math.round(volume)),
      });
    }

    if (bars.length < 5) return null;

    return {
      bars,
      regularMarketPrice:
        typeof result.meta?.regularMarketPrice === 'number'
          ? Number(result.meta.regularMarketPrice.toFixed(2))
          : null,
      week52High:
        typeof result.meta?.fiftyTwoWeekHigh === 'number'
          ? Number(result.meta.fiftyTwoWeekHigh.toFixed(2))
          : null,
      week52Low:
        typeof result.meta?.fiftyTwoWeekLow === 'number'
          ? Number(result.meta.fiftyTwoWeekLow.toFixed(2))
          : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolves any NSE/BSE equity by NSE symbol, BSE scrip code, or ISIN.
 * Prefers genuine Delayed Reference Feed OHLCV from Yahoo Finance (.NS / .BO),
 * persists the verified delayed price back into PostgreSQL stock_master,
 * and falls back transparently to Simulated Historical Dataset only for benchmark demo stocks.
 */
export async function resolveStockDetail(
  identifier: string
): Promise<StockDetail | null> {
  const master = await findMasterRecord(identifier);
  const canonicalSymbol = master?.symbol ?? identifier.trim().toUpperCase();

  // Check short-lived cache first
  const cached = quoteCache.get(canonicalSymbol);
  if (cached && Date.now() - cached.fetchedAt < QUOTE_CACHE_TTL_MS) {
    return cached.detail;
  }

  const simulatedFallback = getSimulatedStockDetail(canonicalSymbol);

  // Try genuine delayed exchange OHLCV via Yahoo Finance (.NS first, then .BO)
  const yahooCandidates: string[] = [];
  if (master?.nseSymbol) {
    yahooCandidates.push(`${master.nseSymbol}.NS`);
  } else if (!master) {
    yahooCandidates.push(`${canonicalSymbol}.NS`);
  }
  if (master?.bseSymbol) {
    yahooCandidates.push(`${master.bseSymbol}.BO`);
  }

  let yahooData: Awaited<ReturnType<typeof fetchYahooOhlcv>> = null;
  for (const ticker of yahooCandidates) {
    yahooData = await fetchYahooOhlcv(ticker);
    if (yahooData) break;
  }

  if (yahooData && yahooData.bars.length >= 5) {
    const { series, summary } = computeTechnicalSeries(yahooData.bars);
    const last = series[series.length - 1];
    const prev = series[series.length - 2];

    const currentPrice = yahooData.regularMarketPrice ?? last.close;
    const change = Number((currentPrice - prev.close).toFixed(2));
    const changePercent = Number(
      ((change / Math.max(prev.close, 0.01)) * 100).toFixed(2)
    );
    const week52High =
      yahooData.week52High ??
      Number(Math.max(...yahooData.bars.map((b) => b.high)).toFixed(2));
    const week52Low =
      yahooData.week52Low ??
      Number(Math.min(...yahooData.bars.map((b) => b.low)).toFixed(2));

    const detail: StockDetail = {
      symbol: canonicalSymbol,
      bseCode: master?.bseCode ?? simulatedFallback?.bseCode ?? '—',
      name: master?.companyName ?? simulatedFallback?.name ?? canonicalSymbol,
      sector:
        master?.sector ??
        simulatedFallback?.sector ??
        `${master?.exchange ?? 'NSE / BSE'} Listed Equity (${master?.series ?? 'EQ'})`,
      exchange: (master?.exchange as 'NSE / BSE' | 'NSE' | 'BSE') ?? 'NSE / BSE',
      price: currentPrice,
      prevClose: prev.close,
      change,
      changePercent,
      dayHigh: last.high,
      dayLow: last.low,
      open: last.open,
      volume: last.volume,
      avgVolume20d: Math.round(last.volumeSma20 ?? last.volume),
      week52High,
      week52Low,
      fundamentals: simulatedFallback
        ? simulatedFallback.fundamentals
        : {
            marketCapCr: 0,
            peRatio: null,
            pbRatio: null,
            roePercent: null,
            dividendYieldPercent: null,
            epsInr: null,
            debtToEquity: null,
            faceValueInr: 0,
            bookValueInr: null,
            fundamentalsStatus: 'Unavailable in Delayed Feed',
          },
      dataMode: 'Delayed Reference Feed',
      asOfDate: last.date,
      history: series,
      technicalSummary: summary,
    };

    quoteCache.set(canonicalSymbol, { fetchedAt: Date.now(), detail });

    // Cache verified delayed quote back into PostgreSQL stock_master asynchronously
    if (master) {
      db.update(stockMaster)
        .set({
          lastPrice: currentPrice,
          changePercent,
          priceSource: 'Delayed Reference Feed',
          priceUpdatedAt: new Date(),
        })
        .where(eq(stockMaster.id, master.id))
        .catch((err) => {
          console.warn('Failed to update stock_master cached price:', err);
        });
    }

    return detail;
  }

  // Fallback to simulated benchmark dataset ONLY if this stock exists in our benchmark set
  if (simulatedFallback) {
    return simulatedFallback;
  }

  // If the stock exists in NSE/BSE master but upstream delayed feed has no OHLCV data,
  // never fabricate fake prices — return null so the route surfaces an explicit unavailable state.
  return null;
}
