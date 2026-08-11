import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { AllocationSlice } from '../lib/analytics';
import { fmtMoney } from '../lib/format';

// ---------------------------------------------------------------------------
// Donut chart for portfolio allocation (by asset or by sector) with a
// simple legend. Colors cycle through a brand-friendly palette.
// ---------------------------------------------------------------------------

const COLORS = ['#8ceb1f', '#4ecdc4', '#a78bfa', '#fbbf24', '#ff5c7a', '#38bdf8', '#f472b6', '#94a3b8'];

export function AllocationDonut({ slices }: { slices: AllocationSlice[] }) {
  if (!slices.length) {
    return <p className="py-8 text-center text-sm text-ink-400">Nothing to show yet — make your first buy!</p>;
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {slices.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const s = payload[0].payload as AllocationSlice;
                return (
                  <div className="card !p-2 text-xs shadow-lg">
                    <p className="font-display font-semibold">{s.label}</p>
                    <p className="text-ink-400">
                      {fmtMoney(s.value)} · {s.pct.toFixed(1)}%
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="flex-1 truncate">{s.label}</span>
            <span className="tabular-nums text-ink-400">{s.pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
