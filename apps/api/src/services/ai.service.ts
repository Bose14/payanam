import env from '../config/environment';

interface ItineraryStop {
  order: number;
  place: string;
  type: 'fuel_stop' | 'stay' | 'attraction' | 'meal' | 'rest';
  description: string;
  estimatedKm: number;
  durationHours: number;
  tips: string;
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

  const prompt = `You are an expert biker tour planner. Generate a detailed day-wise itinerary for a ${bikeType} trip from ${from} to ${to} for ${days} days.${preferencesText}

Return ONLY a valid JSON array (no markdown, no explanation) in this exact format:
[
  {
    "day": 1,
    "stops": [
      {
        "order": 1,
        "place": "Place Name",
        "type": "fuel_stop",
        "description": "Brief description",
        "estimatedKm": 50,
        "durationHours": 1,
        "tips": "Useful tip for bikers"
      }
    ]
  }
]

Types allowed: fuel_stop, stay, attraction, meal, rest
Make sure the last stop of each day is a "stay" type. Include fuel stops every 150-200km. Add local attraction and meal stops. Be specific with real place names.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-5-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error: ${response.status} ${errText}`);
  }

  const result = await response.json() as { content: Array<{ type: string; text: string }> };
  const text = result.content[0]?.text ?? '';

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Claude returned invalid itinerary format');
  }

  return JSON.parse(jsonMatch[0]) as ItineraryDay[];
}
