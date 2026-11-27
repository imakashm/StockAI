import { ShieldAlert } from 'lucide-react';

export function DisclaimerBanner({ compact = false }: { compact?: boolean }) {
  return (
    <section
      aria-label="Legal and Risk Disclaimer"
      className={`rounded-xl border border-slate-800/90 bg-[#0B1120] ${
        compact ? 'px-4 py-3' : 'px-5 py-4'
      }`}
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-200">
            Educational Analytics & SEBI Compliance Notice
          </p>
          <p className="text-xs leading-relaxed text-slate-400">
            StockMind AI provides educational market analytics and algorithmic estimates.
            Predictions are uncertain and are not guaranteed. Nothing on this platform
            constitutes personalised investment advice or a recommendation to buy, sell or
            hold securities. Users should independently evaluate investment risks.
          </p>
        </div>
      </div>
    </section>
  );
}
