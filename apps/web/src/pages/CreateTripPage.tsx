import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { tripService } from '../services/api';
import PlaceInput from '../components/PlaceInput';

function CreateTripPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    from_place: '',
    to_place: '',
    days: 3,
    bike_type: 'motorcycle',
    preferences: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name === 'days' ? Number(value) : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await tripService.createTrip(form);
      navigate(`/trips/${result.trip.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate itinerary');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.headerBar}>
          <Link to="/dashboard" style={styles.back}>← Back</Link>
          <div style={styles.logo}>🏍️</div>
          <h1 style={styles.appName}>Payanam</h1>
        </div>

        <h2 style={styles.title}>Plan Your Trip</h2>
        <p style={styles.subtitle}>Let AI create the perfect route for your adventure</p>

        {error && <div style={styles.errorBox}>⚠️ {error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>From</label>
              <PlaceInput
                value={form.from_place}
                onChange={(v) => setForm((f) => ({ ...f, from_place: v }))}
                placeholder="e.g. Mumbai"
              />
            </div>
            <div style={styles.fieldArrow}>→</div>
            <div style={styles.field}>
              <label style={styles.label}>To</label>
              <PlaceInput
                value={form.to_place}
                onChange={(v) => setForm((f) => ({ ...f, to_place: v }))}
                placeholder="e.g. Goa"
              />
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Number of Days</label>
              <input
                type="number"
                name="days"
                value={form.days}
                onChange={handleChange}
                min={1}
                max={30}
                required
                style={styles.input}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Vehicle Type</label>
              <select name="bike_type" value={form.bike_type} onChange={handleChange} style={styles.input}>
                <option value="motorcycle">Motorcycle</option>
                <option value="scooter">Scooter</option>
                <option value="bicycle">Bicycle</option>
                <option value="car">Car</option>
              </select>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Preferences (optional)</label>
            <textarea
              name="preferences"
              value={form.preferences}
              onChange={handleChange}
              placeholder="e.g. avoid highways, prefer coastal roads, vegetarian food..."
              rows={3}
              style={{ ...styles.input, resize: 'vertical' }}
            />
          </div>

          <button type="submit" disabled={loading} style={loading ? { ...styles.btn, ...styles.btnDisabled } : styles.btn}>
            {loading ? (
              <span>⏳ AI is planning your trip...</span>
            ) : (
              <span>🤖 Generate Itinerary with AI</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  },
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '40px 36px',
    width: '100%',
    maxWidth: '540px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  headerBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '28px',
  },
  back: {
    color: '#6b7280',
    textDecoration: 'none',
    fontSize: '14px',
    marginRight: 'auto',
  },
  logo: { fontSize: '28px', lineHeight: 1 },
  appName: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1a1a2e',
    margin: 0,
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 6px',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: '14px',
    margin: '0 0 24px',
  },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '14px',
    marginBottom: '16px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  row: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
  },
  fieldArrow: {
    paddingBottom: '10px',
    color: '#9ca3af',
    fontSize: '18px',
    fontWeight: 300,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1,
  },
  label: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
  },
  input: {
    padding: '10px 14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '15px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'system-ui, sans-serif',
  },
  btn: {
    marginTop: '4px',
    padding: '13px',
    background: 'linear-gradient(135deg, #0f3460, #533483)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
};

export default CreateTripPage;
