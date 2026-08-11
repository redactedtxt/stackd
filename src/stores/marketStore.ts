import { create } from 'zustand';
import type { Quote } from '../types';
import { ASSETS } from '../data/assets';
import { nextTickPrice, prevClose } from '../lib/market';
import { usePortfolioStore } from './portfolioStore';

// ---------------------------------------------------------------------------
// Live quotes. On startup every asset opens at yesterday's simulated close,
// then a single interval ticks all prices every ~3 seconds. Each tick also
// feeds the portfolio store so limit orders fill and price alerts fire in
// (simulated) real time.
// ---------------------------------------------------------------------------

interface MarketState {
  quotes: Record<string, Quote>;
  startTicker: () => void;
}

const TICK_MS = 3000;
let tickerStarted = false;

function buildInitialQuotes(): Record<string, Quote> {
  const quotes: Record<string, Quote> = {};
  for (const a of ASSETS) {
    const pc = prevClose(a.symbol);
    // Open slightly away from yesterday's close so day-change isn't 0.00%.
    const price = nextTickPrice(a.symbol, pc);
    quotes[a.symbol] = {
      symbol: a.symbol,
      price,
      prevClose: pc,
      dayChange: price - pc,
      dayChangePct: ((price - pc) / pc) * 100,
    };
  }
  return quotes;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  quotes: buildInitialQuotes(),

  startTicker: () => {
    if (tickerStarted) return; // guard against React StrictMode double-mount
    tickerStarted = true;
    setInterval(() => {
      const prev = get().quotes;
      const quotes: Record<string, Quote> = {};
      for (const a of ASSETS) {
        const q = prev[a.symbol];
        const price = nextTickPrice(a.symbol, q.price);
        quotes[a.symbol] = {
          ...q,
          price,
          dayChange: price - q.prevClose,
          dayChangePct: ((price - q.prevClose) / q.prevClose) * 100,
        };
      }
      set({ quotes });
      usePortfolioStore.getState().processTick(quotes);
    }, TICK_MS);
  },
}));

/** Convenience hook: live quote for one symbol. */
export function useQuote(symbol: string): Quote {
  return useMarketStore((s) => s.quotes[symbol]);
}
