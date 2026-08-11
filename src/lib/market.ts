import { getAsset } from '../data/assets';
import { gaussian, hashString, mulberry32 } from './rng';

// ---------------------------------------------------------------------------
// The market simulation engine.
//
// Design goals:
//  1. DETERMINISTIC — the same symbol always produces the same 5-year price
//     history, on any device, with no server. This keeps charts and the
//     user's portfolio-performance history stable across sessions.
//  2. REALISTIC PRESENT — histories are generated BACKWARD from a realistic
//     present-day anchor price (Geometric Brownian Motion run in reverse),
//     so "today's" price always looks plausible instead of drifting to a
//     random endpoint.
//  3. ALIVE — during a session, prices tick every few seconds with small
//     random moves so the app feels like a live market.
//
// The model: Geometric Brownian Motion (GBM), the same process behind the
// Black–Scholes model. Each daily step multiplies price by
//   exp((mu - sigma^2/2) * dt + sigma * sqrt(dt) * Z)
// where Z ~ N(0,1). Running it in reverse means dividing by that factor.
// ---------------------------------------------------------------------------

export const HISTORY_DAYS = 365 * 5; // 5 years of daily closes
const DAY_MS = 86_400_000;

export interface PricePoint {
  t: number; // ms timestamp
  p: number; // price
}

/** Midnight (local) of the current day — the anchor for all history. */
export function todayStart(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Cache: generating 1825 points is cheap, but we only want to do it once
// per asset per session.
const historyCache = new Map<string, PricePoint[]>();

/**
 * Full 5-year daily close series for a symbol, oldest → newest.
 * The last point is "yesterday's close"; live prices move from there.
 */
export function getDailyHistory(symbol: string): PricePoint[] {
  const cached = historyCache.get(symbol);
  if (cached) return cached;

  const asset = getAsset(symbol);
  const rand = mulberry32(hashString(symbol + ':daily'));
  const dt = 1 / 365;
  const mu = asset.drift;
  const sigma = asset.volatility;

  const anchor = todayStart();
  const prices = new Array<number>(HISTORY_DAYS);
  let price = asset.currentBase;
  // Walk backward in time: divide out one GBM step per day.
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    prices[i] = price;
    const shock = (mu - (sigma * sigma) / 2) * dt + sigma * Math.sqrt(dt) * gaussian(rand);
    price = price / Math.exp(shock);
    if (price < 0.0001) price = 0.0001;
  }

  const series: PricePoint[] = prices.map((p, i) => ({
    t: anchor - (HISTORY_DAYS - 1 - i) * DAY_MS,
    p,
  }));
  historyCache.set(symbol, series);
  return series;
}

/** Close price on (or before) a given timestamp — used for backtesting the portfolio's value over time. */
export function closeOn(symbol: string, timestamp: number): number {
  const series = getDailyHistory(symbol);
  const first = series[0];
  const idx = Math.floor((timestamp - first.t) / DAY_MS);
  if (idx <= 0) return first.p;
  if (idx >= series.length) return series[series.length - 1].p;
  return series[idx].p;
}

/** Yesterday's close — the baseline for today's % change. */
export function prevClose(symbol: string): number {
  const series = getDailyHistory(symbol);
  return series[series.length - 1].p;
}

/**
 * Intraday minute-by-minute series for the 1D chart. Deterministic per
 * symbol per day (seeded with the date), generated backward from the
 * session's opening live price so it joins the live ticks seamlessly.
 */
export function getIntradayHistory(symbol: string, currentPrice: number): PricePoint[] {
  const asset = getAsset(symbol);
  const dayKey = Math.floor(Date.now() / DAY_MS);
  const rand = mulberry32(hashString(`${symbol}:intra:${dayKey}`));
  const now = Date.now();
  const start = todayStart() + 8 * 3_600_000; // pretend the session opens 8am
  const minutes = Math.max(30, Math.floor((now - start) / 60_000));
  const points: PricePoint[] = [];
  // Per-minute volatility scaled from annual volatility.
  const minSigma = asset.volatility / Math.sqrt(365 * 390);
  let price = currentPrice;
  for (let i = 0; i < minutes; i++) {
    points.push({ t: now - i * 60_000, p: price });
    price = price / Math.exp(minSigma * gaussian(rand));
  }
  return points.reverse();
}

/**
 * One live tick: a small random move from the previous price. Uses
 * Math.random (not seeded) — live noise SHOULD differ between sessions.
 */
export function nextTickPrice(symbol: string, lastPrice: number): number {
  const asset = getAsset(symbol);
  // Scale annual vol down to a ~3-second interval, then exaggerate slightly
  // so the UI visibly moves.
  const tickSigma = (asset.volatility / Math.sqrt((365 * 24 * 3600) / 3)) * 2.5;
  const z = gaussian(Math.random);
  const next = lastPrice * Math.exp(tickSigma * z);
  return Math.max(next, 0.0001);
}

/** Range keys supported by the chart UI. */
export type ChartRange = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';

export const RANGE_DAYS: Record<Exclude<ChartRange, '1D' | 'ALL'>, number> = {
  '1W': 7,
  '1M': 30,
  '3M': 91,
  '1Y': 365,
};

/** Series for a given chart range, ending at the current live price. */
export function getRangeSeries(
  symbol: string,
  range: ChartRange,
  currentPrice: number,
): PricePoint[] {
  if (range === '1D') return getIntradayHistory(symbol, currentPrice);
  const daily = getDailyHistory(symbol);
  const slice =
    range === 'ALL' ? daily : daily.slice(-RANGE_DAYS[range]);
  // Append "now" so the line always ends at the live price.
  return [...slice, { t: Date.now(), p: currentPrice }];
}
