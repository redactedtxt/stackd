import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ASSETS, getAsset } from '../data/assets';
import {
  DEFAULT_PARAMS,
  STRATEGIES,
  type BacktestConfig,
  type BacktestResult,
  type Metrics,
  type StrategyId,
  type Trade,
} from '../lib/backtest';
import { useBacktest } from '../lib/useBacktest';
import { fmtCompact, fmtDate, fmtMoney, fmtPct, fmtPrice } from '../lib/format';
import { Slider } from '../components/Slider';

// ---------------------------------------------------------------------------
// Strategy Lab: pick an asset and a trading rule, tune its parameters, and
// see how it would have done over the simulator's price history — next to
// plain buy-and-hold. The math lives in lib/backtest.ts and runs in a Web
// Worker (lib/useBacktest.ts); this page is controls + presentation.
//
// The teaching goal: students discover for themselves that most "clever"
// rules trail buy-and-hold on return, sometimes win on risk, and that
// tuning sliders until the numbers look great is overfitting.
// ---------------------------------------------------------------------------

const STARTING_CASH = 10_000;
const PERIODS = [1, 2, 3, 5];

const pct = (x: number) => fmtPct(x * 100);
const name = (id: StrategyId) => STRATEGIES.find((s) => s.id === id)!.name;

export function StrategyLab() {
  const [symbol, setSymbol] = useState('VOO');
  const [strategy, setStrategy] = useState<StrategyId>('ema-cross');
  const [years, setYears] = useState(3);
  const [costPct, setCostPct] = useState(0.001);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const set = (patch: Partial<typeof params>) => setParams((p) => ({ ...p, ...patch }));

  const config: BacktestConfig = { symbol, strategy, years, startingCash: STARTING_CASH, costPct, params };
  const { result, comparison, running } = useBacktest(config);
  const meta = STRATEGIES.find((s) => s.id === strategy)!;
  const usesSignals = strategy === 'sma-trend' || strategy === 'ema-cross';

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-bold">Strategy Lab 🧪</h1>
        <p className="mt-1 text-sm text-ink-400">
          Test a trading rule on years of simulated history before you trust it with a cent.
        </p>
      </div>

      {/* ------------------------------ controls ------------------------------ */}
      <div className="card space-y-5 !p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="section-title">Asset</span>
            <select
              className="input mt-2"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            >
              {ASSETS.map((a) => (
                <option key={a.symbol} value={a.symbol}>
                  {a.emoji} {a.symbol} — {a.name}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="section-title">Test period</span>
            <div className="mt-2 flex gap-2">
              {PERIODS.map((y) => (
                <button
                  key={y}
                  className={years === y ? 'chip-on' : 'chip-off'}
                  onClick={() => setYears(y)}
                >
                  {y}Y
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <span className="section-title">Strategy</span>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STRATEGIES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStrategy(s.id)}
                className={`rounded-xl border px-3 py-2.5 text-left font-display text-sm font-semibold transition-colors ${
                  strategy === s.id
                    ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                    : 'border-ink-800 text-ink-300 hover:border-ink-600'
                }`}
              >
                <span className="mr-1.5">{s.emoji}</span>
                {s.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-ink-400">{meta.blurb}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {strategy === 'dca' && (
            <Slider
              label="Invest a slice every"
              value={params.dcaEveryDays}
              display={`${params.dcaEveryDays} days`}
              min={7}
              max={90}
              step={1}
              onChange={(v) => set({ dcaEveryDays: v })}
            />
          )}
          {strategy === 'ema-cross' && (
            <>
              <Slider
                label="Fast EMA"
                value={params.fastEma}
                display={`${params.fastEma} days`}
                min={3}
                max={50}
                step={1}
                onChange={(v) => set({ fastEma: v, slowEma: Math.max(params.slowEma, v + 1) })}
              />
              <Slider
                label="Slow EMA"
                value={params.slowEma}
                display={`${params.slowEma} days`}
                min={10}
                max={200}
                step={1}
                onChange={(v) => set({ slowEma: v, fastEma: Math.min(params.fastEma, v - 1) })}
              />
            </>
          )}
          {usesSignals && (
            <>
              <Slider
                label={strategy === 'sma-trend' ? 'Trend SMA' : 'Trend filter (SMA)'}
                value={params.trendSma}
                display={params.trendSma === 0 ? 'off' : `${params.trendSma} days`}
                min={strategy === 'sma-trend' ? 20 : 0}
                max={250}
                step={10}
                onChange={(v) => set({ trendSma: v })}
              />
              <Slider
                label="ATR trailing stop"
                value={params.atrStopMult}
                display={params.atrStopMult === 0 ? 'off' : `${params.atrStopMult}× ATR`}
                min={0}
                max={6}
                step={0.5}
                onChange={(v) => set({ atrStopMult: v })}
              />
            </>
          )}
          <Slider
            label="Trading cost per buy/sell"
            value={costPct * 100}
            display={`${(costPct * 100).toFixed(2)}%`}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setCostPct(v / 100)}
          />
        </div>
        {usesSignals && years === 5 && (
          <p className="text-xs text-ink-500">
            Heads up: a 5-year test uses all the history, so there's no earlier data to warm up
            the indicators — the rule sits in cash until its moving averages exist.
          </p>
        )}
      </div>

      {/* ------------------------------ results ------------------------------- */}
      {result && comparison ? (
        <div className={`space-y-6 transition-opacity ${running ? 'opacity-60' : ''}`}>
          <Verdict result={result} />
          <MetricGrid m={result.metrics} b={result.benchmark} isBenchmark={strategy === 'buy-hold'} />
          <EquityChart result={result} />
          <Leaderboard comparison={comparison} active={strategy} onPick={setStrategy} />
          {result.trades.length > 0 && <TradeList trades={result.trades} strategy={strategy} />}
        </div>
      ) : (
        <div className="card animate-pulse-soft !p-8 text-center text-sm text-ink-400">
          Crunching {years} years of {symbol}…
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-ink-500">
        Backtests on simulated prices. Past performance (especially simulated past performance)
        doesn't predict the future, and a rule tuned until it looks perfect on one history is
        usually just <em>overfit</em> to it. Educational tool — not financial advice.
      </p>
    </div>
  );
}

// ------------------------------- sub-views ----------------------------------

function Verdict({ result }: { result: BacktestResult }) {
  const { metrics: m, benchmark: b, config } = result;
  const asset = getAsset(config.symbol);
  if (config.strategy === 'buy-hold') {
    return (
      <div className="rounded-2xl bg-brand-500/10 p-4 text-sm">
        <p>
          💎 Holding <b>{asset.symbol}</b> for the whole test turned {fmtMoney(STARTING_CASH)} into{' '}
          <b className="gain">{fmtMoney(m.finalValue)}</b> ({pct(m.totalReturn)}), with a worst
          drop of <b className="loss-text">−{(m.maxDrawdown * 100).toFixed(1)}%</b> along the way.
        </p>
        <p className="mt-1 text-ink-400">
          This is the benchmark. Pick another strategy and see if it can do better.
        </p>
      </div>
    );
  }
  const diff = m.totalReturn - b.totalReturn;
  const won = diff >= 0;
  const safer = m.maxDrawdown < b.maxDrawdown;
  return (
    <div className={`rounded-2xl p-4 text-sm ${won ? 'bg-brand-500/10' : 'bg-loss/10'}`}>
      <p>
        {won ? '🏆' : '🐢'} <b>{name(config.strategy)}</b> {won ? 'beat' : 'trailed'} buy & hold on{' '}
        {asset.symbol} by <b className={won ? 'gain' : 'loss-text'}>{(Math.abs(diff) * 100).toFixed(1)} points</b>{' '}
        ({pct(m.totalReturn)} vs {pct(b.totalReturn)}).
      </p>
      <p className="mt-1 text-ink-300">
        {safer
          ? `Its worst drop was smaller (−${(m.maxDrawdown * 100).toFixed(1)}% vs −${(b.maxDrawdown * 100).toFixed(1)}%) — giving up some return for a calmer ride can be a fair trade.`
          : `And it didn't even soften the worst drop (−${(m.maxDrawdown * 100).toFixed(1)}% vs −${(b.maxDrawdown * 100).toFixed(1)}%).`}{' '}
        Risk-adjusted, its Sharpe ratio was {m.sharpe.toFixed(2)} vs {b.sharpe.toFixed(2)}.
      </p>
    </div>
  );
}

function MetricGrid({ m, b, isBenchmark }: { m: Metrics; b: Metrics; isBenchmark: boolean }) {
  // `higher` = whether a bigger number is better (drawdown & volatility: lower is better).
  const rows: { label: string; v: string; bv: string; better: boolean | null; tip: string }[] = [
    {
      label: 'Total return',
      v: pct(m.totalReturn),
      bv: pct(b.totalReturn),
      better: m.totalReturn >= b.totalReturn,
      tip: 'Gain over the whole test.',
    },
    {
      label: 'CAGR',
      v: pct(m.cagr),
      bv: pct(b.cagr),
      better: m.cagr >= b.cagr,
      tip: 'Compound annual growth rate — the steady yearly return that gets you the same result.',
    },
    {
      label: 'Max drawdown',
      v: `−${(m.maxDrawdown * 100).toFixed(1)}%`,
      bv: `−${(b.maxDrawdown * 100).toFixed(1)}%`,
      better: m.maxDrawdown <= b.maxDrawdown,
      tip: 'Biggest fall from a peak. The number that makes people panic-sell.',
    },
    {
      label: 'Sharpe ratio',
      v: m.sharpe.toFixed(2),
      bv: b.sharpe.toFixed(2),
      better: m.sharpe >= b.sharpe,
      tip: 'Return per unit of volatility. Above 1 is good; higher is better.',
    },
    {
      label: 'Volatility',
      v: `${(m.volatility * 100).toFixed(1)}%`,
      bv: `${(b.volatility * 100).toFixed(1)}%`,
      better: m.volatility <= b.volatility,
      tip: 'How much the value swings per year (annualized std. dev.).',
    },
    {
      label: 'Win rate',
      v: m.winRate === null ? '—' : `${Math.round(m.winRate * 100)}%`,
      bv: b.winRate === null ? '—' : `${Math.round(b.winRate * 100)}%`,
      better: null,
      tip: 'Share of trades that made money. High win rate ≠ high return!',
    },
    {
      label: 'Trades',
      v: String(m.tradeCount),
      bv: String(b.tradeCount),
      better: null,
      tip: 'Positions opened. More trades = more costs.',
    },
    {
      label: 'Time in market',
      v: `${Math.round(m.exposure * 100)}%`,
      bv: `${Math.round(b.exposure * 100)}%`,
      better: null,
      tip: 'Share of days with money invested.',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {rows.map((r) => (
        <div key={r.label} className="card !p-3.5" title={r.tip}>
          <p className="text-[11px] text-ink-400">{r.label}</p>
          <p
            className={`mt-1 font-display text-base font-bold tabular-nums ${
              isBenchmark || r.better === null ? '' : r.better ? 'gain' : 'loss-text'
            }`}
          >
            {r.v}
          </p>
          {!isBenchmark && <p className="mt-0.5 text-[11px] text-ink-500">B&H {r.bv}</p>}
        </div>
      ))}
    </div>
  );
}

function EquityChart({ result }: { result: BacktestResult }) {
  const isBench = result.config.strategy === 'buy-hold';
  return (
    <div className="card !p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">Growth of {fmtMoney(STARTING_CASH)}</h2>
        <div className="flex gap-4 text-xs text-ink-400">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-brand-400" />
            {name(result.config.strategy)}
          </span>
          {!isBench && (
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-ink-400" />
              Buy & hold
            </span>
          )}
        </div>
      </div>
      <div className="mt-4 h-60">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={result.equity} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#7783ae" strokeOpacity={0.15} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(t: number) => new Date(t).getFullYear().toString()}
              tick={{ fontSize: 11, fill: '#7783ae' }}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            <YAxis
              width={44}
              domain={['auto', 'auto']}
              tickFormatter={(v: number) => '$' + fmtCompact(v)}
              tick={{ fontSize: 11, fill: '#7783ae' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const pt = payload[0].payload as BacktestResult['equity'][number];
                return (
                  <div className="card !p-2 text-xs shadow-lg">
                    <p className="text-ink-400">{fmtDate(pt.t, true)}</p>
                    <p className="font-display font-semibold tabular-nums gain">
                      {fmtMoney(pt.strategy)}
                    </p>
                    {!isBench && (
                      <p className="font-display tabular-nums text-ink-400">
                        B&H {fmtMoney(pt.benchmark)}
                      </p>
                    )}
                  </div>
                );
              }}
            />
            {!isBench && (
              <Line
                type="monotone"
                dataKey="benchmark"
                stroke="#7783ae"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            )}
            <Line
              type="monotone"
              dataKey="strategy"
              stroke="#8ceb1f"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Leaderboard({
  comparison,
  active,
  onPick,
}: {
  comparison: { strategy: StrategyId; metrics: Metrics }[];
  active: StrategyId;
  onPick: (id: StrategyId) => void;
}) {
  const ranked = [...comparison].sort((a, b) => b.metrics.sharpe - a.metrics.sharpe);
  return (
    <div className="card !p-5">
      <h2 className="section-title">Leaderboard · same asset, same period</h2>
      <p className="mt-1 text-xs text-ink-500">Ranked by Sharpe ratio (return per unit of risk).</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-[11px] text-ink-500">
              <th className="pb-2 font-medium">Strategy</th>
              <th className="pb-2 text-right font-medium">Return</th>
              <th className="pb-2 text-right font-medium">Max DD</th>
              <th className="pb-2 text-right font-medium">Sharpe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            {ranked.map(({ strategy, metrics }, i) => {
              const s = STRATEGIES.find((x) => x.id === strategy)!;
              return (
                <tr
                  key={strategy}
                  onClick={() => onPick(strategy)}
                  className={`cursor-pointer ${strategy === active ? 'text-brand-400' : 'hover:bg-ink-800/50'}`}
                >
                  <td className="py-2 pr-2 font-display font-semibold">
                    <span className="mr-1 text-ink-500">{i + 1}.</span> {s.emoji} {s.name}
                  </td>
                  <td className={`py-2 text-right ${metrics.totalReturn >= 0 ? '' : 'loss-text'}`}>
                    {pct(metrics.totalReturn)}
                  </td>
                  <td className="py-2 text-right">−{(metrics.maxDrawdown * 100).toFixed(1)}%</td>
                  <td className="py-2 text-right">{metrics.sharpe.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const REASON_LABEL: Record<Trade['exitReason'], string> = {
  signal: 'Signal',
  stop: 'Stop hit',
  end: 'Still held',
};

function TradeList({ trades, strategy }: { trades: Trade[]; strategy: StrategyId }) {
  const [showAll, setShowAll] = useState(false);
  const newestFirst = [...trades].reverse();
  const shown = showAll ? newestFirst : newestFirst.slice(0, 8);
  return (
    <div className="card !p-5">
      <h2 className="section-title">
        {strategy === 'dca' ? 'Purchases' : 'Trades'} ({trades.length})
      </h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-[11px] text-ink-500">
              <th className="pb-2 font-medium">Bought</th>
              <th className="pb-2 font-medium">{strategy === 'dca' ? 'Valued' : 'Sold'}</th>
              <th className="pb-2 text-right font-medium">Return</th>
              <th className="pb-2 pl-2 text-right font-medium">Exit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            {shown.map((t) => (
              <tr key={t.entryT}>
                <td className="py-2 pr-2">
                  <span className="block">{fmtDate(t.entryT, true)}</span>
                  <span className="text-[11px] text-ink-500">{fmtPrice(t.entryPrice)}</span>
                </td>
                <td className="py-2 pr-2">
                  <span className="block">{fmtDate(t.exitT, true)}</span>
                  <span className="text-[11px] text-ink-500">{fmtPrice(t.exitPrice)}</span>
                </td>
                <td className={`py-2 text-right font-semibold ${t.returnPct >= 0 ? 'gain' : 'loss-text'}`}>
                  {pct(t.returnPct)}
                </td>
                <td className="py-2 pl-2 text-right text-xs text-ink-400">
                  {REASON_LABEL[t.exitReason]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {trades.length > 8 && (
        <button className="btn-ghost mt-3 w-full" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${trades.length}`}
        </button>
      )}
    </div>
  );
}
