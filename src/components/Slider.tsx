// Labelled range slider with a live value readout — shared by the Insights
// calculator and the Strategy Lab controls.
export function Slider({
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
        aria-label={label}
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
