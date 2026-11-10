// Payanam Nearby Services Engine (Feature 3 · SERVICES)
// Route corridor searching, distance sorting, last-verified dates, community verification (confirm open / report closed),
// adding custom places, and offline caching.

import L from 'leaflet';

export type ServiceCategory = 'ALL' | 'FUEL' | 'REPAIR' | 'FOOD' | 'REST' | 'STAY';

export interface NearbyServiceItem {
  id: string;
  category: 'FUEL' | 'REPAIR' | 'FOOD' | 'REST' | 'STAY';
  name: string;
  subtitle: string;
  distanceKm: number;
  verifiedAt: string; // ISO date string
  source: string; // e.g. "Rider Arjun", "HPCL Verified", "Convoy Scout", "Mechanic Registry"
  phone?: string;
  lat: number;
  lng: number;
  isOpen: boolean;
  openReports?: number;
  closedReports?: number;
  notes?: string;
  isUserAdded?: boolean;
}

const STORAGE_KEY = 'payanam_cached_nearby_services';

// Initial pre-cached corridor dataset along touring routes (Western Ghats, NH48, NH66, Coorg, Sagar)
export const SEED_CORRIDOR_SERVICES: NearbyServiceItem[] = [
  {
    id: 'srv-fuel-1',
    category: 'FUEL',
    name: 'HP Petrol Pump · 24 Hours',
    subtitle: 'High speed XP95, clean air tower & nitrogen',
    distanceKm: 3.8,
    verifiedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(), // 1 day ago
    source: 'Rider Arjun',
    phone: '+91 98451 22340',
    lat: 14.1670,
    lng: 75.0333,
    isOpen: true,
    openReports: 14,
    closedReports: 0,
    notes: 'Credit cards and UPI accepted. Quick air refill for bikes.',
  },
  {
    id: 'srv-repair-1',
    category: 'REPAIR',
    name: 'Apex Highway Bike Care & Puncture',
    subtitle: 'Tubeless mushroom patches, chain lube, cables',
    distanceKm: 5.4,
    verifiedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), // 2 days ago
    source: 'Mechanic Registry',
    phone: '+91 94480 33910',
    lat: 14.1520,
    lng: 75.0480,
    isOpen: true,
    openReports: 9,
    closedReports: 0,
    notes: 'Has 17 & 19-inch inner tubes. Mobile breakdown van available.',
  },
  {
    id: 'srv-food-1',
    category: 'FOOD',
    name: 'Sagar Highway Dhaba & Cafe',
    subtitle: 'Hot filter coffee, parathas, shaded bike parking',
    distanceKm: 7.2,
    verifiedAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
    source: 'Convoy Scout',
    phone: '+91 94812 55432',
    lat: 14.1400,
    lng: 75.0700,
    isOpen: true,
    openReports: 22,
    closedReports: 0,
    notes: 'Clean washrooms for touring groups. Space for 20+ motorcycles.',
  },
  {
    id: 'srv-repair-2',
    category: 'REPAIR',
    name: 'Ghat Edge Puncture Works',
    subtitle: 'Wheel alignment, puncture repair, clutch wire',
    distanceKm: 11.0,
    verifiedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    source: 'Rider Meera',
    phone: '+91 99002 88412',
    lat: 14.1100,
    lng: 75.0950,
    isOpen: true,
    openReports: 6,
    closedReports: 1,
    notes: 'Located just before the ghat ascent. Essential stop.',
  },
  {
    id: 'srv-rest-1',
    category: 'REST',
    name: 'Ghat Viewpoint Shaded Shelter',
    subtitle: 'Cool mountain breeze, benches, natural spring',
    distanceKm: 13.5,
    verifiedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    source: 'Payanam Community',
    lat: 14.0850,
    lng: 75.1250,
    isOpen: true,
    openReports: 18,
    closedReports: 0,
    notes: 'Safe paved shoulder to rest safely off the road.',
  },
  {
    id: 'srv-stay-1',
    category: 'STAY',
    name: 'Valley Mist Biker Homestay',
    subtitle: 'Gated bike parking, drying room for riding gear',
    distanceKm: 16.8,
    verifiedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    source: 'Rider Karthik',
    phone: '+91 98450 77123',
    lat: 14.0600,
    lng: 75.1450,
    isOpen: true,
    openReports: 11,
    closedReports: 0,
    notes: 'Biker friendly host, tool kit available in garage.',
  },
  {
    id: 'srv-fuel-2',
    category: 'FUEL',
    name: 'IOCL Shimoga Highway Hub',
    subtitle: 'Closes 21:30 · Petrol, Diesel & Snacks',
    distanceKm: 21.2,
    verifiedAt: new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString(),
    source: 'IOCL Official',
    phone: '+91 94481 00293',
    lat: 14.0200,
    lng: 75.1900,
    isOpen: true,
    openReports: 4,
    closedReports: 0,
  },
  {
    id: 'srv-stay-2',
    category: 'STAY',
    name: 'Highway Highway Residency & Lodge',
    subtitle: '24h check-in, AC rooms & restaurant',
    distanceKm: 26.0,
    verifiedAt: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
    source: 'Local Registry',
    phone: '+91 98453 99201',
    lat: 13.9800,
    lng: 75.2200,
    isOpen: true,
    openReports: 8,
    closedReports: 0,
  },
];

/**
 * Step 5: Works offline - retrieve cached route corridor listings from local storage
 */
export function getCachedNearbyServices(): NearbyServiceItem[] {
  if (typeof window === 'undefined') return SEED_CORRIDOR_SERVICES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_CORRIDOR_SERVICES;
    const items: NearbyServiceItem[] = JSON.parse(raw);
    const existingIds = new Set(items.map((i) => i.id));
    const merged = [...items, ...SEED_CORRIDOR_SERVICES.filter((s) => !existingIds.has(s.id))];
    return merged;
  } catch {
    return SEED_CORRIDOR_SERVICES;
  }
}

/**
 * Save services to offline cache
 */
export function saveCachedNearbyServices(items: NearbyServiceItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Failed to cache nearby services:', err);
  }
}

/**
 * Step 4 Action: Rider confirms open (updates last-verified timestamp & increments confirmations)
 */
export function confirmServiceOpen(serviceId: string, userName?: string): NearbyServiceItem[] {
  const all = getCachedNearbyServices();
  const updated = all.map((item) => {
    if (item.id === serviceId) {
      return {
        ...item,
        isOpen: true,
        verifiedAt: new Date().toISOString(),
        source: userName ? `Verified by @${userName}` : 'Verified by Rider',
        openReports: (item.openReports || 0) + 1,
      };
    }
    return item;
  });
  saveCachedNearbyServices(updated);
  return updated;
}

/**
 * Step 4 Action: Rider reports closed
 */
export function reportServiceClosed(serviceId: string, userName?: string): NearbyServiceItem[] {
  const all = getCachedNearbyServices();
  const updated = all.map((item) => {
    if (item.id === serviceId) {
      return {
        ...item,
        isOpen: false,
        verifiedAt: new Date().toISOString(),
        source: userName ? `Reported closed by @${userName}` : 'Reported closed by Rider',
        closedReports: (item.closedReports || 0) + 1,
      };
    }
    return item;
  });
  saveCachedNearbyServices(updated);
  return updated;
}

/**
 * Step 4 Action: Rider adds a new place along the route corridor
 */
export function addNearbyPlace(newPlace: {
  category: 'FUEL' | 'REPAIR' | 'FOOD' | 'REST' | 'STAY';
  name: string;
  subtitle: string;
  phone?: string;
  notes?: string;
  lat: number;
  lng: number;
  userName?: string;
}): NearbyServiceItem {
  const id = `user-place-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const item: NearbyServiceItem = {
    id,
    category: newPlace.category,
    name: newPlace.name,
    subtitle: newPlace.subtitle || 'Added by rider along corridor',
    distanceKm: 1.5, // dynamically calculated on render
    verifiedAt: new Date().toISOString(),
    source: newPlace.userName ? `Added by @${newPlace.userName}` : 'Added by Rider',
    phone: newPlace.phone,
    notes: newPlace.notes,
    lat: newPlace.lat,
    lng: newPlace.lng,
    isOpen: true,
    openReports: 1,
    closedReports: 0,
    isUserAdded: true,
  };

  const existing = getCachedNearbyServices();
  const updated = [item, ...existing];
  saveCachedNearbyServices(updated);
  return item;
}

/**
 * Step 1 & 3: Haversine distance calculator and sorting by distance
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Sort listings by distance from current GPS or reference point
 */
export function sortServicesByDistance(
  services: NearbyServiceItem[],
  currentLat?: number | null,
  currentLng?: number | null
): NearbyServiceItem[] {
  if (!currentLat || !currentLng) {
    return [...services].sort((a, b) => a.distanceKm - b.distanceKm);
  }

  return services
    .map((s) => ({
      ...s,
      distanceKm: calculateDistanceKm(currentLat, currentLng, s.lat, s.lng),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Map Pin DivIcon for Ride Map ("Pins also appear on the Ride map")
 */
export function makeServicePinIcon(
  category: 'FUEL' | 'REPAIR' | 'FOOD' | 'REST' | 'STAY',
  isOpen: boolean = true,
  name?: string
): L.DivIcon {
  const config = {
    FUEL: { icon: '⛽', bg: '#D97706', border: '#F0C23A' },
    REPAIR: { icon: '🔧', bg: '#2563EB', border: '#60A5FA' },
    FOOD: { icon: '🍽️', bg: '#EA580C', border: '#FB923C' },
    REST: { icon: '☕', bg: '#7C3AED', border: '#A78BFA' },
    STAY: { icon: '🏨', bg: '#059669', border: '#34D399' },
  }[category] || { icon: '📍', bg: '#4B5563', border: '#9CA3AF' };

  const statusBadge = !isOpen
    ? `<div style="position:absolute;top:-4px;right:-4px;width:12px;height:12px;border-radius:6px;background:#EF4444;border:1.5px solid #111316;" title="Reported Closed"></div>`
    : `<div style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;border-radius:5px;background:#10B981;border:1.5px solid #111316;" title="Open & Verified"></div>`;

  const labelHtml = name
    ? `<div style="position:absolute;top:30px;background:#111316;color:#F1EFEA;border:1px solid #2A2E35;padding:1px 6px;border-radius:6px;font-size:9px;font-weight:800;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.6);letter-spacing:-0.2px;">
        ${name.slice(0, 16)}
      </div>`
    : '';

  return L.divIcon({
    className: 'nearby-service-marker',
    iconAnchor: [15, 15],
    iconSize: [30, 30],
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
        <div style="width:28px;height:28px;background:${config.bg};border:2px solid ${config.border};border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.65);font-size:13px;opacity:${isOpen ? 1 : 0.65};">
          ${config.icon}
          ${statusBadge}
        </div>
        ${labelHtml}
      </div>
    `,
  });
}
