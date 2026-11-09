import L from 'leaflet';
import { FreshnessInfo } from '../utils/lastSeen';

/**
 * Builds custom Leaflet DivIcons according to the last-seen specification:
 * - Under 30 s: Solid live marker with glowing aura
 * - 30 s to 5 min: Hollow marker with colored outline + age label (e.g., "2 min ago")
 * - Over 5 min: Dimmed hollow marker with grey outline + age label (e.g., "6 min ago")
 */
export function createRiderMarkerIcon(
  initial: string,
  color: string,
  quickStatus: string,
  freshness: FreshnessInfo,
  isCaptain: boolean = false
): L.DivIcon {
  const cleanInitial = (initial || '?')[0].toUpperCase();
  const captainCrown = isCaptain
    ? `<div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-size:12px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6));">👑</div>`
    : '';

  // 1. LIVE RIDER (< 30s) -> Solid filled marker with live status badge
  if (freshness.isLive) {
    const statusText = quickStatus ? ` · ${quickStatus}` : '';
    const badgeHtml = `<div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#065f46;color:#a7f3d0;border:1px solid #10b981;font-size:10px;padding:2px 6px;border-radius:999px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;gap:3px;">
      <span style="width:6px;height:6px;background:#10b981;border-radius:50%;display:inline-block;animation:pulse 1.5s infinite;"></span>
      LIVE${statusText}
    </div>`;

    return L.divIcon({
      className: 'rider-marker-wrap',
      iconAnchor: [19, 19],
      iconSize: [38, 44],
      html: `
        <div style="position:relative;width:38px;height:38px;">
          ${captainCrown}
          <div style="position:absolute;inset:-3px;border-radius:50%;background:${color};opacity:0.35;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="width:38px;height:38px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:800;font-size:15px;border:2.5px solid #ffffff;box-shadow:0 3px 10px rgba(0,0,0,0.45);">
            ${cleanInitial}
          </div>
          ${badgeHtml}
        </div>
      `,
    });
  }

  // 2. STALE RIDER (30s to 5min) -> Hollow marker with age badge
  if (freshness.isStale) {
    const ageLabel = freshness.ageLabel;
    const badgeHtml = `<div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#78350f;color:#fde68a;border:1px solid #f59e0b;font-size:9.5px;padding:1px 6px;border-radius:999px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.4);">
      ⏳ ${ageLabel}
    </div>`;

    return L.divIcon({
      className: 'rider-marker-wrap rider-marker-stale',
      iconAnchor: [19, 19],
      iconSize: [38, 44],
      html: `
        <div style="position:relative;width:38px;height:38px;">
          ${captainCrown}
          <div style="width:38px;height:38px;background:#111827;border-radius:50%;display:flex;align-items:center;justify-content:center;color:${color};font-weight:800;font-size:15px;border:3px dashed ${color};box-shadow:0 3px 8px rgba(0,0,0,0.4);">
            ${cleanInitial}
          </div>
          ${badgeHtml}
        </div>
      `,
    });
  }

  // 3. UNKNOWN RIDER (> 5min) -> Dimmed hollow marker
  const ageLabel = freshness.ageLabel === 'no position' ? 'offline' : freshness.ageLabel;
  const badgeHtml = `<div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#1f2937;color:#9ca3af;border:1px solid #4b5563;font-size:9.5px;padding:1px 6px;border-radius:999px;font-weight:700;">
    ⚠️ ${ageLabel}
  </div>`;

  return L.divIcon({
    className: 'rider-marker-wrap rider-marker-unknown',
    iconAnchor: [19, 19],
    iconSize: [38, 44],
    html: `
      <div style="position:relative;width:38px;height:38px;opacity:0.65;">
        ${captainCrown}
        <div style="width:38px;height:38px;background:rgba(17,24,39,0.9);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-weight:800;font-size:15px;border:2px solid #6b7280;box-shadow:0 2px 6px rgba(0,0,0,0.3);">
          ${cleanInitial}
        </div>
        ${badgeHtml}
      </div>
    `,
  });
}

