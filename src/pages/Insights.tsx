import { useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMarketStore } from '../stores/marketStore';
import { usePortfolioStore } from '../stores/portfolioStore';
import { useUserStore } from '../stores/userStore';
import {
  allocationByAsset,
  allocationBySector,
  diversificationScore,
  netContributions,
  projectGrowth,
  totalValue,
} from '../lib/analytics';
import { fmtCompact, fmtMoney, fmtPct, fmtSignedMoney } from '../lib/format';
import { AllocationDonut } from '../components/AllocationDonut';
import type { PricePoint } from '../lib/market';

// ---------------------------------------------------------------------------
// Insights: the analytics layer.
//  • Headline stats (value, contributions, all-time return)
//  • Allocation donuts by asset and by sector
//  • Diversification score with a plain-language hint
//  • Suggested mix from the onboarding risk profile
//  • "Future You" compound-growth calculator — the single most persuasive
//    chart you can show a student.
// ---------------------------------------------------------------------------

const PROFILE_MIX: Record<string, { label: string; mix: string }> = {
  cautious: { label: '🛡️ Cautious', mix: '90% index ETFs · 10% individual picks' },
  balanced: { label: '⚖️ Balanced', mix: '75% index ETFs · 20% stocks · 5% crypto' },
  bold: { label: '🔥 Bold', mix: '60% index ETFs · 30% stocks · 10% crypto' },
};

export function Insights() {
  const quotes = useMarketStore((s) => s.quotes);
  const { cash, holdings, transactions } = usePortfolioStore();
  const riskProfile = useUserStore((s) => s.riskProfile);

  const value = totalValue(cash, holdings, quotes);
  const contributed = netContributions(transactions);
  const gain = value - contributed;

  const byAsset = useMemo(() => allocationByAsset(cash, holdings, quotes), [cash, holdings, quotes]);
  const bySector = useMemo(() => allocationBySector(holdings, quotes), [holdings, quotes]);
  const diversity = useMemo(() => diversificationScore(holdings, quotes), [holdings, quotes]);

  // Future You calculator state
  const [monthly, setMonthly] = useState(100);
  const [years, setYears] = useState(20);
  const [rate, setRate] = useState(8);
  const projection = useMemo(
    () => projectGrowth(value, monthly, rate / 100, years),
    [value, monthly, rate, years],
  );
  const endValue = projection[projection.length - 1]?.p ?? 0;
  const invested = value + monthly * 12 * years;

  return (
    <div className="space-y-6 animate-fade-up">
      <h1 className="font-display text-2xl font-bold">Insights ✨</h1>

      {/* Headline stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total value', val: fmtMoney(value), tone: '' },
          { label: 'You put in', val: fmtMoney(contributed), tone: '' },
          {
            label: 'All-time gain',
            val: fmtSignedMoney(gain),
            tone: gain >= 0 ? 'gain' : 'loss-text',
          },
        ].map((s) => (
          <div key={s.label} className="card !p-3.5">
            <p className="text-[11px] text-ink-400">{s.label}</p>
            <p className={`mt-1 font-display text-sm font-bold tabular-nums sm:text-base ${s.tone}`}>
              {s.val}
            </p>
          </div>
        ))}
      </div>

      {/* Diversification score */}
      <div className="card !p-5">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Diversification score</h2>
          <span className="font-display text-2xl font-bold text-brand-400">
            {diversity.score}
            <span className="text-sm text-ink-500">/100</span>
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-loss via-yellow-400 to-brand-400 transition-all"
            style={{ width: `${diversity.score}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-ink-300">{diversity.hint}</p>
        <p className="mt-2 text-[11px] text-ink-500">
          Scored on number of holdings, sector spread, concentration, and ETF exposure. A teaching
          heuristic — not financial advice.
        </p>
      </div>

      {/* Suggested mix */}
      <div className="card flex items-center justify-between gap-3 !p-4">
        <div>
          <p className="section-title">Your profile: {PROFILE_MIX[riskProfile].label}</p>
          <p className="mt-1 text-sm text-ink-300">{PROFILE_MIX[riskProfile].mix}</p>
        </div>
      </div>

      {/* Allocation */}
      <div className="card !p-5">
        <h2 className="section-title mb-3">Allocation by holding</h2>
        <AllocationDonut slices={byAsset} />
      </div>
      {bySector.length > 1 && (
        <div className="card !p-5">
          <h2 className="section-title mb-3">Allocation by sector</h2>
          <AllocationDonut slices={bySector} />
        </div>
      )}

      {/* Future You calculator */}
      <div className="card !p-5">
        <h2 className="section-title">Future You calculator 🔮</h2>
        <p className="mt-1 text-sm text-ink-400">
          Starting from your current {fmtMoney(value)}, compounding monthly:
        </p>

        <div className="mt-4 space-y-4">
          <Slider
            label="Monthly contribution"
            value={monthly}
            display={fmtMoney(monthly)}
            min={10}
            max={1000}
            step={10}
            onChange={setMonthly}
          />
          <Slider
            label="Years"
            value={years}
            display={`${years} yrs`}
            min={1}
            max={45}
            step={1}
            onChange={setYears}
          />
          <Slider
            label="Assumed annual return"
            value={rate}
            display={`${rate}%`}
            min={1}
            max={15}
            step={0.5}
            onChange={setRate}
          />
        </div>

        <div className="mt-5 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projection} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
              <defs>
                <linearGradient id="futureGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8ceb1f" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#8ceb1f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const pt = payload[0].payload as PricePoint;
                  const yearsOut = Math.round((pt.t - Date.now()) / (365 * 86_400_000));
                  return (
                    <div className="card !p-2 text-xs shadow-lg">
                      <p className="font-display font-semibold tabular-nums">{fmtMoney(pt.p)}</p>
                      <p className="text-ink-400">in ~{yearsOut} years</p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="p"
                stroke="#8ceb1f"
                strokeWidth={2}
                fill="url(#futureGrad)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 rounded-xl bg-brand-500/10 p-4 text-center">
          <p className="text-xs text-ink-400">
            In {years} years you could have
          </p>
          <p className="font-display text-3xl font-bold text-brand-400">
            ${fmtCompact(endValue)}
          </p>
          <p className="mt-1 text-xs text-ink-400">
            from {fmtMoney(invested)} invested — the other{' '}
            <span className="font-semibold text-brand-400">
              ${fmtCompact(Math.max(endValue - invested, 0))}
            </span>{' '}
            is compounding ({fmtPct(invested > 0 ? ((endValue - invested) / invested) * 100 : 0)}).
          </p>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-ink-400">{label}</span>
        <span className="font-display font-semibold tabular-nums">{display}</span>
      </div>
      <input
        type="range"
        className="mt-1.5 w-full accent-brand-500"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
