import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  portfolioHoldings,
  predictionLogs,
  priceAlerts,
  users,
  watchlistItems,
  watchlists,
} from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string | null
) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName ?? null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName ?? null,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Failed to upsert user:', error);
    throw new Error('Unable to synchronize user profile.', { cause: error });
  }
}

export async function listUserWatchlists(userUid: string) {
  try {
    const lists = await db
      .select()
      .from(watchlists)
      .where(eq(watchlists.userUid, userUid))
      .orderBy(watchlists.createdAt);

    if (lists.length === 0) {
      const [created] = await db
        .insert(watchlists)
        .values({ userUid, name: 'Core NSE Watchlist' })
        .returning();

      const defaultSymbols = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK'];
      await db
        .insert(watchlistItems)
        .values(
          defaultSymbols.map((symbol) => ({
            watchlistId: created.id,
            symbol,
          }))
        )
        .onConflictDoNothing();

      return [
        {
          id: created.id,
          name: created.name,
          createdAt: created.createdAt,
          symbols: defaultSymbols,
        },
      ];
    }

    const result = [];
    for (const list of lists) {
      const items = await db
        .select()
        .from(watchlistItems)
        .where(eq(watchlistItems.watchlistId, list.id))
        .orderBy(watchlistItems.addedAt);
      result.push({
        id: list.id,
        name: list.name,
        createdAt: list.createdAt,
        symbols: items.map((i) => i.symbol),
      });
    }
    return result;
  } catch (error) {
    console.error('Failed to load watchlists:', error);
    throw new Error('Unable to load watchlists. Please try again later.', {
      cause: error,
    });
  }
}

export async function createUserWatchlist(userUid: string, name: string) {
  try {
    const [created] = await db
      .insert(watchlists)
      .values({ userUid, name })
      .returning();
    return {
      id: created.id,
      name: created.name,
      createdAt: created.createdAt,
      symbols: [] as string[],
    };
  } catch (error) {
    console.error('Failed to create watchlist:', error);
    throw new Error('Unable to create watchlist.', { cause: error });
  }
}

export async function deleteUserWatchlist(userUid: string, watchlistId: number) {
  try {
    const deleted = await db
      .delete(watchlists)
      .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userUid, userUid)))
      .returning();
    return deleted.length > 0;
  } catch (error) {
    console.error('Failed to delete watchlist:', error);
    throw new Error('Unable to delete watchlist.', { cause: error });
  }
}

export async function addSymbolToWatchlist(
  userUid: string,
  watchlistId: number,
  symbol: string
) {
  try {
    const ownerCheck = await db
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userUid, userUid)));
    if (ownerCheck.length === 0) {
      return null;
    }

    await db
      .insert(watchlistItems)
      .values({ watchlistId, symbol })
      .onConflictDoNothing();
    return true;
  } catch (error) {
    console.error('Failed to add watchlist item:', error);
    throw new Error('Unable to add stock to watchlist.', { cause: error });
  }
}

export async function removeSymbolFromWatchlist(
  userUid: string,
  watchlistId: number,
  symbol: string
) {
  try {
    const ownerCheck = await db
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userUid, userUid)));
    if (ownerCheck.length === 0) {
      return null;
    }

    await db
      .delete(watchlistItems)
      .where(
        and(
          eq(watchlistItems.watchlistId, watchlistId),
          eq(watchlistItems.symbol, symbol)
        )
      );
    return true;
  } catch (error) {
    console.error('Failed to remove watchlist item:', error);
    throw new Error('Unable to remove stock from watchlist.', { cause: error });
  }
}

export async function listUserPortfolio(userUid: string) {
  try {
    return await db
      .select()
      .from(portfolioHoldings)
      .where(eq(portfolioHoldings.userUid, userUid))
      .orderBy(desc(portfolioHoldings.createdAt));
  } catch (error) {
    console.error('Failed to fetch portfolio holdings:', error);
    throw new Error('Unable to load portfolio holdings.', { cause: error });
  }
}

export async function createPortfolioHolding(input: {
  userUid: string;
  symbol: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
  notes?: string | null;
}) {
  try {
    const [created] = await db
      .insert(portfolioHoldings)
      .values({
        userUid: input.userUid,
        symbol: input.symbol,
        quantity: input.quantity,
        purchasePrice: input.purchasePrice,
        purchaseDate: input.purchaseDate,
        notes: input.notes ?? null,
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Failed to add portfolio holding:', error);
    throw new Error('Unable to save portfolio entry.', { cause: error });
  }
}

export async function deletePortfolioHolding(userUid: string, holdingId: number) {
  try {
    const deleted = await db
      .delete(portfolioHoldings)
      .where(
        and(
          eq(portfolioHoldings.id, holdingId),
          eq(portfolioHoldings.userUid, userUid)
        )
      )
      .returning();
    return deleted.length > 0;
  } catch (error) {
    console.error('Failed to delete portfolio holding:', error);
    throw new Error('Unable to remove portfolio entry.', { cause: error });
  }
}

export async function listUserPredictionLogs(userUid: string) {
  try {
    return await db
      .select()
      .from(predictionLogs)
      .where(eq(predictionLogs.userUid, userUid))
      .orderBy(desc(predictionLogs.createdAt))
      .limit(100);
  } catch (error) {
    console.error('Failed to list prediction logs:', error);
    throw new Error('Unable to load prediction history.', { cause: error });
  }
}

export async function savePredictionLog(input: {
  userUid: string;
  symbol: string;
  timeframe: string;
  predictedDirection: string;
  bullishProb: number;
  bearishProb: number;
  sidewaysProb: number;
  confidence: number;
  referencePrice: number;
  targetDate: string;
  modelVersion: string;
  dataMode: string;
  reasoningSummary: string;
}) {
  try {
    const [created] = await db
      .insert(predictionLogs)
      .values(input)
      .returning();
    return created;
  } catch (error) {
    console.error('Failed to save prediction log:', error);
    throw new Error('Unable to log prediction.', { cause: error });
  }
}

export async function evaluatePredictionLog(input: {
  userUid: string;
  logId: number;
  actualPrice: number;
  actualReturnPct: number;
  evaluationStatus: string;
}) {
  try {
    const [updated] = await db
      .update(predictionLogs)
      .set({
        actualPrice: input.actualPrice,
        actualReturnPct: input.actualReturnPct,
        evaluationStatus: input.evaluationStatus,
      })
      .where(
        and(
          eq(predictionLogs.id, input.logId),
          eq(predictionLogs.userUid, input.userUid)
        )
      )
      .returning();
    return updated ?? null;
  } catch (error) {
    console.error('Failed to evaluate prediction log:', error);
    throw new Error('Unable to record prediction evaluation.', { cause: error });
  }
}

export async function listUserPriceAlerts(userUid: string) {
  try {
    return await db
      .select()
      .from(priceAlerts)
      .where(eq(priceAlerts.userUid, userUid))
      .orderBy(desc(priceAlerts.createdAt));
  } catch (error) {
    console.error('Failed to load price alerts:', error);
    throw new Error('Unable to load price alerts.', { cause: error });
  }
}

export async function createUserPriceAlert(input: {
  userUid: string;
  symbol: string;
  condition: 'above' | 'below';
  targetPrice: number;
  status?: 'active' | 'triggered';
  triggeredPrice?: number | null;
  triggeredAt?: Date | null;
}) {
  try {
    const [created] = await db
      .insert(priceAlerts)
      .values({
        userUid: input.userUid,
        symbol: input.symbol,
        condition: input.condition,
        targetPrice: input.targetPrice,
        status: input.status ?? 'active',
        triggeredPrice: input.triggeredPrice ?? null,
        triggeredAt: input.triggeredAt ?? null,
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Failed to create price alert:', error);
    throw new Error('Unable to create price alert.', { cause: error });
  }
}

export async function updateUserPriceAlertStatus(input: {
  userUid: string;
  alertId: number;
  status: 'active' | 'triggered';
  triggeredPrice: number | null;
  triggeredAt: Date | null;
}) {
  try {
    const [updated] = await db
      .update(priceAlerts)
      .set({
        status: input.status,
        triggeredPrice: input.triggeredPrice,
        triggeredAt: input.triggeredAt,
      })
      .where(
        and(eq(priceAlerts.id, input.alertId), eq(priceAlerts.userUid, input.userUid))
      )
      .returning();
    return updated ?? null;
  } catch (error) {
    console.error('Failed to update price alert status:', error);
    throw new Error('Unable to update price alert.', { cause: error });
  }
}

export async function deleteUserPriceAlert(userUid: string, alertId: number) {
  try {
    const deleted = await db
      .delete(priceAlerts)
      .where(
        and(eq(priceAlerts.id, alertId), eq(priceAlerts.userUid, userUid))
      )
      .returning();
    return deleted.length > 0;
  } catch (error) {
    console.error('Failed to delete price alert:', error);
    throw new Error('Unable to delete price alert.', { cause: error });
  }
}

