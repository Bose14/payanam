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

interface TripMapProps { stops: Stop[]; }

const TYPE_COLORS: Record<string, string> = {
  fuel_stop: '#f59e0b',
  stay: '#3b82f6',
  attraction: '#10b981',
  meal: '#f97316',
  rest: '#8b5cf6',
};

export default function TripMap({ stops }: TripMapProps) {
  const validStops = stops.filter((s) => s.lat && s.lng);

  if (validStops.length === 0) {
    return (
      <div style={{
        height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f3f4f6', borderRadius: 12, color: '#6b7280', fontSize: 14,
      }}>
        Map unavailable — stops missing coordinates
      </div>
    );
  }

  const midIdx = Math.floor(validStops.length / 2);
  const center: [number, number] = [validStops[midIdx].lat as number, validStops[midIdx].lng as number];
  const positions: [number, number][] = validStops.map((s) => [s.lat as number, s.lng as number]);

  return (
    <MapContainer center={center} zoom={7} style={{ height: 350, borderRadius: 12 }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
      <Polyline positions={positions} color="#3b82f6" weight={3} dashArray="6,4" />
      {validStops.map((stop, i) => {
        const color = TYPE_COLORS[stop.item_type ?? 'rest'] ?? '#6b7280';
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold">${i + 1}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        return (
          <Marker key={i} position={[stop.lat as number, stop.lng as number]} icon={icon}>
            <Popup>{stop.place}</Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
