/**
 * Picture-in-Picture (PiP HUD) preferences and platform permission helpers
 * Supports Android (OS PiP permission check & guides) and iOS (In-App floating cockpit & PWA guide)
 */

export type PipModePreference = 'auto' | 'in_app' | 'native';

export interface PipPreferences {
  autoOpenOnRide: boolean;
  preferredMode: PipModePreference;
  dockPosition: 'top' | 'bottom';
}

const STORAGE_KEY = 'payanam_pip_preferences';

const DEFAULT_PREFERENCES: PipPreferences = {
  autoOpenOnRide: true,
  preferredMode: 'auto',
  dockPosition: 'bottom',
};

export function getPipPreferences(): PipPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      autoOpenOnRide: parsed.autoOpenOnRide !== undefined ? Boolean(parsed.autoOpenOnRide) : true,
      preferredMode: parsed.preferredMode === 'in_app' || parsed.preferredMode === 'native' ? parsed.preferredMode : 'auto',
      dockPosition: parsed.dockPosition === 'top' ? 'top' : 'bottom',
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePipPreferences(prefs: Partial<PipPreferences>): PipPreferences {
  const current = getPipPreferences();
  const updated: PipPreferences = { ...current, ...prefs };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // storage unavailable
    }
  }
  return updated;
}

export function isPlatformIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIosDevice = /iPad|iPhone|iPod/.test(ua);
  const isIpadOs = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
  return isIosDevice || isIpadOs;
}

export function isPlatformAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/.test(navigator.userAgent || '');
}

export function getPlatformType(): 'ios' | 'android' | 'desktop' {
  if (isPlatformIos()) return 'ios';
  if (isPlatformAndroid()) return 'android';
  return 'desktop';
}

/**
 * Checks whether the browser runtime supports native OS video Picture-in-Picture.
 * iOS WebKit strictly restricts canvas captureStream from popping out to OS level,
 * whereas Android Chrome and modern desktop browsers fully support it.
 */
export function isNativePipSupported(): boolean {
  if (typeof document === 'undefined') return false;
  if (isPlatformIos()) return false;
  const hasVideoPip = 'pictureInPictureEnabled' in document && Boolean(document.pictureInPictureEnabled);
  const hasDocPip = typeof window !== 'undefined' && 'documentPictureInPicture' in window;
  return hasVideoPip || hasDocPip;
}
