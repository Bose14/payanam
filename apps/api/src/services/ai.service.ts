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

Return ONLY a valid JSON array (no markdown, no explanation, no code fences) in this exact format:
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errText}`);
  }

  const result = await response.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };

  const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`Gemini returned invalid format: ${text.slice(0, 200)}`);
  }

  return JSON.parse(jsonMatch[0]) as ItineraryDay[];
}
