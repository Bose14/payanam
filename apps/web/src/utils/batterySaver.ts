/**
 * Battery-saver mode Engine (Feature D · Tracking)
 * 
 * Rules:
 * 1. Rider turns it on: Me > Ride settings > Battery saver.
 * 2. Update rate drops: Positions are sent about every 30 s instead of about every 10 s.
 * 3. Note appears: The Ride tab notes that positions may be older.
 * 4. Freshness stays honest: Riders with older positions show as stale (see A), so the group is not misled.
 */

const STORAGE_KEY = 'payanam_battery_saver_enabled';

export const NORMAL_TRACKING_INTERVAL_MS = 10 * 1000;       // 10 seconds default
export const BATTERY_SAVER_TRACKING_INTERVAL_MS = 30 * 1000; // 30 seconds battery-saver rate

/**
 * Reads battery saver preference from localStorage (safely handles SSR / storage blocks).
 */
export function getBatterySaverPreference(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Saves battery saver preference to localStorage.
 */
export function setBatterySaverPreference(enabled: boolean): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    /* ignore storage quota or private mode issues */
  }
}

/**
 * Returns the effective location update rate based on battery saver mode.
 */
export function getEffectiveTrackingInterval(batterySaver: boolean): number {
  return batterySaver ? BATTERY_SAVER_TRACKING_INTERVAL_MS : NORMAL_TRACKING_INTERVAL_MS;
}
