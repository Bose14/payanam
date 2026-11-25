/** Pre-ride checklist and fuel range planner helpers. Stored on the device, per rider. */

export interface ChecklistItem { id: string; label: string; hint?: string }

export const RIDER_CHECKLIST: ChecklistItem[] = [
  { id: 'licence', label: 'Driving licence and ID', hint: 'Keep originals or DigiLocker copies handy' },
  { id: 'helmet', label: 'Helmet and riding gear', hint: 'Helmet strap fastened, gloves, jacket, knee guards' },
  { id: 'phone', label: 'Phone charged with a power bank', hint: 'Mount is secure and location is on' },
  { id: 'water', label: 'Water, snacks and personal medicines' },
  { id: 'cash', label: 'Some cash and UPI working', hint: 'Network can drop on the highway' },
  { id: 'rain', label: 'Rain cover or spare layer for weather' },
];

export const BIKE_CHECKLIST: ChecklistItem[] = [
  { id: 'papers', label: 'RC, insurance and PUC with you' },
  { id: 'tyres', label: 'Tyre pressure and tread checked' },
  { id: 'brakes', label: 'Brakes working front and rear' },
  { id: 'chain', label: 'Chain tight and lubed' },
  { id: 'oil', label: 'Engine oil and coolant level fine' },
  { id: 'lights', label: 'Headlight, tail light and indicators work' },
  { id: 'kit', label: 'Puncture kit and basic tools packed' },
  { id: 'tank', label: 'Tank filled or fuel stop planned' },
];

const key = (sessionId: string, userId: string) => `payanam_ready_${sessionId}_${userId}`;

export function loadChecked(sessionId: string, userId: string): string[] {
  try { return JSON.parse(localStorage.getItem(key(sessionId, userId)) || '{}').checked ?? []; } catch { return []; }
}
export function isReadyDone(sessionId: string, userId: string): boolean {
  try { return !!JSON.parse(localStorage.getItem(key(sessionId, userId)) || '{}').done; } catch { return false; }
}
export function saveReady(sessionId: string, userId: string, checked: string[], done: boolean) {
  try { localStorage.setItem(key(sessionId, userId), JSON.stringify({ checked, done })); } catch { /* ignore */ }
}

export interface FuelProfile {
  /** Kilometres per litre */
  mileage: number;
  /** Tank size in litres */
  tank: number;
}
export interface FuelState extends FuelProfile {
  /** Fuel in the tank, litres, when set */
  litres: number;
  /** Distance travelled along the route (metres) when set; null if unknown */
  baselineAlong: number | null;
  setAt: number;
}

const PROFILE_KEY = 'payanam_fuel_profile';
const stateKey = (sessionId: string, userId: string) => `payanam_fuel_${sessionId}_${userId}`;

export function loadFuelProfile(): FuelProfile | null {
  try { const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); return p?.mileage > 0 && p?.tank > 0 ? p : null; } catch { return null; }
}
export function loadFuelState(sessionId: string, userId: string): FuelState | null {
  try { return JSON.parse(localStorage.getItem(stateKey(sessionId, userId)) || 'null'); } catch { return null; }
}
export function saveFuelState(sessionId: string, userId: string, s: FuelState) {
  try {
    localStorage.setItem(stateKey(sessionId, userId), JSON.stringify(s));
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ mileage: s.mileage, tank: s.tank }));
  } catch { /* ignore */ }
}

/** Reserve kept back so the rider is never planning to run the tank dry. */
export const FUEL_RESERVE = 0.1;

export function rangeKm(mileage: number, litres: number): number {
  return Math.max(0, Math.floor(mileage * litres * (1 - FUEL_RESERVE)));
}

/** Range left now: the range when set, less what has been ridden along the route since. */
export function rangeLeftKm(s: FuelState, currentAlongM: number | null): number {
  const start = rangeKm(s.mileage, s.litres);
  if (s.baselineAlong == null || currentAlongM == null) return start;
  return Math.max(0, Math.floor(start - Math.max(0, currentAlongM - s.baselineAlong) / 1000));
}
