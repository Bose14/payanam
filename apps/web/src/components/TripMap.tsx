import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Stop { place: string; lat?: number | null; lng?: number | null; item_type?: string; }

interface TripMapProps {
  stops: Stop[];
  fromPlace?: string;
  toPlace?: string;
}

const TYPE_COLORS: Record<string, string> = {
  fuel_stop: '#f59e0b', stay: '#3b82f6', attraction: '#10b981', meal: '#f97316', rest: '#8b5cf6',
};

export default function TripMap({ stops, fromPlace, toPlace }: TripMapProps) {
  const validStops = stops.filter((s) => s.lat && s.lng);

  if (validStops.length === 0) {
    const mapsQuery = fromPlace && toPlace
      ? `https://www.google.com/maps/dir/${encodeURIComponent(fromPlace)}/${encodeURIComponent(toPlace)}`
      : null;

    return (
      <div style={{
        height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 12,
        background: 'linear-gradient(135deg, #1e3a5f10, #0f346015)',
        borderRadius: 12, border: '1px dashed #93c5fd',
      }}>
        <div style={{ fontSize: 32 }}>🗺️</div>
        <p style={{ color: '#374151', fontSize: 14, fontWeight: 500, margin: 0 }}>
          Map available for new trips with AI coordinates
        </p>
        {mapsQuery && (
          <a href={mapsQuery} target="_blank" rel="noreferrer" style={{
            padding: '8px 16px', background: '#3b82f6', color: 'white',
            borderRadius: 8, fontSize: 13, textDecoration: 'none', fontWeight: 600,
          }}>
            View on Google Maps →
          </a>
        )}
      </div>
    );
  }

  const midIdx = Math.floor(validStops.length / 2);
  const center: [number, number] = [validStops[midIdx].lat as number, validStops[midIdx].lng as number];
  const positions: [number, number][] = validStops.map((s) => [s.lat as number, s.lng as number]);

  return (
    <MapContainer center={center} zoom={7} style={{ height: 380, borderRadius: 12, zIndex: 0 }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
      <Polyline positions={positions} color="#3b82f6" weight={3} dashArray="6,4" />
      {validStops.map((stop, i) => {
        const color = TYPE_COLORS[stop.item_type ?? 'rest'] ?? '#6b7280';
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold">${i + 1}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        return (
          <Marker key={i} position={[stop.lat as number, stop.lng as number]} icon={icon}>
            <Popup><strong>{stop.place}</strong></Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
