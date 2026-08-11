import { X } from 'lucide-react';
import { useToastStore } from '../stores/toastStore';

/** Stacked notification cards, top-right on desktop / top on mobile. */
export function Toasts() {
  const { toasts, dismiss } = useToastStore();
  if (!toasts.length) return null;

  const toneBar: Record<string, string> = {
    success: 'bg-brand-500',
    info: 'bg-sky-400',
    alert: 'bg-loss',
  };

  return (
    <div className="pointer-events-none fixed inset-x-3 top-3 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:top-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="card pointer-events-auto flex w-full items-start gap-3 !p-3 shadow-xl animate-fade-up sm:w-80"
        >
          <div className={`mt-0.5 h-8 w-1 shrink-0 rounded-full ${toneBar[t.tone]}`} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold">{t.title}</p>
            {t.body && <p className="mt-0.5 text-xs text-ink-400">{t.body}</p>}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="text-ink-500 hover:text-ink-300"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
