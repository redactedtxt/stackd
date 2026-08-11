import { useState } from 'react';
import { X } from 'lucide-react';
import type { Asset, OrderSide } from '../types';
import { useQuote } from '../stores/marketStore';
import { usePortfolioStore } from '../stores/portfolioStore';
import { fmtMoney, fmtPrice, fmtQty } from '../lib/format';

// ---------------------------------------------------------------------------
// The buy/sell bottom sheet — the core interaction of the app.
//
// UX decisions (Wealthsimple-inspired):
//  • Users enter a DOLLAR amount, not shares — fractional investing means
//    "put in $25" is the natural mental model for students. A share-quantity
//    readout shows what that converts to.
//  • Market and limit orders are two tabs of the same sheet.
//  • Quick-amount chips ($10/$25/$50/Max) reduce typing on mobile.
// ---------------------------------------------------------------------------

interface Props {
  asset: Asset;
  side: OrderSide;
  onClose: () => void;
}

export function TradeSheet({ asset, side, onClose }: Props) {
  const quote = useQuote(asset.symbol);
  const { cash, holdings, trade, placeLimitOrder } = usePortfolioStore();
  const held = holdings.find((h) => h.symbol === asset.symbol);

  const [mode, setMode] = useState<'market' | 'limit'>('market');
  const [amountStr, setAmountStr] = useState('');
  const [limitStr, setLimitStr] = useState(quote.price.toFixed(2));

  const amount = parseFloat(amountStr) || 0;
  const limitPrice = parseFloat(limitStr) || 0;
  const effectivePrice = mode === 'market' ? quote.price : limitPrice;
  const qty = effectivePrice > 0 ? amount / effectivePrice : 0;

  const maxAmount = side === 'buy' ? cash : (held?.qty ?? 0) * effectivePrice;
  const overMax = amount > maxAmount + 0.005;
  const valid = amount > 0 && !overMax && (mode === 'market' || limitPrice > 0);

  const submit = () => {
    if (!valid) return;
    if (mode === 'market') {
      const ok = trade(asset.symbol, side, qty, quote.price);
      if (ok) onClose();
    } else {
      placeLimitOrder(asset.symbol, side, qty, limitPrice);
      onClose();
    }
  };

  const isBuy = side === 'buy';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* backdrop */}
      <button className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Close" />

      <div className="card relative w-full max-w-md rounded-b-none !p-5 animate-fade-up sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">
            {isBuy ? 'Buy' : 'Sell'} {asset.emoji} {asset.symbol}
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-200" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <p className="mt-0.5 text-sm text-ink-400">
          {fmtPrice(quote.price)} per {asset.type === 'crypto' ? 'coin' : 'share'}
          {held && ` · you hold ${fmtQty(held.qty)}`}
        </p>

        {/* order type tabs */}
        <div className="mt-4 flex gap-1.5">
          <button
            onClick={() => setMode('market')}
            className={mode === 'market' ? 'chip-on' : 'chip-off'}
          >
            Market
          </button>
          <button
            onClick={() => setMode('limit')}
            className={mode === 'limit' ? 'chip-on' : 'chip-off'}
          >
            Limit
          </button>
        </div>

        {mode === 'limit' && (
          <div className="mt-4">
            <label className="text-xs font-medium text-ink-400">
              {isBuy ? 'Buy when price drops to' : 'Sell when price rises to'}
            </label>
            <input
              className="input mt-1"
              type="number"
              min="0"
              step="any"
              value={limitStr}
              onChange={(e) => setLimitStr(e.target.value)}
            />
          </div>
        )}

        <div className="mt-4">
          <label className="text-xs font-medium text-ink-400">Amount (CAD)</label>
          <input
            className="input mt-1 text-lg font-semibold"
            type="number"
            min="0"
            step="any"
            placeholder="0.00"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            autoFocus
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[10, 25, 50, 100].map((v) => (
              <button key={v} className="chip-off" onClick={() => setAmountStr(String(v))}>
                ${v}
              </button>
            ))}
            <button
              className="chip-off"
              onClick={() => setAmountStr(maxAmount > 0 ? maxAmount.toFixed(2) : '0')}
            >
              Max
            </button>
          </div>
        </div>

        {/* order summary */}
        <div className="mt-4 space-y-1.5 rounded-xl bg-ink-800/50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-400">You {isBuy ? 'pay' : 'receive'}</span>
            <span className="font-semibold tabular-nums">{fmtMoney(amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-400">
              Est. {asset.type === 'crypto' ? 'coins' : 'shares'}
            </span>
            <span className="font-semibold tabular-nums">{fmtQty(Number(qty.toFixed(6)))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-400">Commission</span>
            <span className="font-semibold text-brand-400">$0 🎉</span>
          </div>
          {overMax && (
            <p className="pt-1 text-xs text-loss">
              {isBuy
                ? `Not enough cash — you have ${fmtMoney(cash)}.`
                : `You only hold ${fmtQty(held?.qty ?? 0)} ${asset.symbol}.`}
            </p>
          )}
        </div>

        <button
          onClick={submit}
          disabled={!valid}
          className={`mt-4 w-full ${isBuy ? 'btn-primary' : 'btn-danger'} !py-3.5 text-base`}
        >
          {mode === 'market'
            ? `${isBuy ? 'Buy' : 'Sell'} now`
            : `Place limit ${side}`}
        </button>
        <p className="mt-2 text-center text-[11px] text-ink-500">
          Practice trading with simulated prices — no real money involved.
        </p>
      </div>
    </div>
  );
}
