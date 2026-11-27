import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { tripService } from '../services/api';
import { getPosition, GeoError, GEO_MESSAGES } from '../utils/geolocate';
import Stepper from '../components/Stepper';
import PlaceInput from '../components/PlaceInput';
import Navbar from '../components/Navbar';
import Icon from '../components/Icon';

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'Payanam-App' } }
    );
    const data = await res.json();
    const a = data.address ?? {};
    const area = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.residential ?? a.road;
    const city = a.city ?? a.town ?? a.village ?? a.county;
    if (area && city && area !== city) return `${area}, ${city}`;
    return city ?? a.state ?? data.display_name ?? `${lat.toFixed(5)},${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)},${lng.toFixed(5)}`;
  }
}

const TRIP_TYPES = [
  { value: 'one_way', label: '→ One-way', desc: 'Direct forward route' },
  { value: 'round_trip', label: '↺ Round trip', desc: 'Return to start point' },
  { value: 'loop', label: '⟳ Loop Circuit', desc: 'Scenic loop via new roads' },
];

const VEHICLES = [
  { value: 'motorcycle', label: 'Motorcycle', icon: 'bike' },
  { value: 'scooter', label: 'Scooter', icon: 'bike' },
  { value: 'car', label: 'Car / 4x4', icon: 'bike' },
  { value: 'bicycle', label: 'Bicycle', icon: 'bike' },
];

const PREFERENCE_CHIPS = [
  'Ghats & Hill Curves',
  'Scenic Coastal Roads',
  'Avoid Highway Tolls',
  'Frequent Chai & Fuel Stops',
  'Authentic Local Dhabas',
  'High-Altitude Viewpoints',
];

export default function CreateTripPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    from_place: '',
    to_place: '',
    from_lat: null as number | null,
    from_lng: null as number | null,
    to_lat: null as number | null,
    to_lng: null as number | null,
    days: 3,
    max_members: 6,
    bike_type: 'motorcycle',
    trip_type: 'one_way',
    preferences: '',
  });
  const [mode, setMode] = useState<'ai' | 'manual' | 'direct'>('ai')
  const [teaStop, setTeaStop] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gettingFrom, setGettingFrom] = useState(false);
  const [gettingTo, setGettingTo] = useState(false);

  const [locError, setLocError] = useState<{ field: 'from_place' | 'to_place'; msg: string } | null>(null);

  const useCurrentLocation = async (field: 'from_place' | 'to_place') => {
    const setSpin = field === 'from_place' ? setGettingFrom : setGettingTo;
    const latField = field === 'from_place' ? 'from_lat' : 'to_lat';
    const lngField = field === 'from_place' ? 'from_lng' : 'to_lng';
    setSpin(true);
    setLocError(null);
    try {
      const pos = await getPosition();
      const { latitude: lat, longitude: lng } = pos.coords;
      const name = await reverseGeocode(lat, lng).catch(() => '');
      setForm(f => ({ ...f, [field]: name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`, [latField]: lat, [lngField]: lng }));
    } catch (e) {
      const reason = e instanceof GeoError ? e.reason : 'unavailable';
      const detail = e instanceof GeoError && e.detail ? ` (${e.detail.slice(0, 140)})` : '';
      setLocError({ field, msg: GEO_MESSAGES[reason] + (reason === 'denied' ? '' : detail) });
    } finally {
      setSpin(false);
    }
  };

  const handleSwapPlaces = () => {
    setForm(prev => ({
      ...prev,
      from_place: prev.to_place,
      to_place: prev.from_place,
      from_lat: prev.to_lat,
      from_lng: prev.to_lng,
      to_lat: prev.from_lat,
      to_lng: prev.from_lng,
    }));
  };

  const handleAddPreference = (chip: string) => {
    setForm(prev => {
      const current = prev.preferences.trim();
      if (current.includes(chip)) return prev;
      return {
        ...prev,
        preferences: current ? `${current}, ${chip}` : chip,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await tripService.createTrip({
        ...form,
        preferences: mode === 'ai' ? form.preferences : '',
        itinerary_mode: mode,
        tea_stop: mode === 'direct' ? teaStop : undefined,
        ...(mode === 'direct' ? { trip_type: 'one_way' } : {}),
        days: mode === 'direct' ? 1 : Number(form.days) || 1,
      });
      navigate(`/trips/${result.trip.id}`);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string; error?: { message?: string } } };
        message?: string;
      };
      const errorMsg =
        axiosErr.response?.data?.error?.message ??
        axiosErr.response?.data?.message ??
        axiosErr.message ??
        mode === 'ai' ? 'Failed to generate itinerary. Please try again.' : 'Failed to create the trip. Please try again.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <Navbar />

      <main className="responsive-page-container" style={styles.container}>
        {/* Back Link */}
        <div style={{ marginBottom: 16 }}>
          <Link to="/dashboard" style={styles.backLink}>
            ← Back to Dashboard
          </Link>
        </div>

        {/* Card Form */}
        <div className="responsive-card" style={styles.card}>
          <div style={styles.header}>
            <div style={styles.badge}>
              <span>Trip Planner</span>
            </div>
            <h1 style={styles.title}>Plan Your Expedition</h1>
            <p style={styles.subtitle}>
              {mode === 'ai' ? 'Enter your route details and AI will generate day-wise fuel stops, scenic viewpoints, dhabas, and stays.' : mode === 'direct' ? 'Pick where you start and where you end. No stops to plan.' : 'Enter your route details, then add the places you want to stop at one by one.'}
            </p>
          </div>

          {error && (
            <div style={styles.errorBox}>
              <span><Icon name="warning" /></span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            {/* Itinerary mode */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>How do you want to plan this trip?</label>
              <div role="radiogroup" aria-label="Itinerary mode" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                {([
                  { value: 'direct', title: 'Point to point', desc: 'Straight from A to B. No stops, or one tea break on the way.', icon: 'road' },
                  { value: 'ai', title: 'Generate with AI', desc: 'AI suggests a day-by-day route with fuel, food and rest stops. You can edit it afterwards.', icon: 'spark' },
                  { value: 'manual', title: 'Build step by step', desc: 'Start with an empty plan. Search for places and add them one at a time.', icon: 'list' },
                ] as const).map(o => {
                  const on = mode === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setMode(o.value)}
                      style={{
                        textAlign: 'left',
                        padding: '12px 14px',
                        borderRadius: 12,
                        cursor: 'pointer',
                        background: on ? 'var(--pz-accent-soft, rgba(240,194,58,0.12))' : 'var(--bg-card, transparent)',
                        border: on ? '2px solid var(--pz-accent, var(--pz-accent))' : '1px solid var(--border-color, var(--pz-line))',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 15 }}>
                        <Icon name={o.icon} /> {o.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>{o.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Trip Type */}
            {mode !== 'direct' && (
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Trip Style</label>
              <div className="responsive-trip-type-grid" style={styles.tripTypeGrid}>
                {TRIP_TYPES.map(t => {
                  const isSelected = form.trip_type === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, trip_type: t.value }))}
                      style={{
                        ...styles.tripTypeBtn,
                        borderColor: isSelected ? 'var(--accent-gold)' : 'var(--border-subtle)',
                        background: isSelected ? 'var(--accent-gold-bg)' : 'var(--bg-subtle)',
                      }}
                    >
                      <div style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: isSelected ? 'var(--accent-gold)' : 'var(--text-primary)',
                      }}>
                        {t.label}
                      </div>
                      <div style={styles.tripTypeDesc}>{t.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            {/* From & To Row with Swap */}
            <div className="responsive-route-row" style={styles.routeRow}>
              <div style={styles.fieldFlex}>
                <label style={styles.label}>Starting Point</label>
                <PlaceInput
                  value={form.from_place}
                  onChange={(v) => setForm(f => ({ ...f, from_place: v, from_lat: null, from_lng: null }))}
                  placeholder="e.g. Salem, Tamil Nadu"
                />
                <button
                  type="button"
                  onClick={() => useCurrentLocation('from_place')}
                  disabled={gettingFrom}
                  style={styles.gpsBtn}
                >
                  {gettingFrom ? 'Finding GPS...' : 'Use My Location'}
                </button>
                {locError?.field === 'from_place' && <div role="alert" style={styles.locError}>{locError.msg}</div>}
              </div>

              {/* Swap Button */}
              <button
                type="button"
                onClick={handleSwapPlaces}
                title="Swap origin and destination"
                className="responsive-swap-btn"
                style={styles.swapBtn}
              >
                ⇄
              </button>

              <div style={styles.fieldFlex}>
                <label style={styles.label}>
                  {form.trip_type === 'round_trip' ? 'Destination (Furthest Point)' : 'Destination'}
                </label>
                <PlaceInput
                  value={form.to_place}
                  onChange={(v) => setForm(f => ({ ...f, to_place: v, to_lat: null, to_lng: null }))}
                  placeholder="e.g. Munnar, Kerala"
                  bias={form.from_lat != null && form.from_lng != null ? { lat: form.from_lat, lng: form.from_lng } : undefined}
                />
                <button
                  type="button"
                  onClick={() => useCurrentLocation('to_place')}
                  disabled={gettingTo}
                  style={styles.gpsBtn}
                >
                  {gettingTo ? 'Finding GPS...' : 'Use My Location'}
                </button>
                {locError?.field === 'to_place' && <div role="alert" style={styles.locError}>{locError.msg}</div>}
              </div>
            </div>

            {/* Number of Days */}
            {mode !== 'direct' && (
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Number of Days</label>
              <Stepper value={form.days} min={1} max={14} label="days" unit={(n) => (n === 1 ? 'Day' : 'Days')} onChange={(days) => setForm(f => ({ ...f, days }))} />
            </div>
            )}

            {/* Tea stop (point to point) */}
            {mode === 'direct' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, cursor: 'pointer', border: '1px solid var(--border-color, var(--pz-line))', background: 'var(--bg-card, transparent)', color: 'var(--text-primary)' }}>
                <input type="checkbox" checked={teaStop} onChange={(e) => setTeaStop(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--pz-accent)', flexShrink: 0 }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 15 }}><Icon name="coffee" /> Add one tea stop</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>A cafe or tea shop near the middle of the road. Skipped if none is mapped on your route.</span>
                </span>
              </label>
            )}

            {/* Group size */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>How many riders in this trip? (including you)</label>
              <Stepper value={form.max_members} min={2} max={100} label="riders" unit="Riders" onChange={(max_members) => setForm(f => ({ ...f, max_members }))} />
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                Once this many riders have joined, nobody else can join with the code or link. You can see who joined on the trip page.
              </div>
            </div>

            {/* Vehicle Type */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Vehicle Type</label>
              <div className="responsive-vehicle-grid" style={styles.vehicleGrid}>
                {VEHICLES.map(v => {
                  const isSelected = form.bike_type === v.value;
                  return (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, bike_type: v.value }))}
                      className="responsive-vehicle-btn"
                      style={{
                        ...styles.vehicleBtn,
                        borderColor: isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                        background: isSelected ? 'var(--accent-cyan-bg)' : 'var(--bg-subtle)',
                        color: isSelected ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                        boxShadow: isSelected ? '0 0 0 1.5px var(--accent-cyan)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}><Icon name={v.icon} size={20} /></span>
                      <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{v.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rider Preferences (AI only) */}
            {mode === 'ai' && (
            <div style={styles.fieldGroup}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={styles.label}>Convoy Preferences & Detours</label>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Optional</span>
              </div>

              {/* Quick Tags */}
              <div style={styles.chipsRow}>
                {PREFERENCE_CHIPS.map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleAddPreference(chip)}
                    style={styles.chipBtn}
                  >
                    + {chip}
                  </button>
                ))}
              </div>

              <textarea
                name="preferences"
                value={form.preferences}
                onChange={e => setForm(f => ({ ...f, preferences: e.target.value }))}
                placeholder="e.g. Prefer hill roads, scenic coastal highway, avoid tolls, suggest South Indian dhabas..."
                rows={3}
                style={styles.textarea}
              />
            </div>
            )}

            {/* Submit Action */}
            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.btnSubmit,
                opacity: loading ? 0.75 : 1,
              }}
            >
              {loading ? (
                <span>{mode === 'ai' ? 'AI is planning your waypoints...' : mode === 'direct' && teaStop ? 'Finding a tea stop on your route...' : 'Creating your trip...'}</span>
              ) : (
                <span>{mode === 'ai' ? 'Generate Itinerary with AI' : mode === 'direct' ? 'Create Point to Point Trip' : 'Create Trip and Add Stops'}</span>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-page)',
    color: 'var(--text-primary)',
    transition: 'background-color 0.3s ease, color 0.3s ease',
  },
  container: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '24px 16px 60px',
  },
  backLink: {
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  card: {
    background: 'var(--pz-surface, var(--bg-card))',
    border: '1px solid var(--pz-line, var(--border-card))',
    borderRadius: 16,
    padding: 'clamp(20px, 4vw, 32px) clamp(16px, 3.5vw, 28px)',
    boxShadow: 'var(--card-shadow)',
  },
  header: {
    marginBottom: 24,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    background: 'var(--accent-gold-bg)',
    border: '1px solid var(--accent-gold)',
    color: 'var(--accent-gold)',
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    font: "700 clamp(24px, 5vw, 32px)/1.05 'Barlow Condensed', sans-serif",
    textTransform: 'uppercase',
    color: 'var(--text-primary)',
    margin: '0 0 8px',
    letterSpacing: '0.01em',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: 14,
    margin: 0,
    lineHeight: 1.5,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'var(--pz-bad-bg)',
    border: '1px solid var(--pz-bad-bg)',
    color: '#ef4444',
    padding: '12px 16px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 20,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tripTypeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 8,
  },
  tripTypeBtn: {
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  tripTypeDesc: {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginTop: 4,
  },
  routeRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  fieldFlex: {
    flex: 1,
    minWidth: 240,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  swapBtn: {
    alignSelf: 'center',
    marginTop: 22,
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-card)',
    color: 'var(--accent-gold)',
    fontSize: 18,
    fontWeight: 800,
    width: 38,
    height: 38,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  locError: { marginTop: 8, fontSize: 12, lineHeight: 1.45, color: 'var(--pz-bad, #ef4444)' },
  gpsBtn: {
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-card)',
    borderRadius: 6,
    padding: '6px 10px',
    color: 'var(--accent-cyan)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
  },
  vehicleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: 10,
    width: '100%',
  },
  vehicleBtn: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 14px',
    borderRadius: 12,
    border: '1.5px solid',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minHeight: 48,
    width: '100%',
    boxSizing: 'border-box',
  },
  chipsRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  chipBtn: {
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-card)',
    color: 'var(--text-secondary)',
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  textarea: {
    width: '100%',
    padding: '12px 14px',
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-input)',
    borderRadius: 10,
    color: 'var(--text-primary)',
    fontSize: 14,
    lineHeight: 1.5,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  btnSubmit: {
    minHeight: 48,
    padding: '14px 24px',
    background: 'var(--pz-accent, var(--btn-primary-bg))',
    color: 'var(--pz-on-accent, var(--btn-primary-text))',
    border: 'none',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 2px 8px var(--pz-warn-bg)',
    marginTop: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
};
