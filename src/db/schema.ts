import { relations } from 'drizzle-orm';
import {
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const stockMaster = pgTable(
  'stock_master',
  {
    id: serial('id').primaryKey(),
    isin: text('isin').notNull().unique(),
    symbol: text('symbol').notNull(),
    nseSymbol: text('nse_symbol'),
    bseCode: text('bse_code'),
    bseSymbol: text('bse_symbol'),
    companyName: text('company_name').notNull(),
    shortName: text('short_name'),
    exchange: text('exchange').notNull(), // 'NSE / BSE' | 'NSE' | 'BSE'
    series: text('series'),
    sector: text('sector'),
    lastPrice: doublePrecision('last_price'),
    changePercent: doublePrecision('change_percent'),
    priceSource: text('price_source'), // 'Delayed Reference Feed' | 'Simulated Historical Dataset' | null
    priceUpdatedAt: timestamp('price_updated_at'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('stock_master_symbol_idx').on(table.symbol),
    index('stock_master_nse_symbol_idx').on(table.nseSymbol),
    index('stock_master_bse_code_idx').on(table.bseCode),
    index('stock_master_company_name_idx').on(table.companyName),
    index('stock_master_exchange_idx').on(table.exchange),
  ]
);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const watchlists = pgTable('watchlists', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const watchlistItems = pgTable(
  'watchlist_items',
  {
    id: serial('id').primaryKey(),
    watchlistId: integer('watchlist_id')
      .notNull()
      .references(() => watchlists.id, { onDelete: 'cascade' }),
    symbol: text('symbol').notNull(),
    addedAt: timestamp('added_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('watchlist_items_watchlist_symbol_idx').on(
      table.watchlistId,
      table.symbol
    ),
  ]
);

export const portfolioHoldings = pgTable('portfolio_holdings', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(),
  quantity: doublePrecision('quantity').notNull(),
  purchasePrice: doublePrecision('purchase_price').notNull(),
  purchaseDate: text('purchase_date').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const predictionLogs = pgTable('prediction_logs', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(),
  timeframe: text('timeframe').notNull(),
  predictedDirection: text('predicted_direction').notNull(),
  bullishProb: integer('bullish_prob').notNull(),
  bearishProb: integer('bearish_prob').notNull(),
  sidewaysProb: integer('sideways_prob').notNull(),
  confidence: integer('confidence').notNull(),
  referencePrice: doublePrecision('reference_price').notNull(),
  targetDate: text('target_date').notNull(),
  actualPrice: doublePrecision('actual_price'),
  actualReturnPct: doublePrecision('actual_return_pct'),
  evaluationStatus: text('evaluation_status')
    .notNull()
    .default('Pending Evaluation'),
  modelVersion: text('model_version').notNull(),
  dataMode: text('data_mode').notNull(),
  reasoningSummary: text('reasoning_summary').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const priceAlerts = pgTable('price_alerts', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(),
  condition: text('condition').notNull(), // 'above' | 'below'
  targetPrice: doublePrecision('target_price').notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'triggered'
  triggeredPrice: doublePrecision('triggered_price'),
  triggeredAt: timestamp('triggered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  watchlists: many(watchlists),
  portfolioHoldings: many(portfolioHoldings),
  predictionLogs: many(predictionLogs),
  priceAlerts: many(priceAlerts),
}));

export const watchlistsRelations = relations(watchlists, ({ one, many }) => ({
  user: one(users, {
    fields: [watchlists.userUid],
    references: [users.uid],
  }),
  items: many(watchlistItems),
}));

export const watchlistItemsRelations = relations(watchlistItems, ({ one }) => ({
  watchlist: one(watchlists, {
    fields: [watchlistItems.watchlistId],
    references: [watchlists.id],
  }),
}));

export const portfolioHoldingsRelations = relations(
  portfolioHoldings,
  ({ one }) => ({
    user: one(users, {
      fields: [portfolioHoldings.userUid],
      references: [users.uid],
    }),
  })
);

export const predictionLogsRelations = relations(predictionLogs, ({ one }) => ({
  user: one(users, {
    fields: [predictionLogs.userUid],
    references: [users.uid],
  }),
}));

export const priceAlertsRelations = relations(priceAlerts, ({ one }) => ({
  user: one(users, {
    fields: [priceAlerts.userUid],
    references: [users.uid],
  }),
}));

