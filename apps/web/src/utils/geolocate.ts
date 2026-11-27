/**
 * One reading of the device position, with an honest reason when it fails.
 * A timeout or "no signal" is not the same as "permission denied", and the person needs to be
 * told which one it is. A precise (GPS) reading is tried first; if the device cannot give one in
 * time, a coarser reading from Wi-Fi or mobile networks is accepted.
 */
export type GeoFailure = 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'insecure';

export class GeoError extends Error {
  /** `detail` is the browser's own wording, kept so a failure can be diagnosed. */
  constructor(public reason: GeoFailure, public detail = '') { super(reason); }
}

export const GEO_MESSAGES: Record<GeoFailure, string> = {
  denied: 'Location is blocked for this site. Allow Location in your browser or phone settings for this site, then try again.',
  unavailable: 'Your device could not work out its position. Phone: turn on Location (GPS). Laptop: turn on Location services in the system settings and allow your browser (Windows: Settings > Privacy & security > Location. Mac: System Settings > Privacy & Security > Location Services). Or just type the place.',
  timeout: 'Finding your position took too long. Make sure Location is on (on a laptop it uses Wi-Fi, so be connected to Wi-Fi), then try again, or type the place.',
  unsupported: 'This browser cannot share your location. Type the place instead.',
  insecure: 'Location only works on a secure (https) page. Open the app from its https address.',
};

const once = (opts: PositionOptions) =>
  new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, opts));

const reasonOf = (e: unknown): GeoFailure => {
  const code = (e as GeolocationPositionError | undefined)?.code;
  return code === 1 ? 'denied' : code === 3 ? 'timeout' : 'unavailable';
};

export async function getPosition(): Promise<GeolocationPosition> {
  if (!('geolocation' in navigator)) throw new GeoError('unsupported');
  if (typeof window !== 'undefined' && window.isSecureContext === false) throw new GeoError('insecure');
  try {
    return await once({ enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  } catch (first) {
    if (reasonOf(first) === 'denied') throw new GeoError('denied', (first as GeolocationPositionError).message ?? '');
    try {
      return await once({ enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 });
    } catch (second) {
      throw new GeoError(reasonOf(second), (second as GeolocationPositionError | undefined)?.message ?? '');
    }
  }
}
