import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { tripService } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface TripPreview {
  id: string;
  title: string;
  from_place: string;
  to_place: string;
  days: number;
  bike_type: string;
}

type PageState = 'loading' | 'preview' | 'requesting' | 'pending' | 'approved' | 'rejected' | 'error';

function JoinRoomPage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [preview, setPreview] = useState<TripPreview | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!inviteCode) { setPageState('error'); setErrorMsg('Invalid invite link'); return; }

    tripService.getRoomPreview(inviteCode)
      .then((data) => {
        const trip = data.preview?.trips as TripPreview;
        setPreview(trip);
        setTripId(trip?.id ?? null);
        setPageState('preview');
      })
      .catch(() => { setPageState('error'); setErrorMsg('Invite link is invalid or has expired'); });
  }, [inviteCode]);

  const handleRequestJoin = async () => {
    if (!inviteCode) return;

    if (!user) {
      navigate(`/login?redirect=/join/${inviteCode}`);
      return;
    }

    setPageState('requesting');
    try {
      const data = await tripService.joinRoom(inviteCode);
      const status = data.memberStatus as string;
      const roomTripId = data.room?.trips?.id ?? data.room?.trip_id ?? tripId;

      if (status === 'approved') {
        if (roomTripId) navigate(`/trips/${roomTripId}`, { replace: true });
        else setPageState('approved');
      } else if (status === 'pending') {
        setPageState('pending');
      } else if (status === 'rejected') {
        setPageState('rejected');
      } else {
        setPageState('pending');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setErrorMsg(msg);
      setPageState('error');
    }
  };

  if (pageState === 'loading') {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.icon}>⏳</div>
          <p style={s.subtitle}>Loading trip details...</p>
        </div>
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.icon}>❌</div>
          <h2 style={s.title}>Link Error</h2>
          <p style={{ color: '#dc2626', fontSize: 15, marginBottom: 24 }}>{errorMsg}</p>
          <Link to="/dashboard" style={s.btnPrimary}>Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  if (pageState === 'pending') {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.icon}>⏳</div>
          <h2 style={s.title}>Request Sent!</h2>
          <p style={s.subtitle}>Your request to join <strong>{preview?.title}</strong> has been sent to the trip leader.</p>
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>You'll be able to view the trip once they approve your request.</p>
          <Link to="/dashboard" style={s.btnPrimary}>Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  if (pageState === 'approved') {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.icon}>✅</div>
          <h2 style={s.title}>You're In!</h2>
          <p style={s.subtitle}>You're already an approved member of this trip.</p>
          {tripId && <Link to={`/trips/${tripId}`} style={s.btnPrimary}>View Trip</Link>}
        </div>
      </div>
    );
  }

  if (pageState === 'rejected') {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.icon}>🚫</div>
          <h2 style={s.title}>Request Declined</h2>
          <p style={s.subtitle}>The trip leader has declined your request to join this trip.</p>
          <Link to="/dashboard" style={s.btnPrimary}>Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  // preview state
  return (
    <div style={s.page}>
      <header style={s.header}>
        <span style={{ fontSize: 22 }}>🏍️</span>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>Payanam</span>
      </header>

      <div style={s.card}>
        <div style={s.badge}>Trip Invite</div>
        <div style={s.icon}>🗺️</div>
        <h2 style={s.title}>{preview?.title}</h2>

        <div style={s.detailsGrid}>
          <div style={s.detailItem}>
            <span style={s.detailLabel}>From</span>
            <span style={s.detailValue}>{preview?.from_place}</span>
          </div>
          <div style={s.detailItem}>
            <span style={s.detailLabel}>To</span>
            <span style={s.detailValue}>{preview?.to_place}</span>
          </div>
          <div style={s.detailItem}>
            <span style={s.detailLabel}>Duration</span>
            <span style={s.detailValue}>{preview?.days} days</span>
          </div>
          <div style={s.detailItem}>
            <span style={s.detailLabel}>Bike</span>
            <span style={{ ...s.detailValue, textTransform: 'capitalize' }}>{preview?.bike_type}</span>
          </div>
        </div>

        <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 24, fontSize: 14, color: '#78350f' }}>
          🔑 Submitting a request will notify the trip leader for approval.
        </div>

        {user ? (
          <button
            onClick={handleRequestJoin}
            disabled={pageState === 'requesting'}
            style={{ ...s.btnPrimary, opacity: pageState === 'requesting' ? 0.6 : 1, cursor: pageState === 'requesting' ? 'not-allowed' : 'pointer', display: 'block', width: '100%', textAlign: 'center', textDecoration: 'none' }}
          >
            {pageState === 'requesting' ? '⏳ Sending request...' : '✉️ Request to Join'}
          </button>
        ) : (
          <div>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 12, textAlign: 'center' }}>You need to be logged in to request joining.</p>
            <Link to={`/login?redirect=/join/${inviteCode}`} style={{ ...s.btnPrimary, display: 'block', textAlign: 'center', textDecoration: 'none' }}>
              Login to Request
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 60%, #533483 100%)',
    fontFamily: 'system-ui, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  header: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '16px 24px',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '40px 32px',
    maxWidth: 440,
    width: 'calc(100% - 32px)',
    marginTop: 40,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    textAlign: 'center',
  },
  badge: {
    display: 'inline-block',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: 700,
    padding: '4px 12px',
    borderRadius: 20,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 8px' },
  subtitle: { color: '#6b7280', fontSize: 15, margin: '0 0 24px', lineHeight: 1.5 },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginBottom: 24,
    textAlign: 'left',
  },
  detailItem: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  detailLabel: { fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 14, color: '#111827', fontWeight: 600 },
  btnPrimary: {
    padding: '13px 24px',
    background: 'linear-gradient(135deg, #0f3460, #533483)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
  },
};

export default JoinRoomPage;
