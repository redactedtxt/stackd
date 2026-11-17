import { getDailyHistory, type PricePoint } from './market';
import { atr, ema, sma } from './indicators';

// ---------------------------------------------------------------------------
// Strategy Lab backtester.
//
// Replays a trading rule bar-by-bar over the simulator's 5-year daily price
// history and reports the numbers a quant would look at: total return, CAGR,
// max drawdown, volatility, Sharpe ratio, win rate, and time in market — all
// side by side with plain buy-and-hold, the benchmark every strategy has to
// beat to be worth the effort.
//
// Execution rules (the honest-backtest checklist):
//  • NO LOOK-AHEAD: a signal-based decision is made on bar i's close and
//    filled at bar i+1's close. Deciding and filling on the same close would
//    quietly assume you could trade at a price you only learn after the bell.
//  • Scheduled orders (buy & hold's first buy, DCA installments) use no
//    price information, so they fill on the bar they're scheduled for.
//  • Trading costs (spread/commission) are charged as a % on every buy and
//    sell, so over-trading strategies pay for their churn.
//  • Indicators are computed over the FULL history, so a 1–4 year test
//    window starts with warmed-up indicators, like a real trader who has
//    past data before day one. A 5-year window has no prior data, so
//    signal strategies sit in cash until their indicators exist.
//  • All-in / all-out position sizing with fractional units — keeps the
//    focus on the rule itself rather than sizing.
//
// The core (`runBacktest`) takes a raw price series so tests can feed it
// hand-built paths; `backtestSymbol` wires it to the simulator.
// ---------------------------------------------------------------------------

/** Simulator days per year — histories include weekends (see market.ts). */
export const BARS_PER_YEAR = 365;

export type StrategyId = 'buy-hold' | 'dca' | 'sma-trend' | 'ema-cross';

export interface StrategyParams {
  /** Fast EMA length for the crossover strategy. */
  fastEma: number;
  /** Slow EMA length for the crossover strategy. */
  slowEma: number;
  /**
   * Trend SMA length. For `sma-trend` it IS the rule (hold while price is
   * above it); for `ema-cross` it's an optional filter (0 = off) that only
   * allows longs in an uptrend.
   */
  trendSma: number;
  /** ATR trailing-stop distance in multiples of ATR (0 = no stop). */
  atrStopMult: number;
  /** ATR lookback, in bars. */
  atrPeriod: number;
  /** DCA: invest an equal slice every N days. */
  dcaEveryDays: number;
}

export interface BacktestConfig {
  symbol: string;
  strategy: StrategyId;
  /** Test window length, 1–5 years (ending yesterday). */
  years: number;
  startingCash: number;
  /** Cost per buy or sell as a fraction (0.001 = 0.1%). */
  costPct: number;
  params: StrategyParams;
}

export const DEFAULT_PARAMS: StrategyParams = {
  fastEma: 12,
  slowEma: 26,
  trendSma: 200,
  atrStopMult: 3,
  atrPeriod: 14,
  dcaEveryDays: 30,
};

export const STRATEGIES: { id: StrategyId; name: string; emoji: string; blurb: string }[] = [
  {
    id: 'buy-hold',
    name: 'Buy & hold',
    emoji: '💎',
    blurb: 'Invest everything on day one and never touch it. The benchmark to beat.',
  },
  {
    id: 'dca',
    name: 'Dollar-cost averaging',
    emoji: '📅',
    blurb: 'Split your cash into equal slices and invest one on a fixed schedule.',
  },
  {
    id: 'sma-trend',
    name: 'Trend following',
    emoji: '🏄',
    blurb: 'Hold while price is above its long moving average; sit in cash when it drops below.',
  },
  {
    id: 'ema-cross',
    name: 'EMA crossover',
    emoji: '✂️',
    blurb: 'Buy when the fast EMA crosses above the slow one, sell when it crosses back.',
  },
];

export type ExitReason = 'signal' | 'stop' | 'end';

/** One position from entry to exit (or to the end of the test, still open). */
export interface Trade {
  entryT: number;
  entryPrice: number;
  exitT: number;
  exitPrice: number;
  /** Net return on the cash committed, after trading costs. */
  returnPct: number;
  exitReason: ExitReason;
}

export interface Metrics {
  finalValue: number;
  /** 0.25 = +25% */
  totalReturn: number;
  /** Compound annual growth rate. */
  cagr: number;
  /** Largest peak-to-trough fall, as a positive fraction (0.3 = −30%). */
  maxDrawdown: number;
  /** Annualized standard deviation of daily returns. */
  volatility: number;
  /** Annualized Sharpe ratio, risk-free rate 0. */
  sharpe: number;
  /** Fraction of trades that made money; null when there were none. */
  winRate: number | null;
  tradeCount: number;
  /** Fraction of bars with money in the market. */
  exposure: number;
}

export interface EquityPoint {
  t: number;
  strategy: number;
  benchmark: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  /** Downsampled for charting. Metrics use the full-resolution curve. */
  equity: EquityPoint[];
  metrics: Metrics;
  benchmark: Metrics;
  trades: Trade[];
}

// ------------------------------- metrics -----------------------------------

/** Largest peak-to-trough decline of a value series, as a positive fraction. */
export function maxDrawdown(values: number[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    if (peak > 0) worst = Math.max(worst, 1 - v / peak);
  }
  return worst;
}

/** Bar-to-bar simple returns. */
export function periodReturns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i - 1] > 0 ? values[i] / values[i - 1] - 1 : 0);
  }
  return out;
}

function meanAndStd(xs: number[]): { mean: number; std: number } {
  if (xs.length < 2) return { mean: xs[0] ?? 0, std: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  // Sample standard deviation (n − 1).
  const variance = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (xs.length - 1);
  return { mean, std: Math.sqrt(variance) };
}

/**
 * Annualized Sharpe ratio: mean daily return ÷ std of daily returns, scaled
 * by √(bars per year). Risk-free rate assumed 0 — idle cash in the sim earns
 * nothing, so this is consistent with how the strategies are simulated.
 */
export function sharpeRatio(values: number[], barsPerYear = BARS_PER_YEAR): number {
  const { mean, std } = meanAndStd(periodReturns(values));
  if (std === 0) return 0;
  return (mean / std) * Math.sqrt(barsPerYear);
}

export function computeMetrics(
  values: number[],
  years: number,
  trades: Trade[],
  barsInMarket: number,
): Metrics {
  const start = values[0] ?? 0;
  const end = values[values.length - 1] ?? 0;
  const totalReturn = start > 0 ? end / start - 1 : 0;
  const cagr = years > 0 && start > 0 && end > 0 ? (end / start) ** (1 / years) - 1 : totalReturn;
  const { std } = meanAndStd(periodReturns(values));
  const wins = trades.filter((t) => t.returnPct > 0).length;
  return {
    finalValue: end,
    totalReturn,
    cagr,
    maxDrawdown: maxDrawdown(values),
    volatility: std * Math.sqrt(BARS_PER_YEAR),
    sharpe: sharpeRatio(values),
    winRate: trades.length ? wins / trades.length : null,
    tradeCount: trades.length,
    exposure: values.length ? barsInMarket / values.length : 0,
  };
}

// ------------------------------- engine ------------------------------------

export interface RawRun {
  /** Portfolio value at each bar's close, from startIndex to the end. */
  values: number[];
  trades: Trade[];
  barsInMarket: number;
}

/**
 * Run one strategy over `series[startIndex..]`. Indicators are computed over
 * the whole series so bars before `startIndex` serve as warm-up data.
 */
export function runBacktest(
  series: PricePoint[],
  startIndex: number,
  strategy: StrategyId,
  params: StrategyParams,
  startingCash: number,
  costPct: number,
): RawRun {
  const closes = series.map((pt) => pt.p);
  const last = closes.length - 1;
  const start = Math.max(0, Math.min(startIndex, last));

  // Only compute what the strategy needs.
  const fast = strategy === 'ema-cross' ? ema(closes, params.fastEma) : [];
  const slow = strategy === 'ema-cross' ? ema(closes, params.slowEma) : [];
  const trend =
    (strategy === 'sma-trend' || strategy === 'ema-cross') && params.trendSma > 0
      ? sma(closes, params.trendSma)
      : [];
  const useStop =
    (strategy === 'sma-trend' || strategy === 'ema-cross') && params.atrStopMult > 0;
  const atrs = useStop ? atr(closes, params.atrPeriod) : [];

  /** Does the rule want to be long at bar i's close? (false during warm-up) */
  const wantsLong = (i: number): boolean => {
    if (strategy === 'sma-trend') {
      return !Number.isNaN(trend[i]) && closes[i] > trend[i];
    }
    if (strategy === 'ema-cross') {
      if (Number.isNaN(fast[i]) || Number.isNaN(slow[i])) return false;
      if (trend.length && (Number.isNaN(trend[i]) || closes[i] <= trend[i])) return false;
      return fast[i] > slow[i];
    }
    return true;
  };

  let cash = startingCash;
  let qty = 0;
  const values: number[] = [];
  const trades: Trade[] = [];
  let barsInMarket = 0;

  // Open position bookkeeping (signal strategies hold one position at a time).
  let entry: { t: number; price: number; cashIn: number } | null = null;
  let highest = 0;
  let stopLevel = -Infinity;
  /** After a stop-out, wait for the rule to switch off before re-entering. */
  let stoppedOut = false;
  let pending: { side: 'buy' | 'sell'; reason: ExitReason } | null = null;

  // DCA lots: each installment is tracked as its own "trade" held to the end.
  const dcaLots: { t: number; price: number; cashIn: number; qty: number }[] = [];
  const windowLen = last - start + 1;
  const dcaEvery = Math.max(1, Math.round(params.dcaEveryDays));
  const dcaInstallments = Math.ceil(windowLen / dcaEvery);
  const dcaSlice = startingCash / dcaInstallments;

  const buyAll = (i: number) => {
    const cashIn = cash;
    qty = (cash * (1 - costPct)) / closes[i];
    cash = 0;
    entry = { t: series[i].t, price: closes[i], cashIn };
    highest = closes[i];
    stopLevel = -Infinity;
  };

  const sellAll = (i: number, reason: ExitReason) => {
    const proceeds = qty * closes[i] * (1 - costPct);
    if (entry) {
      trades.push({
        entryT: entry.t,
        entryPrice: entry.price,
        exitT: series[i].t,
        exitPrice: closes[i],
        returnPct: proceeds / entry.cashIn - 1,
        exitReason: reason,
      });
    }
    cash += proceeds;
    qty = 0;
    entry = null;
  };

  for (let i = start; i <= last; i++) {
    const price = closes[i];

    // 1. Fill yesterday's signal at today's close.
    if (pending) {
      if (pending.side === 'buy' && qty === 0) buyAll(i);
      else if (pending.side === 'sell' && qty > 0) sellAll(i, pending.reason);
      pending = null;
    }

    // 2. Scheduled orders fill immediately (they use no price information).
    if (strategy === 'buy-hold' && i === start) {
      buyAll(i);
    } else if (strategy === 'dca' && (i - start) % dcaEvery === 0 && cash > 1e-9) {
      const isLast = dcaLots.length === dcaInstallments - 1;
      const cashIn = isLast ? cash : Math.min(dcaSlice, cash);
      const lotQty = (cashIn * (1 - costPct)) / price;
      qty += lotQty;
      cash -= cashIn;
      dcaLots.push({ t: series[i].t, price, cashIn, qty: lotQty });
    }

    // 3. Mark to market.
    values.push(cash + qty * price);
    if (qty > 0) barsInMarket++;

    // 4. Decide at today's close for tomorrow (signal strategies only).
    if (i === last || (strategy !== 'sma-trend' && strategy !== 'ema-cross')) continue;
    const want = wantsLong(i);
    if (qty > 0) {
      if (useStop) {
        highest = Math.max(highest, price);
        const a = atrs[i];
        // Chandelier-style trailing stop: ratchets up, never down.
        if (!Number.isNaN(a)) stopLevel = Math.max(stopLevel, highest - params.atrStopMult * a);
        if (price < stopLevel) {
          pending = { side: 'sell', reason: 'stop' };
          stoppedOut = true;
          continue;
        }
      }
      if (!want) pending = { side: 'sell', reason: 'signal' };
    } else {
      if (stoppedOut && !want) stoppedOut = false;
      if (want && !stoppedOut) pending = { side: 'buy', reason: 'signal' };
    }
  }

  // Positions still open at the end are reported at the last close (no exit cost —
  // the value is marked to market, not actually sold).
  const lastPrice = closes[last];
  const lastT = series[last].t;
  if (strategy === 'dca') {
    for (const lot of dcaLots) {
      trades.push({
        entryT: lot.t,
        entryPrice: lot.price,
        exitT: lastT,
        exitPrice: lastPrice,
        returnPct: (lot.qty * lastPrice) / lot.cashIn - 1,
        exitReason: 'end',
      });
    }
  } else if (qty > 0 && entry) {
    const open = entry as { t: number; price: number; cashIn: number };
    trades.push({
      entryT: open.t,
      entryPrice: open.price,
      exitT: lastT,
      exitPrice: lastPrice,
      returnPct: (qty * lastPrice) / open.cashIn - 1,
      exitReason: 'end',
    });
  }

  return { values, trades, barsInMarket };
}

/** Keep at most `max` points (always including the last) for chart rendering. */
export function downsample<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const out = points.filter((_, i) => i % step === 0);
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}

function windowStart(series: PricePoint[], years: number): number {
  const bars = Math.round(Math.min(Math.max(years, 1), 5) * BARS_PER_YEAR);
  return Math.max(0, series.length - bars);
}

function spanYears(series: PricePoint[], start: number): number {
  const span = series[series.length - 1].t - series[start].t;
  return span / (BARS_PER_YEAR * 86_400_000);
}

/** Run a config against the simulator's history for its symbol. */
export function backtestSymbol(config: BacktestConfig): BacktestResult {
  const series = getDailyHistory(config.symbol);
  return backtestSeries(series, config);
}

/** Same as `backtestSymbol` but on any price series (used by tests). */
export function backtestSeries(series: PricePoint[], config: BacktestConfig): BacktestResult {
  const start = windowStart(series, config.years);
  const years = spanYears(series, start);
  const run = runBacktest(
    series,
    start,
    config.strategy,
    config.params,
    config.startingCash,
    config.costPct,
  );
  const bench =
    config.strategy === 'buy-hold'
      ? run
      : runBacktest(series, start, 'buy-hold', config.params, config.startingCash, config.costPct);

  const equity: EquityPoint[] = run.values.map((v, k) => ({
    t: series[start + k].t,
    strategy: v,
    benchmark: bench.values[k],
  }));

  return {
    config,
    equity: downsample(equity, 365),
    metrics: computeMetrics(run.values, years, run.trades, run.barsInMarket),
    benchmark: computeMetrics(bench.values, years, bench.trades, bench.barsInMarket),
    trades: run.trades,
  };
}

/** Every strategy on the same asset/window/params — the leaderboard. */
export function compareStrategies(
  config: BacktestConfig,
): { strategy: StrategyId; metrics: Metrics }[] {
  const series = getDailyHistory(config.symbol);
  const start = windowStart(series, config.years);
  const years = spanYears(series, start);
  return STRATEGIES.map(({ id }) => {
    const run = runBacktest(series, start, id, config.params, config.startingCash, config.costPct);
    return { strategy: id, metrics: computeMetrics(run.values, years, run.trades, run.barsInMarket) };
  });
}
