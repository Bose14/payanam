import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { tripService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

interface TripPreview {
  id: string;
  title: string;
  from_place: string;
  to_place: string;
  days: number;
  bike_type: string;
  preferences?: string;
}

interface ConvoyLeader {
  fullName: string;
  avatarUrl?: string | null;
  bikeModel?: string | null;
  ridingStyle?: string | null;
  city?: string | null;
}

interface StopPreview {
  place: string;
  item_type: string;
  day_number: number;
}

const VEHICLE_ICONS: Record<string, string> = {
  motorcycle: '🏍️',
  scooter: '🛵',
  car: '🚗',
  bicycle: '🚲',
};

type PageState = 'loading' | 'preview' | 'requesting' | 'pending' | 'approved' | 'rejected' | 'error';

export default function JoinRoomPage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [preview, setPreview] = useState<TripPreview | null>(null);
  const [leader, setLeader] = useState<ConvoyLeader | null>(null);
  const [memberCount, setMemberCount] = useState<number>(1);
  const [stopsPreview, setStopsPreview] = useState<StopPreview[]>([]);
  const [tripId, setTripId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    if (!inviteCode) {
      setPageState('error');
      setErrorMsg('Invalid or missing invite code');
      return;
    }

    tripService.getRoomPreview(inviteCode)
      .then((data) => {
        const p = data.preview;
        const trip = p?.trips as TripPreview;
        setPreview(trip);
        setTripId(trip?.id ?? null);
        if (p?.leader) setLeader(p.leader as ConvoyLeader);
        if (typeof p?.memberCount === 'number') setMemberCount(p.memberCount);
        if (Array.isArray(p?.stopsPreview)) setStopsPreview(p.stopsPreview);

        // If user is already logged in, check if they can access the trip (already approved or owner)
        if (user && trip?.id) {
          tripService.getTripById(trip.id)
            .then(() => {
              setPageState('approved');
            })
            .catch(() => {
              setPageState('preview');
            });
        } else {
          setPageState('preview');
        }
      })
      .catch(() => {
        setPageState('error');
        setErrorMsg('Invite code is invalid or has expired.');
      });
  }, [inviteCode, user]);

  // Auto-polling when request is pending approval
  useEffect(() => {
    if (pageState === 'pending' && inviteCode && user) {
      pollTimerRef.current = setInterval(async () => {
        try {
          const res = await tripService.joinRoom(inviteCode);
          if (res?.memberStatus === 'approved') {
            const destTripId = res.room?.trips?.id ?? res.room?.trip_id ?? tripId;
            setPageState('approved');
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            if (destTripId) {
              showToastMsg('🎉 Request Approved! Opening convoy...');
              setTimeout(() => navigate(`/trips/${destTripId}`, { replace: true }), 1200);
            }
          } else if (res?.memberStatus === 'rejected') {
            setPageState('rejected');
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          }
        } catch { /* silent retry */ }
      }, 4000);
    }

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [pageState, inviteCode, user, tripId, navigate]);

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
        showToastMsg('Request sent! Awaiting leader confirmation.');
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

  const shareUrl = window.location.href;

  const handleCopyCode = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      showToastMsg('📋 Convoy code copied!');
    } catch {
      showToastMsg('Failed to copy code');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToastMsg('🔗 Invite link copied!');
    } catch {
      showToastMsg('Failed to copy link');
    }
  };

  const handleWhatsAppShare = () => {
    const text = `🏍️ Join our motorcycle convoy on Payanam!\n\n🗺️ Route: ${preview?.from_place ?? 'Route'} ➔ ${preview?.to_place ?? 'Destination'} (${preview?.days ?? 1} Days)\n🎟️ Convoy Code: ${inviteCode}\n\nJoin our convoy here:\n${shareUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const vehicleIcon = VEHICLE_ICONS[preview?.bike_type?.toLowerCase() ?? 'motorcycle'] ?? '🏍️';

  return (
    <div style={styles.page}>
      {user ? <Navbar /> : (
        <header style={styles.header}>
          <Link to="/" style={styles.brand}>
            <span style={{ fontSize: 24 }}>🏍️</span>
            <span style={styles.brandTitle}>PAYANAM</span>
          </Link>
          <Link to={`/login?redirect=/join/${inviteCode}`} style={styles.loginBtn}>
            Sign In
          </Link>
        </header>
      )}

      {/* Floating Toast */}
      {toast && (
        <div style={styles.toast}>
          {toast}
        </div>
      )}

      <main className="responsive-page-container" style={styles.container}>
        {/* Loading State */}
        {pageState === 'loading' && (
          <div className="responsive-card" style={styles.card}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h2 style={styles.title}>Verifying Convoy Code...</h2>
            <p style={styles.subtitle}>Looking up expedition details, leader information, and route waypoints.</p>
          </div>
        )}

        {/* Error State */}
        {pageState === 'error' && (
          <div className="responsive-card" style={styles.card}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={styles.title}>Convoy Pass Not Found</h2>
            <p style={{ color: '#ef4444', fontSize: 15, margin: '8px 0 24px', lineHeight: 1.5, fontWeight: 700 }}>
              {errorMsg}
            </p>
            <Link to="/dashboard" style={styles.btnPrimary}>
              ← Back to Dashboard
            </Link>
          </div>
        )}

        {/* Pending Approval State */}
        {pageState === 'pending' && (
          <div className="responsive-card" style={styles.card}>
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
              <div style={{ fontSize: 50 }}>⏳</div>
              <div style={styles.pulseDot} />
            </div>

            <div style={styles.pendingBadge}>● Waiting for Convoy Leader</div>
            <h2 style={styles.title}>Request Sent!</h2>
            <p style={styles.subtitle}>
              Your request to join <strong>{preview?.title}</strong> is awaiting approval from the convoy leader.
            </p>

            <div style={styles.infoNotice}>
              <span>⚡</span>
              <span>This screen automatically updates the instant the leader approves you. Keep this tab open or return whenever ready!</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
              <button onClick={handleWhatsAppShare} style={styles.btnWhatsApp}>
                <span>💬</span>
                <span>Ping Leader on WhatsApp</span>
              </button>
              <Link to="/dashboard" style={styles.btnSecondary}>
                Return to Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* Approved State */}
        {pageState === 'approved' && (
          <div className="responsive-card" style={styles.card}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
            <div style={styles.approvedBadge}>✓ Convoy Co-Rider</div>
            <h2 style={styles.title}>You're in the Convoy!</h2>
            <p style={styles.subtitle}>
              You have official access to the live telemetry, GPS map, and expense splitting for <strong>{preview?.title}</strong>.
            </p>
            {tripId && (
              <Link to={`/trips/${tripId}`} style={styles.btnPrimary}>
                Open Convoy Mission Control ➔
              </Link>
            )}
          </div>
        )}

        {/* Rejected State */}
        {pageState === 'rejected' && (
          <div className="responsive-card" style={styles.card}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
            <h2 style={styles.title}>Join Request Declined</h2>
            <p style={styles.subtitle}>
              The convoy leader declined your request to join this expedition.
            </p>
            <Link to="/dashboard" style={styles.btnPrimary}>
              Back to Dashboard
            </Link>
          </div>
        )}

        {/* Preview State */}
        {(pageState === 'preview' || pageState === 'requesting') && preview && (
          <div className="responsive-card" style={styles.card}>
            {/* Top Pass Header */}
            <div style={styles.passHeader}>
              <div style={styles.inviteTag}>
                <span>🎟️ CONVOY TRAVEL PASS</span>
              </div>
              <div style={styles.codePill} onClick={handleCopyCode} title="Click to copy code">
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>CODE:</span>
                <span style={{ fontWeight: 900, letterSpacing: 1.5, color: 'var(--accent-gold)' }}>{inviteCode}</span>
                <span style={{ fontSize: 12 }}>📋</span>
              </div>
            </div>

            <div style={{ fontSize: 42, margin: '14px 0 6px' }}>{vehicleIcon}</div>
            <h2 style={styles.title}>{preview.title}</h2>

            {/* Route Visualizer Card */}
            <div style={styles.routeContainer}>
              <div style={styles.routePoint}>
                <span style={{ color: '#10b981', fontSize: 16 }}>🟢</span>
                <div>
                  <div style={styles.routeLabel}>Origin</div>
                  <div style={styles.routePlace}>{preview.from_place}</div>
                </div>
              </div>

              <div style={styles.routeConnector}>
                <div style={styles.routeLine} />
                <span style={styles.routeArrow}>➔</span>
              </div>

              <div style={styles.routePoint}>
                <span style={{ color: '#ef4444', fontSize: 16 }}>🏁</span>
                <div>
                  <div style={styles.routeLabel}>Destination</div>
                  <div style={styles.routePlace}>{preview.to_place}</div>
                </div>
              </div>
            </div>

            {/* Leader Spotlight */}
            {leader && (
              <div style={styles.leaderCard}>
                <div style={styles.leaderAvatar}>
                  {leader.avatarUrl ? (
                    <img src={leader.avatarUrl} alt={leader.fullName} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                  ) : (
                    <span>{(leader.fullName || 'L')[0].toUpperCase()}</span>
                  )}
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>{leader.fullName}</span>
                    <span style={styles.leadBadge}>👑 Lead</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {leader.bikeModel && <span>🏍️ {leader.bikeModel}</span>}
                    {leader.city && <span>📍 {leader.city}</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Key Convoy Metrics Grid */}
            <div style={styles.statsGrid}>
              <div style={styles.statBox}>
                <span style={styles.statBoxLabel}>Duration</span>
                <span style={styles.statBoxVal}>{preview.days} {preview.days === 1 ? 'Day' : 'Days'}</span>
              </div>
              <div style={styles.statBox}>
                <span style={styles.statBoxLabel}>Convoy Strength</span>
                <span style={styles.statBoxVal}>👥 {memberCount} {memberCount === 1 ? 'Rider' : 'Riders'}</span>
              </div>
              <div style={styles.statBox}>
                <span style={styles.statBoxLabel}>Vehicle Type</span>
                <span style={styles.statBoxVal}>{preview.bike_type}</span>
              </div>
            </div>

            {/* Itinerary Waypoints Preview */}
            {stopsPreview.length > 0 && (
              <div style={styles.stopsSection}>
                <div style={styles.stopsHeader}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    📍 Planned Waypoints Preview
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stopsPreview.length} stops</span>
                </div>
                <div style={styles.stopsList}>
                  {stopsPreview.map((stop, idx) => (
                    <div key={idx} style={styles.stopChip}>
                      <span style={styles.stopIndex}>{idx + 1}</span>
                      <span style={styles.stopName}>{stop.place}</span>
                      <span style={styles.stopDay}>Day {stop.day_number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {user ? (
              <div style={{ marginTop: 20 }}>
                <button
                  onClick={handleRequestJoin}
                  disabled={pageState === 'requesting'}
                  style={{
                    ...styles.btnPrimary,
                    opacity: pageState === 'requesting' ? 0.7 : 1,
                    cursor: pageState === 'requesting' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {pageState === 'requesting' ? '⏳ Requesting Entry...' : '✉️ Request to Join Convoy'}
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 20 }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
                  Sign in or create a free rider account to join this convoy:
                </p>
                <Link to={`/login?redirect=/join/${inviteCode}`} style={styles.btnPrimary}>
                  Sign In to Join ➔
                </Link>
              </div>
            )}

            {/* Quick Share Strip */}
            <div style={styles.shareStrip}>
              <button onClick={handleWhatsAppShare} style={styles.shareBtn} title="Share on WhatsApp">
                <span>💬</span>
                <span>WhatsApp</span>
              </button>
              <button onClick={() => setShowQrModal(true)} style={styles.shareBtn} title="View Scannable QR Pass">
                <span>📱</span>
                <span>QR Pass</span>
              </button>
              <button onClick={handleCopyLink} style={styles.shareBtn} title="Copy Link">
                <span>🔗</span>
                <span>Copy Link</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* QR Code Pass Modal */}
      {showQrModal && (
        <div style={styles.modalOverlay} onClick={() => setShowQrModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--text-primary)' }}>
                  🎟️ Convoy QR Pass
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                  Scan with any camera to open this convoy
                </p>
              </div>
              <button onClick={() => setShowQrModal(false)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={styles.qrContainer}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(shareUrl)}`}
                alt="Convoy QR Code"
                style={styles.qrImage}
              />
            </div>

            <div style={styles.qrCodeBox}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Convoy Invite Code</span>
              <strong style={{ fontSize: 20, letterSpacing: 2, color: 'var(--accent-gold)' }}>{inviteCode}</strong>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={handleCopyLink} style={styles.btnPrimary}>
                📋 Copy Link
              </button>
              <button onClick={() => setShowQrModal(false)} style={styles.btnSecondary}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-page)',
    color: 'var(--text-primary)',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    display: 'flex',
    flexDirection: 'column',
    transition: 'background-color 0.3s ease, color 0.3s ease',
  },
  header: {
    padding: '0 24px',
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--border-nav)',
    background: 'var(--bg-nav)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    textDecoration: 'none',
  },
  brandTitle: {
    color: 'var(--text-primary)',
    fontWeight: 900,
    fontSize: 18,
    letterSpacing: 1.5,
  },
  loginBtn: {
    padding: '7px 16px',
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-card)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    textDecoration: 'none',
  },
  container: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '30px 16px 60px',
  },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    borderRadius: 24,
    padding: 'clamp(24px, 5vw, 36px) clamp(16px, 4vw, 28px)',
    width: '100%',
    maxWidth: 480,
    boxShadow: 'var(--card-shadow)',
    textAlign: 'center',
  },
  passHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  inviteTag: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'var(--accent-gold-bg)',
    border: '1px solid var(--accent-gold)',
    color: 'var(--accent-gold)',
    fontSize: 11,
    fontWeight: 800,
    padding: '4px 10px',
    borderRadius: 999,
    letterSpacing: 0.8,
  },
  codePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-subtle)',
    padding: '4px 10px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 900,
    color: 'var(--text-primary)',
    margin: '0 0 14px',
    letterSpacing: -0.3,
    lineHeight: 1.3,
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: 14,
    margin: '0 0 18px',
    lineHeight: 1.5,
  },
  routeContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 14,
    padding: '12px 14px',
    marginBottom: 14,
    textAlign: 'left',
  },
  routePoint: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  routeLabel: {
    fontSize: 10,
    color: 'var(--text-muted)',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  routePlace: {
    fontSize: 13,
    fontWeight: 800,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  routeConnector: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '0 8px',
    color: 'var(--accent-gold)',
  },
  routeLine: {
    width: 20,
    height: 2,
    background: 'var(--border-card)',
  },
  routeArrow: {
    fontSize: 14,
    fontWeight: 900,
  },
  leaderCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 12,
    padding: '10px 14px',
    marginBottom: 14,
  },
  leaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'var(--accent-gold-bg)',
    border: '2px solid var(--accent-gold)',
    color: 'var(--accent-gold)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: 16,
    flexShrink: 0,
  },
  leadBadge: {
    fontSize: 10,
    fontWeight: 800,
    background: 'var(--accent-gold-bg)',
    color: 'var(--accent-gold)',
    border: '1px solid var(--accent-gold)',
    borderRadius: 6,
    padding: '1px 6px',
    textTransform: 'uppercase',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
    marginBottom: 14,
  },
  statBox: {
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 10,
    padding: '8px 10px',
    textAlign: 'center',
  },
  statBoxLabel: {
    display: 'block',
    fontSize: 10,
    color: 'var(--text-muted)',
    fontWeight: 700,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statBoxVal: {
    fontSize: 13,
    fontWeight: 800,
    color: 'var(--text-primary)',
    textTransform: 'capitalize',
  },
  stopsSection: {
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 12,
    padding: '10px 12px',
    marginBottom: 14,
    textAlign: 'left',
  },
  stopsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stopsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  stopChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 6,
    padding: '5px 8px',
  },
  stopIndex: {
    fontWeight: 800,
    color: 'var(--accent-gold)',
    fontSize: 11,
    width: 16,
  },
  stopName: {
    flex: 1,
    fontWeight: 700,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  stopDay: {
    fontSize: 10,
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  shareStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTop: '1px solid var(--border-subtle)',
  },
  shareBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 6px',
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-card)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
  btnPrimary: {
    display: 'block',
    width: '100%',
    padding: '13px 20px',
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    border: 'none',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 800,
    textDecoration: 'none',
    boxShadow: 'var(--card-shadow)',
    cursor: 'pointer',
    boxSizing: 'border-box',
    textAlign: 'center',
  },
  btnSecondary: {
    display: 'block',
    width: '100%',
    padding: '11px 16px',
    background: 'var(--bg-subtle)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-card)',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    textDecoration: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
    textAlign: 'center',
  },
  btnWhatsApp: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    padding: '12px 18px',
    background: '#25D366',
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  pendingBadge: {
    display: 'inline-block',
    background: 'rgba(234, 88, 12, 0.15)',
    border: '1px solid rgba(234, 88, 12, 0.4)',
    color: '#ea580c',
    fontSize: 12,
    fontWeight: 800,
    padding: '4px 14px',
    borderRadius: 999,
    marginBottom: 12,
  },
  approvedBadge: {
    display: 'inline-block',
    background: 'var(--accent-green-bg)',
    border: '1px solid var(--accent-green)',
    color: 'var(--accent-green)',
    fontSize: 12,
    fontWeight: 800,
    padding: '4px 14px',
    borderRadius: 999,
    marginBottom: 12,
  },
  pulseDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: '#ea580c',
    boxShadow: '0 0 0 4px rgba(234, 88, 12, 0.3)',
  },
  infoNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--accent-cyan-bg)',
    border: '1px solid var(--accent-cyan)',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 12,
    color: 'var(--accent-cyan)',
    textAlign: 'left',
    marginBottom: 16,
    lineHeight: 1.4,
    fontWeight: 600,
  },
  toast: {
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    border: '1px solid var(--accent-gold)',
    borderRadius: 10,
    padding: '10px 20px',
    fontWeight: 700,
    fontSize: 14,
    boxShadow: 'var(--card-shadow)',
    zIndex: 9999,
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 10000,
  },
  modalCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    textAlign: 'center',
    boxShadow: 'var(--card-shadow)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    textAlign: 'left',
  },
  closeBtn: {
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-card)',
    color: 'var(--text-primary)',
    borderRadius: '50%',
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 14,
  },
  qrContainer: {
    background: '#ffffff',
    borderRadius: 16,
    padding: 16,
    display: 'inline-block',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    marginBottom: 16,
  },
  qrImage: {
    width: 220,
    height: 220,
    display: 'block',
  },
  qrCodeBox: {
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 10,
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
};
