import L from 'leaflet';
import { FreshnessInfo } from '../utils/lastSeen';
import { RiderRouteStatus } from '../utils/plannedRouteProgress';

/**
 * Builds custom Leaflet DivIcons according to Feature A (Last Seen) & Feature E2 (Planned route on group map):
 * 
 * Feature E2 Requirement:
 * "Ahead, on plan, behind, or off route appear through shape and colour, with a text label."
 * 
 * Visual Language:
 * - AHEAD: Forward chevron/diamond shape with sky-blue badge (#38BDF8)
 * - ON PLAN: Solid circle shape with emerald green badge (#10B981)
 * - BEHIND: Rounded square shape with amber badge (#F59E0B)
 * - OFF ROUTE: Octagonal warning shape with crimson alert badge (#EF4444)
 * - STALE / UNKNOWN: Retains Feature A hollow dashed marker with elapsed age badge
 */
export function createRiderMarkerIcon(
  initial: string,
  color: string,
  quickStatus: string,
  freshness: FreshnessInfo,
  isCaptain: boolean = false,
  routeStatus?: RiderRouteStatus
): L.DivIcon {
  const cleanInitial = (initial || '?')[0].toUpperCase();
  const captainCrown = isCaptain
    ? `<div style="position:absolute;top:-11px;left:50%;transform:translateX(-50%);font-size:12px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.7));z-index:10;">👑</div>`
    : '';

  // 1. OFF ROUTE (Feature C & E2 - highest visual priority)
  if (routeStatus?.status === 'off_route') {
    const badgeText = 'OFF ROUTE';
    return L.divIcon({
      className: 'rider-marker-wrap rider-marker-offroute',
      iconAnchor: [20, 20],
      iconSize: [40, 48],
      html: `
        <div style="position:relative;width:40px;height:40px;">
          ${captainCrown}
          <div style="position:absolute;inset:-4px;border-radius:10px;background:#EF4444;opacity:0.3;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="width:40px;height:40px;background:#1B1E23;border:3px solid #EF4444;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#EF4444;font-weight:900;font-size:15px;box-shadow:0 3px 14px rgba(239,68,68,0.5);">
            ${cleanInitial}
          </div>
          <div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#1B1E23;color:#EF4444;border:1.5px solid #EF4444;font-size:9px;padding:2px 7px;border-radius:999px;font-weight:900;box-shadow:0 3px 10px rgba(0,0,0,0.6);display:flex;align-items:center;gap:3px;">
            <span>⚠️</span>
            <span>${badgeText}</span>
          </div>
        </div>
      `,
    });
  }

  // 2. UNKNOWN (> 5 min) - Dimmed hollow marker with age label
  if (freshness.isUnknown || routeStatus?.status === 'unknown') {
    const ageLabel = freshness.ageLabel === 'no position' ? 'offline' : freshness.ageLabel;
    return L.divIcon({
      className: 'rider-marker-wrap rider-marker-unknown',
      iconAnchor: [19, 19],
      iconSize: [38, 44],
      html: `
        <div style="position:relative;width:38px;height:38px;opacity:0.85;">
          ${captainCrown}
          <div style="width:38px;height:38px;background:#1B1E23;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#9D9C9A;font-weight:900;font-size:14px;border:2.5px dashed #3A3F47;box-shadow:0 3px 10px rgba(0,0,0,0.3);">
            ${cleanInitial}
          </div>
          <div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#1B1E23;color:#9D9C9A;border:1.5px solid #2A2E35;font-size:9px;padding:2px 7px;border-radius:999px;font-weight:800;box-shadow:0 3px 10px rgba(0,0,0,0.4);">
            ⚠️ ${ageLabel}
          </div>
        </div>
      `,
    });
  }

  // 3. STALE (30s to 5 min) - Hollow marker with age badge
  if (freshness.isStale) {
    const ageLabel = freshness.ageLabel;
    return L.divIcon({
      className: 'rider-marker-wrap rider-marker-stale',
      iconAnchor: [19, 19],
      iconSize: [38, 44],
      html: `
        <div style="position:relative;width:38px;height:38px;">
          ${captainCrown}
          <div style="width:38px;height:38px;background:#1B1E23;border-radius:50%;display:flex;align-items:center;justify-content:center;color:${color};font-weight:900;font-size:14px;border:3px dashed ${color};box-shadow:0 3px 10px rgba(0,0,0,0.4);">
            ${cleanInitial}
          </div>
          <div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#1B1E23;color:#F0C23A;border:1.5px solid #F0C23A;font-size:9px;padding:2px 7px;border-radius:999px;font-weight:800;box-shadow:0 3px 10px rgba(0,0,0,0.4);">
            ⏳ ${ageLabel}
          </div>
        </div>
      `,
    });
  }

  // 4. LIVE RIDERS: Determine on-route shape and badge based on progress status (Feature E2)
  const status = routeStatus?.status ?? 'on_plan';

  // 4A. AHEAD: Forward Chevron / Diamond shape (Sky blue #38BDF8)
  if (status === 'ahead') {
    const badgeText = routeStatus?.deltaFormatted ? routeStatus.deltaFormatted.replace(' ahead', '') : 'AHEAD';
    return L.divIcon({
      className: 'rider-marker-wrap rider-marker-ahead',
      iconAnchor: [19, 19],
      iconSize: [38, 46],
      html: `
        <div style="position:relative;width:38px;height:38px;">
          ${captainCrown}
          <div style="position:absolute;inset:-3px;border-radius:6px 14px 6px 14px;background:#38BDF8;opacity:0.3;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="width:38px;height:38px;background:#38BDF8;border-radius:6px 14px 6px 14px;display:flex;align-items:center;justify-content:center;color:#111316;font-weight:900;font-size:15px;border:2.5px solid #111316;box-shadow:0 3px 12px rgba(56,189,248,0.4);">
            ${cleanInitial}
          </div>
          <div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#1B1E23;color:#38BDF8;border:1.5px solid #38BDF8;font-size:9px;padding:2px 7px;border-radius:999px;font-weight:800;box-shadow:0 3px 10px rgba(0,0,0,0.5);display:flex;align-items:center;gap:3px;">
            <span>▲</span>
            <span>AHEAD ${badgeText !== 'AHEAD' ? `(${badgeText})` : ''}</span>
          </div>
        </div>
      `,
    });
  }

  // 4B. BEHIND: Rounded Square shape (Amber #F59E0B)
  if (status === 'behind') {
    const badgeText = quickStatus || (routeStatus?.deltaFormatted ? routeStatus.deltaFormatted.replace(' behind', '') : 'BEHIND');
    return L.divIcon({
      className: 'rider-marker-wrap rider-marker-behind',
      iconAnchor: [19, 19],
      iconSize: [38, 46],
      html: `
        <div style="position:relative;width:38px;height:38px;">
          ${captainCrown}
          <div style="position:absolute;inset:-3px;border-radius:8px;background:#F59E0B;opacity:0.25;animation:pulse 2s infinite;"></div>
          <div style="width:38px;height:38px;background:#F59E0B;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#111316;font-weight:900;font-size:15px;border:2.5px solid #111316;box-shadow:0 3px 12px rgba(245,158,11,0.4);">
            ${cleanInitial}
          </div>
          <div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#1B1E23;color:#F59E0B;border:1.5px solid #F59E0B;font-size:9px;padding:2px 7px;border-radius:999px;font-weight:800;box-shadow:0 3px 10px rgba(0,0,0,0.5);display:flex;align-items:center;gap:3px;">
            <span>▼</span>
            <span>BEHIND ${badgeText !== 'BEHIND' ? `(${badgeText})` : ''}</span>
          </div>
        </div>
      `,
    });
  }

  // 4C. ON PLAN: Solid Circle shape (Emerald #10B981)
  const statusSuffix = quickStatus ? ` · ${quickStatus}` : '';
  return L.divIcon({
    className: 'rider-marker-wrap rider-marker-onplan',
    iconAnchor: [19, 19],
    iconSize: [38, 46],
    html: `
      <div style="position:relative;width:38px;height:38px;">
        ${captainCrown}
        <div style="position:absolute;inset:-3px;border-radius:50%;background:#10B981;opacity:0.35;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
        <div style="width:38px;height:38px;background:#10B981;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:900;font-size:15px;border:2.5px solid #111316;box-shadow:0 3px 12px rgba(16,185,129,0.4);">
          ${cleanInitial}
        </div>
        <div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#1B1E23;color:#10B981;border:1.5px solid #10B981;font-size:9px;padding:2px 7px;border-radius:999px;font-weight:800;box-shadow:0 3px 10px rgba(0,0,0,0.5);display:flex;align-items:center;gap:3px;">
          <span style="width:5px;height:5px;background:#10B981;border-radius:50%;display:inline-block;animation:pulse 1.5s infinite;"></span>
          <span>ON PLAN${statusSuffix}</span>
        </div>
      </div>
    `,
  });
}
