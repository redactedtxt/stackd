import { describe, expect, it } from 'vitest';
import { ASSETS } from '../data/assets';
import { line, seriesOf } from '../test/helpers';
import { ema } from './indicators';
import {
  DEFAULT_PARAMS,
  STRATEGIES,
  backtestSeries,
  backtestSymbol,
  compareStrategies,
  downsample,
  maxDrawdown,
  runBacktest,
  sharpeRatio,
  type BacktestConfig,
  type StrategyParams,
} from './backtest';

const CASH = 10_000;

function config(overrides: Partial<BacktestConfig> = {}): BacktestConfig {
  return {
    symbol: 'VOO',
    strategy: 'buy-hold',
    years: 1,
    startingCash: CASH,
    costPct: 0,
    params: DEFAULT_PARAMS,
    ...overrides,
  };
}

const params = (p: Partial<StrategyParams>): StrategyParams => ({ ...DEFAULT_PARAMS, ...p });

// ------------------------------- metrics -----------------------------------

describe('maxDrawdown', () => {
  it('finds the largest peak-to-trough fall', () => {
    // Peak 120 → trough 60 is −50%; the later 130 high doesn't erase it.
    expect(maxDrawdown([100, 120, 60, 90, 130])).toBeCloseTo(0.5);
  });

  it('is 0 for a series that only goes up', () => {
    expect(maxDrawdown([1, 2, 3, 4])).toBe(0);
  });
});

describe('sharpeRatio', () => {
  it('is 0 when there is no volatility', () => {
    expect(sharpeRatio([100, 100, 100, 100])).toBe(0);
  });

  it('annualizes by √(bars per year)', () => {
    const values = [100, 102, 101, 104, 103, 107];
    expect(sharpeRatio(values, 365)).toBeCloseTo(sharpeRatio(values, 1) * Math.sqrt(365));
  });

  it('is positive for a rising, noisy series and negative for a falling one', () => {
    expect(sharpeRatio([100, 103, 102, 106, 105, 110])).toBeGreaterThan(0);
    expect(sharpeRatio([110, 105, 106, 102, 103, 100])).toBeLessThan(0);
  });
});

describe('downsample', () => {
  it('caps the number of points and always keeps the last one', () => {
    const pts = Array.from({ length: 1000 }, (_, i) => i);
    const out = downsample(pts, 100);
    expect(out.length).toBeLessThanOrEqual(101);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(999);
  });

  it('leaves short series untouched', () => {
    expect(downsample([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });
});

// ------------------------------- engine ------------------------------------

describe('buy & hold', () => {
  const series = seriesOf(line(400, 100, 200));

  it('returns exactly the price change over the window, with no costs', () => {
    const r = backtestSeries(series, config());
    const start = series[series.length - 365].p;
    const end = series[series.length - 1].p;
    expect(r.metrics.totalReturn).toBeCloseTo(end / start - 1, 10);
    expect(r.metrics.finalValue).toBeCloseTo((CASH * end) / start, 6);
    expect(r.metrics.exposure).toBe(1);
    expect(r.metrics.tradeCount).toBe(1);
    expect(r.metrics.winRate).toBe(1);
  });

  it('is its own benchmark', () => {
    const r = backtestSeries(series, config());
    expect(r.metrics).toEqual(r.benchmark);
  });

  it('charges trading costs on the way in', () => {
    const free = backtestSeries(series, config());
    const paid = backtestSeries(series, config({ costPct: 0.01 }));
    expect(paid.metrics.finalValue).toBeCloseTo(free.metrics.finalValue * 0.99, 6);
  });
});

describe('no look-ahead bias', () => {
  // Flat, then a jump that flips the fast EMA above the slow one.
  const closes = [...Array(60).fill(100), ...line(40, 110, 150)];
  const series = seriesOf(closes);
  const p = params({ fastEma: 3, slowEma: 10, trendSma: 0, atrStopMult: 0 });

  it('fills a crossover signal on the NEXT bar, not the bar that produced it', () => {
    const fast = ema(closes, 3);
    const slow = ema(closes, 10);
    const signalBar = closes.findIndex((_, i) => fast[i] > slow[i]);
    expect(signalBar).toBeGreaterThan(0);

    const run = runBacktest(series, 0, 'ema-cross', p, CASH, 0);
    expect(run.trades[0].entryT).toBe(series[signalBar + 1].t);
    expect(run.trades[0].entryPrice).toBe(closes[signalBar + 1]);
  });

  it('exits on the bar after the cross back down', () => {
    const roundTrip = [...closes, ...line(40, 148, 90)];
    const s = seriesOf(roundTrip);
    const fast = ema(roundTrip, 3);
    const slow = ema(roundTrip, 10);
    const run = runBacktest(s, 0, 'ema-cross', p, CASH, 0);
    const entryBar = s.findIndex((pt) => pt.t === run.trades[0].entryT);
    let crossDown = entryBar;
    while (fast[crossDown] > slow[crossDown]) crossDown++;
    expect(run.trades[0].exitReason).toBe('signal');
    expect(run.trades[0].exitT).toBe(s[crossDown + 1].t);
  });
});

describe('trend following', () => {
  it('sits in cash until the moving average exists (warm-up)', () => {
    const series = seriesOf(line(200, 100, 300));
    const run = runBacktest(series, 0, 'sma-trend', params({ trendSma: 50, atrStopMult: 0 }), CASH, 0);
    const firstEntryBar = series.findIndex((pt) => pt.t === run.trades[0].entryT);
    expect(firstEntryBar).toBeGreaterThanOrEqual(50);
    expect(run.values.slice(0, 50).every((v) => v === CASH)).toBe(true);
  });
});

describe('ATR trailing stop', () => {
  // Zig-zag uptrend (so ATR > 0), then a steady slide.
  const up = Array.from({ length: 100 }, (_, i) => 100 + i + (i % 2 ? 0.5 : -0.5));
  const down = Array.from({ length: 30 }, (_, j) => up[up.length - 1] - 2 * (j + 1));
  const series = seriesOf([...up, ...down]);

  const withStop = runBacktest(series, 0, 'sma-trend', params({ trendSma: 20, atrStopMult: 1 }), CASH, 0);
  const noStop = runBacktest(series, 0, 'sma-trend', params({ trendSma: 20, atrStopMult: 0 }), CASH, 0);

  it('exits on the stop before the trend rule would', () => {
    expect(withStop.trades[0].exitReason).toBe('stop');
    expect(noStop.trades[0].exitReason).toBe('signal');
    expect(withStop.trades[0].exitT).toBeLessThan(noStop.trades[0].exitT);
    expect(withStop.trades[0].returnPct).toBeGreaterThan(noStop.trades[0].returnPct);
  });

  it("doesn't jump straight back in while the rule is still on after a stop-out", () => {
    expect(withStop.trades).toHaveLength(1);
  });
});

describe('dollar-cost averaging', () => {
  it('invests the whole budget in equal slices over the window', () => {
    const r = backtestSeries(seriesOf(line(400, 100, 200)), config({ strategy: 'dca', years: 1 }));
    expect(r.trades).toHaveLength(Math.ceil(365 / 30));
    expect(r.metrics.exposure).toBe(1); // first slice goes in on day one
  });

  it('trails a lump sum in a rising market and beats it in a falling one', () => {
    const rising = seriesOf(line(400, 100, 200));
    const falling = seriesOf(line(400, 200, 100));
    const up = backtestSeries(rising, config({ strategy: 'dca' }));
    const down = backtestSeries(falling, config({ strategy: 'dca' }));
    expect(up.metrics.totalReturn).toBeLessThan(up.benchmark.totalReturn);
    expect(down.metrics.totalReturn).toBeGreaterThan(down.benchmark.totalReturn);
  });
});

describe('trading costs', () => {
  it('make an active strategy strictly worse', () => {
    const closes = Array.from({ length: 500 }, (_, i) => 100 + 10 * Math.sin(i / 8) + i * 0.05);
    const s = seriesOf(closes);
    const p = params({ fastEma: 5, slowEma: 20, trendSma: 0, atrStopMult: 0 });
    const free = runBacktest(s, 0, 'ema-cross', p, CASH, 0);
    const paid = runBacktest(s, 0, 'ema-cross', p, CASH, 0.005);
    expect(free.trades.length).toBeGreaterThan(3);
    expect(paid.values.at(-1)!).toBeLessThan(free.values.at(-1)!);
  });
});

// --------------------------- against the simulator -------------------------

describe('backtestSymbol', () => {
  it('is deterministic — the same config always gives the same result', () => {
    const cfg = config({ symbol: 'NVDA', strategy: 'ema-cross', years: 3, costPct: 0.001 });
    expect(backtestSymbol(cfg)).toEqual(backtestSymbol(cfg));
  });

  it('agrees with the leaderboard for the chosen strategy', () => {
    const cfg = config({ symbol: 'BTC', strategy: 'sma-trend', years: 2 });
    const single = backtestSymbol(cfg);
    const board = compareStrategies(cfg);
    expect(board.map((b) => b.strategy)).toEqual(STRATEGIES.map((s) => s.id));
    expect(board.find((b) => b.strategy === 'sma-trend')!.metrics).toEqual(single.metrics);
    expect(board.find((b) => b.strategy === 'buy-hold')!.metrics).toEqual(single.benchmark);
  });

  it('produces sane metrics for every strategy on every asset', () => {
    for (const asset of ASSETS) {
      for (const { metrics: m } of compareStrategies(config({ symbol: asset.symbol, years: 3, costPct: 0.001 }))) {
        expect(Number.isFinite(m.totalReturn)).toBe(true);
        expect(Number.isFinite(m.sharpe)).toBe(true);
        expect(m.finalValue).toBeGreaterThan(0);
        expect(m.maxDrawdown).toBeGreaterThanOrEqual(0);
        expect(m.maxDrawdown).toBeLessThan(1);
        expect(m.exposure).toBeGreaterThanOrEqual(0);
        expect(m.exposure).toBeLessThanOrEqual(1);
      }
    }
  });
});
