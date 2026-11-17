import { describe, expect, it, vi } from 'vitest';
import { getAsset } from '../data/assets';
import { HISTORY_DAYS, closeOn, getDailyHistory } from './market';

const DAY_MS = 86_400_000;

describe('getDailyHistory', () => {
  it('returns 5 years of evenly spaced daily closes', () => {
    const h = getDailyHistory('VOO');
    expect(h).toHaveLength(HISTORY_DAYS);
    for (let i = 1; i < h.length; i++) expect(h[i].t - h[i - 1].t).toBe(DAY_MS);
    expect(h.every((pt) => pt.p > 0)).toBe(true);
  });

  it('ends exactly at the realistic present-day anchor price', () => {
    for (const sym of ['VOO', 'NVDA', 'BTC', 'DOGE']) {
      expect(getDailyHistory(sym).at(-1)!.p).toBe(getAsset(sym).currentBase);
    }
  });

  it('regenerates the identical path from scratch (no cache, fresh module)', async () => {
    const original = getDailyHistory('SPOT').map((pt) => pt.p);
    vi.resetModules();
    const fresh = await import('./market');
    expect(fresh.getDailyHistory('SPOT').map((pt) => pt.p)).toEqual(original);
  });

  it('gives each symbol its own path', () => {
    const a = getDailyHistory('AAPL').map((pt) => pt.p / getAsset('AAPL').currentBase);
    const b = getDailyHistory('MSFT').map((pt) => pt.p / getAsset('MSFT').currentBase);
    expect(a).not.toEqual(b);
  });

  it('pins the engine output (fails if the simulation math changes)', () => {
    const h = getDailyHistory('VOO');
    const sample = [0, 500, 1000, 1500].map((i) => Number(h[i].p.toFixed(4)));
    expect(sample).toMatchInlineSnapshot(`
      [
        286.3258,
        338.1485,
        395.5304,
        428.2245,
      ]
    `);
  });

  it("realizes roughly each asset's configured volatility", () => {
    for (const sym of ['VOO', 'TSLA', 'BTC']) {
      const p = getDailyHistory(sym).map((pt) => pt.p);
      const logR = p.slice(1).map((x, i) => Math.log(x / p[i]));
      const mean = logR.reduce((a, b) => a + b, 0) / logR.length;
      const std = Math.sqrt(logR.reduce((a, r) => a + (r - mean) ** 2, 0) / (logR.length - 1));
      const annualized = std * Math.sqrt(365);
      const target = getAsset(sym).volatility;
      expect(Math.abs(annualized - target) / target).toBeLessThan(0.1);
    }
  });
});

describe('closeOn', () => {
  it('looks up the close for a given day and clamps outside the history', () => {
    const h = getDailyHistory('QQQ');
    expect(closeOn('QQQ', h[100].t + 3_600_000)).toBe(h[100].p);
    expect(closeOn('QQQ', h[0].t - 30 * DAY_MS)).toBe(h[0].p);
    expect(closeOn('QQQ', h.at(-1)!.t + 30 * DAY_MS)).toBe(h.at(-1)!.p);
  });
});
