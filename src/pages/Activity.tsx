import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolioStore } from '../stores/portfolioStore';
import { fmtPrice, fmtQty, fmtRelative, fmtSignedMoney } from '../lib/format';
import type { Transaction, TxType } from '../types';

// ---------------------------------------------------------------------------
// Activity: the full transaction ledger with type filters. Every cash and
// share movement in the app lands here — it doubles as the audit trail for
// the portfolio performance chart (which replays this exact log).
// ---------------------------------------------------------------------------

const FILTERS: { label: string; types: TxType[] | null }[] = [
  { label: 'All', types: null },
  { label: 'Trades', types: ['buy', 'sell'] },
  { label: 'Auto 🔁', types: ['recurring-buy', 'roundup'] },
  { label: 'Dividends', types: ['dividend'] },
  { label: 'Deposits', types: ['deposit', 'reward'] },
];

const TX_META: Record<TxType, { emoji: string; label: string }> = {
  buy: { emoji: '🟢', label: 'Bought' },
  sell: { emoji: '🔴', label: 'Sold' },
  deposit: { emoji: '🏦', label: 'Deposit' },
  dividend: { emoji: '💸', label: 'Dividend' },
  roundup: { emoji: '🪙', label: 'Round-up' },
  'recurring-buy': { emoji: '🔁', label: 'Auto-invest' },
  reward: { emoji: '🎁', label: 'Reward' },
};

function TxRow({ tx }: { tx: Transaction }) {
  const meta = TX_META[tx.type];
  const detail =
    tx.symbol && tx.qty
      ? `${fmtQty(Number(tx.qty.toFixed(6)))} ${tx.symbol}${tx.price ? ` @ ${fmtPrice(tx.price)}` : ''}`
      : (tx.note ?? '');

  const inner = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-800 text-base">
        {meta.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {meta.label} {tx.symbol && <span className="font-display font-semibold">{tx.symbol}</span>}
        </p>
        <p className="truncate text-xs text-ink-400">{detail}</p>
      </div>
      <div className="text-right">
        <p
          className={`text-sm font-semibold tabular-nums ${
            tx.amount > 0 ? 'gain' : tx.amount < 0 ? '' : 'text-ink-400'
          }`}
        >
          {tx.amount !== 0 ? fmtSignedMoney(tx.amount) : '—'}
        </p>
        <p className="text-xs text-ink-500">{fmtRelative(tx.timestamp)}</p>
      </div>
    </>
  );

  const cls = 'flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-ink-800/50';
  return tx.symbol ? (
    <Link to={`/asset/${tx.symbol}`} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function Activity() {
  const transactions = usePortfolioStore((s) => s.transactions);
  const [filter, setFilter] = useState(0);

  const list = useMemo(() => {
    const types = FILTERS[filter].types;
    return types ? transactions.filter((t) => types.includes(t.type)) : transactions;
  }, [transactions, filter]);

  return (
    <div className="space-y-5 animate-fade-up">
      <h1 className="font-display text-2xl font-bold">Activity</h1>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f, i) => (
          <button key={f.label} className={i === filter ? 'chip-on' : 'chip-off'} onClick={() => setFilter(i)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="card divide-y divide-ink-800 !p-2">
        {list.map((tx) => (
          <TxRow key={tx.id} tx={tx} />
        ))}
        {list.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-400">
            Nothing here yet — this feed fills up as you invest.
          </p>
        )}
      </div>
    </div>
  );
}
