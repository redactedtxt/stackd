import type { PricePoint } from '../lib/market';

export const DAY_MS = 86_400_000;
const T0 = Date.UTC(2020, 0, 1);

/** Build a daily price series from raw closes (one bar per day). */
export function seriesOf(closes: number[]): PricePoint[] {
  return closes.map((p, i) => ({ t: T0 + i * DAY_MS, p }));
}

/** n closes on a straight line from `from` to `to`. */
export function line(n: number, from: number, to: number): number[] {
  return Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));
}
