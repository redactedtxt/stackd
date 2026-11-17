import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Holding, Quote, Transaction } from '../types';
import {
  diversificationScore,
  marketValue,
  netContributions,
  portfolioDailySeries,
  projectGrowth,
  totalValue,
} from './analytics';
import { closeOn, todayStart } from './market';

const DAY_MS = 86_400_000;

const quote = (symbol: string, price: number): Quote => ({
  symbol,
  price,
  prevClose: price,
  dayChange: 0,
  dayChangePct: 0,
});
const quotesOf = (...qs: Quote[]) => Object.fromEntries(qs.map((q) => [q.symbol, q]));
const holding = (symbol: string, qty: number): Holding => ({ symbol, qty, avgCost: 1 });

describe('valuation', () => {
  it('values holdings at live quotes and adds cash', () => {
    const holdings = [holding('VOO', 2), holding('BTC', 0.5)];
    const quotes = quotesOf(quote('VOO', 500), quote('BTC', 80_000));
    expect(marketValue(holdings, quotes)).toBe(41_000);
    expect(totalValue(250, holdings, quotes)).toBe(41_250);
  });

  it('counts only deposits as contributions (rewards are gains)', () => {
    const txs: Transaction[] = [
      { id: '1', type: 'deposit', amount: 1000, timestamp: 1 },
      { id: '2', type: 'reward', amount: 20, timestamp: 2 },
      { id: '3', type: 'deposit', amount: 500, timestamp: 3 },
      { id: '4', type: 'buy', symbol: 'VOO', qty: 1, price: 400, amount: -400, timestamp: 4 },
    ];
    expect(netContributions(txs)).toBe(1500);
  });
});

describe('portfolioDailySeries (event-sourced replay)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 14, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('reconstructs past values by replaying the ledger against historical closes', () => {
    const today = todayStart();
    const depositAt = today - 5 * DAY_MS;
    const buyAt = today - 3 * DAY_MS + 1000;
    const buyPrice = closeOn('VOO', buyAt);
    // The store keeps transactions newest-first.
    const txs: Transaction[] = [
      { id: 'b', type: 'buy', symbol: 'VOO', qty: 2, price: buyPrice, amount: -2 * buyPrice, timestamp: buyAt },
      { id: 'd', type: 'deposit', amount: 5000, timestamp: depositAt },
    ];
    const series = portfolioDailySeries(txs, depositAt, quotesOf(quote('VOO', 600)));

    expect(series).toHaveLength(6); // 5 past days + today
    // Before the buy: just the cash.
    expect(series[0].p).toBe(5000);
    expect(series[1].p).toBe(5000);
    // After the buy: remaining cash + 2 shares at that day's close.
    const day3 = series[3];
    expect(day3.p).toBeCloseTo(5000 - 2 * buyPrice + 2 * closeOn('VOO', day3.t), 6);
    // Today uses the live quote, not a historical close.
    expect(series.at(-1)!.p).toBeCloseTo(5000 - 2 * buyPrice + 2 * 600, 6);
  });
});

describe('diversificationScore', () => {
  const qs = quotesOf(
    ...['VOO', 'QQQ', 'AAPL', 'SPOT', 'NKE', 'BTC', 'DUOL', 'UBER', 'TSLA'].map((s) => quote(s, 100)),
  );

  it('is 0 for an empty portfolio', () => {
    expect(diversificationScore([], qs).score).toBe(0);
  });

  it('scores a single ETF above a single stock', () => {
    const etf = diversificationScore([holding('VOO', 10)], qs).score;
    const stock = diversificationScore([holding('TSLA', 10)], qs).score;
    expect(etf).toBeGreaterThan(stock);
  });

  it('rewards spreading across holdings and sectors', () => {
    const spread = ['VOO', 'QQQ', 'AAPL', 'SPOT', 'NKE', 'BTC', 'DUOL', 'UBER'].map((s) => holding(s, 1));
    const { score } = diversificationScore(spread, qs);
    expect(score).toBeGreaterThanOrEqual(80);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('projectGrowth', () => {
  it('is plain addition at a 0% return', () => {
    const pts = projectGrowth(1000, 100, 0, 10);
    expect(pts.at(-1)!.p).toBeCloseTo(1000 + 100 * 12 * 10);
  });

  it('matches the future-value-of-an-annuity formula', () => {
    const start = 2000;
    const monthly = 150;
    const rate = 0.08;
    const years = 20;
    const i = rate / 12;
    const n = years * 12;
    const fv = start * (1 + i) ** n + monthly * (((1 + i) ** n - 1) / i);
    expect(projectGrowth(start, monthly, rate, years).at(-1)!.p).toBeCloseTo(fv, 6);
  });
});
