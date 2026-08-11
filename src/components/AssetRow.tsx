import { Link } from 'react-router-dom';
import type { Asset } from '../types';
import { useQuote } from '../stores/marketStore';
import { fmtPct, fmtPrice } from '../lib/format';
import { Sparkline } from './Sparkline';

// ---------------------------------------------------------------------------
// The standard asset list row used across Discover, watchlists, and movers.
// Live price + day change re-render on every tick via the quote hook.
// ---------------------------------------------------------------------------

export function AssetRow({ asset, sub }: { asset: Asset; sub?: string }) {
  const quote = useQuote(asset.symbol);
  const up = quote.dayChangePct >= 0;

  return (
    <Link
      to={`/asset/${asset.symbol}`}
      className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-ink-800/50"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-800 text-lg">
        {asset.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-semibold">{asset.symbol}</p>
        <p className="truncate text-xs text-ink-400">{sub ?? asset.name}</p>
      </div>
      <div className="hidden sm:block">
        <Sparkline symbol={asset.symbol} />
      </div>
      <div className="text-right">
        <p className="font-display text-sm font-semibold tabular-nums">{fmtPrice(quote.price)}</p>
        <p className={`text-xs font-medium tabular-nums ${up ? 'gain' : 'loss-text'}`}>
          {fmtPct(quote.dayChangePct)}
        </p>
      </div>
    </Link>
  );
}
