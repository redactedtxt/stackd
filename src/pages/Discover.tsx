import { useMemo, useState } from 'react';
import { Search, TrendingDown, TrendingUp } from 'lucide-react';
import { ASSETS } from '../data/assets';
import { NEWS } from '../data/news';
import { useMarketStore } from '../stores/marketStore';
import { AssetRow } from '../components/AssetRow';

// ---------------------------------------------------------------------------
// Discover: search + category filters, today's top movers (computed live
// from the simulated quotes), and a market news feed. This is the browsing
// surface — the equivalent of Wealthsimple's "Discover" tab.
// ---------------------------------------------------------------------------

const CATEGORIES = ['All', 'ETFs', 'Stocks', 'Crypto', 'Student Life 🎒'] as const;
type Category = (typeof CATEGORIES)[number];

// "Student Life" — brands students touch daily; the shelf that makes the
// audience positioning obvious.
const STUDENT_PICKS = ['SPOT', 'DUOL', 'RBLX', 'NFLX', 'UBER', 'CMG', 'SBUX', 'NKE', 'CELH', 'ABNB'];

export function Discover() {
  const quotes = useMarketStore((s) => s.quotes);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('All');

  const filtered = useMemo(() => {
    let list = ASSETS;
    if (category === 'ETFs') list = list.filter((a) => a.type === 'etf');
    if (category === 'Stocks') list = list.filter((a) => a.type === 'stock');
    if (category === 'Crypto') list = list.filter((a) => a.type === 'crypto');
    if (category === 'Student Life 🎒') list = list.filter((a) => STUDENT_PICKS.includes(a.symbol));
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          a.symbol.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.sector.toLowerCase().includes(q),
      );
    }
    return list;
  }, [query, category]);

  const movers = useMemo(() => {
    const sorted = [...ASSETS].sort(
      (a, b) => (quotes[b.symbol]?.dayChangePct ?? 0) - (quotes[a.symbol]?.dayChangePct ?? 0),
    );
    return { up: sorted.slice(0, 3), down: sorted.slice(-3).reverse() };
    // Recompute only when the quote object identity changes (every tick).
  }, [quotes]);

  const searching = query.trim() !== '' || category !== 'All';

  return (
    <div className="space-y-6 animate-fade-up">
      <h1 className="font-display text-2xl font-bold">Discover</h1>

      {/* Search + categories */}
      <div>
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            className="input !pl-10"
            placeholder="Search stocks, ETFs, crypto…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={c === category ? 'chip-on' : 'chip-off'}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Movers — hidden while actively searching to keep results focused */}
      {!searching && (
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="card !p-3">
            <h2 className="section-title mb-1 flex items-center gap-1.5 px-2 pt-1">
              <TrendingUp size={14} className="text-brand-400" /> Today's gainers
            </h2>
            {movers.up.map((a) => (
              <AssetRow key={a.symbol} asset={a} />
            ))}
          </section>
          <section className="card !p-3">
            <h2 className="section-title mb-1 flex items-center gap-1.5 px-2 pt-1">
              <TrendingDown size={14} className="text-loss" /> Today's dippers
            </h2>
            {movers.down.map((a) => (
              <AssetRow key={a.symbol} asset={a} />
            ))}
          </section>
        </div>
      )}

      {/* Asset list */}
      <section>
        <h2 className="section-title mb-2">
          {searching ? `${filtered.length} result${filtered.length === 1 ? '' : 's'}` : 'All assets'}
        </h2>
        <div className="card !p-2">
          {filtered.map((a) => (
            <AssetRow key={a.symbol} asset={a} sub={`${a.name} · ${a.sector}`} />
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-400">
              No matches for “{query}”. Try a ticker like AAPL or BTC.
            </p>
          )}
        </div>
      </section>

      {/* News feed */}
      {!searching && (
        <section>
          <h2 className="section-title mb-2">Market buzz 📰</h2>
          <div className="space-y-2">
            {NEWS.slice(0, 8).map((n) => (
              <article key={n.id} className="card !p-3.5">
                <p className="text-sm font-medium leading-snug">{n.headline}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                  <span>{n.source}</span>
                  <span>· {n.hoursAgo}h ago</span>
                  <span
                    className={
                      n.sentiment === 'bullish'
                        ? 'gain'
                        : n.sentiment === 'bearish'
                          ? 'loss-text'
                          : ''
                    }
                  >
                    {n.sentiment === 'bullish' ? '▲ bullish' : n.sentiment === 'bearish' ? '▼ bearish' : '– neutral'}
                  </span>
                  <span className="text-ink-600">{n.symbols.join(' · ')}</span>
                </p>
              </article>
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] text-ink-600">
            Headlines are fictional demo content.
          </p>
        </section>
      )}
    </div>
  );
}
