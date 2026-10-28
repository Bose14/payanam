import { useState, useCallback, useRef } from 'react';

interface Place { display_name: string; lat: string; lon: string; }

export function usePlaceSearch() {
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=in`,
          { headers: { 'Accept-Language': 'en' } },
        );
        const data = await res.json();
        setSuggestions(data);
      } catch {
        setSuggestions([]);
      }
      setLoading(false);
    }, 400);
  }, []);

  const clear = useCallback(() => setSuggestions([]), []);
  return { suggestions, loading, search, clear };
}
