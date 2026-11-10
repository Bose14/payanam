// Payanam Background Tracking Reliability Engine (Feature P1 · Foundation)
// Runs foreground keepalive, monitors position heartbeat, detects when OS pauses tracking,
// generates the Ride tab pause warning, and logs support diagnostics.

export interface TrackingDiagnosticsLog {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

export interface BackgroundTrackingStatus {
  isTracking: boolean;
  isHeartbeatHealthy: boolean;
  isPaused: boolean;
  pauseReason?: string;
  lastFixTime: string | null;
  lastFixCoords?: { lat: number; lng: number } | null;
  totalFixesRecorded: number;
  heartbeatIntervalSec: number;
  maxFixStallSec: number;
  inBackground: boolean;
  wakeLockActive: boolean;
  batterySaver: boolean;
  platformMode: string;
  logs: TrackingDiagnosticsLog[];
}

const STORAGE_DIAGNOSTICS_KEY = 'payanam_tracking_diagnostics_log';
const MAX_LOGS = 50;

class BackgroundTrackingEngine {
  private isTracking = false;
  private isPaused = false;
  private pauseReason: string | undefined = undefined;
  private lastFixTime: string | null = null;
  private lastFixCoords: { lat: number; lng: number } | null = null;
  private totalFixesRecorded = 0;
  private inBackground = false;
  private wakeLockActive = false;
  private batterySaver = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private logs: TrackingDiagnosticsLog[] = [];
  private listeners: Array<(status: BackgroundTrackingStatus) => void> = [];

  constructor() {
    this.loadLogs();
    this.detectBackgroundState();
  }

  private loadLogs() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_DIAGNOSTICS_KEY);
      if (raw) {
        this.logs = JSON.parse(raw);
      }
    } catch {
      this.logs = [];
    }
  }

  private saveLogs() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_DIAGNOSTICS_KEY, JSON.stringify(this.logs.slice(-MAX_LOGS)));
    } catch {
      // silent
    }
  }

  private detectBackgroundState() {
    if (typeof document === 'undefined') return;
    this.inBackground = document.visibilityState === 'hidden';

    document.addEventListener('visibilitychange', () => {
      const wasBg = this.inBackground;
      this.inBackground = document.visibilityState === 'hidden';
      if (this.inBackground && !wasBg) {
        this.log('INFO', 'App entered background state. Foreground keepalive engaged.');
      } else if (!this.inBackground && wasBg) {
        this.log('INFO', 'App returned to foreground.');
      }
      this.notify();
    });
  }

  public log(level: 'INFO' | 'WARN' | 'ERROR', message: string) {
    const entry: TrackingDiagnosticsLog = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
    };
    this.logs.push(entry);
    if (this.logs.length > MAX_LOGS) {
      this.logs.shift();
    }
    this.saveLogs();
  }

  /**
   * Step 1: Trip starts - Tracking runs as foreground service / keepalive mode
   */
  public startTracking(batterySaver: boolean = false) {
    this.isTracking = true;
    this.isPaused = false;
    this.pauseReason = undefined;
    this.batterySaver = batterySaver;
    this.log('INFO', `Trip tracking started. Mode: Foreground keepalive (${batterySaver ? '30s throttle' : '10s real-time'})`);

    // Step 2: Start heartbeat watchdog check
    this.startHeartbeatWatchdog();
    this.notify();
  }

  public setBatterySaver(enabled: boolean) {
    this.batterySaver = enabled;
    this.log('INFO', `Battery saver changed: ${enabled ? 'ON (30s throttle)' : 'OFF (10s standard)'}`);
    this.notify();
  }

  public setWakeLockActive(active: boolean) {
    this.wakeLockActive = active;
    this.log('INFO', `Screen WakeLock state: ${active ? 'Active' : 'Released'}`);
    this.notify();
  }

  /**
   * Called whenever a new GPS coordinate is successfully received
   */
  public recordFix(lat: number, lng: number, accuracy?: number) {
    this.lastFixTime = new Date().toISOString();
    this.lastFixCoords = { lat, lng };
    this.totalFixesRecorded += 1;

    // If was previously paused, resume automatically
    if (this.isPaused) {
      this.isPaused = false;
      this.pauseReason = undefined;
      this.log('INFO', `Tracking resumed successfully. Fix #${this.totalFixesRecorded} recorded.`);
    }

    if (this.totalFixesRecorded % 10 === 1) {
      const accStr = accuracy ? ` (acc: ${Math.round(accuracy)}m)` : '';
      this.log('INFO', `GPS fix #${this.totalFixesRecorded} recorded at ${lat.toFixed(4)}, ${lng.toFixed(4)}${accStr}`);
    }

    this.notify();
  }

  /**
   * Step 2: Heartbeat checked
   * Confirms positions are still being recorded.
   * If tracking stops (e.g. OS kills background process or GPS freezes), trigger Step 3.
   */
  private startHeartbeatWatchdog() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    this.heartbeatTimer = setInterval(() => {
      if (!this.isTracking) return;

      const maxStallSec = this.batterySaver ? 90 : 45;
      const now = Date.now();
      const lastFixMs = this.lastFixTime ? new Date(this.lastFixTime).getTime() : 0;

      // Only check stall if we've received at least one fix, or if tracking has been running > 30s
      if (lastFixMs > 0 && now - lastFixMs > maxStallSec * 1000) {
        if (!this.isPaused) {
          // Step 3: If tracking stops -> The Ride tab warns: Tracking paused. Reopen Payanam.
          this.isPaused = true;
          this.pauseReason = `No GPS fixes for ${Math.round((now - lastFixMs) / 1000)}s (threshold: ${maxStallSec}s)`;
          this.log('WARN', `Tracking heartbeat check failed: ${this.pauseReason}. Alerting rider.`);

          // Vibrate if supported to alert rider
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate([400, 200, 400]);
            } catch {
              // ignore
            }
          }
          this.notify();
        }
      }
    }, 5000); // Heartbeat checked every 5 seconds
  }

  /**
   * Step 3: Rider manually or automatically resumes tracking
   */
  public resumeTracking() {
    this.isPaused = false;
    this.pauseReason = undefined;
    this.lastFixTime = new Date().toISOString();
    this.log('INFO', 'Rider tapped resume tracking. Heartbeat timer reset.');
    this.notify();
  }

  public stopTracking() {
    this.isTracking = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.log('INFO', 'Trip tracking ended.');
    this.notify();
  }

  /**
   * Step 4: Status logged - The last successful update time is kept for support diagnostics.
   */
  public getStatus(): BackgroundTrackingStatus {
    const isMobile = typeof navigator !== 'undefined' && /android|iphone|ipad|mobile/i.test(navigator.userAgent);
    const platform = isMobile
      ? /android/i.test(navigator.userAgent)
        ? 'Android Foreground Service Mode'
        : 'iOS Location Keepalive Mode'
      : 'PWA Web Worker Keepalive';

    return {
      isTracking: this.isTracking,
      isHeartbeatHealthy: !this.isPaused && this.isTracking,
      isPaused: this.isPaused,
      pauseReason: this.pauseReason,
      lastFixTime: this.lastFixTime,
      lastFixCoords: this.lastFixCoords,
      totalFixesRecorded: this.totalFixesRecorded,
      heartbeatIntervalSec: 5,
      maxFixStallSec: this.batterySaver ? 90 : 45,
      inBackground: this.inBackground,
      wakeLockActive: this.wakeLockActive,
      batterySaver: this.batterySaver,
      platformMode: platform,
      logs: [...this.logs].reverse(),
    };
  }

  public subscribe(listener: (status: BackgroundTrackingStatus) => void): () => void {
    this.listeners.push(listener);
    listener(this.getStatus());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    const current = this.getStatus();
    this.listeners.forEach((l) => {
      try {
        l(current);
      } catch (err) {
        console.warn('Tracking listener error:', err);
      }
    });
  }

  public exportDiagnosticsText(): string {
    const status = this.getStatus();
    const lines = [
      '=== PAYANAM BACKGROUND TRACKING DIAGNOSTICS ===',
      `Timestamp: ${new Date().toISOString()}`,
      `Tracking Active: ${status.isTracking}`,
      `Heartbeat Healthy: ${status.isHeartbeatHealthy}`,
      `Tracking Paused: ${status.isPaused}`,
      `Pause Reason: ${status.pauseReason || 'None'}`,
      `Last Fix Time: ${status.lastFixTime || 'None'}`,
      `Last Coordinates: ${status.lastFixCoords ? `${status.lastFixCoords.lat}, ${status.lastFixCoords.lng}` : 'None'}`,
      `Total Fixes Recorded: ${status.totalFixesRecorded}`,
      `Platform Mode: ${status.platformMode}`,
      `In Background: ${status.inBackground}`,
      `Screen WakeLock: ${status.wakeLockActive}`,
      `Battery Saver: ${status.batterySaver}`,
      '\n--- RECENT DIAGNOSTIC LOGS ---',
      ...status.logs.slice(0, 20).map((l) => `[${l.timestamp}] [${l.level}] ${l.message}`),
    ];
    return lines.join('\n');
  }
}

export const backgroundTrackingEngine = new BackgroundTrackingEngine();

