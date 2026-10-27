import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const firstName = user?.fullName?.split(' ')[0] ?? 'Rider';

  return (
    <div style={styles.page}>
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
          <button style={styles.createBtn} disabled>
            + Create New Trip
          </button>
          <span style={styles.comingSoon}>AI itinerary generation coming soon</span>
        </div>

        <section style={styles.tripsSection}>
          <h2 style={styles.sectionTitle}>My Trips</h2>
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>🗺️</div>
            <p style={styles.emptyTitle}>No trips yet</p>
            <p style={styles.emptySub}>Create your first trip and let AI plan the perfect route for you.</p>
          </div>
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
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  brandIcon: {
    fontSize: '24px',
  },
  brandName: {
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '20px',
    letterSpacing: '0.5px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  userName: {
    color: '#cbd5e1',
    fontSize: '14px',
  },
  logoutBtn: {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#ffffff',
    padding: '6px 14px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  main: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '40px 16px',
  },
  welcome: {
    marginBottom: '32px',
  },
  welcomeTitle: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 6px',
  },
  welcomeSub: {
    color: '#6b7280',
    fontSize: '16px',
    margin: 0,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '40px',
  },
  createBtn: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #0f3460, #533483)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'not-allowed',
    opacity: 0.7,
  },
  comingSoon: {
    color: '#9ca3af',
    fontSize: '13px',
    fontStyle: 'italic',
  },
  tripsSection: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#111827',
    margin: '0 0 24px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
  },
  emptyIcon: {
    fontSize: '56px',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#374151',
    margin: '0 0 8px',
  },
  emptySub: {
    color: '#9ca3af',
    fontSize: '14px',
    margin: 0,
    maxWidth: '360px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
};

export default DashboardPage;
