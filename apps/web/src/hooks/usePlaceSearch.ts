import { useState, useCallback, useRef, useEffect } from 'react';

import { placeService } from '../services/api';

export interface Place { display_name: string; lat: string; lon: string; kind?: string; }
export interface SearchBias { lat: number; lng: number }

export type PlaceSearchStatus = 'idle' | 'loading' | 'done' | 'error';

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

async function fetchPlaces(query: string, limit: number, signal?: AbortSignal, india = true): Promise<Place[]> {
  const url = `${ENDPOINT}?q=${encodeURIComponent(query)}&format=json&limit=${limit}${india ? '&countrycodes=in' : ''}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' }, signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Best single match for a typed place name: India first, then anywhere. */
export async function geocodeBest(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    let hits = await fetchPlaces(query, 1, undefined, true);
    if (hits.length === 0) hits = await fetchPlaces(query, 1, undefined, false);
    if (hits[0]) return { lat: parseFloat(hits[0].lat), lng: parseFloat(hits[0].lon) };
  } catch { /* network error: caller decides what to tell the person */ }
  return null;
}

/** The server searches OpenStreetMap with many results. If it cannot be reached, ask Nominatim directly. */
async function searchAll(q: string, bias: SearchBias | undefined, signal: AbortSignal): Promise<Place[]> {
  try {
    const items = await placeService.suggest(q, bias, signal);
    return items.map((i) => ({ display_name: [i.name, i.subtitle].filter(Boolean).join(', '), lat: String(i.lat), lon: String(i.lng), kind: i.kind }));
  } catch (e) {
    if ((e as Error).name === 'AbortError' || (e as { code?: string }).code === 'ERR_CANCELED') throw e;
    let hits = await fetchPlaces(q, 8, signal, true);
    if (hits.length === 0) hits = await fetchPlaces(q, 8, signal, false);
    return hits;
  }
}

export function usePlaceSearch(bias?: SearchBias) {
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [status, setStatus] = useState<PlaceSearchStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);
  const biasRef = useRef(bias);
  biasRef.current = bias;

  const cancel = useCallback(() => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    abortRef.current?.abort();
    abortRef.current = null;
    seqRef.current += 1; // any reply still in flight is now stale
  }, []);

  useEffect(() => cancel, [cancel]);

  const search = useCallback((query: string) => {
    cancel();
    const q = query.trim();
    if (q.length < 2) { setSuggestions([]); setStatus('idle'); return; }
    const seq = seqRef.current;
    setStatus('loading');
    debounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const hits = await searchAll(q, biasRef.current, ctrl.signal);
        if (seq !== seqRef.current) return; // person kept typing
        setSuggestions(hits);
        setStatus('done');
      } catch (e) {
        if ((e as Error).name === 'AbortError' || (e as { code?: string }).code === 'ERR_CANCELED' || seq !== seqRef.current) return;
        setSuggestions([]);
        setStatus('error');
      }
    }, 350);
  }, [cancel]);

  const clear = useCallback(() => { cancel(); setSuggestions([]); setStatus('idle'); }, [cancel]);
  return { suggestions, loading: status === 'loading', status, search, clear };
}
