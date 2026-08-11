import { useMemo } from 'react';
import { getDailyHistory } from '../lib/market';

// ---------------------------------------------------------------------------
// Tiny inline 30-day trend line drawn with raw SVG — cheap enough to render
// in every list row (a full Recharts instance per row would be wasteful).
// ---------------------------------------------------------------------------

export function Sparkline({ symbol, width = 72, height = 28 }: {
  symbol: string;
  width?: number;
  height?: number;
}) {
  const { path, up } = useMemo(() => {
    const points = getDailyHistory(symbol).slice(-30).map((d) => d.p);
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const step = width / (points.length - 1);
    const d = points
      .map((p, i) => {
        const x = (i * step).toFixed(1);
        const y = (height - 2 - ((p - min) / span) * (height - 4)).toFixed(1);
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join(' ');
    return { path: d, up: points[points.length - 1] >= points[0] };
  }, [symbol, width, height]);

  return (
    <svg width={width} height={height} className="shrink-0" aria-hidden>
      <path
        d={path}
        fill="none"
        stroke={up ? '#8ceb1f' : '#ff5c7a'}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
