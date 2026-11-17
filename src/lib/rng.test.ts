import { describe, expect, it } from 'vitest';
import { gaussian, hashString, mulberry32 } from './rng';

describe('hashString (FNV-1a)', () => {
  it('matches the published FNV-1a 32-bit test vectors', () => {
    expect(hashString('')).toBe(0x811c9dc5);
    expect(hashString('a')).toBe(0xe40c292c);
  });

  it('gives different symbols different seeds', () => {
    expect(hashString('AAPL:daily')).not.toBe(hashString('MSFT:daily'));
  });
});

describe('mulberry32', () => {
  it('replays the exact same sequence for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 100 }, a);
    const seqB = Array.from({ length: 100 }, b);
    expect(seqA).toEqual(seqB);
  });

  it('produces uniform floats in [0, 1)', () => {
    const rand = mulberry32(7);
    const xs = Array.from({ length: 20_000 }, rand);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean).toBeCloseTo(0.5, 1);
  });
});

describe('gaussian (Box–Muller)', () => {
  it('has mean ≈ 0 and standard deviation ≈ 1', () => {
    const rand = mulberry32(123);
    const xs = Array.from({ length: 20_000 }, () => gaussian(rand));
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    const std = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1));
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(std).toBeGreaterThan(0.97);
    expect(std).toBeLessThan(1.03);
  });
});
