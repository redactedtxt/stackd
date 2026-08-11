// ---------------------------------------------------------------------------
// Formatting helpers. Centralized so money/percent formatting is identical
// everywhere in the app.
// ---------------------------------------------------------------------------

const money = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const moneyPrecise = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

/** $1,234.56 — standard money. */
export function fmtMoney(n: number): string {
  return money.format(n);
}

/**
 * Money that adapts to tiny prices (DOGE at $0.32 needs more decimals than
 * a $500 stock).
 */
export function fmtPrice(n: number): string {
  return n < 1 ? moneyPrecise.format(n) : money.format(n);
}

/** +$12.34 / −$12.34 with an explicit sign. */
export function fmtSignedMoney(n: number): string {
  const sign = n >= 0 ? '+' : '−';
  return sign + money.format(Math.abs(n));
}

/** +1.23% / −1.23% */
export function fmtPct(n: number): string {
  const sign = n >= 0 ? '+' : '−';
  return `${sign}${Math.abs(n).toFixed(2)}%`;
}

/** Share quantities: whole numbers plain, fractional up to 6 dp. */
export function fmtQty(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString('en-CA', { maximumFractionDigits: 6 });
}

/** 12.4K / 3.1M compact numbers. */
export function fmtCompact(n: number): string {
  return new Intl.NumberFormat('en-CA', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

/** "Mar 4" / "Mar 4, 2025" style dates. */
export function fmtDate(ts: number, withYear = false): string {
  return new Date(ts).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

/** "2:34 PM" */
export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Relative label for activity feeds: "just now", "3h ago", "Mar 4". */
export function fmtRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(ts, days > 300);
}
