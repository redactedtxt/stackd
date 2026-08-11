import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Flame, PiggyBank, Plus, Sparkles } from 'lucide-react';
import { useMarketStore } from '../stores/marketStore';
import { usePortfolioStore } from '../stores/portfolioStore';
import { useUserStore } from '../stores/userStore';
import {
  netContributions,
  portfolioDailySeries,
  portfolioIntradaySeries,
  totalValue,
} from '../lib/analytics';
import type { ChartRange, PricePoint } from '../lib/market';
import { RANGE_DAYS } from '../lib/market';
import { fmtMoney, fmtPct, fmtPrice, fmtQty, fmtSignedMoney } from '../lib/format';
import { getAsset, ASSET_MAP } from '../data/assets';
import { AssetRow } from '../components/AssetRow';
import { PriceChart } from '../components/PriceChart';

// ---------------------------------------------------------------------------
// The dashboard. Answers the three questions every investor opens the app
// with: How much do I have? How is it doing? What should I do next?
//  • Big number + performance chart (range-aware, like Wealthsimple's home)
//  • Holdings with live P/L
//  • Watchlist, pending limit orders, next scheduled events
// ---------------------------------------------------------------------------

export function Home() {
  const quotes = useMarketStore((s) => s.quotes);
  const { cash, holdings, transactions, watchlist, orders, recurring, deposit } =
    usePortfolioStore();
  const { name, joinedAt, streak } = useUserStore();
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositStr, setDepositStr] = useState('100');

  const value = totalValue(cash, holdings, quotes);
  const contributed = netContributions(transactions);
  const allTimeGain = value - contributed;
  const allTimePct = contributed > 0 ? (allTimeGain / contributed) * 100 : 0;

  const getSeries = useCallback(
    (range: ChartRange): PricePoint[] => {
      if (range === '1D') return portfolioIntradaySeries(cash, holdings, quotes);
      const days = range === 'ALL' ? undefined : RANGE_DAYS[range];
      return portfolioDailySeries(transactions, joinedAt, quotes, days);
    },
    [cash, holdings, transactions, joinedAt, quotes],
  );

  const holdingRows = useMemo(
    () =>
      holdings
        .map((h) => {
          const price = quotes[h.symbol]?.price ?? 0;
          const mv = h.qty * price;
          const gain = mv - h.avgCost * h.qty;
          const gainPct = h.avgCost > 0 ? (gain / (h.avgCost * h.qty)) * 100 : 0;
          return { ...h, price, mv, gain, gainPct };
        })
        .sort((a, b) => b.mv - a.mv),
    [holdings, quotes],
  );

  const watchAssets = watchlist.filter((s) => !holdings.some((h) => h.symbol === s));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'gm' : hour < 18 ? 'good afternoon' : 'gn... or one more trade?';

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-400">
            {greeting}, <span className="font-semibold text-ink-200">{name}</span> 👋
          </p>
          <h1 className="font-display text-lg font-bold">Your portfolio</h1>
        </div>
        {streak > 1 && (
          <span className="flex items-center gap-1 rounded-full bg-orange-500/15 px-3 py-1.5 text-sm font-semibold text-orange-400">
            <Flame size={15} /> {streak}
          </span>
        )}
      </div>

      {/* Value + chart */}
      <div className="card !p-5">
        <p className="font-display text-4xl font-bold tabular-nums tracking-tight">
          {fmtMoney(value)}
        </p>
        <p
          className={`mt-1 text-sm font-medium tabular-nums ${
            allTimeGain >= 0 ? 'gain' : 'loss-text'
          }`}
        >
          {fmtSignedMoney(allTimeGain)} ({fmtPct(allTimePct)}) all time
        </p>
        <div className="mt-4">
          <PriceChart getSeries={getSeries} />
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-ink-800/50 p-3 text-sm">
          <span className="flex items-center gap-2 text-ink-300">
            <PiggyBank size={16} className="text-brand-400" /> Cash to invest
          </span>
          <span className="font-semibold tabular-nums">{fmtMoney(cash)}</span>
          <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setDepositOpen(!depositOpen)}>
            <Plus size={14} /> Add
          </button>
        </div>
        {depositOpen && (
          <div className="mt-2 flex gap-2 animate-fade-up">
            <input
              className="input flex-1"
              type="number"
              min="1"
              value={depositStr}
              onChange={(e) => setDepositStr(e.target.value)}
            />
            <button
              className="btn-primary"
              onClick={() => {
                deposit(parseFloat(depositStr) || 0);
                setDepositOpen(false);
              }}
            >
              Deposit
            </button>
          </div>
        )}
      </div>

      {/* Insights teaser */}
      <Link
        to="/insights"
        className="card flex items-center gap-3 !py-3.5 transition-colors hover:border-brand-500"
      >
        <Sparkles size={18} className="shrink-0 text-brand-400" />
        <span className="flex-1 text-sm font-medium">
          Insights: allocation, diversification score &amp; the Future You calculator
        </span>
        <ArrowRight size={16} className="text-ink-500" />
      </Link>

      {/* Holdings */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="section-title">Your holdings</h2>
          <Link to="/discover" className="text-xs font-semibold text-brand-400">
            Find more →
          </Link>
        </div>
        {holdingRows.length === 0 ? (
          <div className="card py-8 text-center">
            <p className="text-3xl">🌱</p>
            <p className="mt-2 font-display font-semibold">Nothing here yet</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-ink-400">
              Your {fmtMoney(cash)} is ready. Head to Discover and make your first (practice)
              investment.
            </p>
            <Link to="/discover" className="btn-primary mt-4">
              Start investing
            </Link>
          </div>
        ) : (
          <div className="card divide-y divide-ink-800 !p-2">
            {holdingRows.map((h) => {
              const asset = getAsset(h.symbol);
              return (
                <Link
                  key={h.symbol}
                  to={`/asset/${h.symbol}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-ink-800/50"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-800 text-lg">
                    {asset.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-semibold">{h.symbol}</p>
                    <p className="text-xs text-ink-400">
                      {fmtQty(Number(h.qty.toFixed(6)))} @ {fmtPrice(h.avgCost)} avg
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-sm font-semibold tabular-nums">
                      {fmtMoney(h.mv)}
                    </p>
                    <p
                      className={`text-xs font-medium tabular-nums ${
                        h.gain >= 0 ? 'gain' : 'loss-text'
                      }`}
                    >
                      {fmtSignedMoney(h.gain)} ({fmtPct(h.gainPct)})
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Pending limit orders */}
      {orders.length > 0 && (
        <section>
          <h2 className="section-title mb-2">Open limit orders</h2>
          <div className="card space-y-2 !p-3 text-sm">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2">
                <span>
                  <span className={`font-semibold ${o.side === 'buy' ? 'gain' : 'loss-text'}`}>
                    {o.side.toUpperCase()}
                  </span>{' '}
                  {fmtQty(Number(o.qty.toFixed(6)))} {o.symbol} @ {fmtPrice(o.limitPrice)}
                </span>
                <button
                  className="text-xs font-semibold text-ink-400 hover:text-loss"
                  onClick={() => usePortfolioStore.getState().cancelOrder(o.id)}
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Auto-invest summary */}
      {recurring.filter((r) => r.active).length > 0 && (
        <section>
          <h2 className="section-title mb-2">Auto-invest 🔁</h2>
          <div className="card space-y-1.5 !p-3 text-sm">
            {recurring
              .filter((r) => r.active)
              .map((r) => (
                <p key={r.id} className="text-ink-300">
                  {fmtMoney(r.amount)} of <span className="font-semibold">{r.symbol}</span>{' '}
                  {r.cadence} · next{' '}
                  {new Date(r.nextRun).toLocaleDateString('en-CA', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              ))}
          </div>
        </section>
      )}

      {/* Watchlist */}
      {watchAssets.length > 0 && (
        <section>
          <h2 className="section-title mb-2">Watching 👀</h2>
          <div className="card !p-2">
            {watchAssets.map(
              (s) => ASSET_MAP[s] && <AssetRow key={s} asset={ASSET_MAP[s]} />,
            )}
          </div>
        </section>
      )}
    </div>
  );
}
