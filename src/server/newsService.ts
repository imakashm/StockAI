import type { NewsArticle, NewsCategory } from '../types/market.ts';

const VALID_CATEGORIES: NewsCategory[] = [
  'Indian Stock Market',
  'NSE & BSE Updates',
  'Company News',
  'Corporate Results',
  'RBI & Economic News',
  'Global Market Updates',
];

interface FeedSource {
  name: string;
  url: string;
}

const CATEGORY_FEEDS: Record<NewsCategory, FeedSource[]> = {
  'Indian Stock Market': [
    {
      name: 'The Economic Times',
      url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
    },
    {
      name: 'Livemint',
      url: 'https://www.livemint.com/rss/markets',
    },
    {
      name: 'Business Standard',
      url: 'https://www.business-standard.com/rss/markets-106.rss',
    },
  ],
  'NSE & BSE Updates': [
    {
      name: 'Google News India (NSE/BSE)',
      url: 'https://news.google.com/rss/search?q=NSE+OR+BSE+OR+SEBI+circular+OR+listing+OR+index&hl=en-IN&gl=IN&ceid=IN:en',
    },
    {
      name: 'The Economic Times',
      url: 'https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms',
    },
  ],
  'Company News': [
    {
      name: 'Livemint',
      url: 'https://www.livemint.com/rss/companies',
    },
    {
      name: 'The Economic Times',
      url: 'https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms',
    },
  ],
  'Corporate Results': [
    {
      name: 'The Economic Times',
      url: 'https://economictimes.indiatimes.com/markets/stocks/earnings/rssfeeds/13357555.cms',
    },
    {
      name: 'Google News India (Results)',
      url: 'https://news.google.com/rss/search?q=%22quarterly+results%22+OR+%22Q1+results%22+OR+%22Q2+results%22+OR+%22Q3+results%22+OR+%22Q4+results%22+NSE+India&hl=en-IN&gl=IN&ceid=IN:en',
    },
  ],
  'RBI & Economic News': [
    {
      name: 'Reserve Bank of India',
      url: 'https://www.rbi.org.in/pressreleases_rss.xml',
    },
    {
      name: 'The Economic Times',
      url: 'https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms',
    },
  ],
  'Global Market Updates': [
    {
      name: 'MarketWatch',
      url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',
    },
    {
      name: 'BBC Business',
      url: 'https://feeds.bbci.co.uk/news/business/rss.xml',
    },
  ],
};

interface CachedCategory {
  fetchedAt: number;
  articles: NewsArticle[];
  sourcesUsed: string[];
}

const newsCache = new Map<NewsCategory, CachedCategory>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function isValidNewsCategory(cat: string): cat is NewsCategory {
  return VALID_CATEGORIES.includes(cat as NewsCategory);
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
      const n = parseInt(hex, 16);
      return Number.isFinite(n) ? String.fromCharCode(n) : '';
    });
}

function stripHtmlTags(input: string): string {
  return decodeHtmlEntities(input)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = block.match(regex);
  return match ? match[1].trim() : '';
}

function formatPublishedIst(dateStr: string): { iso: string; label: string; epoch: number } {
  const parsed = Date.parse(dateStr);
  if (!Number.isNaN(parsed)) {
    const dt = new Date(parsed);
    const label = `${dt.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })} IST`;
    return { iso: dt.toISOString(), label, epoch: parsed };
  }
  const now = new Date();
  return {
    iso: now.toISOString(),
    label: 'Publication time unavailable — see source',
    epoch: 0,
  };
}

interface ParsedFeedItem {
  article: NewsArticle;
  epoch: number;
}

async function fetchRssFeed(
  feed: FeedSource,
  category: NewsCategory
): Promise<ParsedFeedItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(feed.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'StockMindAI-NewsAggregator/1.0 (+https://stockmind.ai)',
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Feed ${feed.name} returned HTTP ${res.status}`);
    }

    const xml = await res.text();
    const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
    const results: ParsedFeedItem[] = [];

    for (let i = 0; i < Math.min(itemMatches.length, 10); i++) {
      const block = itemMatches[i];
      const rawTitle = extractTag(block, 'title');
      const rawLink = extractTag(block, 'link');
      const rawDesc = extractTag(block, 'description');
      const rawPubDate = extractTag(block, 'pubDate');
      const rawSource = extractTag(block, 'source');

      let headline = stripHtmlTags(rawTitle);
      const url = decodeHtmlEntities(rawLink).trim();
      if (!headline || !isSafeHttpUrl(url)) continue;

      let sourceName = stripHtmlTags(rawSource) || feed.name;
      // Google News titles often end with " - Publisher Name"
      if (feed.name.startsWith('Google News') && headline.includes(' - ')) {
        const lastDash = headline.lastIndexOf(' - ');
        if (lastDash > 15) {
          if (!rawSource) {
            sourceName = headline.slice(lastDash + 3).trim() || sourceName;
          }
          headline = headline.slice(0, lastDash).trim();
        }
      }

      let summary = stripHtmlTags(rawDesc);
      if (!summary || summary.toLowerCase() === headline.toLowerCase()) {
        summary = `Verified report published by ${sourceName}. Open the original article link for full details.`;
      } else if (summary.length > 260) {
        summary = `${summary.slice(0, 257).trimEnd()}...`;
      }

      const pub = formatPublishedIst(stripHtmlTags(rawPubDate));

      results.push({
        epoch: pub.epoch,
        article: {
          id: `${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Buffer.from(
            url
          )
            .toString('base64url')
            .slice(0, 16)}`,
          headline,
          source: sourceName,
          publishedAt: pub.iso,
          publishedLabel: pub.label,
          category,
          summary,
          url,
          verifiedSource: true,
        },
      });
    }

    return results;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchGroundedMarketNews(
  category: NewsCategory,
  forceRefresh = false
): Promise<{
  category: NewsCategory;
  articles: NewsArticle[];
  retrievedAt: string;
  cached: boolean;
  sourcesUsed: string[];
}> {
  const existing = newsCache.get(category);
  if (!forceRefresh && existing && Date.now() - existing.fetchedAt < CACHE_TTL_MS) {
    return {
      category,
      articles: existing.articles,
      retrievedAt: new Date(existing.fetchedAt).toISOString(),
      cached: true,
      sourcesUsed: existing.sourcesUsed,
    };
  }

  const feeds = CATEGORY_FEEDS[category];
  const settled = await Promise.allSettled(
    feeds.map((feed) => fetchRssFeed(feed, category))
  );

  const combined: ParsedFeedItem[] = [];
  const sourcesUsed: string[] = [];

  settled.forEach((outcome, idx) => {
    if (outcome.status === 'fulfilled' && outcome.value.length > 0) {
      combined.push(...outcome.value);
      sourcesUsed.push(feeds[idx].name);
    } else if (outcome.status === 'rejected') {
      console.warn(
        `News feed "${feeds[idx].name}" failed for "${category}":`,
        outcome.reason instanceof Error ? outcome.reason.message : outcome.reason
      );
    }
  });

  if (combined.length === 0) {
    throw new Error(
      `Unable to fetch live financial news for "${category}" from upstream publishers right now. Please try refreshing shortly.`
    );
  }

  // Sort newest-first and deduplicate by normalized headline
  combined.sort((a, b) => b.epoch - a.epoch);
  const seenHeadlines = new Set<string>();
  const deduped: NewsArticle[] = [];

  for (const entry of combined) {
    const key = entry.article.headline.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 64);
    if (seenHeadlines.has(key)) continue;
    seenHeadlines.add(key);
    deduped.push(entry.article);
    if (deduped.length >= 12) break;
  }

  const now = Date.now();
  newsCache.set(category, {
    fetchedAt: now,
    articles: deduped,
    sourcesUsed,
  });

  return {
    category,
    articles: deduped,
    retrievedAt: new Date(now).toISOString(),
    cached: false,
    sourcesUsed,
  };
}
