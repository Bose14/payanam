/**
 * Feature H2 · Communication: Trip Chat Linked to Itinerary
 * 
 * Specifications:
 * 1. Member shares a location: From the chat composer, the current location or a dropped pin.
 * 2. Captain confirms it: Confirm as stop turns the location into an itinerary stop.
 * 3. Itinerary updates for all: The stop appears in the plan with a 'from chat' tag.
 * 4. Chat stays trip-only: General conversation stays on WhatsApp.
 */

export interface ParsedLocationMessage {
  isLocation: boolean;
  placeName: string;
  lat: number | null;
  lng: number | null;
  note: string;
  rawText: string;
}

export interface ItineraryStopLike {
  id?: string;
  place: string;
  lat?: number | null;
  lng?: number | null;
  day_number?: number;
  order_index?: number;
  item_type?: string;
  description?: string;
}

/**
 * Extracts location details, coordinates, place name, and optional note from chat messages.
 * Matches patterns:
 * - "📍 Shared Location: Place Name [lat, lng] — Note"
 * - "Some message text [lat, lng]"
 * - Direct coordinate strings
 */
export function parseLocationFromMessage(messageText: string): ParsedLocationMessage {
  if (!messageText) {
    return {
      isLocation: false,
      placeName: '',
      lat: null,
      lng: null,
      note: '',
      rawText: '',
    };
  }

  // Regex to match [lat, lng]
  const coordRegex = /\[([+-]?[0-9]+(?:\.[0-9]+)?),\s*([+-]?[0-9]+(?:\.[0-9]+)?)\]/;
  const match = messageText.match(coordRegex);

  if (!match) {
    // Also check if text explicitly mentions shared location or pin
    const isKeywordLoc = messageText.includes('📍') || messageText.includes('📌 Pinned Target Stop:');
    return {
      isLocation: isKeywordLoc,
      placeName: isKeywordLoc ? messageText.replace(/^(?:📍|📌)\s*/, '').split('\n')[0].trim() : '',
      lat: null,
      lng: null,
      note: '',
      rawText: messageText,
    };
  }

  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);

  // Extract place name and note
  // Common format: "📍 Shared Location: Place Name [lat,lng] — Note"
  let placeName = '';
  let note = '';

  const prefixPattern = /📍\s*Shared Location:\s*([^[\n]+)/i;
  const pinPrefixPattern = /📌\s*Pinned Target Stop:\s*([^[\n]+)/i;

  const prefixMatch = messageText.match(prefixPattern) || messageText.match(pinPrefixPattern);
  if (prefixMatch && prefixMatch[1]) {
    placeName = prefixMatch[1].trim();
  } else {
    // Take text before the bracket as place name or message
    const beforeBracket = messageText.slice(0, match.index).trim();
    if (beforeBracket) {
      placeName = beforeBracket.replace(/^(?:📍|📌)\s*/, '').trim();
    }
  }

  // If after the bracket there is an em-dash or note
  const afterBracket = messageText.slice((match.index ?? 0) + match[0].length).trim();
  if (afterBracket) {
    note = afterBracket.replace(/^[-—:·\s]+/, '').replace(/^["']|["']$/g, '').trim();
  }

  if (!placeName && !note) {
    placeName = `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  } else if (!placeName && note) {
    placeName = note;
    note = '';
  }

  return {
    isLocation: true,
    placeName,
    lat,
    lng,
    note,
    rawText: messageText,
  };
}

/**
 * Checks if a location has already been confirmed into the trip itinerary.
 */
export function isStopConfirmedInItinerary(
  placeName: string,
  lat: number | null,
  lng: number | null,
  itinerary: ItineraryStopLike[] = []
): boolean {
  if (!itinerary || itinerary.length === 0) return false;

  const cleanName = placeName.trim().toLowerCase();

  return itinerary.some((item) => {
    // Match by name
    const itemPlace = item.place.trim().toLowerCase();
    if (cleanName && itemPlace === cleanName) return true;

    // Match by coordinates if available (within ~100m)
    if (lat != null && lng != null && item.lat != null && item.lng != null) {
      const dLat = Math.abs(lat - item.lat);
      const dLng = Math.abs(lng - item.lng);
      if (dLat < 0.0015 && dLng < 0.0015) return true;
    }

    return false;
  });
}

/**
 * Determines whether an itinerary item originated from the chat.
 */
export function isStopFromChat(item: ItineraryStopLike): boolean {
  if (!item) return false;
  if (item.item_type === 'chat_stop') return true;
  const desc = item.description?.toLowerCase() || '';
  return desc.includes('from chat') || desc.includes('from_chat') || desc.includes('shared in chat');
}

/**
 * Formats standard location sharing message text.
 */
export function formatLocationShareMessage(
  placeName: string,
  lat: number,
  lng: number,
  note?: string
): string {
  const base = `📍 Shared Location: ${placeName.trim()} [${lat.toFixed(6)},${lng.toFixed(6)}]`;
  return note && note.trim() ? `${base} — "${note.trim()}"` : base;
}
