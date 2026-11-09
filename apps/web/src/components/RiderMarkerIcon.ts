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
    const badgeHtml = `<div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#1B1E23;color:#10B981;border:1.5px solid #10B981;font-size:9.5px;padding:2px 7px;border-radius:999px;font-weight:800;box-shadow:0 3px 10px rgba(0,0,0,0.4);display:flex;align-items:center;gap:3px;">
      <span style="width:5px;height:5px;background:#10B981;border-radius:50%;display:inline-block;animation:pulse 1.5s infinite;"></span>
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
          <div style="width:38px;height:38px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:900;font-size:15px;border:2.5px solid #111316;box-shadow:0 3px 12px rgba(0,0,0,0.5);">
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
    const badgeHtml = `<div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#1B1E23;color:#F0C23A;border:1.5px solid #F0C23A;font-size:9.5px;padding:2px 7px;border-radius:999px;font-weight:800;box-shadow:0 3px 10px rgba(0,0,0,0.4);">
      ⏳ ${ageLabel}
    </div>`;

    return L.divIcon({
      className: 'rider-marker-wrap rider-marker-stale',
      iconAnchor: [19, 19],
      iconSize: [38, 44],
      html: `
        <div style="position:relative;width:38px;height:38px;">
          ${captainCrown}
          <div style="width:38px;height:38px;background:#1B1E23;border-radius:50%;display:flex;align-items:center;justify-content:center;color:${color};font-weight:900;font-size:15px;border:3px dashed ${color};box-shadow:0 3px 10px rgba(0,0,0,0.4);">
            ${cleanInitial}
          </div>
          ${badgeHtml}
        </div>
      `,
    });
  }

  // 3. UNKNOWN RIDER (> 5min) -> Dimmed hollow marker
  const ageLabel = freshness.ageLabel === 'no position' ? 'offline' : freshness.ageLabel;
  const badgeHtml = `<div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#1B1E23;color:#9D9C9A;border:1.5px solid #2A2E35;font-size:9.5px;padding:2px 7px;border-radius:999px;font-weight:800;box-shadow:0 3px 10px rgba(0,0,0,0.4);">
    ⚠️ ${ageLabel}
  </div>`;

  return L.divIcon({
    className: 'rider-marker-wrap rider-marker-unknown',
    iconAnchor: [19, 19],
    iconSize: [38, 44],
    html: `
      <div style="position:relative;width:38px;height:38px;opacity:0.85;">
        ${captainCrown}
        <div style="width:38px;height:38px;background:#1B1E23;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#9D9C9A;font-weight:900;font-size:15px;border:2.5px dashed #3A3F47;box-shadow:0 3px 10px rgba(0,0,0,0.3);">
          ${cleanInitial}
        </div>
        ${badgeHtml}
      </div>
    `,
  });
}

