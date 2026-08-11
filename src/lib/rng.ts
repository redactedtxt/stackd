// ---------------------------------------------------------------------------
// Deterministic pseudo-random number generation.
//
// Why: the market simulator must produce the SAME price history for a given
// symbol on every visit (otherwise charts and portfolio history would change
// on refresh). We seed a small, fast PRNG (mulberry32) with a hash of the
// symbol so every asset gets its own stable random universe.
// ---------------------------------------------------------------------------

/** FNV-1a string hash — turns a symbol like "AAPL" into a 32-bit seed. */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — tiny seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Standard-normal sample via Box–Muller. Geometric Brownian Motion (the
 * model behind our price paths) needs normally-distributed shocks, not
 * uniform ones.
 */
export function gaussian(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/** Short unique id for transactions/orders (no external uuid dep needed). */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
