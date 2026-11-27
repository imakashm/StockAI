import { getGeminiClient } from './gemini.ts';
import {
  DATA_SOURCE_MODE,
  getAllStockDetails,
  getMarketIndices,
} from '../data/indianMarketData.ts';

interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function buildContextSnapshot(message: string): string {
  const upper = message.toUpperCase();
  const allStocks = getAllStockDetails();
  const indices = getMarketIndices();

  const matchedStocks = allStocks.filter(
    (s) =>
      upper.includes(s.symbol) ||
      upper.includes(s.name.toUpperCase().split(' ')[0])
  );

  const selectedStocks =
    matchedStocks.length > 0 ? matchedStocks.slice(0, 4) : allStocks.slice(0, 5);

  const indexSummary = indices
    .map(
      (i) =>
        `${i.name} (${i.exchange}): ${i.value.toLocaleString('en-IN')} (${i.changePercent >= 0 ? '+' : ''}${i.changePercent.toFixed(2)}%)`
    )
    .join('; ');

  const stockLines = selectedStocks.map((s) => {
    const ts = s.technicalSummary;
    return `- ${s.symbol} (${s.name}, ${s.sector}): Ref Price ₹${s.price.toFixed(2)} (${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%), 52W ₹${s.week52Low.toFixed(1)}–₹${s.week52High.toFixed(1)}, MCap ₹${s.fundamentals.marketCapCr.toLocaleString('en-IN')} Cr, P/E ${s.fundamentals.peRatio ?? 'N/A'}, ROE ${s.fundamentals.roePercent ?? 'N/A'}%, RSI(14) ${ts.rsi14.toFixed(1)}, MACD Hist ${ts.macdHistogram.toFixed(2)}, EMA20 ₹${ts.ema20.toFixed(1)}, EMA50 ₹${ts.ema50.toFixed(1)}, SMA200 ₹${ts.sma200.toFixed(1)}, Trend: ${ts.overallTrend}`;
  });

  return `PLATFORM DATASET SNAPSHOT (${DATA_SOURCE_MODE}, as of ${selectedStocks[0]?.asOfDate ?? 'latest session'}):
Indices (Simulated Historical Dataset): ${indexSummary}
Relevant NSE/BSE Equities (Simulated Historical Dataset):
${stockLines.join('\n')}`;
}

export async function generateAnalystReply(
  message: string,
  history: ChatHistoryTurn[]
): Promise<{ reply: string; citations: { title: string; url: string }[] }> {
  const ai = getGeminiClient();
  const snapshot = buildContextSnapshot(message);

  const recentHistory = history.slice(-6).map((turn) => ({
    role: turn.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: turn.content.slice(0, 1500) }],
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: [
      ...recentHistory,
      {
        role: 'user',
        parts: [
          {
            text: `${snapshot}\n\nUSER QUESTION:\n${message}`,
          },
        ],
      },
    ],
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction: `You are StockMind AI Analyst, an educational Indian stock market (NSE & BSE) research assistant.
Rules you MUST strictly follow:
1. Always clearly distinguish between: (a) Verified real-time web facts retrieved via Google Search, (b) StockMind AI's Simulated Historical Dataset technical indicators provided in the prompt context, and (c) Educational analytical estimates or concepts.
2. Never claim guaranteed stock returns, guaranteed price targets, or personalized buy/sell/hold investment advice (respect SEBI educational boundaries).
3. Use crisp, well-structured prose with clear headings or concise bullet points and Indian currency formatting (₹, Cr).
4. If comparing two Indian stocks (e.g., TCS vs Infosys), compare fundamentals, technical trend structure, and key sector risks clearly.`,
    },
  });

  const chunks =
    response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const citations = chunks
    .map((c) => ({
      title: c.web?.title || 'Verified Web Source',
      url: c.web?.uri || '',
    }))
    .filter((c) => isSafeHttpUrl(c.url))
    .slice(0, 5);

  return {
    reply:
      response.text?.trim() ||
      'I could not synthesize a response right now. Please try rephrasing your question.',
    citations,
  };
}
