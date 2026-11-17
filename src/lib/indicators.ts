// ---------------------------------------------------------------------------
// Technical indicators for the Strategy Lab backtester.
//
// Every function takes a plain array of daily closes and returns an array of
// the SAME length, with `NaN` for the warm-up bars where the indicator isn't
// defined yet (e.g. the first 199 bars of a 200-day SMA). Keeping the arrays
// index-aligned with the price series means strategy code can read
// `fast[i] > slow[i]` without any offset bookkeeping.
//
// All pure functions — no market or store imports — so they're trivial to
// unit test against hand-computed values.
// ---------------------------------------------------------------------------

/** Simple moving average: the mean of the last `period` closes. */
export function sma(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/**
 * Exponential moving average. Weights recent closes more heavily using
 * `k = 2 / (period + 1)`. Seeded with the SMA of the first `period` closes
 * (the standard convention), so the first defined value is at index
 * `period - 1`.
 */
export function ema(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (period <= 0 || values.length < period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  let prev = seed / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/**
 * Average True Range, adapted for close-only data.
 *
 * Real ATR uses each bar's high, low, and previous close. Our simulator only
 * produces daily closes, so the "true range" of a bar is approximated as
 * |close − previous close|. It still does the job ATR is used for here:
 * measuring how much an asset typically moves in a day, so a trailing stop
 * can sit further away on a volatile asset (crypto) than a calm one (VOO).
 *
 * Uses Wilder's smoothing: ATR_i = (ATR_{i−1}·(n−1) + TR_i) / n, seeded with
 * the simple mean of the first n true ranges.
 */
export function atr(closes: number[], period: number): number[] {
  const out = new Array<number>(closes.length).fill(NaN);
  if (period <= 0 || closes.length <= period) return out;
  // tr[i] is defined from i = 1 (needs a previous close).
  let seed = 0;
  for (let i = 1; i <= period; i++) seed += Math.abs(closes[i] - closes[i - 1]);
  let prev = seed / period;
  out[period] = prev;
  for (let i = period + 1; i < closes.length; i++) {
    const tr = Math.abs(closes[i] - closes[i - 1]);
    prev = (prev * (period - 1) + tr) / period;
    out[i] = prev;
  }
  return out;
}
