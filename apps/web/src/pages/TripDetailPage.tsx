import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { tripService } from '../services/api';

const typeIcons: Record<string, string> = {
  fuel_stop: '⛽',
  stay: '🏨',
  attraction: '📍',
  meal: '🍽️',
  rest: '☕',
  stop: '📌',
};

interface Stop {
  id: string;
  place: string;
  item_type: string;
  description: string;
  estimated_km: number;
  duration_hours: number;
  tips: string;
  day_number: number;
  order_index: number;
}

interface Trip {
  id: string;
  title: string;
  from_place: string;
  to_place: string;
  days: number;
  bike_type: string;
  status: string;
  itinerary: Stop[];
  rooms?: Array<{ id: string; invite_code: string }>;
}

function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [openDay, setOpenDay] = useState<number>(1);

  useEffect(() => {
    if (!id) return;
    tripService.getTripById(id)
      .then((data) => setTrip(data.trip))
      .catch((err) => setError(err.message ?? 'Failed to load trip'))
      .finally(() => setLoading(false));
  }, [id]);

  const inviteCode = trip?.rooms?.[0]?.invite_code;
  const shareUrl = inviteCode ? `${window.location.origin}/join/${inviteCode}` : null;

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const groupedByDay = trip?.itinerary.reduce<Record<number, Stop[]>>((acc, stop) => {
    if (!acc[stop.day_number]) acc[stop.day_number] = [];
    acc[stop.day_number].push(stop);
    return acc;
  }, {}) ?? {};

  if (loading) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner}>⏳</div>
        <p style={styles.loadingText}>Loading trip details...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#dc2626' }}>{error || 'Trip not found'}</p>
        <Link to="/dashboard">← Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brand}>
          <span>🏍️</span>
          <span style={styles.brandName}>Payanam</span>
        </div>
        <Link to="/dashboard" style={styles.backLink}>← Dashboard</Link>
      </header>

      <main style={styles.main}>
        <div style={styles.tripHeader}>
          <div>
            <h1 style={styles.tripTitle}>{trip.title}</h1>
            <p style={styles.tripMeta}>
              {trip.from_place} → {trip.to_place} · {trip.days} days · {trip.bike_type}
            </p>
          </div>
          <div style={styles.tripActions}>
            {shareUrl && (
              <button onClick={handleCopy} style={styles.shareBtn}>
                {copied ? '✅ Copied!' : '🔗 Share Trip'}
              </button>
            )}
          </div>
        </div>

        {inviteCode && (
          <div style={styles.inviteBanner}>
            <span>📨 Invite code: <strong>{inviteCode}</strong></span>
            <span style={styles.inviteHint}>Share this link with your fellow riders</span>
          </div>
        )}

        <section style={styles.itinerarySection}>
          <h2 style={styles.sectionTitle}>Itinerary</h2>

          {Array.from({ length: trip.days }, (_, i) => i + 1).map((day) => {
            const stops = groupedByDay[day] ?? [];
            const isOpen = openDay === day;
            return (
              <div key={day} style={styles.dayCard}>
                <button
                  style={styles.dayHeader}
                  onClick={() => setOpenDay(isOpen ? 0 : day)}
                >
                  <span style={styles.dayLabel}>Day {day}</span>
                  {stops.length > 0 && (
                    <span style={styles.dayStops}>{stops.length} stops</span>
                  )}
                  <span style={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div style={styles.stopsContainer}>
                    {stops.length === 0 ? (
                      <p style={styles.noStops}>No stops for this day</p>
                    ) : (
                      stops.map((stop, idx) => (
                        <div key={stop.id} style={styles.stopRow}>
                          <div style={styles.stopConnector}>
                            <div style={styles.stopDot}>{typeIcons[stop.item_type] ?? '📌'}</div>
                            {idx < stops.length - 1 && <div style={styles.stopLine} />}
                          </div>
                          <div style={styles.stopContent}>
                            <div style={styles.stopPlaceRow}>
                              <span style={styles.stopPlace}>{stop.place}</span>
                              <span style={styles.stopType}>{stop.item_type.replace('_', ' ')}</span>
                            </div>
                            {stop.description && (
                              <p style={styles.stopDesc}>{stop.description}</p>
                            )}
                            <div style={styles.stopMeta}>
                              {stop.estimated_km > 0 && <span>🛣️ {stop.estimated_km}km</span>}
                              {stop.duration_hours > 0 && <span>⏱️ {stop.duration_hours}h</span>}
                            </div>
                            {stop.tips && (
                              <div style={styles.tipBox}>💡 {stop.tips}</div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f5f7fa',
    fontFamily: 'system-ui, sans-serif',
  },
  center: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
  },
  spinner: { fontSize: '40px' },
  loadingText: { color: '#6b7280', fontSize: '16px' },
  header: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
    padding: '0 24px',
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { display: 'flex', alignItems: 'center', gap: '8px' },
  brandName: { color: '#fff', fontWeight: 700, fontSize: '20px' },
  backLink: { color: '#cbd5e1', fontSize: '14px', textDecoration: 'none' },
  main: { maxWidth: '800px', margin: '0 auto', padding: '32px 16px' },
  tripHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  tripTitle: { fontSize: '26px', fontWeight: 700, color: '#111827', margin: '0 0 6px' },
  tripMeta: { color: '#6b7280', fontSize: '15px', margin: 0, textTransform: 'capitalize' },
  tripActions: { display: 'flex', gap: '10px' },
  shareBtn: {
    padding: '10px 18px',
    background: 'linear-gradient(135deg, #0f3460, #533483)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  inviteBanner: {
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '10px',
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '8px',
    fontSize: '14px',
    color: '#1e40af',
  },
  inviteHint: { color: '#60a5fa', fontSize: '13px' },
  itinerarySection: {},
  sectionTitle: { fontSize: '18px', fontWeight: 600, color: '#111827', margin: '0 0 16px' },
  dayCard: {
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    marginBottom: '12px',
    overflow: 'hidden',
  },
  dayHeader: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '16px 20px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '15px',
  },
  dayLabel: { fontWeight: 600, color: '#111827', flex: 1 },
  dayStops: {
    background: '#f3f4f6',
    color: '#6b7280',
    fontSize: '12px',
    padding: '2px 8px',
    borderRadius: '12px',
  },
  chevron: { color: '#9ca3af', fontSize: '12px' },
  stopsContainer: { padding: '8px 20px 20px' },
  noStops: { color: '#9ca3af', fontSize: '14px' },
  stopRow: { display: 'flex', gap: '12px', marginBottom: '4px' },
  stopConnector: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '28px',
    flexShrink: 0,
  },
  stopDot: { fontSize: '20px', lineHeight: 1, marginTop: '2px' },
  stopLine: {
    width: '2px',
    flex: 1,
    background: '#e5e7eb',
    margin: '4px 0',
    minHeight: '16px',
  },
  stopContent: {
    flex: 1,
    paddingBottom: '16px',
    borderBottom: '1px solid #f3f4f6',
  },
  stopPlaceRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' },
  stopPlace: { fontWeight: 600, color: '#111827', fontSize: '15px' },
  stopType: {
    fontSize: '11px',
    color: '#6b7280',
    background: '#f3f4f6',
    padding: '2px 8px',
    borderRadius: '10px',
    textTransform: 'capitalize',
  },
  stopDesc: { color: '#374151', fontSize: '14px', margin: '0 0 6px' },
  stopMeta: { display: 'flex', gap: '12px', fontSize: '13px', color: '#6b7280', marginBottom: '4px' },
  tipBox: {
    background: '#fefce8',
    border: '1px solid #fde68a',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '13px',
    color: '#92400e',
  },
};

export default TripDetailPage;
