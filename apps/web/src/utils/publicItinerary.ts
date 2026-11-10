// Payanam Public Itinerary & Discover Engine (Feature 1B)
// Handles public publishing flow, privacy controls, sanitization, discover search, and trip cloning with source attribution

export interface PublicItinerarySettings {
  includeRoute: boolean;
  includeDays: boolean;
  includeStops: boolean;
  includeNotes: boolean;
  includePhotos: boolean;
  hideHomeStart: boolean; // default true: Home start point is never shown
  hideHotels: boolean;    // default true: Hotel/stays can be hidden
  hiddenStopIds: string[]; // specific stops the rider marked private
}

export interface PublicStopItem {
  id: string;
  place: string;
  item_type?: string;
  description?: string;
  day_number?: number;
  order_index?: number;
  lat?: number | null;
  lng?: number | null;
  tips?: string;
  isPrivate?: boolean;
}

export interface PublishedTrip {
  id: string;
  sourceTripId: string;
  title: string;
  fromPlace: string;
  toPlace: string;
  authorName: string;
  authorId: string;
  days: number;
  bikeType: string;
  publishedAt: string;
  copiesCount: number;
  rating: number;
  finishersCount: number;
  tags: string[];
  description?: string;
  settings: PublicItinerarySettings;
  stops: PublicStopItem[];
  amenitiesSummary: {
    fuel: number;
    food: number;
    rest: number;
    scenic: number;
  };
  sourceCredit?: string;
}

const STORAGE_KEY = 'payanam_published_trips';
const COPIED_TRIPS_KEY = 'payanam_copied_draft_trips';

export const DEFAULT_PUBLISH_SETTINGS: PublicItinerarySettings = {
  includeRoute: true,
  includeDays: true,
  includeStops: true,
  includeNotes: true,
  includePhotos: true,
  hideHomeStart: true,
  hideHotels: true,
  hiddenStopIds: [],
};

// Seed content so Discover is immediately rich & usable at launch (Mockup Screen 8 + Test 3 requirement)
export const SEED_PUBLISHED_TRIPS: PublishedTrip[] = [
  {
    id: 'pub-blr-ksd-3d',
    sourceTripId: 'seed-trip-1',
    title: 'Bengaluru to Kasaragod, 3 days',
    fromPlace: 'Bengaluru',
    toPlace: 'Kasaragod',
    authorName: 'Arjun',
    authorId: 'seed-user-arjun',
    days: 3,
    bikeType: 'motorcycle',
    publishedAt: '2026-11-01T08:00:00Z',
    copiesCount: 412,
    rating: 4.7,
    finishersCount: 238,
    tags: ['TWISTY', '3-5 DAYS', 'GHATS', 'MIXED'],
    description: 'Channapatna highway stretch, coffee estate hairpins in Madikeri, and coastal twisties into Kasaragod. Clean roads with reliable fuel stations.',
    settings: {
      ...DEFAULT_PUBLISH_SETTINGS,
      hiddenStopIds: [],
    },
    amenitiesSummary: {
      fuel: 5,
      food: 9,
      rest: 2,
      scenic: 4,
    },
    stops: [
      { id: 's1', place: 'Bengaluru Meeting Point (Nice Road Toll)', item_type: 'stop', day_number: 1, order_index: 1, description: 'Rider meet up before sunrise', tips: 'Quick air pressure check available at HP pump' },
      { id: 's2', place: 'Maddur Tiffany (Breakfast)', item_type: 'meal', day_number: 1, order_index: 2, description: 'Famous Maddur vada and filter coffee', tips: 'Quick service, ample bike parking in front' },
      { id: 's3', place: 'Hunsur BPCL Petrol Bunk', item_type: 'fuel_stop', day_number: 1, order_index: 3, description: 'Fill tank before entering forest stretch', tips: 'XP95 available here' },
      { id: 's4', place: 'Madikeri Viewpoint (Raja Seat)', item_type: 'attraction', day_number: 2, order_index: 1, description: 'Scenic valley view across Western Ghats', tips: 'Best in morning mist' },
      { id: 's5', place: 'Sullia Valley Rest Stop', item_type: 'rest', day_number: 2, order_index: 2, description: 'Cool shaded grove by the river stream', tips: 'Great place to stretch and rehydrate' },
      { id: 's6', place: 'Kasaragod Fort & Beach', item_type: 'stop', day_number: 3, order_index: 1, description: 'Historic Bekal fort coastal lookout', tips: 'Arrive before 5 PM for sunset' },
    ],
  },
  {
    id: 'pub-coorg-loop-2d',
    sourceTripId: 'seed-trip-2',
    title: 'Coorg loop, 2 days',
    fromPlace: 'Mysuru',
    toPlace: 'Coorg',
    authorName: 'Meera',
    authorId: 'seed-user-meera',
    days: 2,
    bikeType: 'motorcycle',
    publishedAt: '2026-11-04T10:30:00Z',
    copiesCount: 128,
    rating: 4.9,
    finishersCount: 94,
    tags: ['WEEKEND', 'TWISTY', 'SCENIC', 'COFFEE'],
    description: 'Crisp morning corners through coffee plantations, Bylakuppe monastery loop, and smooth ghat sweepers.',
    settings: {
      ...DEFAULT_PUBLISH_SETTINGS,
      hiddenStopIds: [],
    },
    amenitiesSummary: {
      fuel: 2,
      food: 4,
      rest: 3,
      scenic: 5,
    },
    stops: [
      { id: 'm1', place: 'Mysuru Ring Road Hub', item_type: 'stop', day_number: 1, order_index: 1, description: 'Starting junction', tips: 'Avoid rush hour by leaving before 7 AM' },
      { id: 'm2', place: 'Bylakuppe Golden Temple', item_type: 'attraction', day_number: 1, order_index: 2, description: 'Peaceful Tibetan settlement and momos', tips: 'Clean restrooms available inside' },
      { id: 'm3', place: 'Kushalnagar Fuel Bunk', item_type: 'fuel_stop', day_number: 1, order_index: 3, description: 'Top up', tips: 'Card and UPI accepted' },
      { id: 'm4', place: 'Mandalpatti Peak Ridge', item_type: 'attraction', day_number: 2, order_index: 1, description: 'Breathtaking 4x4 trail & mountain vistas', tips: 'Requires good tires and slow throttle control' },
    ],
  },
  {
    id: 'pub-goa-coastal-4d',
    sourceTripId: 'seed-trip-3',
    title: 'Goa Coastal Highway, 4 days',
    fromPlace: 'Mangaluru',
    toPlace: 'Panaji',
    authorName: 'Rohit',
    authorId: 'seed-user-rohit',
    days: 4,
    bikeType: 'motorcycle',
    publishedAt: '2026-10-28T14:15:00Z',
    copiesCount: 295,
    rating: 4.8,
    finishersCount: 182,
    tags: ['COASTAL', '3-5 DAYS', 'BEACH', 'SEAFOOD'],
    description: 'NH66 coastal ride through Udupi, Maravanthe beach with ocean on one side & river on other, and Gokarna cliffs.',
    settings: {
      ...DEFAULT_PUBLISH_SETTINGS,
      hiddenStopIds: [],
    },
    amenitiesSummary: {
      fuel: 4,
      food: 7,
      rest: 4,
      scenic: 6,
    },
    stops: [
      { id: 'g1', place: 'Mangaluru City Gate', item_type: 'stop', day_number: 1, order_index: 1, description: 'Start of coastal run' },
      { id: 'g2', place: 'Maravanthe Ocean Highway', item_type: 'attraction', day_number: 1, order_index: 2, description: 'Iconic stretch where sea meets river', tips: 'Park on sea-side shoulder safely for photos' },
      { id: 'g3', place: 'Murudeshwar Temple & Shore', item_type: 'attraction', day_number: 2, order_index: 1, description: 'Giant Shiva statue overlooking Arabian sea' },
      { id: 'g4', place: 'Gokarna Om Beach Cafe', item_type: 'meal', day_number: 3, order_index: 1, description: 'Fresh seafood & sunset stop' },
      { id: 'g5', place: 'Cabo de Rama Fort (South Goa)', item_type: 'attraction', day_number: 4, order_index: 1, description: 'Cliff-edge ancient Portuguese fort' },
    ],
  },
  {
    id: 'pub-valparai-ooty-3d',
    sourceTripId: 'seed-trip-4',
    title: 'Valparai 40 Hairpin Curves & Ooty, 3 days',
    fromPlace: 'Coimbatore',
    toPlace: 'Ooty',
    authorName: 'Karthik',
    authorId: 'seed-user-karthik',
    days: 3,
    bikeType: 'motorcycle',
    publishedAt: '2026-11-02T11:00:00Z',
    copiesCount: 318,
    rating: 4.9,
    finishersCount: 201,
    tags: ['TWISTY', 'GHATS', '3-5 DAYS', 'WILDLIFE'],
    description: 'Legendary 40 hairpin curves of Valparai, tea plantation carpet roads, Sholayar reservoir, and Nilgiri climb.',
    settings: {
      ...DEFAULT_PUBLISH_SETTINGS,
      hiddenStopIds: [],
    },
    amenitiesSummary: {
      fuel: 3,
      food: 6,
      rest: 3,
      scenic: 8,
    },
    stops: [
      { id: 'v1', place: 'Pollachi Forest Gate', item_type: 'stop', day_number: 1, order_index: 1, description: 'Forest entry checkpoint' },
      { id: 'v2', place: 'Hairpin Turn 28 (Waterfall View)', item_type: 'rest', day_number: 1, order_index: 2, description: 'Mid-climb viewpoint with tea stalls' },
      { id: 'v3', place: 'Valparai Tea Garden Stays', item_type: 'attraction', day_number: 2, order_index: 1, description: 'Lush rolling tea estates' },
      { id: 'v4', place: 'Ooty Kalhatti Ghats', item_type: 'stop', day_number: 3, order_index: 1, description: 'Steep 36 hairpin descent/climb' },
    ],
  },
];

/**
 * Retrieve all published trips (seed + user-published)
 */
export function getPublishedTrips(): PublishedTrip[] {
  if (typeof window === 'undefined') return SEED_PUBLISHED_TRIPS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_PUBLISHED_TRIPS;
    const userPubs: PublishedTrip[] = JSON.parse(raw);
    // Combine user pubs first, then seed items that don't collide
    const existingIds = new Set(userPubs.map((p) => p.id));
    const merged = [...userPubs, ...SEED_PUBLISHED_TRIPS.filter((s) => !existingIds.has(s.id))];
    return merged;
  } catch (err) {
    console.warn('Failed to load published trips from localStorage:', err);
    return SEED_PUBLISHED_TRIPS;
  }
}

/**
 * Check if a specific trip is published
 */
export function isTripPublished(sourceTripId: string): boolean {
  const all = getPublishedTrips();
  return all.some((t) => t.sourceTripId === sourceTripId);
}

/**
 * Get published trip metadata by source trip id
 */
export function getPublishedTripBySourceId(sourceTripId: string): PublishedTrip | undefined {
  const all = getPublishedTrips();
  return all.find((t) => t.sourceTripId === sourceTripId);
}

/**
 * Publish a trip with privacy rules applied
 */
export function publishTrip(params: {
  trip: {
    id: string;
    title: string;
    from_place: string;
    to_place: string;
    days: number;
    bike_type?: string;
    preferences?: string;
  };
  stops: Array<{
    id?: string;
    place: string;
    item_type?: string;
    description?: string;
    day_number?: number;
    order_index?: number;
    lat?: number | null;
    lng?: number | null;
    tips?: string;
  }>;
  settings: PublicItinerarySettings;
  author: {
    id: string;
    fullName: string;
  };
  tags?: string[];
}): PublishedTrip {
  // Step 2: Sanitize private items
  const sanitizedStops: PublicStopItem[] = [];

  params.stops.forEach((stop, idx) => {
    const stopId = stop.id || `stop-${idx}`;
    // If rider explicitly hid this stop
    if (params.settings.hiddenStopIds.includes(stopId)) return;

    // If rider selected to hide hotel/stay items
    if (params.settings.hideHotels && (stop.item_type === 'stay' || /hotel|resort|lodge|stay/i.test(stop.place))) {
      return;
    }

    // Step 2 Rule: "The home start point is never shown."
    // If this is the starting point (day 1, order 0 or 1, or matches from_place), mask exact street address to city level
    const isStart = (stop.day_number === 1 && (stop.order_index === 0 || stop.order_index === 1)) ||
      (stop.place.toLowerCase().includes(params.trip.from_place.toLowerCase()) && idx === 0);

    let displayPlace = stop.place;
    let lat = stop.lat;
    let lng = stop.lng;

    if (isStart && params.settings.hideHomeStart) {
      displayPlace = `${params.trip.from_place} (General Departure Area)`;
      // Scrub exact residential GPS coordinate
      lat = null;
      lng = null;
    }

    sanitizedStops.push({
      id: stopId,
      place: displayPlace,
      item_type: stop.item_type || 'stop',
      description: params.settings.includeNotes ? stop.description : undefined,
      day_number: stop.day_number || 1,
      order_index: stop.order_index || idx + 1,
      lat,
      lng,
      tips: params.settings.includeNotes ? stop.tips : undefined,
    });
  });

  // Calculate amenities breakdown
  const fuel = sanitizedStops.filter((s) => s.item_type === 'fuel_stop' || /fuel|petrol|diesel/i.test(s.place)).length;
  const food = sanitizedStops.filter((s) => s.item_type === 'meal' || /food|breakfast|lunch|dinner|cafe|restaurant/i.test(s.place)).length;
  const rest = sanitizedStops.filter((s) => s.item_type === 'rest' || /rest|chai|tea|viewpoint/i.test(s.place)).length;
  const scenic = sanitizedStops.filter((s) => s.item_type === 'attraction' || /view|falls|temple|beach|fort/i.test(s.place)).length;

  const autoTags = [...(params.tags || [])];
  if (params.trip.days >= 3 && params.trip.days <= 5 && !autoTags.includes('3-5 DAYS')) autoTags.push('3-5 DAYS');
  if (params.trip.days <= 2 && !autoTags.includes('WEEKEND')) autoTags.push('WEEKEND');
  if (/ghat|mountain|hill|curve|pass/i.test(params.trip.title + params.trip.to_place) && !autoTags.includes('GHATS')) autoTags.push('GHATS');
  if (/beach|sea|coast/i.test(params.trip.title + params.trip.to_place) && !autoTags.includes('COASTAL')) autoTags.push('COASTAL');
  if (autoTags.length === 0) autoTags.push('POPULAR');

  const published: PublishedTrip = {
    id: `pub-${params.trip.id}-${Date.now().toString(36)}`,
    sourceTripId: params.trip.id,
    title: params.trip.title,
    fromPlace: params.trip.from_place,
    toPlace: params.trip.to_place,
    authorName: params.author.fullName || 'Rider',
    authorId: params.author.id,
    days: params.trip.days,
    bikeType: params.trip.bike_type || 'motorcycle',
    publishedAt: new Date().toISOString(),
    copiesCount: 0,
    rating: 5.0,
    finishersCount: 1,
    tags: autoTags,
    description: params.trip.preferences || `Curated ${params.trip.days}-day motorcycle itinerary from ${params.trip.from_place} to ${params.trip.to_place}.`,
    settings: params.settings,
    stops: params.settings.includeStops ? sanitizedStops : [],
    amenitiesSummary: {
      fuel,
      food,
      rest,
      scenic,
    },
  };

  try {
    const existing = getPublishedTrips().filter((p) => p.sourceTripId !== params.trip.id);
    const updated = [published, ...existing];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save published trip to localStorage:', err);
  }

  return published;
}

/**
 * Unpublish a trip
 */
export function unpublishTrip(sourceTripId: string): void {
  try {
    const existing = getPublishedTrips().filter((p) => p.sourceTripId !== sourceTripId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (err) {
    console.warn('Failed to unpublish trip:', err);
  }
}

export interface CopiedDraftTrip {
  id: string;
  sourcePublishedId: string;
  sourceTripId: string;
  sourceCredit: string;
  title: string;
  from_place: string;
  to_place: string;
  days: number;
  bike_type: string;
  stops: PublicStopItem[];
  copiedAt: string;
  isDraft: boolean;
}

/**
 * Step 5: "Others copy and edit - Copy to my trips creates a draft that credits the source."
 */
export function copyTripToMyTrips(
  publishedTrip: PublishedTrip,
  currentUser: { id: string; fullName: string }
): CopiedDraftTrip {
  const draftId = `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const sourceCredit = `Forked from @${publishedTrip.authorName} (${publishedTrip.title}) by @${currentUser.fullName || 'Rider'}`;

  const draft: CopiedDraftTrip = {
    id: draftId,
    sourcePublishedId: publishedTrip.id,
    sourceTripId: publishedTrip.sourceTripId,
    sourceCredit,
    title: `${publishedTrip.title} (Draft Copy)`,
    from_place: publishedTrip.fromPlace,
    to_place: publishedTrip.toPlace,
    days: publishedTrip.days,
    bike_type: publishedTrip.bikeType,
    stops: publishedTrip.stops.map((s, idx) => ({
      ...s,
      id: `copy-stop-${idx}-${Date.now()}`,
    })),
    copiedAt: new Date().toISOString(),
    isDraft: true,
  };

  // 1. Increment copiesCount on the published trip
  try {
    const all = getPublishedTrips().map((p) => {
      if (p.id === publishedTrip.id) {
        return { ...p, copiesCount: p.copiesCount + 1 };
      }
      return p;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn('Failed to update copies count:', err);
  }

  // 2. Save draft to user's copied drafts list
  try {
    const existingDrafts: CopiedDraftTrip[] = JSON.parse(localStorage.getItem(COPIED_TRIPS_KEY) || '[]');
    existingDrafts.unshift(draft);
    localStorage.setItem(COPIED_TRIPS_KEY, JSON.stringify(existingDrafts));
  } catch (err) {
    console.warn('Failed to save copied draft trip:', err);
  }

  return draft;
}

/**
 * Get all user's copied draft trips
 */
export function getCopiedDraftTrips(): CopiedDraftTrip[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COPIED_TRIPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
