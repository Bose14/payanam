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

export async function generateItinerary(
  from: string,
  to: string,
  days: number,
  bikeType: string,
  preferences: string,
): Promise<ItineraryDay[]> {
  const preferencesText = preferences ? `\nRider preferences: ${preferences}` : '';

  const prompt = `You are an expert biker tour planner with deep knowledge of Indian highways. Generate a day-wise itinerary for a ${bikeType} trip from ${from} to ${to} for ${days} days.${preferencesText}

STRICT RULES (must follow every rule):
- This is a ONE-WAY trip from ${from} to ${to} — not a round trip
- Always take the most direct highway route — NO detours, no side trips off the highway
- Each stop must be ON or very close to the direct route, progressing forward toward ${to}
- Stops within a day must be in correct geographical order along the route (never go backwards)
- Fuel stops every 150-200km along the main highway
- End each day at a town/city with accommodation ON the route
- NEVER repeat the same place, attraction, fort, temple, or town across any day
- NEVER list the same stop twice anywhere in the entire itinerary
- Every place name must be unique across all days combined
- Each attraction should only be visited ONCE — if you mention a place on day 1, do NOT mention it again on day 2 or later

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
Make sure the last stop of each day is a "stay" type. Include fuel stops every 150-200km. Add local attraction and meal stops. Be specific with real place names. Include approximate lat/lng for each place (real coordinates).`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error: ${response.status} ${errText}`);
  }

  const result = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const text = result.choices?.[0]?.message?.content ?? '';

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`Groq returned invalid format: ${text.slice(0, 200)}`);
  }

  return JSON.parse(jsonMatch[0]) as ItineraryDay[];
}
