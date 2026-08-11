import { useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import type { ChartRange, PricePoint } from '../lib/market';
import { fmtDate, fmtMoney, fmtTime } from '../lib/format';

// ---------------------------------------------------------------------------
// The main price/portfolio chart: gradient area, hover tooltip, and a range
// selector. Color flips green/red based on performance over the visible
// range (Wealthsimple-style).
// ---------------------------------------------------------------------------

const RANGES: ChartRange[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];

interface Props {
  /** Called when the user changes range; parent supplies matching data. */
  getSeries: (range: ChartRange) => PricePoint[];
  height?: number;
  /** Ranges to offer; portfolios younger than a range can hide it. */
  ranges?: ChartRange[];
  onRangeChange?: (range: ChartRange) => void;
}

export function PriceChart({ getSeries, height = 220, ranges = RANGES, onRangeChange }: Props) {
  const [range, setRange] = useState<ChartRange>('1M');
  const activeRange = ranges.includes(range) ? range : ranges[0];

  const data = useMemo(() => getSeries(activeRange), [getSeries, activeRange]);
  const first = data[0]?.p ?? 0;
  const last = data[data.length - 1]?.p ?? 0;
  const up = last >= first;
  const color = up ? '#8ceb1f' : '#ff5c7a';

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`grad-${up}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={['dataMin', 'dataMax']} hide />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const pt = payload[0].payload as PricePoint;
                return (
                  <div className="card !p-2 text-xs shadow-lg">
                    <p className="font-display font-semibold tabular-nums">{fmtMoney(pt.p)}</p>
                    <p className="text-ink-400">
                      {activeRange === '1D' ? fmtTime(pt.t) : fmtDate(pt.t, true)}
                    </p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="p"
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${up})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex gap-1.5">
        {ranges.map((r) => (
          <button
            key={r}
            onClick={() => {
              setRange(r);
              onRangeChange?.(r);
            }}
            className={r === activeRange ? 'chip-on' : 'chip-off'}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
