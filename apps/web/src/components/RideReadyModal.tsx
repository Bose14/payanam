import { useState } from 'react';
import Icon from './Icon';
import {
  RIDER_CHECKLIST, BIKE_CHECKLIST, ChecklistItem, FuelState, rangeKm, FUEL_RESERVE, loadFuelProfile,
} from '../utils/rideReady';

interface Props {
  step: 'checklist' | 'fuel';
  initialChecked: string[];
  initialFuel: FuelState | null;
  /** Distance ridden along the route right now (metres), if known */
  currentAlongM: number | null;
  routeLeftKm: number | null;
  onSaveChecklist: (checked: string[]) => void;
  onSaveFuel: (fuel: FuelState) => void;
  onClose: () => void;
}

function Section({ title, items, checked, toggle }: {
  title: string; items: ChecklistItem[]; checked: string[]; toggle: (id: string) => void;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: 'var(--pz-muted)', marginBottom: 6 }}>{title}</div>
      {items.map((it) => {
        const on = checked.includes(it.id);
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => toggle(it.id)}
            role="checkbox"
            aria-checked={on}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
              padding: '10px 12px', marginBottom: 6, borderRadius: 12, cursor: 'pointer',
              background: on ? 'var(--pz-ok-bg, var(--pz-surface))' : 'var(--pz-surface)',
              border: `1.5px solid ${on ? 'var(--pz-ok)' : 'var(--pz-line)'}`, color: 'var(--pz-ink)',
            }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: `1.5px solid ${on ? 'var(--pz-ok)' : 'var(--pz-line)'}`,
              background: on ? 'var(--pz-ok)' : 'transparent', color: 'var(--pz-on-accent)',
            }}>{on && <Icon name="check" />}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>{it.label}</span>
              {it.hint && <span style={{ display: 'block', fontSize: 12, color: 'var(--pz-muted)' }}>{it.hint}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function RideReadyModal(p: Props) {
  const [step, setStep] = useState<'checklist' | 'fuel'>(p.step);
  const [checked, setChecked] = useState<string[]>(p.initialChecked);
  const profile = p.initialFuel ?? loadFuelProfile();
  const [mileage, setMileage] = useState(String(profile?.mileage ?? ''));
  const [tank, setTank] = useState(String(profile?.tank ?? ''));
  const [level, setLevel] = useState(p.initialFuel && p.initialFuel.tank ? Math.round((p.initialFuel.litres / p.initialFuel.tank) * 100) : 100);

  const total = RIDER_CHECKLIST.length + BIKE_CHECKLIST.length;
  const toggle = (id: string) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const m = parseFloat(mileage);
  const t = parseFloat(tank);
  const valid = m > 0 && m <= 150 && t > 0 && t <= 60;
  const litres = valid ? (t * level) / 100 : 0;
  const range = valid ? rangeKm(m, litres) : 0;
  const enough = p.routeLeftKm != null && valid ? range >= p.routeLeftKm : null;

  const saveFuel = () => {
    if (!valid) return;
    p.onSaveFuel({ mileage: m, tank: t, litres, baselineAlong: p.currentAlongM, setAt: Date.now() });
  };

  return (
    <div className="pz-backdrop" role="dialog" aria-modal="true" aria-label="Ride preparation"
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={p.onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 520, maxHeight: '92dvh', overflowY: 'auto', background: 'var(--pz-bg)', color: 'var(--pz-ink)',
        borderRadius: '20px 20px 0 0', padding: '16px 16px 24px', borderTop: '1.5px solid var(--pz-line)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: 'var(--pz-muted)' }}>BEFORE THE CONVOY MOVES</div>
            <h3 style={{ margin: 0, fontSize: 18 }}>{step === 'checklist' ? 'Pre-ride checklist' : 'Fuel range'}</h3>
          </div>
          <button type="button" onClick={p.onClose} title="Close" className="pz-btn small"><Icon name="close" /></button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {(['checklist', 'fuel'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setStep(s)} className="pz-btn small"
              style={{ flex: 1, opacity: step === s ? 1 : 0.6, borderColor: step === s ? 'var(--pz-accent)' : undefined }}>
              {s === 'checklist' ? `1. Checklist (${checked.length}/${total})` : '2. Fuel range'}
            </button>
          ))}
        </div>

        {step === 'checklist' ? (
          <>
            <Section title="YOU" items={RIDER_CHECKLIST} checked={checked} toggle={toggle} />
            <Section title="YOUR BIKE" items={BIKE_CHECKLIST} checked={checked} toggle={toggle} />
            {checked.length < total && (
              <p className="pz-note" style={{ margin: '0 0 10px' }}>
                Tick everything you have done. Anything left unticked is on you, so sort it before you roll.
              </p>
            )}
            <button type="button" className="pz-btn primary block"
              onClick={() => { p.onSaveChecklist(checked); setStep('fuel'); }}>
              {checked.length === total ? 'All set, next' : 'Save and continue'}
            </button>
          </>
        ) : (
          <>
            <p className="pz-note" style={{ marginTop: 0 }}>
              Enter your bike's mileage and tank size, then how full it is. We keep {Math.round(FUEL_RESERVE * 100)}% in reserve and track your range as you ride.
            </p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <label style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>Mileage (km per litre)
                <input className="pz-input" inputMode="decimal" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="e.g. 35" style={{ width: '100%', marginTop: 4 }} />
              </label>
              <label style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>Tank size (litres)
                <input className="pz-input" inputMode="decimal" value={tank} onChange={(e) => setTank(e.target.value)} placeholder="e.g. 13" style={{ width: '100%', marginTop: 4 }} />
              </label>
            </div>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 12 }}>
              Fuel in tank now: {level}%
              <input type="range" min={5} max={100} step={5} value={level} onChange={(e) => setLevel(Number(e.target.value))} style={{ width: '100%' }} />
            </label>
            <div className="pz-card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--pz-muted)' }}>Your range on this fuel</div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{valid ? `${range} km` : '--'}</div>
              {p.routeLeftKm != null && valid && (
                <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: enough ? 'var(--pz-ok)' : 'var(--pz-bad)' }}>
                  {enough
                    ? `Enough for the ${Math.round(p.routeLeftKm)} km left on the route.`
                    : `Route has ${Math.round(p.routeLeftKm)} km left. You need a fuel stop in about ${range} km.`}
                </div>
              )}
              {!valid && <div className="pz-note">Mileage up to 150 km/l and tank up to 60 L.</div>}
            </div>
            <button type="button" className="pz-btn primary block" disabled={!valid} onClick={saveFuel}>Save fuel range and ride</button>
            <button type="button" className="pz-btn block" style={{ marginTop: 8 }} onClick={p.onClose}>Skip for now</button>
          </>
        )}
      </div>
    </div>
  );
}
