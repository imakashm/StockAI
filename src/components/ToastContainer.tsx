import { BellRing, TrendingDown, TrendingUp, X } from 'lucide-react';
import type { ToastNotification } from '../types/market.ts';

interface ToastContainerProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
  onViewStock?: (symbol: string) => void;
}

export function ToastContainer({
  toasts,
  onDismiss,
  onViewStock,
}: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Price alert notifications"
      className="fixed bottom-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2.5"
    >
      {toasts.map((toast) => {
        const borderClass =
          toast.tone === 'bullish'
            ? 'border-emerald-500/50'
            : toast.tone === 'bearish'
            ? 'border-red-500/50'
            : 'border-blue-500/50';

        const iconColor =
          toast.tone === 'bullish'
            ? 'text-emerald-400'
            : toast.tone === 'bearish'
            ? 'text-red-400'
            : 'text-blue-400';

        const Icon =
          toast.tone === 'bullish'
            ? TrendingUp
            : toast.tone === 'bearish'
            ? TrendingDown
            : BellRing;

        return (
          <div
            key={toast.id}
            role="status"
            className={`rounded-xl border ${borderClass} bg-[#0D1321]/98 p-4 shadow-2xl backdrop-blur-md`}
          >
            <div className="flex items-start gap-3">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-50 truncate">
                    {toast.title}
                  </p>
                  <button
                    type="button"
                    onClick={() => onDismiss(toast.id)}
                    aria-label="Dismiss notification"
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  {toast.message}
                </p>
                <div className="mt-2.5 flex items-center justify-between text-[11px]">
                  <span className="font-mono tabular-nums text-slate-500">
                    {toast.timestamp}
                  </span>
                  {toast.symbol && onViewStock && (
                    <button
                      type="button"
                      onClick={() => {
                        onViewStock(toast.symbol!);
                        onDismiss(toast.id);
                      }}
                      className="font-medium text-blue-400 hover:text-blue-300 hover:underline whitespace-nowrap"
                    >
                      Open {toast.symbol} Analysis
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
