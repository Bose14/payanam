import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { tripService } from '../services/api';

interface Trip {
  id: string;
  title: string;
  from_place: string;
  to_place: string;
  days: number;
  bike_type: string;
  status: string;
  created_at: string;
  isOwner?: boolean;
  isJoined?: boolean;
}

function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTrip, setConfirmTrip] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    tripService.getUserTrips()
      .then((data) => setTrips(data.trips))
      .catch(() => setTrips([]))
      .finally(() => setTripsLoading(false));
  }, []);

  const handleDeleteConfirm = async () => {
    if (!confirmTrip) return;
    setDeletingId(confirmTrip.id);
    setConfirmTrip(null);
    try {
      await tripService.deleteTrip(confirmTrip.id);
      setTrips(prev => prev.filter(t => t.id !== confirmTrip.id));
    } catch {
      // silent — could add a toast here
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const firstName = user?.fullName?.split(' ')[0] ?? 'Rider';

  return (
    <div style={styles.page}>
      {/* Delete confirmation modal */}
      {confirmTrip && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '32px 28px', maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Delete Trip?</h3>
            <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
              "<strong>{confirmTrip.title}</strong>" will be permanently deleted along with its itinerary and room.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmTrip(null)} style={{ flex: 1, padding: '11px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                Cancel
              </button>
              <button onClick={handleDeleteConfirm} style={{ flex: 1, padding: '11px', background: '#dc2626', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff' }}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
      <header style={styles.header}>
        <div style={styles.brand}>
          <span style={styles.brandIcon}>🏍️</span>
          <span style={styles.brandName}>Payanam</span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.userName}>{user?.fullName}</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Sign out
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.welcome}>
          <h1 style={styles.welcomeTitle}>Welcome back, {firstName}! 🏕️</h1>
          <p style={styles.welcomeSub}>Ready to plan your next adventure?</p>
        </div>

        <div style={styles.actions}>
          <Link to="/trips/new" style={styles.createBtn}>
            + Create New Trip
          </Link>
        </div>

        <section style={styles.tripsSection}>
          <h2 style={styles.sectionTitle}>My Trips</h2>

          {tripsLoading ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>⏳</div>
              <p style={styles.emptyTitle}>Loading trips...</p>
            </div>
          ) : trips.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🗺️</div>
              <p style={styles.emptyTitle}>No trips yet</p>
              <p style={styles.emptySub}>Create your first trip and let AI plan the perfect route for you.</p>
            </div>
          ) : (
            <div style={styles.tripGrid}>
              {trips.map((trip) => (
                <div key={trip.id} style={{ position: 'relative' }}>
                  <Link to={`/trips/${trip.id}`} style={styles.tripCard}>
                    <div style={styles.tripCardHeader}>
                      <span style={styles.tripIcon}>🏍️</span>
                      <span style={{ ...styles.statusBadge, background: trip.isJoined ? '#d1fae5' : '#dbeafe', color: trip.isJoined ? '#065f46' : '#1d4ed8' }}>
                    {trip.isJoined ? 'Co-rider' : (trip.status ?? 'active')}
                  </span>
                    </div>
                    <h3 style={styles.tripTitle}>{trip.title}</h3>
                    <p style={styles.tripRoute}>{trip.from_place} → {trip.to_place}</p>
                    <div style={styles.tripFooter}>
                      <span style={styles.tripMeta}>{trip.days} days</span>
                      <span style={styles.tripMeta}>{trip.bike_type}</span>
                    </div>
                  </Link>
                  {!trip.isJoined && (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmTrip({ id: trip.id, title: trip.title }); }}
                      disabled={deletingId === trip.id}
                      title="Delete trip"
                      style={{ position: 'absolute', bottom: 12, right: 12, background: '#fee2e2', border: 'none', color: '#dc2626', borderRadius: 6, padding: '5px 8px', fontSize: 16, cursor: 'pointer', opacity: deletingId === trip.id ? 0.4 : 1, lineHeight: 1 }}
                    >
                      {deletingId === trip.id ? '⏳' : '🗑️'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
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
  header: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
    padding: '0 24px',
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { display: 'flex', alignItems: 'center', gap: '8px' },
  brandIcon: { fontSize: '24px' },
  brandName: { color: '#ffffff', fontWeight: 700, fontSize: '20px', letterSpacing: '0.5px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '16px' },
  userName: { color: '#cbd5e1', fontSize: '14px' },
  logoutBtn: {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#ffffff',
    padding: '6px 14px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  main: { maxWidth: '900px', margin: '0 auto', padding: '40px 16px' },
  welcome: { marginBottom: '32px' },
  welcomeTitle: { fontSize: '28px', fontWeight: 700, color: '#111827', margin: '0 0 6px' },
  welcomeSub: { color: '#6b7280', fontSize: '16px', margin: 0 },
  actions: { marginBottom: '40px' },
  createBtn: {
    display: 'inline-block',
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #0f3460, #533483)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
  },
  tripsSection: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  sectionTitle: { fontSize: '18px', fontWeight: 600, color: '#111827', margin: '0 0 24px' },
  emptyState: { textAlign: 'center', padding: '48px 24px' },
  emptyIcon: { fontSize: '56px', marginBottom: '16px' },
  emptyTitle: { fontSize: '18px', fontWeight: 600, color: '#374151', margin: '0 0 8px' },
  emptySub: {
    color: '#9ca3af',
    fontSize: '14px',
    margin: 0,
    maxWidth: '360px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  tripGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '16px',
  },
  tripCard: {
    display: 'block',
    padding: '20px',
    background: '#f9fafb',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    textDecoration: 'none',
    transition: 'box-shadow 0.2s',
  },
  tripCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  tripIcon: { fontSize: '24px' },
  statusBadge: {
    fontSize: '11px',
    background: '#dbeafe',
    color: '#1d4ed8',
    padding: '2px 8px',
    borderRadius: '10px',
    textTransform: 'capitalize',
  },
  tripTitle: { fontSize: '15px', fontWeight: 600, color: '#111827', margin: '0 0 4px' },
  tripRoute: { fontSize: '13px', color: '#6b7280', margin: '0 0 12px' },
  tripFooter: { display: 'flex', gap: '8px' },
  tripMeta: {
    fontSize: '12px',
    background: '#f3f4f6',
    color: '#6b7280',
    padding: '2px 8px',
    borderRadius: '10px',
    textTransform: 'capitalize',
  },
};

export default DashboardPage;
