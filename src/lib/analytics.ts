import type { Holding, Quote, Transaction } from '../types';
import { getAsset } from '../data/assets';
import { closeOn, getIntradayHistory, todayStart, type PricePoint } from './market';

// ---------------------------------------------------------------------------
// Portfolio analytics.
//
// The transaction log is the source of truth: by replaying it against the
// deterministic price history we can reconstruct the portfolio's value on
// any past day — no snapshots needed. This is the same event-sourcing idea
// real brokerages use for performance reporting.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

export function marketValue(holdings: Holding[], quotes: Record<string, Quote>): number {
  return holdings.reduce((sum, h) => sum + h.qty * (quotes[h.symbol]?.price ?? 0), 0);
}

export function totalValue(cash: number, holdings: Holding[], quotes: Record<string, Quote>): number {
  return cash + marketValue(holdings, quotes);
}

/** Total the user has put in (deposits only — rewards/roundups are gains). */
export function netContributions(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === 'deposit')
    .reduce((sum, t) => sum + t.amount, 0);
}

export interface DayState {
  cash: number;
  qty: Map<string, number>;
}

/** Replay transactions up to a timestamp → cash + holdings at that moment. */
function stateAt(transactions: Transaction[], ts: number): DayState {
  const cashState: DayState = { cash: 0, qty: new Map() };
  // transactions are stored newest-first; replay oldest-first.
  for (let i = transactions.length - 1; i >= 0; i--) {
    const t = transactions[i];
    if (t.timestamp > ts) break;
    cashState.cash += t.amount;
    if (t.symbol && t.qty) {
      const delta = t.type === 'sell' ? -t.qty : t.qty;
      cashState.qty.set(t.symbol, (cashState.qty.get(t.symbol) ?? 0) + delta);
    }
  }
  return cashState;
}

/**
 * Daily portfolio value series from account opening until today.
 * Used by the dashboard chart for 1W/1M/3M/1Y/ALL ranges.
 */
export function portfolioDailySeries(
  transactions: Transaction[],
  joinedAt: number,
  quotes: Record<string, Quote>,
  maxDays?: number,
): PricePoint[] {
  if (!transactions.length) return [];
  const startDay = Math.max(
    todayStart() - (maxDays ? (maxDays - 1) * DAY_MS : Infinity),
    todayStart() - Math.ceil((todayStart() - joinedAt) / DAY_MS) * DAY_MS,
  );

  const points: PricePoint[] = [];
  for (let t = startDay; t < todayStart() + DAY_MS; t += DAY_MS) {
    const day = Math.min(t, Date.now());
    const st = stateAt(transactions, day + DAY_MS - 1);
    let value = st.cash;
    for (const [sym, qty] of st.qty) {
      if (qty <= 1e-9) continue;
      // Use the live quote for "today", historical close otherwise.
      const price = t >= todayStart() ? (quotes[sym]?.price ?? closeOn(sym, day)) : closeOn(sym, day);
      value += qty * price;
    }
    points.push({ t: day, p: value });
  }
  // A day-one account produces a single point, which charts render as a
  // lonely dot. Pad with the account-opening moment so a line always draws.
  if (points.length === 1) {
    points.unshift({ t: joinedAt, p: points[0].p });
  }
  return points;
}

/**
 * Intraday portfolio series for the 1D chart: current positions marked
 * against each asset's minute-by-minute simulated path.
 */
export function portfolioIntradaySeries(
  cash: number,
  holdings: Holding[],
  quotes: Record<string, Quote>,
): PricePoint[] {
  if (!holdings.length) {
    const now = Date.now();
    return [
      { t: now - 3_600_000, p: cash },
      { t: now, p: cash },
    ];
  }
  const perSymbol = holdings.map((h) => ({
    h,
    series: getIntradayHistory(h.symbol, quotes[h.symbol]?.price ?? 0),
  }));
  const len = Math.min(...perSymbol.map((x) => x.series.length));
  const points: PricePoint[] = [];
  for (let i = 0; i < len; i++) {
    let value = cash;
    for (const { h, series } of perSymbol) {
      value += h.qty * series[series.length - len + i].p;
    }
    points.push({ t: perSymbol[0].series[perSymbol[0].series.length - len + i].t, p: value });
  }
  return points;
}

export interface AllocationSlice {
  label: string;
  value: number;
  pct: number;
}

/** Allocation by individual holding (cash included). */
export function allocationByAsset(
  cash: number,
  holdings: Holding[],
  quotes: Record<string, Quote>,
): AllocationSlice[] {
  const total = totalValue(cash, holdings, quotes);
  if (total <= 0) return [];
  const slices = holdings
    .map((h) => {
      const value = h.qty * (quotes[h.symbol]?.price ?? 0);
      return { label: h.symbol, value, pct: (value / total) * 100 };
    })
    .sort((a, b) => b.value - a.value);
  if (cash > 0.01) slices.push({ label: 'Cash', value: cash, pct: (cash / total) * 100 });
  return slices;
}

/** Allocation by sector. */
export function allocationBySector(
  holdings: Holding[],
  quotes: Record<string, Quote>,
): AllocationSlice[] {
  const bySector = new Map<string, number>();
  let total = 0;
  for (const h of holdings) {
    const value = h.qty * (quotes[h.symbol]?.price ?? 0);
    total += value;
    const sector = getAsset(h.symbol).sector;
    bySector.set(sector, (bySector.get(sector) ?? 0) + value);
  }
  if (total <= 0) return [];
  return [...bySector.entries()]
    .map(([label, value]) => ({ label, value, pct: (value / total) * 100 }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Diversification score, 0–100. A teaching tool, not a real risk model:
 *  • more distinct holdings → better (up to 8)
 *  • more sectors → better (up to 5)
 *  • concentration penalty via Herfindahl index of position weights
 *  • ETF exposure counts extra (each ETF is internally diversified)
 */
export function diversificationScore(
  holdings: Holding[],
  quotes: Record<string, Quote>,
): { score: number; hint: string } {
  if (!holdings.length) return { score: 0, hint: 'Buy your first asset to get a score.' };

  const values = holdings.map((h) => h.qty * (quotes[h.symbol]?.price ?? 0));
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return { score: 0, hint: 'Buy your first asset to get a score.' };

  const weights = values.map((v) => v / total);
  const herfindahl = weights.reduce((a, w) => a + w * w, 0); // 1 = all-in on one thing
  const sectors = new Set(holdings.map((h) => getAsset(h.symbol).sector)).size;
  const etfWeight = holdings.reduce(
    (a, h, i) => a + (getAsset(h.symbol).type === 'etf' ? weights[i] : 0),
    0,
  );

  const countScore = Math.min(holdings.length / 8, 1) * 30;
  const sectorScore = Math.min(sectors / 5, 1) * 25;
  const concentrationScore = (1 - herfindahl) * 30;
  const etfBonus = etfWeight * 15;
  const score = Math.round(countScore + sectorScore + concentrationScore + etfBonus);

  let hint = 'Solid spread. Keep it balanced as you add more.';
  if (score < 35) hint = 'Very concentrated — one bad day hits your whole portfolio.';
  else if (score < 60) hint = 'Decent start. Adding an index ETF would smooth the ride.';
  else if (score >= 80) hint = 'Excellent diversification. Textbook stuff. 🎓';
  return { score: Math.min(score, 100), hint };
}

/**
 * Compound-growth projection for the "future you" calculator.
 * FV of a starting amount + monthly contributions at a given annual return.
 */
export function projectGrowth(
  start: number,
  monthly: number,
  annualRate: number,
  years: number,
): PricePoint[] {
  const points: PricePoint[] = [];
  const r = annualRate / 12;
  let value = start;
  const now = Date.now();
  for (let m = 0; m <= years * 12; m++) {
    if (m > 0) value = value * (1 + r) + monthly;
    if (m % 3 === 0) points.push({ t: now + m * 30 * DAY_MS, p: value });
  }
  return points;
}
