import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Goal,
  Holding,
  LimitOrder,
  OrderSide,
  PriceAlert,
  Quote,
  RecurringPlan,
  Transaction,
} from '../types';
import { getAsset } from '../data/assets';
import { closeOn } from '../lib/market';
import { hashString, mulberry32, uid } from '../lib/rng';
import { fmtMoney, fmtPrice, fmtQty } from '../lib/format';
import { toast } from './toastStore';
import { useUserStore } from './userStore';

// ---------------------------------------------------------------------------
// The brokerage ledger. Single practice account (framed as a TFSA in the UI)
// holding cash + positions, with a full transaction log as the source of
// truth for performance history.
//
// Key mechanics:
//  • Market orders   — instant fill at the live price, fractional allowed.
//  • Limit orders    — stored and checked against every live tick.
//  • Price alerts    — same tick loop, fire once then mark triggered.
//  • Recurring buys  — executed on app load for any runs that came due while
//                      away, filled at that day's simulated close.
//  • Round-ups       — weekly "spare change" sweep (seeded random $3–9)
//                      auto-invested into an ETF of the user's choice.
//  • Dividends       — paid on the 1st of each month at yield/12, optionally
//                      auto-reinvested (DRIP). Real payers are mostly
//                      quarterly; monthly is an intentional simplification so
//                      learners see the feedback loop sooner.
// ---------------------------------------------------------------------------

export const STARTING_CASH = 10_000;
const DAY_MS = 86_400_000;

interface Settings {
  drip: boolean;
  roundups: boolean;
  roundupSymbol: string;
}

interface PortfolioState {
  cash: number;
  holdings: Holding[];
  transactions: Transaction[];
  orders: LimitOrder[];
  alerts: PriceAlert[];
  watchlist: string[];
  recurring: RecurringPlan[];
  goals: Goal[];
  settings: Settings;
  /** Timestamp up to which scheduled events (dividends etc.) are processed. */
  lastEventCheck: number;

  openAccount: () => void;
  deposit: (amount: number) => void;
  trade: (symbol: string, side: OrderSide, qty: number, price: number, note?: string) => boolean;
  placeLimitOrder: (symbol: string, side: OrderSide, qty: number, limitPrice: number) => void;
  cancelOrder: (id: string) => void;
  toggleWatch: (symbol: string) => void;
  addAlert: (symbol: string, direction: 'above' | 'below', targetPrice: number) => void;
  removeAlert: (id: string) => void;
  addRecurring: (symbol: string, amount: number, cadence: RecurringPlan['cadence']) => void;
  toggleRecurring: (id: string) => void;
  removeRecurring: (id: string) => void;
  addGoal: (name: string, emoji: string, target: number) => void;
  removeGoal: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  processTick: (quotes: Record<string, Quote>) => void;
  processScheduledEvents: () => void;
  resetAll: () => void;
}

function cadenceMs(c: RecurringPlan['cadence']): number {
  return c === 'weekly' ? 7 * DAY_MS : c === 'biweekly' ? 14 * DAY_MS : 30 * DAY_MS;
}

/** Apply a fill to holdings, returning the new array. */
function applyFill(holdings: Holding[], symbol: string, side: OrderSide, qty: number, price: number): Holding[] {
  const existing = holdings.find((h) => h.symbol === symbol);
  if (side === 'buy') {
    if (!existing) return [...holdings, { symbol, qty, avgCost: price }];
    // Weighted-average cost basis.
    const totalCost = existing.avgCost * existing.qty + price * qty;
    const totalQty = existing.qty + qty;
    return holdings.map((h) =>
      h.symbol === symbol ? { ...h, qty: totalQty, avgCost: totalCost / totalQty } : h,
    );
  }
  // Sell: reduce qty; remove the row when (near) zero. avgCost unchanged.
  if (!existing) return holdings;
  const remaining = existing.qty - qty;
  if (remaining <= 1e-9) return holdings.filter((h) => h.symbol !== symbol);
  return holdings.map((h) => (h.symbol === symbol ? { ...h, qty: remaining } : h));
}

const initialState = {
  cash: 0,
  holdings: [] as Holding[],
  transactions: [] as Transaction[],
  orders: [] as LimitOrder[],
  alerts: [] as PriceAlert[],
  watchlist: ['VOO', 'AAPL', 'BTC'] as string[],
  recurring: [] as RecurringPlan[],
  goals: [] as Goal[],
  settings: { drip: true, roundups: false, roundupSymbol: 'XEQT' },
  lastEventCheck: 0,
};

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      ...initialState,

      openAccount: () => {
        set({
          cash: STARTING_CASH,
          lastEventCheck: Date.now(),
          transactions: [
            {
              id: uid(),
              type: 'deposit',
              amount: STARTING_CASH,
              timestamp: Date.now(),
              note: 'Welcome bonus — your practice money 🎓',
            },
          ],
        });
      },

      deposit: (amount) => {
        if (amount <= 0) return;
        set((s) => ({
          cash: s.cash + amount,
          transactions: [
            { id: uid(), type: 'deposit', amount, timestamp: Date.now(), note: 'Top-up' },
            ...s.transactions,
          ],
        }));
        toast('success', `Added ${fmtMoney(amount)}`, 'Practice cash deposited.');
      },

      trade: (symbol, side, qty, price, note) => {
        const s = get();
        const cost = qty * price;
        if (side === 'buy' && cost > s.cash + 1e-6) {
          toast('alert', 'Not enough cash', `That order needs ${fmtMoney(cost)}.`);
          return false;
        }
        const held = s.holdings.find((h) => h.symbol === symbol)?.qty ?? 0;
        if (side === 'sell' && qty > held + 1e-9) {
          toast('alert', 'Not enough shares', `You only hold ${fmtQty(held)} ${symbol}.`);
          return false;
        }

        const tx: Transaction = {
          id: uid(),
          type: side,
          symbol,
          qty,
          price,
          amount: side === 'buy' ? -cost : cost,
          timestamp: Date.now(),
          note,
        };
        set({
          cash: s.cash + tx.amount,
          holdings: applyFill(s.holdings, symbol, side, qty, price),
          transactions: [tx, ...s.transactions],
        });

        const verb = side === 'buy' ? 'Bought' : 'Sold';
        toast('success', `${verb} ${fmtQty(qty)} ${symbol}`, `@ ${fmtPrice(price)} · ${fmtMoney(cost)}`);
        useUserStore.getState().addXp(15, 'Trade executed');
        checkBadges();
        return true;
      },

      placeLimitOrder: (symbol, side, qty, limitPrice) => {
        const order: LimitOrder = { id: uid(), symbol, side, qty, limitPrice, createdAt: Date.now() };
        set((s) => ({ orders: [order, ...s.orders] }));
        toast('info', `Limit ${side} placed`, `${fmtQty(qty)} ${symbol} @ ${fmtPrice(limitPrice)}`);
      },

      cancelOrder: (id) => set((s) => ({ orders: s.orders.filter((o) => o.id !== id) })),

      toggleWatch: (symbol) =>
        set((s) => ({
          watchlist: s.watchlist.includes(symbol)
            ? s.watchlist.filter((w) => w !== symbol)
            : [...s.watchlist, symbol],
        })),

      addAlert: (symbol, direction, targetPrice) => {
        const alert: PriceAlert = {
          id: uid(),
          symbol,
          direction,
          targetPrice,
          triggered: false,
          createdAt: Date.now(),
        };
        set((s) => ({ alerts: [alert, ...s.alerts] }));
        toast('info', 'Alert set', `${symbol} ${direction} ${fmtPrice(targetPrice)}`);
      },

      removeAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),

      addRecurring: (symbol, amount, cadence) => {
        const plan: RecurringPlan = {
          id: uid(),
          symbol,
          amount,
          cadence,
          nextRun: Date.now() + cadenceMs(cadence),
          active: true,
        };
        set((s) => ({ recurring: [plan, ...s.recurring] }));
        toast('success', 'Auto-invest on 🔁', `${fmtMoney(amount)} of ${symbol}, ${cadence}`);
        useUserStore.getState().earnBadge('planner');
      },

      toggleRecurring: (id) =>
        set((s) => ({
          recurring: s.recurring.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
        })),

      removeRecurring: (id) =>
        set((s) => ({ recurring: s.recurring.filter((r) => r.id !== id) })),

      addGoal: (name, emoji, target) => {
        set((s) => ({
          goals: [...s.goals, { id: uid(), name, emoji, target, createdAt: Date.now() }],
        }));
        useUserStore.getState().earnBadge('goal-getter');
      },

      removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      // Called by the market ticker every few seconds with fresh quotes.
      processTick: (quotes) => {
        const s = get();

        // 1. Fill any limit orders whose trigger price has been crossed.
        for (const o of s.orders) {
          const q = quotes[o.symbol];
          if (!q) continue;
          const crossed =
            o.side === 'buy' ? q.price <= o.limitPrice : q.price >= o.limitPrice;
          if (!crossed) continue;
          // Remove the order first so a failed fill (e.g. insufficient cash
          // after other activity) doesn't retry forever.
          set((st) => ({ orders: st.orders.filter((x) => x.id !== o.id) }));
          const ok = get().trade(o.symbol, o.side, o.qty, q.price, 'Limit order filled');
          if (ok) toast('success', '🎯 Limit order filled', `${o.symbol} hit ${fmtPrice(o.limitPrice)}`);
        }

        // 2. Fire any price alerts that crossed their target.
        for (const a of s.alerts) {
          if (a.triggered) continue;
          const q = quotes[a.symbol];
          if (!q) continue;
          const hit = a.direction === 'above' ? q.price >= a.targetPrice : q.price <= a.targetPrice;
          if (hit) {
            set((st) => ({
              alerts: st.alerts.map((x) => (x.id === a.id ? { ...x, triggered: true } : x)),
            }));
            toast('alert', `🔔 ${a.symbol} is ${a.direction} ${fmtPrice(a.targetPrice)}`, `Now ${fmtPrice(q.price)}`);
          }
        }
      },

      // Runs once on app load: catch up on everything that came due while
      // the user was away (recurring buys, round-ups, dividends).
      processScheduledEvents: () => {
        const s = get();
        if (!s.lastEventCheck) return;
        const now = Date.now();

        // --- Recurring buys: execute every run that came due, at that day's close.
        for (const plan of s.recurring) {
          if (!plan.active) continue;
          let next = plan.nextRun;
          while (next <= now) {
            const price = closeOn(plan.symbol, next);
            const qty = plan.amount / price;
            const st = get();
            if (st.cash >= plan.amount) {
              set({
                cash: st.cash - plan.amount,
                holdings: applyFill(st.holdings, plan.symbol, 'buy', qty, price),
                transactions: [
                  {
                    id: uid(),
                    type: 'recurring-buy',
                    symbol: plan.symbol,
                    qty,
                    price,
                    amount: -plan.amount,
                    timestamp: next,
                    note: `Auto-invest (${plan.cadence})`,
                  },
                  ...st.transactions,
                ],
              });
            }
            next += cadenceMs(plan.cadence);
          }
          if (next !== plan.nextRun) {
            set((st) => ({
              recurring: st.recurring.map((r) => (r.id === plan.id ? { ...r, nextRun: next } : r)),
            }));
          }
        }

        // --- Round-ups: one weekly "spare change" sweep, seeded so the
        // amount is deterministic per week.
        if (s.settings.roundups) {
          const WEEK = 7 * DAY_MS;
          let week = Math.floor(s.lastEventCheck / WEEK) + 1;
          const nowWeek = Math.floor(now / WEEK);
          while (week <= nowWeek) {
            const rand = mulberry32(hashString(`roundup:${week}`));
            const amount = Math.round((3 + rand() * 6) * 100) / 100; // $3–9
            const ts = week * WEEK;
            const price = closeOn(s.settings.roundupSymbol, ts);
            set((st) => ({
              holdings: applyFill(st.holdings, st.settings.roundupSymbol, 'buy', amount / price, price),
              transactions: [
                {
                  id: uid(),
                  type: 'roundup',
                  symbol: st.settings.roundupSymbol,
                  qty: amount / price,
                  price,
                  amount: 0, // spare change is "found money", not from cash balance
                  timestamp: ts,
                  note: 'Weekly round-up sweep 🪙',
                },
                ...st.transactions,
              ],
            }));
            week++;
          }
        }

        // --- Dividends: paid on the 1st of each month at yield/12.
        const cursor = new Date(s.lastEventCheck);
        cursor.setDate(1);
        cursor.setHours(12, 0, 0, 0);
        cursor.setMonth(cursor.getMonth() + 1); // first payday after last check
        while (cursor.getTime() <= now) {
          const payTs = cursor.getTime();
          const st = get();
          for (const h of st.holdings) {
            const asset = getAsset(h.symbol);
            if (asset.dividendYield <= 0) continue;
            const price = closeOn(h.symbol, payTs);
            const amount = Math.round(h.qty * price * (asset.dividendYield / 12) * 100) / 100;
            if (amount < 0.01) continue;
            if (st.settings.drip) {
              // DRIP: reinvest the dividend into more shares immediately.
              set((s2) => ({
                holdings: applyFill(s2.holdings, h.symbol, 'buy', amount / price, price),
                transactions: [
                  {
                    id: uid(),
                    type: 'dividend',
                    symbol: h.symbol,
                    qty: amount / price,
                    price,
                    amount: 0,
                    timestamp: payTs,
                    note: 'Dividend reinvested (DRIP) 💸',
                  },
                  ...s2.transactions,
                ],
              }));
            } else {
              set((s2) => ({
                cash: s2.cash + amount,
                transactions: [
                  {
                    id: uid(),
                    type: 'dividend',
                    symbol: h.symbol,
                    amount,
                    timestamp: payTs,
                    note: 'Dividend payment 💸',
                  },
                  ...s2.transactions,
                ],
              }));
            }
            useUserStore.getState().earnBadge('dividend-club');
          }
          cursor.setMonth(cursor.getMonth() + 1);
        }

        set({ lastEventCheck: now });
        checkBadges();
      },

      resetAll: () => set({ ...initialState }),
    }),
    { name: 'stackd-portfolio', version: 1 },
  ),
);

/**
 * Badge rules that depend on portfolio state. Called after trades and
 * scheduled events.
 */
export function checkBadges() {
  const p = usePortfolioStore.getState();
  const user = useUserStore.getState();
  const buys = p.transactions.filter((t) => t.type === 'buy' || t.type === 'recurring-buy');

  if (buys.length > 0) user.earnBadge('first-trade');
  if (p.holdings.length >= 5) user.earnBadge('diversified');
  if (p.holdings.some((h) => getAsset(h.symbol).type === 'etf')) user.earnBadge('etf-enjoyer');
  if (p.holdings.some((h) => getAsset(h.symbol).type === 'crypto')) user.earnBadge('crypto-curious');
  if (user.streak >= 7) user.earnBadge('streak-7');
}
