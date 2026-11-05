import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { tripService } from '../services/api';
import PlaceInput from '../components/PlaceInput';
import Navbar from '../components/Navbar';

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
  { value: 'motorcycle', label: 'Motorcycle', icon: '🏍️' },
  { value: 'scooter', label: 'Scooter', icon: '🛵' },
  { value: 'car', label: 'Car / 4x4', icon: '🚗' },
  { value: 'bicycle', label: 'Bicycle', icon: '🚲' },
];

const PREFERENCE_CHIPS = [
  '⛰️ Ghats & Hill Curves',
  '🌊 Scenic Coastal Roads',
  '🚧 Avoid Highway Tolls',
  '☕ Frequent Chai & Fuel Stops',
  '🍽️ Authentic Local Dhabas',
  '📸 High-Altitude Viewpoints',
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
    bike_type: 'motorcycle',
    trip_type: 'one_way',
    preferences: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gettingFrom, setGettingFrom] = useState(false);
  const [gettingTo, setGettingTo] = useState(false);

  const useCurrentLocation = (field: 'from_place' | 'to_place') => {
    const setSpin = field === 'from_place' ? setGettingFrom : setGettingTo;
    const latField = field === 'from_place' ? 'from_lat' : 'to_lat';
    const lngField = field === 'from_place' ? 'from_lng' : 'to_lng';
    setSpin(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const name = await reverseGeocode(lat, lng);
        setForm(f => ({ ...f, [field]: name, [latField]: lat, [lngField]: lng }));
        setSpin(false);
      },
      () => {
        setSpin(false);
        setError('Location permission denied. Please enable GPS in your browser and try again.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
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
        days: Number(form.days) || 1,
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
        'Failed to generate itinerary. Please try again.';
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
              <span>🤖</span>
              <span>AI Route Planner</span>
            </div>
            <h1 style={styles.title}>Plan Your Expedition</h1>
            <p style={styles.subtitle}>
              Enter your route details to automatically generate day-wise fuel stops, scenic viewpoints, dhabas, and stays.
            </p>
          </div>

          {error && (
            <div style={styles.errorBox}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            {/* Trip Type */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Trip Style</label>
              <div style={styles.tripTypeGrid}>
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
                  {gettingFrom ? '⏳ Finding GPS...' : '📍 Use My Location'}
                </button>
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
                />
                <button
                  type="button"
                  onClick={() => useCurrentLocation('to_place')}
                  disabled={gettingTo}
                  style={styles.gpsBtn}
                >
                  {gettingTo ? '⏳ Finding GPS...' : '📍 Use My Location'}
                </button>
              </div>
            </div>

            {/* Days & Vehicle Selection */}
            <div className="responsive-stepper-row" style={styles.twoColGrid}>
              {/* Days Selector */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Number of Days</label>
                <div style={styles.stepperBox}>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, days: Math.max(1, f.days - 1) }))}
                    style={styles.stepperBtn}
                  >
                    –
                  </button>
                  <div style={styles.stepperValue}>
                    <strong>{form.days}</strong> <span>Day{form.days !== 1 ? 's' : ''}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, days: Math.min(14, f.days + 1) }))}
                    style={styles.stepperBtn}
                  >
                    +
                  </button>
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
                          boxShadow: isSelected ? '0 0 0 1px var(--accent-cyan)' : 'none',
                        }}
                      >
                        <span style={{ fontSize: 18 }}>{v.icon}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{v.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Rider Preferences */}
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
                <span>⏳ AI is planning your waypoints...</span>
              ) : (
                <span>🚀 Generate Itinerary with AI</span>
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
    background: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    borderRadius: 20,
    padding: 'clamp(20px, 4vw, 36px) clamp(16px, 3.5vw, 32px)',
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
    fontSize: 26,
    fontWeight: 900,
    color: 'var(--text-primary)',
    margin: '0 0 8px',
    letterSpacing: -0.4,
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
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.35)',
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
  twoColGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.6fr',
    gap: 14,
  },
  stepperBox: {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-input)',
    borderRadius: 10,
    padding: 4,
  },
  stepperBtn: {
    width: 38,
    height: 38,
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
    fontSize: 18,
    fontWeight: 800,
    borderRadius: 8,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    color: 'var(--text-primary)',
  },
  vehicleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
  },
  vehicleBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: '10px 4px',
    borderRadius: 10,
    border: '1.5px solid',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minHeight: 54,
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
    padding: '14px 24px',
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    border: 'none',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: 'var(--card-shadow)',
    marginTop: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
};
