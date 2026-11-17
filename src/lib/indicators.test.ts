import { describe, expect, it } from 'vitest';
import { atr, ema, sma } from './indicators';

describe('sma', () => {
  it('averages the trailing window and pads warm-up bars with NaN', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([NaN, NaN, 2, 3, 4]);
  });

  it('returns all NaN when there is not enough data', () => {
    expect(sma([1, 2], 3)).toEqual([NaN, NaN]);
  });
});

describe('ema', () => {
  it('is seeded with the SMA, then smooths with k = 2/(n+1)', () => {
    // n = 3 → k = 0.5. Seed = mean(2, 4, 6) = 4.
    // bar 3: 8·0.5 + 4·0.5 = 6;  bar 4: 20·0.5 + 6·0.5 = 13
    expect(ema([2, 4, 6, 8, 20], 3)).toEqual([NaN, NaN, 4, 6, 13]);
  });

  it('reacts to a price jump faster than an SMA of the same length', () => {
    const prices = [...Array(20).fill(100), ...Array(5).fill(120)];
    const last = prices.length - 1;
    expect(ema(prices, 10)[last]).toBeGreaterThan(sma(prices, 10)[last]);
  });
});

describe('atr (close-to-close)', () => {
  it('equals the constant daily move when every move is the same size', () => {
    const out = atr([10, 11, 10, 11, 10, 11], 3);
    expect(out.slice(0, 3).every(Number.isNaN)).toBe(true);
    expect(out.slice(3)).toEqual([1, 1, 1]);
  });

  it("uses Wilder's smoothing after the seed", () => {
    // TRs: 2, 0, 0, 0 → seed (2+0)/2 = 1, then (1·1 + 0)/2 = 0.5, then 0.25
    expect(atr([10, 12, 12, 12, 12], 2)).toEqual([NaN, NaN, 1, 0.5, 0.25]);
  });
});
