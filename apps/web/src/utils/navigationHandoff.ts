/**
 * Feature L · Navigation Handoff: Open stop in navigation app
 * 
 * Specifications:
 * Where it sits:
 * - Stop detail on the Ride tab
 * - Location cards in chat
 * - Nearby help listings in the Plan tab
 * 
 * How it works:
 * 1. Rider taps Open in navigation app (Any stop, shared location, or listing).
 * 2. Coordinates are handed over: The phone passes the place to the rider's own maps app.
 * 3. Navigation happens there: Turn-by-turn guidance is entirely in Google Maps or the chosen app.
 */

export type NavigationAppType = 'google_bike' | 'google_drive' | 'apple' | 'waze' | 'system_geo';

export interface NavigationTargetCoords {
  lat: number;
  lng: number;
  name?: string;
}

export interface NavigationAppOption {
  id: NavigationAppType;
  name: string;
  desc: string;
  icon: string;
  accentColor: string;
  accentBg: string;
}

export const NAVIGATION_APP_OPTIONS: NavigationAppOption[] = [
  {
    id: 'google_bike',
    name: 'Google Maps (Motorcycle)',
    desc: 'Two-wheeler fastest routing & bike shortcuts',
    icon: '🏍️',
    accentColor: '#F0C23A',
    accentBg: 'rgba(240, 194, 58, 0.12)',
  },
  {
    id: 'google_drive',
    name: 'Google Maps (Drive)',
    desc: 'Standard driving guidance with live traffic',
    icon: '🗺️',
    accentColor: '#4285F4',
    accentBg: 'rgba(66, 133, 244, 0.12)',
  },
  {
    id: 'apple',
    name: 'Apple Maps',
    desc: 'Native iOS turn-by-turn voice directions',
    icon: '🍏',
    accentColor: '#10B981',
    accentBg: 'rgba(16, 185, 129, 0.12)',
  },
  {
    id: 'waze',
    name: 'Waze',
    desc: 'Crowdsourced police, speed cams & hazard alerts',
    icon: '🚙',
    accentColor: '#38BDF8',
    accentBg: 'rgba(56, 189, 248, 0.12)',
  },
];

const PREF_STORAGE_KEY = 'payanam_preferred_nav_app';

export function getPreferredNavigationApp(): NavigationAppType {
  try {
    const saved = localStorage.getItem(PREF_STORAGE_KEY);
    if (saved && ['google_bike', 'google_drive', 'apple', 'waze'].includes(saved)) {
      return saved as NavigationAppType;
    }
  } catch {
    // ignore
  }
  return 'google_bike';
}

export function setPreferredNavigationApp(app: NavigationAppType): void {
  try {
    localStorage.setItem(PREF_STORAGE_KEY, app);
  } catch {
    // ignore
  }
}

/**
 * Builds the platform-specific URL to hand coordinates off to external navigation apps.
 */
export function buildNavigationHandoffUrl(
  target: NavigationTargetCoords,
  app: NavigationAppType = 'google_bike'
): string {
  const { lat, lng, name } = target;
  const encodedName = encodeURIComponent(name || 'Stop Target');

  switch (app) {
    case 'google_bike':
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=&travelmode=two-wheeler`;

    case 'google_drive':
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

    case 'apple': {
      const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
      return isIOS
        ? `maps://?daddr=${lat},${lng}&dirflg=d&q=${encodedName}`
        : `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d&q=${encodedName}`;
    }

    case 'waze':
      return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;

    case 'system_geo':
    default:
      return `geo:${lat},${lng}?q=${lat},${lng}(${encodedName})`;
  }
}

/**
 * Hands coordinates over to the rider's navigation app.
 */
export function launchNavigationHandoff(
  target: NavigationTargetCoords,
  app?: NavigationAppType
): void {
  const chosenApp = app || getPreferredNavigationApp();
  const url = buildNavigationHandoffUrl(target, chosenApp);
  window.open(url, '_blank', 'noopener,noreferrer');
}

