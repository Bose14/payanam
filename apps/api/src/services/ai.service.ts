import env from '../config/environment';

interface ItineraryStop {
  order: number;
  place: string;
  type: 'fuel_stop' | 'stay' | 'attraction' | 'meal' | 'rest';
  description: string;
  estimatedKm: number;
  durationHours: number;
  tips: string;
  lat?: number;
  lng?: number;
}

interface ItineraryDay {
  day: number;
  stops: ItineraryStop[];
}

async function geocodePlace(name: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1&countrycodes=in`,
      {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'Payanam-App/1.0' },
        signal: AbortSignal.timeout(3500),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { /* silent fallback */ }
  return null;
}

/**
 * Intelligent rule-based fallback itinerary generator
 * Used when GROQ_API_KEY is not configured or when Groq API encounters rate limits/outages.
 */
async function generateSmartFallbackItinerary(
  from: string,
  to: string,
  days: number,
  bikeType: string,
  tripType: string,
  preferences: string,
): Promise<ItineraryDay[]> {
  console.log(`[ai.service] Generating smart fallback itinerary for ${from} → ${to} (${days} days)`);

  // Try to get actual coordinates for from and to
  const fromCoords = await geocodePlace(from) ?? { lat: 11.3410, lng: 77.7172 }; // Erode default
  const toCoords = await geocodePlace(to) ?? { lat: 10.8505, lng: 76.2711 }; // Kerala default

  const itinerary: ItineraryDay[] = [];
  const safeDays = Math.max(1, Math.min(days, 14));

  for (let d = 1; d <= safeDays; d++) {
    const stops: ItineraryStop[] = [];

    // Fraction along the route
    let startFraction = (d - 1) / safeDays;
    let endFraction = d / safeDays;

    if (tripType === 'round_trip' || tripType === 'loop') {
      // Outward in first half, return in second half
      const midDay = Math.ceil(safeDays / 2);
      if (d <= midDay) {
        startFraction = (d - 1) / midDay;
        endFraction = d / midDay;
      } else {
        startFraction = 1 - (d - midDay - 1) / (safeDays - midDay);
        endFraction = 1 - (d - midDay) / (safeDays - midDay);
      }
    }

    const interpLat = (frac: number, jitter = 0) =>
      Number((fromCoords.lat + (toCoords.lat - fromCoords.lat) * frac + jitter).toFixed(5));
    const interpLng = (frac: number, jitter = 0) =>
      Number((fromCoords.lng + (toCoords.lng - fromCoords.lng) * frac + jitter).toFixed(5));

    // Stop 1: Morning Fuel Stop
    stops.push({
      order: 1,
      place: d === 1 ? `Highway Fuel Station near ${from}` : `Morning Fuel Hub - Day ${d}`,
      type: 'fuel_stop',
      description: `Refuel ${bikeType}, inspect tire pressure, and top-up engine coolant/oil.`,
      estimatedKm: 65,
      durationHours: 0.5,
      tips: 'Tank up early to avoid long queues at highway pumps.',
      lat: interpLat(startFraction + 0.15 * (endFraction - startFraction), 0.01),
      lng: interpLng(startFraction + 0.15 * (endFraction - startFraction), -0.01),
    });

    // Stop 2: Meal / Dhaba Refreshment Stop
    stops.push({
      order: 2,
      place: `Highway Dhaba & Express Cafe (km ${Math.round(140 * d)})`,
      type: 'meal',
      description: `Hearty meal break with fresh food, tea/coffee, and shaded parking for ${bikeType}s.`,
      estimatedKm: 140,
      durationHours: 1.0,
      tips: 'Stay hydrated with tender coconut or electrolyte water.',
      lat: interpLat(startFraction + 0.45 * (endFraction - startFraction), -0.02),
      lng: interpLng(startFraction + 0.45 * (endFraction - startFraction), 0.015),
    });

    // Stop 3: Scenic Point / Attraction
    const isLastDay = d === safeDays;
    stops.push({
      order: 3,
      place: isLastDay
        ? (tripType === 'round_trip' ? `Scenic Return Ghat Viewpoint` : `${to} Scenic Overlook`)
        : `Scenic Pass & Landmark En Route (Day ${d})`,
      type: 'attraction',
      description: preferences
        ? `Scenic detour tailored to your preference: ${preferences.slice(0, 80)}`
        : `Breathtaking valley views, winding curve roads, and photo opportunity for the convoy.`,
      estimatedKm: 210,
      durationHours: 1.5,
      tips: 'Slow down on hairpin curves and check oncoming horn signals.',
      lat: interpLat(startFraction + 0.75 * (endFraction - startFraction), 0.02),
      lng: interpLng(startFraction + 0.75 * (endFraction - startFraction), -0.01),
    });

    // Stop 4: Night Stay / Destination
    stops.push({
      order: 4,
      place: isLastDay
        ? (tripType === 'round_trip' ? `${from} (Home Base)` : `${to} City / Resort Stay`)
        : `Overnight Waypoint & Rider Stay (Day ${d})`,
      type: 'stay',
      description: `Rider-friendly lodge/hotel with gated motorcycle parking and nearby repair facilities.`,
      estimatedKm: 275,
      durationHours: 2.0,
      tips: 'Lubricate drive chain while the chain is still warm from the ride.',
      lat: interpLat(endFraction, 0),
      lng: interpLng(endFraction, 0),
    });

    itinerary.push({ day: d, stops });
  }

  return itinerary;
}

export async function generateItinerary(
  from: string,
  to: string,
  days: number,
  bikeType: string,
  tripType: string,
  preferences: string,
): Promise<ItineraryDay[]> {
  const isGroqConfigured =
    env.GROQ_API_KEY &&
    !env.GROQ_API_KEY.includes('REPLACE_') &&
    env.GROQ_API_KEY.trim().length > 10;

  if (!isGroqConfigured) {
    console.warn('[ai.service] GROQ_API_KEY is not configured or using placeholder. Using smart itinerary generator.');
    return generateSmartFallbackItinerary(from, to, days, bikeType, tripType, preferences);
  }

  const tripTypeInstructions: Record<string, string> = {
    one_way: `This is a ONE-WAY trip from ${from} to ${to}. Plan a direct forward route — stops must progress toward ${to} every day.`,
    round_trip: `This is a ROUND TRIP. Start from ${from}, travel to ${to} (or nearby), then return to ${from} by the last day. Ideally use a different return route for variety.`,
    loop: `This is a LOOP trip starting and ending at ${from}. Plan a scenic circuit that passes through ${to} and returns to ${from} via a different route.`,
  };
  const tripInstruction = tripTypeInstructions[tripType] ?? tripTypeInstructions['one_way'];
  const preferencesText = preferences ? `\n\nRIDER PREFERENCES (follow these exactly):\n${preferences}` : '';

  const prompt = `You are an expert biker tour planner with deep knowledge of Indian roads and highways. Generate a day-wise itinerary for a ${bikeType} trip from ${from} to ${to} for ${days} days.

TRIP TYPE: ${tripInstruction}${preferencesText}

STRICT RULES:
- Follow rider preferences above all else — they override default routing
- Stops within a day must be in correct geographical order (never backtrack)
- Fuel stops every 150-200km
- End each day at a town/city with accommodation
- NEVER repeat the same place across any day — every stop must be unique in the entire itinerary
- Be specific with real place names
- Include approximate real latitude and longitude for each place

Return ONLY a valid JSON array (no markdown, no explanation, no code fences):
[
  {
    "day": 1,
    "stops": [
      {
        "order": 1,
        "place": "Place Name, State",
        "type": "fuel_stop",
        "description": "Brief description",
        "estimatedKm": 50,
        "durationHours": 1,
        "tips": "Useful tip for bikers",
        "lat": 11.6643,
        "lng": 78.1460
      }
    ]
  }
]

Types: fuel_stop, stay, attraction, meal, rest
Make sure the last stop of each day is a "stay" type.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${env.GROQ_API_KEY.trim()}`,
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[ai.service] Groq API returned ${response.status}: ${errText}. Falling back to smart generator.`);
      return generateSmartFallbackItinerary(from, to, days, bikeType, tripType, preferences);
    }

    const result = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const text = result.choices?.[0]?.message?.content ?? '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('[ai.service] Groq response did not contain JSON array. Falling back.');
      return generateSmartFallbackItinerary(from, to, days, bikeType, tripType, preferences);
    }

    const parsed = JSON.parse(jsonMatch[0]) as ItineraryDay[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return generateSmartFallbackItinerary(from, to, days, bikeType, tripType, preferences);
    }

    return parsed;
  } catch (err) {
    console.error('[ai.service] Groq call failed:', err);
    return generateSmartFallbackItinerary(from, to, days, bikeType, tripType, preferences);
  }
}
