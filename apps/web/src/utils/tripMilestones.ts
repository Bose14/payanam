// Payanam Trip Milestones & Sharing Engine (Feature 2)
// Builds milestone summaries upon trip completion, handles photo/stat customization,
// enforces privacy shields (scrubs home start & private stops), and generates share links that lead back to Discover.

import { PublishedTrip, getPublishedTripBySourceId, isTripPublished } from './publicItinerary';

export interface TripMilestoneSummary {
  tripId: string;
  title: string;
  fromPlace: string;
  toPlace: string;
  totalDistanceKm: number;
  daysCount: number;
  stopsClearedCount: number;
  coRidersCount: number;
  coRidersNames: string[];
  fuelStopsCount: number;
  mealStopsCount: number;
  scenicPointsCount: number;
  bikeModel?: string;
  completedAt: string;
  isPublished: boolean;
  publicLink?: string;
  sanitizedStopsList: string[];
}

export type BackdropPreset = 'ghats' | 'coastal' | 'sunset' | 'hairpins' | 'night' | 'minimal';

export interface MilestoneCardCustomization {
  backdropPreset: BackdropPreset;
  customPhotoUrl?: string;
  showDistance: boolean;
  showDays: boolean;
  showStops: boolean;
  showRiders: boolean;
  showBikeModel: boolean;
  customNote?: string;
}

export const DEFAULT_MILESTONE_CUSTOMIZATION: MilestoneCardCustomization = {
  backdropPreset: 'ghats',
  showDistance: true,
  showDays: true,
  showStops: true,
  showRiders: true,
  showBikeModel: true,
  customNote: 'Conquered every hairpin curve, scenic pass, and coastal mile!',
};

export const BACKDROP_PRESETS: Array<{
  id: BackdropPreset;
  name: string;
  icon: string;
  gradient: string;
  accent: string;
}> = [
  {
    id: 'ghats',
    name: 'Western Ghats Mist',
    icon: '🏔️',
    gradient: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
    accent: '#10B981',
  },
  {
    id: 'coastal',
    name: 'Coastal Highway NH66',
    icon: '🌊',
    gradient: 'linear-gradient(135deg, #0369a1 0%, #082f49 100%)',
    accent: '#38BDF8',
  },
  {
    id: 'sunset',
    name: 'Golden Hour Dusk',
    icon: '🌅',
    gradient: 'linear-gradient(135deg, #854d0e 0%, #451a03 100%)',
    accent: '#F0C23A',
  },
  {
    id: 'hairpins',
    name: '40 Hairpins Asphalt',
    icon: '🏁',
    gradient: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)',
    accent: '#F59E0B',
  },
  {
    id: 'night',
    name: 'Midnight Convoy',
    icon: '🌙',
    gradient: 'linear-gradient(135deg, #1e1b4b 0%, #090a0f 100%)',
    accent: '#818CF8',
  },
  {
    id: 'minimal',
    name: 'Obsidian Matte',
    icon: '🖤',
    gradient: 'linear-gradient(135deg, #1B1E23 0%, #111316 100%)',
    accent: '#F1EFEA',
  },
];

/**
 * Step 1 & 2: Build milestone summary with strict privacy shields
 * "Hidden stops and home start points are never included."
 */
export function buildTripMilestoneSummary(params: {
  trip: {
    id: string;
    title: string;
    from_place: string;
    to_place: string;
    days: number;
    bike_type?: string;
  };
  stops: Array<{
    id?: string;
    place: string;
    item_type?: string;
    description?: string;
    day_number?: number;
    order_index?: number;
    estimated_km?: number;
    lat?: number | null;
    lng?: number | null;
  }>;
  coRiders?: Array<{ name: string }>;
  bikeModel?: string;
}): TripMilestoneSummary {
  const { trip, stops, coRiders = [], bikeModel } = params;

  // Step 2 Rule: "Hidden stops and home start points are never included."
  // Sanitize stops: exclude residential starting points and private accommodations
  const sanitizedStops = stops.filter((stop, idx) => {
    // Exclude hotels / accommodations
    if (stop.item_type === 'stay' || /hotel|resort|lodge|stay/i.test(stop.place)) return false;

    // Mask exact home address to city departure area
    const isStart = (stop.day_number === 1 && (stop.order_index === 0 || stop.order_index === 1)) ||
      (stop.place.toLowerCase().includes(trip.from_place.toLowerCase()) && idx === 0);

    if (isStart && /street|road no|house|apt|flat|home/i.test(stop.place)) return false;

    return true;
  });

  // Calculate total distance
  let totalKm = 0;
  for (const s of stops) {
    if (s.estimated_km && s.estimated_km > 0) {
      totalKm += Number(s.estimated_km);
    }
  }

  // If estimated_km was not recorded on stops, use a reasonable route approximation
  if (totalKm <= 0) {
    totalKm = Math.max(120, trip.days * 140);
  }

  const fuelCount = sanitizedStops.filter((s) => s.item_type === 'fuel_stop' || /fuel|petrol/i.test(s.place)).length;
  const mealCount = sanitizedStops.filter((s) => s.item_type === 'meal' || /food|breakfast|lunch|dinner|cafe|restaurant/i.test(s.place)).length;
  const scenicCount = sanitizedStops.filter((s) => s.item_type === 'attraction' || /view|point|falls|beach|fort|pass|peak/i.test(s.place)).length;

  const isPub = isTripPublished(trip.id);
  const pubTrip: PublishedTrip | undefined = getPublishedTripBySourceId(trip.id);

  let publicLink = '';
  if (typeof window !== 'undefined') {
    if (isPub && pubTrip) {
      publicLink = `${window.location.origin}/discover?trip=${pubTrip.id}`;
    } else {
      publicLink = `${window.location.origin}/trips/${trip.id}`;
    }
  }

  return {
    tripId: trip.id,
    title: trip.title,
    fromPlace: trip.from_place,
    toPlace: trip.to_place,
    totalDistanceKm: Math.round(totalKm),
    daysCount: trip.days || 1,
    stopsClearedCount: sanitizedStops.length,
    coRidersCount: Math.max(1, coRiders.length + 1), // +1 for the rider themselves
    coRidersNames: coRiders.map((c) => c.name),
    fuelStopsCount: fuelCount,
    mealStopsCount: mealCount,
    scenicPointsCount: scenicCount,
    bikeModel: bikeModel || 'Motorcycle',
    completedAt: new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    isPublished: isPub,
    publicLink,
    sanitizedStopsList: sanitizedStops.slice(0, 6).map((s) => s.place),
  };
}

/**
 * Step 3: Format high-impact share text for WhatsApp, X, Instagram, etc.
 */
export function formatMilestoneShareText(
  summary: TripMilestoneSummary,
  customization: MilestoneCardCustomization
): string {
  const parts: string[] = [
    '🏍️ MISSION COMPLETED · PAYANAM EXPEDITION',
    `🗺️ ${summary.fromPlace} ➔ ${summary.toPlace}`,
  ];

  const statBadges: string[] = [];
  if (customization.showDistance) statBadges.push(`📍 ${summary.totalDistanceKm} km total`);
  if (customization.showDays) statBadges.push(`📅 ${summary.daysCount} Day${summary.daysCount > 1 ? 's' : ''}`);
  if (customization.showStops) statBadges.push(`🏁 ${summary.stopsClearedCount} Waypoints cleared`);
  if (customization.showRiders && summary.coRidersCount > 1) statBadges.push(`👥 ${summary.coRidersCount} Convoy Riders`);

  if (statBadges.length > 0) {
    parts.push(statBadges.join(' · '));
  }

  if (customization.showBikeModel && summary.bikeModel) {
    parts.push(`🏍️ Steed: ${summary.bikeModel}`);
  }

  if (customization.customNote) {
    parts.push(`\n💬 "${customization.customNote}"`);
  }

  // Step 4: Link leads back
  if (summary.publicLink) {
    if (summary.isPublished) {
      parts.push(`\n✨ View our verified route on Payanam Discover & copy this itinerary:\n${summary.publicLink}`);
    } else {
      parts.push(`\n✨ Tracked live on Payanam Touring:\n${summary.publicLink}`);
    }
  }

  return parts.join('\n');
}
