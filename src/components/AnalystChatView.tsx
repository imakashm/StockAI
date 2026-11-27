import { useRef, useState } from 'react';
import { ExternalLink, Loader2, Send, Trash2 } from 'lucide-react';
import type { ChatMessage } from '../types/market.ts';
import { isSafeExternalUrl } from '../lib/format.ts';
import { parseJsonResponse } from '../lib/http.ts';

const STARTER_PROMPTS = [
  'Analyse Reliance stock',
  "Explain today's NIFTY movement",
  'What does RSI mean?',
  'Compare TCS and Infosys',
  'Explain bullish and bearish trends',
  "Summarise today's market news",
];

function FormattedText({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <div className="space-y-2.5 text-sm leading-relaxed text-slate-200">
      {paragraphs.map((block, i) => {
        const lines = block.split('\n').filter((l) => l.trim().length > 0);
        const isBulletBlock = lines.every((l) => /^[-*•]\s+/.test(l.trim()));
        if (isBulletBlock) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 text-slate-300">
              {lines.map((line, j) => (
                <li key={j}>{line.trim().replace(/^[-*•]\s+/, '').replace(/\*\*/g, '')}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {block.replace(/\*\*/g, '')}
          </p>
        );
      })}
    </div>
  );
}

export function AnalystChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Welcome to StockMind AI Analyst. Ask me to analyse NSE/BSE stocks, explain technical indicators like RSI or MACD, compare Indian IT or banking peers, or summarise recent Indian market developments.\n\nI clearly separate verified web sources, simulated dataset indicators, and educational estimates.',
      timestamp: new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setSending(true);

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 40);

    try {
      const historyPayload = nextMessages
        .filter((m) => m.id !== 'welcome' && !m.error)
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          message: trimmed,
          history: historyPayload.slice(0, -1),
        }),
      });
      const data = await parseJsonResponse<{
        reply: string;
        citations?: { title: string; url: string }[];
      }>(res);

      const replyMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        citations: Array.isArray(data.citations) ? data.citations : [],
        timestamp: new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      setMessages((prev) => [...prev, replyMsg]);
    } catch (err: unknown) {
      const errText =
        err instanceof Error
          ? err.message
          : 'Unable to reach AI Analyst right now.';
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: errText,
          error: true,
          timestamp: new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendQuestion(input);
  };

  const handleClear = () => {
    setMessages((prev) => prev.slice(0, 1));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-800/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            AI Stock Analyst
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Grounded Indian equity research assistant with Google Search citations and clear separation of facts vs estimates.
          </p>
        </div>

        <button
          type="button"
          onClick={handleClear}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0D1321] px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100 whitespace-nowrap self-start sm:self-auto transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear Thread
        </button>
      </div>

      {/* Starter Prompt Bar */}
      <div className="flex flex-wrap gap-2">
        {STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={sending}
            onClick={() => sendQuestion(prompt)}
            className="rounded-lg border border-slate-800 bg-[#0D1321] px-3 py-1.5 text-xs text-slate-300 hover:border-blue-500 hover:text-blue-200 disabled:opacity-50 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Conversation Thread */}
      <section className="flex flex-col rounded-xl border border-slate-800 bg-[#0D1321] overflow-hidden">
        <div className="max-h-[540px] min-h-[380px] overflow-y-auto p-5 space-y-5">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-3xl rounded-xl px-4 py-3 ${
                    isUser
                      ? 'bg-blue-600/20 border border-blue-500/40 text-slate-100'
                      : msg.error
                      ? 'bg-red-950/30 border border-red-800/60 text-red-200'
                      : 'bg-[#070B14] border border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="mb-1.5 flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="font-medium text-slate-300">
                      {isUser ? 'You' : 'StockMind AI Analyst'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{msg.timestamp}</span>
                  </div>

                  <FormattedText text={msg.content} />

                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 border-t border-slate-800 pt-2.5">
                      <div className="text-[11px] font-medium text-slate-400 mb-1.5">
                        Verified Web Sources
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {msg.citations
                          .filter((c) => isSafeExternalUrl(c.url))
                          .map((c, idx) => (
                            <a
                              key={idx}
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
                            >
                              <span className="truncate max-w-[220px]">{c.title}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {sending && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              Analysing market context and checking verified sources...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-slate-800 bg-[#070B14] p-3 flex items-center gap-2.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about NSE stocks, NIFTY trends, RSI/MACD, or Indian market news..."
            maxLength={1500}
            className="flex-1 rounded-lg border border-slate-700 bg-[#0D1321] px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
