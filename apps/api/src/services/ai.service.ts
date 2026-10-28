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
  tripType: string,
  preferences: string,
): Promise<ItineraryDay[]> {
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
