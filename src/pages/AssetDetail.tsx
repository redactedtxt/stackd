import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bell, Repeat, Star } from 'lucide-react';
import { ASSET_MAP } from '../data/assets';
import { newsFor } from '../data/news';
import { useQuote } from '../stores/marketStore';
import { usePortfolioStore } from '../stores/portfolioStore';
import { getDailyHistory, getRangeSeries, type ChartRange } from '../lib/market';
import { fmtCompact, fmtMoney, fmtPct, fmtPrice, fmtQty, fmtSignedMoney } from '../lib/format';
import { PriceChart } from '../components/PriceChart';
import { TradeSheet } from '../components/TradeSheet';
import type { OrderSide, RecurringPlan } from '../types';

// ---------------------------------------------------------------------------
// Asset detail: live price + range chart, your position, key stats
// (52-week range, simulated market cap / volume, dividend yield), the
// "why students care" blurb, related news, and the three power tools —
// trade, price alert, and recurring auto-invest.
// ---------------------------------------------------------------------------

export function AssetDetail() {
  const { symbol = '' } = useParams();
  const asset = ASSET_MAP[symbol];

  if (!asset) {
    return (
      <div className="py-16 text-center">
        <p className="text-3xl">🤔</p>
        <p className="mt-2 font-display font-semibold">Unknown asset</p>
        <Link to="/discover" className="btn-ghost mt-4">
          Back to Discover
        </Link>
      </div>
    );
  }
  return <AssetDetailInner symbol={symbol} />;
}

function AssetDetailInner({ symbol }: { symbol: string }) {
  const asset = ASSET_MAP[symbol];
  const quote = useQuote(symbol);
  const { holdings, watchlist, toggleWatch, alerts, addAlert, removeAlert, addRecurring } =
    usePortfolioStore();

  const [sheet, setSheet] = useState<OrderSide | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertPriceStr, setAlertPriceStr] = useState('');
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [recAmountStr, setRecAmountStr] = useState('25');
  const [recCadence, setRecCadence] = useState<RecurringPlan['cadence']>('weekly');

  const held = holdings.find((h) => h.symbol === symbol);
  const watched = watchlist.includes(symbol);
  const myAlerts = alerts.filter((a) => a.symbol === symbol && !a.triggered);
  const news = newsFor(symbol);
  const up = quote.dayChangePct >= 0;

  const getSeries = useCallback(
    (range: ChartRange) => getRangeSeries(symbol, range, quote.price),
    // Rebuild only when symbol changes — the chart shouldn't re-fetch its
    // whole series on every 3s tick, just when the user changes range.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symbol],
  );

  // 52-week stats + simulated fundamentals (deterministic per symbol).
  const stats = useMemo(() => {
    const year = getDailyHistory(symbol).slice(-365).map((d) => d.p);
    const low = Math.min(...year);
    const high = Math.max(...year);
    // Fake-but-stable share count → market cap scales with price.
    const shares = 100e6 + (symbol.charCodeAt(0) * 7919 + symbol.length * 104729) * 31 * 1e3;
    return { low, high, marketCap: shares * quote.price, volume: shares * 0.011 };
  }, [symbol, quote.price]);

  const positionValue = held ? held.qty * quote.price : 0;
  const positionGain = held ? positionValue - held.avgCost * held.qty : 0;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/discover" className="btn-ghost !p-2" aria-label="Back">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 font-display text-xl font-bold">
              <span>{asset.emoji}</span> {asset.symbol}
            </h1>
            <p className="text-sm text-ink-400">{asset.name}</p>
          </div>
        </div>
        <button
          onClick={() => toggleWatch(symbol)}
          className={`btn-ghost !p-2.5 ${watched ? '!border-brand-500 text-brand-400' : ''}`}
          aria-label="Toggle watchlist"
        >
          <Star size={18} fill={watched ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Price + chart */}
      <div className="card !p-5">
        <p className="font-display text-3xl font-bold tabular-nums">{fmtPrice(quote.price)}</p>
        <p className={`mt-1 text-sm font-medium tabular-nums ${up ? 'gain' : 'loss-text'}`}>
          {fmtSignedMoney(quote.dayChange)} ({fmtPct(quote.dayChangePct)}) today
        </p>
        <div className="mt-4">
          <PriceChart getSeries={getSeries} />
        </div>
      </div>

      {/* Trade buttons */}
      <div className="flex gap-3">
        <button className="btn-primary flex-1 !py-3.5 text-base" onClick={() => setSheet('buy')}>
          Buy
        </button>
        <button
          className="btn-danger flex-1 !py-3.5 text-base"
          onClick={() => setSheet('sell')}
          disabled={!held}
        >
          Sell
        </button>
      </div>

      {/* Your position */}
      {held && (
        <div className="card">
          <h2 className="section-title">Your position</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-ink-400">{asset.type === 'crypto' ? 'Coins' : 'Shares'}</p>
              <p className="font-display font-semibold tabular-nums">
                {fmtQty(Number(held.qty.toFixed(6)))}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-400">Value</p>
              <p className="font-display font-semibold tabular-nums">{fmtMoney(positionValue)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-400">Avg cost</p>
              <p className="font-display font-semibold tabular-nums">{fmtPrice(held.avgCost)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-400">Total return</p>
              <p
                className={`font-display font-semibold tabular-nums ${
                  positionGain >= 0 ? 'gain' : 'loss-text'
                }`}
              >
                {fmtSignedMoney(positionGain)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Power tools: alert + auto-invest */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card">
          <button
            className="flex w-full items-center gap-2 text-left font-display text-sm font-semibold"
            onClick={() => setAlertOpen(!alertOpen)}
          >
            <Bell size={16} className="text-brand-400" /> Price alert
            {myAlerts.length > 0 && (
              <span className="ml-auto rounded-full bg-brand-500/15 px-2 py-0.5 text-xs text-brand-400">
                {myAlerts.length} active
              </span>
            )}
          </button>
          {alertOpen && (
            <div className="mt-3 space-y-2 animate-fade-up">
              <input
                className="input"
                type="number"
                min="0"
                step="any"
                placeholder={`Target price (now ${fmtPrice(quote.price)})`}
                value={alertPriceStr}
                onChange={(e) => setAlertPriceStr(e.target.value)}
              />
              <button
                className="btn-primary w-full"
                disabled={!(parseFloat(alertPriceStr) > 0)}
                onClick={() => {
                  const target = parseFloat(alertPriceStr);
                  addAlert(symbol, target >= quote.price ? 'above' : 'below', target);
                  setAlertPriceStr('');
                  setAlertOpen(false);
                }}
              >
                Notify me
              </button>
              {myAlerts.map((a) => (
                <p key={a.id} className="flex justify-between text-xs text-ink-400">
                  <span>
                    🔔 {a.direction} {fmtPrice(a.targetPrice)}
                  </span>
                  <button className="hover:text-loss" onClick={() => removeAlert(a.id)}>
                    remove
                  </button>
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <button
            className="flex w-full items-center gap-2 text-left font-display text-sm font-semibold"
            onClick={() => setRecurringOpen(!recurringOpen)}
          >
            <Repeat size={16} className="text-brand-400" /> Auto-invest
          </button>
          {recurringOpen && (
            <div className="mt-3 space-y-2 animate-fade-up">
              <input
                className="input"
                type="number"
                min="1"
                value={recAmountStr}
                onChange={(e) => setRecAmountStr(e.target.value)}
              />
              <div className="flex gap-1.5">
                {(['weekly', 'biweekly', 'monthly'] as const).map((c) => (
                  <button
                    key={c}
                    className={c === recCadence ? 'chip-on' : 'chip-off'}
                    onClick={() => setRecCadence(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <button
                className="btn-primary w-full"
                disabled={!(parseFloat(recAmountStr) > 0)}
                onClick={() => {
                  addRecurring(symbol, parseFloat(recAmountStr), recCadence);
                  setRecurringOpen(false);
                }}
              >
                Set up {fmtMoney(parseFloat(recAmountStr) || 0)} {recCadence}
              </button>
              <p className="text-[11px] text-ink-500">
                Dollar-cost averaging on autopilot — buys happen even while you're away.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="card">
        <h2 className="section-title">Stats</h2>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-ink-400">52-wk low</p>
            <p className="font-display font-semibold tabular-nums">{fmtPrice(stats.low)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">52-wk high</p>
            <p className="font-display font-semibold tabular-nums">{fmtPrice(stats.high)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Market cap*</p>
            <p className="font-display font-semibold tabular-nums">${fmtCompact(stats.marketCap)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">
              {asset.dividendYield > 0 ? 'Dividend yield' : 'Avg volume*'}
            </p>
            <p className="font-display font-semibold tabular-nums">
              {asset.dividendYield > 0
                ? `${(asset.dividendYield * 100).toFixed(2)}%`
                : fmtCompact(stats.volume)}
            </p>
          </div>
        </div>
        {/* 52-week range bar */}
        <div className="mt-4">
          <div className="relative h-1.5 rounded-full bg-ink-800">
            <div
              className="absolute -top-[3px] h-3 w-3 rounded-full bg-brand-400"
              style={{
                left: `calc(${Math.min(
                  Math.max(((quote.price - stats.low) / (stats.high - stats.low || 1)) * 100, 0),
                  100,
                )}% - 6px)`,
              }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-ink-500">
            <span>52-wk low</span>
            <span>52-wk high</span>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-ink-600">*Simulated figures for practice purposes.</p>
      </div>

      {/* About */}
      <div className="card">
        <h2 className="section-title">About {asset.name}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">{asset.description}</p>
        <div className="mt-3 rounded-xl bg-brand-500/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-400">
            Why students care
          </p>
          <p className="mt-1 text-sm text-ink-200">{asset.studentAngle}</p>
        </div>
        <p className="mt-3 text-xs text-ink-500">
          {asset.sector} · {asset.type.toUpperCase()}
          {asset.dividendYield > 0 && ' · pays dividends 💸'}
        </p>
      </div>

      {/* News */}
      {news.length > 0 && (
        <section>
          <h2 className="section-title mb-2">In the news</h2>
          <div className="space-y-2">
            {news.map((n) => (
              <article key={n.id} className="card !p-3.5">
                <p className="text-sm font-medium leading-snug">{n.headline}</p>
                <p className="mt-1 text-xs text-ink-500">
                  {n.source} · {n.hoursAgo}h ago ·{' '}
                  <span
                    className={
                      n.sentiment === 'bullish' ? 'gain' : n.sentiment === 'bearish' ? 'loss-text' : ''
                    }
                  >
                    {n.sentiment}
                  </span>
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {sheet && <TradeSheet asset={asset} side={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}
