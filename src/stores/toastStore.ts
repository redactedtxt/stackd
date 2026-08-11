import { create } from 'zustand';
import { uid } from '../lib/rng';

// ---------------------------------------------------------------------------
// Lightweight in-app notification system. Anything can push a toast:
// trade confirmations, filled limit orders, price alerts, dividends, badges.
// ---------------------------------------------------------------------------

export type ToastTone = 'success' | 'info' | 'alert';

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  body?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (tone: ToastTone, title: string, body?: string) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (tone, title, body) => {
    const toast: Toast = { id: uid(), tone, title, body };
    set((s) => ({ toasts: [...s.toasts.slice(-3), toast] }));
    // Auto-dismiss after 5s.
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== toast.id) }));
    }, 5000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience for non-React callers (stores, the market ticker). */
export function toast(tone: ToastTone, title: string, body?: string) {
  useToastStore.getState().push(tone, title, body);
}
