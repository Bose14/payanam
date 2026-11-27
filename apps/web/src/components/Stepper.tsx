import type { CSSProperties } from 'react';

interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  /** Word shown beside the number, e.g. "Days". Pass a function for singular and plural. */
  unit: string | ((n: number) => string);
  /** Spoken name of the thing being changed, e.g. "days" gives "Decrease days". */
  label: string;
}

const box: CSSProperties = {
  display: 'flex', alignItems: 'center', background: 'var(--bg-subtle)', border: '1px solid var(--border-input)',
  borderRadius: 10, padding: 4, maxWidth: 240, width: '100%',
};
const btn: CSSProperties = {
  width: 38, height: 38, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
  fontSize: 18, fontWeight: 800, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const valueBox: CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap',
  fontSize: 15, color: 'var(--text-primary)',
};

/** A number with minus and plus buttons. */
export default function Stepper({ value, min, max, onChange, unit, label }: StepperProps) {
  return (
    <div style={box}>
      <button type="button" style={btn} aria-label={`Decrease ${label}`} disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}>–</button>
      <div style={valueBox}>
        <strong style={{ fontSize: 17, fontWeight: 800 }}>{value}</strong>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{typeof unit === 'function' ? unit(value) : unit}</span>
      </div>
      <button type="button" style={btn} aria-label={`Increase ${label}`} disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  );
}
