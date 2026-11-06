import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { tripService } from '../services/api';
import Navbar from '../components/Navbar';

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
  pendingRequestCount?: number;
}

const VEHICLE_ICONS: Record<string, string> = {
  motorcycle: '🏍️',
  scooter: '🛵',
  bicycle: '🚲',
  car: '🚗',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTrip, setConfirmTrip] = useState<{ id: string; title: string } | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'owned' | 'joined'>('all');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');

  useEffect(() => {
    let mounted = true;
    const fetchTrips = () => {
      tripService.getUserTrips()
        .then((data) => {
          if (mounted) setTrips(data.trips ?? []);
        })
        .catch(() => {
          if (mounted) setTrips([]);
        })
        .finally(() => {
          if (mounted) setTripsLoading(false);
        });
    };

    fetchTrips();
    const interval = setInterval(fetchTrips, 7000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleDeleteConfirm = async () => {
    if (!confirmTrip) return;
    setDeletingId(confirmTrip.id);
    const targetId = confirmTrip.id;
    setConfirmTrip(null);
    try {
      await tripService.deleteTrip(targetId);
      setTrips(prev => prev.filter(t => t.id !== targetId));
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  };

  const handleJoinWithCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;
    const clean = inviteCodeInput.trim().toUpperCase();
    setInviteModalOpen(false);
    navigate(`/join/${clean}`);
  };

  const handlePasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const trimmed = text.trim();
        // If a full join link was copied e.g. https://.../join/9QDA6FP5 or ?code=9QDA6FP5
        const urlMatch = trimmed.match(/\/join\/([A-Za-z0-9_-]+)/i) || trimmed.match(/[?&]code=([A-Za-z0-9_-]+)/i);
        if (urlMatch && urlMatch[1]) {
          setInviteCodeInput(urlMatch[1].toUpperCase());
          return;
        }
        const codeMatch = trimmed.match(/[A-Za-z0-9]{4,12}/);
        if (codeMatch) {
          setInviteCodeInput(codeMatch[0].toUpperCase());
        } else {
          setInviteCodeInput(trimmed.slice(0, 12).toUpperCase());
        }
      }
    } catch {
      // clipboard access not permitted or unavailable
    }
  };

  const firstName = user?.fullName?.split(' ')[0] ?? 'Rider';

  const ownedCount = trips.filter(t => !t.isJoined).length;
  const joinedCount = trips.filter(t => t.isJoined).length;

  const filteredTrips = trips.filter(t => {
    if (filterTab === 'owned') return !t.isJoined;
    if (filterTab === 'joined') return t.isJoined;
    return true;
  });

  return (
    <div style={styles.page}>
      <Navbar />

      {/* Delete Confirmation Modal */}
      {confirmTrip && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              Delete Trip?
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
              Are you sure you want to delete "<strong>{confirmTrip.title}</strong>"? The route, itinerary, and expense records will be permanently removed.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmTrip(null)}
                style={styles.btnSecondary}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                style={styles.btnDanger}
              >
                Yes, Delete Trip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Convoy Modal */}
      {inviteModalOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                🔑 Enter Convoy Invite Code
              </h3>
              <button onClick={() => setInviteModalOpen(false)} style={styles.closeBtn}>✕</button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--text-secondary)' }}>
              Paste or type the invite code shared by the trip organizer:
            </p>
            <form onSubmit={handleJoinWithCode}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="e.g. TRP89X"
                  value={inviteCodeInput}
                  onChange={e => setInviteCodeInput(e.target.value.toUpperCase())}
                  style={{ ...styles.codeInput, flex: 1 }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handlePasteCode}
                  title="Paste from clipboard"
                  style={styles.quickJoinPasteBtn}
                >
                  📋 Paste
                </button>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  style={styles.btnSecondary}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!inviteCodeInput.trim()}
                  style={{
                    ...styles.btnPrimary,
                    flex: 1,
                    opacity: !inviteCodeInput.trim() ? 0.6 : 1,
                  }}
                >
                  Join Convoy →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <main className="responsive-page-container" style={styles.main}>
        {/* Hero Section */}
        <div className="responsive-hero" style={styles.heroBanner}>
          <div style={{ flex: 1, minWidth: 'min(100%, 260px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>🏕️</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                Rider Command Center
              </span>
            </div>
            <h1 style={styles.heroTitle}>Welcome back, {firstName}!</h1>
            <p style={styles.heroSubtitle}>
              Plan AI-optimized motorcycle routes, manage convoy telemetry, and split road trip expenses in real time.
            </p>

            {/* Quick stats pills */}
            <div style={styles.statsRow}>
              <div style={styles.statPill}>
                <span style={{ fontSize: 14 }}>🗺️</span>
                <span style={styles.statLabel}>Total Trips:</span>
                <strong style={styles.statValue}>{trips.length}</strong>
              </div>
              <div style={styles.statPill}>
                <span style={{ fontSize: 14 }}>👑</span>
                <span style={styles.statLabel}>Lead:</span>
                <strong style={styles.statValue}>{ownedCount}</strong>
              </div>
              <div style={styles.statPill}>
                <span style={{ fontSize: 14 }}>🤝</span>
                <span style={styles.statLabel}>Co-rider:</span>
                <strong style={styles.statValue}>{joinedCount}</strong>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="responsive-hero-actions" style={styles.heroActions}>
            <Link to="/trips/new" style={styles.btnCta}>
              <span style={{ fontSize: 18 }}>✨</span>
              <span>Plan New Trip</span>
            </Link>
            <button
              onClick={() => setInviteModalOpen(true)}
              style={styles.btnOutline}
            >
              <span style={{ fontSize: 16 }}>🔑</span>
              <span>Join with Code</span>
            </button>
          </div>
        </div>

        {/* Quick Join Convoy Strip for Mobile & Quick Access */}
        <div className="dashboard-quick-join" style={styles.quickJoinCard}>
          <div style={styles.quickJoinHeader}>
            <div style={styles.quickJoinBadge}>
              <span style={{ fontSize: 13 }}>🤝</span>
              <span>CONVOY ACCESS</span>
            </div>
            <h3 style={styles.quickJoinTitle}>Have a Convoy Invite Code?</h3>
            <p style={styles.quickJoinSubtitle}>
              Enter the code shared by your convoy leader to join routes, waypoints, and live telemetry
            </p>
          </div>

          <form onSubmit={handleJoinWithCode} className="dashboard-quick-join-form" style={styles.quickJoinForm}>
            <div className="quick-join-input-wrap" style={styles.quickJoinInputWrap}>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>🔑</span>
              <input
                type="text"
                placeholder="e.g. 9QDA6FP5"
                value={inviteCodeInput}
                onChange={e => setInviteCodeInput(e.target.value.toUpperCase())}
                style={styles.quickJoinInput}
                maxLength={12}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={handlePasteCode}
                title="Paste from clipboard"
                className="quick-join-paste-btn"
                style={styles.quickJoinPasteBtn}
              >
                📋 Paste
              </button>
            </div>
            <button
              type="submit"
              disabled={!inviteCodeInput.trim()}
              className="quick-join-submit-btn"
              style={{
                ...styles.btnPrimary,
                padding: '11px 20px',
                fontSize: 13,
                fontWeight: 800,
                opacity: !inviteCodeInput.trim() ? 0.6 : 1,
                cursor: !inviteCodeInput.trim() ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Join Convoy ➔
            </button>
          </form>
        </div>

        {/* Trips Hub Header & Filters */}
        <div className="dashboard-hub-header" style={styles.hubHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Your Expeditions & Convoys</h2>
            <p style={styles.sectionSubtitle}>
              Manage routes, day-by-day waypoints, and active ride sessions
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="dashboard-filter-tabs" style={styles.filterTabs}>
            <button
              onClick={() => setFilterTab('all')}
              className={`dashboard-filter-btn ${filterTab === 'all' ? 'active' : ''}`}
              style={{
                ...styles.filterBtn,
                background: filterTab === 'all' ? 'var(--btn-primary-bg)' : 'transparent',
                color: filterTab === 'all' ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
              }}
            >
              All ({trips.length})
            </button>
            <button
              onClick={() => setFilterTab('owned')}
              className={`dashboard-filter-btn ${filterTab === 'owned' ? 'active' : ''}`}
              style={{
                ...styles.filterBtn,
                background: filterTab === 'owned' ? 'var(--btn-primary-bg)' : 'transparent',
                color: filterTab === 'owned' ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
              }}
            >
              Lead ({ownedCount})
            </button>
            <button
              onClick={() => setFilterTab('joined')}
              className={`dashboard-filter-btn ${filterTab === 'joined' ? 'active' : ''}`}
              style={{
                ...styles.filterBtn,
                background: filterTab === 'joined' ? 'var(--btn-primary-bg)' : 'transparent',
                color: filterTab === 'joined' ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
              }}
            >
              Joined ({joinedCount})
            </button>
          </div>
        </div>

        {/* Trips Content */}
        {tripsLoading ? (
          <div style={styles.emptyCard}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
            <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', fontSize: 16 }}>
              Loading your expeditions...
            </p>
          </div>
        ) : filteredTrips.length === 0 ? (
          <div style={styles.emptyCard}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏍️</div>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
              {filterTab === 'all' ? 'No trips planned yet' : `No ${filterTab} trips found`}
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-secondary)', maxWidth: 400, marginInline: 'auto' }}>
              Create your first road trip and let AI plan fuel stops, food dhabas, scenic viewpoints, and stays!
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/trips/new" style={styles.btnPrimary}>
                + Plan Your First Road Trip
              </Link>
              <button
                type="button"
                onClick={() => setInviteModalOpen(true)}
                style={styles.btnSecondary}
              >
                🔑 Join with Code
              </button>
            </div>
          </div>
        ) : (
          <div className="responsive-grid" style={styles.grid}>
            {filteredTrips.map(trip => {
              const vehicleIcon = VEHICLE_ICONS[trip.bike_type?.toLowerCase()] ?? '🏍️';
              const createdDate = new Date(trip.created_at).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={trip.id}
                  onClick={() => navigate(`/trips/${trip.id}`)}
                  style={{ ...styles.tripCard, cursor: 'pointer' }}
                >
                  {/* Top Row: Vehicle Icon + Status Pill & Delete Button */}
                  <div style={styles.tripCardHeader}>
                    <div style={styles.vehiclePill}>
                      <span>{vehicleIcon}</span>
                      <span style={{ textTransform: 'capitalize' }}>{trip.bike_type}</span>
                    </div>
                    <div style={styles.cardHeaderActions}>
                      <span style={{
                        ...styles.statusBadge,
                        background: trip.isJoined ? 'var(--accent-green-bg)' : 'var(--accent-cyan-bg)',
                        color: trip.isJoined ? 'var(--accent-green)' : 'var(--accent-cyan)',
                      }}>
                        {trip.isJoined ? '👥 Co-rider' : '👑 Convoy Lead'}
                      </span>
                      {!trip.isJoined && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setConfirmTrip({ id: trip.id, title: trip.title });
                          }}
                          disabled={deletingId === trip.id}
                          title="Delete trip"
                          aria-label="Delete trip"
                          style={styles.cardDeleteBtn}
                        >
                          {deletingId === trip.id ? '⏳' : '🗑️'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Route Title */}
                  <h3 style={styles.cardTitle}>{trip.title}</h3>

                  {/* Pending Join Requests Alert Badge */}
                  {trip.isOwner && !!trip.pendingRequestCount && trip.pendingRequestCount > 0 && (
                    <div style={styles.pendingBadgeCard}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13 }}>🔔</span>
                        <span>
                          <strong>{trip.pendingRequestCount}</strong> rider{trip.pendingRequestCount > 1 ? 's' : ''} waiting to join!
                        </span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800 }}>Approve ➔</span>
                    </div>
                  )}

                  {/* Route Visualizer */}
                  <div style={styles.routeBox}>
                    <div style={styles.routePoint}>
                      <span style={{ color: '#10b981', fontSize: 12 }}>●</span>
                      <span style={styles.routeText}>{trip.from_place}</span>
                    </div>
                    <div style={styles.routeConnector}>
                      <span style={{ color: 'var(--accent-gold)', fontSize: 14 }}>➔</span>
                    </div>
                    <div style={styles.routePoint}>
                      <span style={{ color: '#ef4444', fontSize: 12 }}>●</span>
                      <span style={styles.routeText}>{trip.to_place}</span>
                    </div>
                  </div>

                  {/* Footer Details */}
                  <div style={styles.cardFooter}>
                    <div style={styles.metaChip}>
                      <span>📅</span>
                      <span>{trip.days} Day{trip.days !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={styles.metaChip}>
                      <span>🕒</span>
                      <span>{createdDate}</span>
                    </div>
                    <span style={styles.viewLink}>
                      Open ➔
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
  main: {
    maxWidth: 1140,
    margin: '0 auto',
    padding: '32px 20px 60px',
  },
  heroBanner: {
    background: 'var(--bg-hero)',
    border: '1px solid var(--border-card)',
    borderRadius: 20,
    padding: '32px 28px',
    boxShadow: 'var(--card-shadow)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 24,
    flexWrap: 'wrap',
    marginBottom: 36,
    color: '#ffffff',
  },
  heroTitle: {
    fontSize: 'clamp(22px, 5vw, 28px)',
    fontWeight: 900,
    color: '#ffffff',
    margin: '0 0 8px',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 'clamp(13px, 3.5vw, 15px)',
    margin: '0 0 20px',
    lineHeight: 1.5,
    maxWidth: 600,
  },
  statsRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  statPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(255, 255, 255, 0.12)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 13,
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: 500,
  },
  statValue: {
    color: '#ffffff',
    fontWeight: 800,
  },
  heroActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minWidth: 190,
  },
  btnCta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '14px 22px',
    background: '#ffffff',
    color: '#0f172a',
    border: 'none',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 800,
    textDecoration: 'none',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
    cursor: 'pointer',
    transition: 'transform 0.15s ease',
  },
  btnOutline: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 20px',
    background: 'rgba(255, 255, 255, 0.12)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  quickJoinCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    flexWrap: 'wrap',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    borderLeft: '4px solid var(--accent-gold)',
    borderRadius: 16,
    padding: '16px 20px',
    marginBottom: 24,
    boxShadow: 'var(--card-shadow)',
  },
  quickJoinHeader: {
    flex: 1,
    minWidth: 'min(100%, 260px)',
  },
  quickJoinBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 8px',
    borderRadius: 999,
    background: 'var(--accent-gold-bg)',
    color: 'var(--accent-gold)',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  quickJoinTitle: {
    fontWeight: 800,
    fontSize: 15,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: -0.2,
  },
  quickJoinSubtitle: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    margin: '3px 0 0',
    lineHeight: 1.4,
  },
  quickJoinForm: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
    justifyContent: 'flex-end',
    minWidth: 'min(100%, 280px)',
  },
  quickJoinInputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--bg-subtle)',
    border: '1.5px solid var(--border-subtle)',
    borderRadius: 12,
    padding: '4px 10px',
    flex: 1,
    minWidth: 160,
  },
  quickJoinInput: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontWeight: 800,
    fontSize: 14,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    outline: 'none',
    width: '100%',
    padding: '6px 4px',
    boxSizing: 'border-box',
  },
  quickJoinPasteBtn: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    borderRadius: 8,
    padding: '5px 9px',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--accent-cyan)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
    flexShrink: 0,
  },
  hubHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
    gap: 16,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    color: 'var(--text-muted)',
    fontSize: 14,
    margin: '4px 0 0',
  },
  filterTabs: {
    display: 'flex',
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  filterBtn: {
    border: 'none',
    borderRadius: 8,
    padding: '7px 14px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
    gap: 18,
  },
  cardContainer: {
    position: 'relative',
  },
  tripCard: {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    borderRadius: 16,
    padding: '20px',
    textDecoration: 'none',
    boxShadow: 'var(--card-shadow)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
  },
  tripCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
    flexWrap: 'wrap',
  },
  cardHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  vehiclePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 6,
    padding: '3px 8px',
    fontSize: 12,
    color: 'var(--text-secondary)',
    fontWeight: 600,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 999,
    padding: '3px 10px',
    display: 'inline-flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: '0 0 12px',
    lineHeight: 1.3,
  },
  pendingBadgeCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    background: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid rgba(245, 158, 11, 0.5)',
    color: '#f59e0b',
    padding: '7px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 12,
  },
  routeBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 10,
    padding: '10px 14px',
    marginBottom: 16,
  },
  routePoint: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    maxWidth: '42%',
  },
  routeConnector: {
    padding: '0 4px',
  },
  routeText: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 'auto',
  },
  metaChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    color: 'var(--text-secondary)',
    background: 'var(--bg-subtle)',
    padding: '2px 8px',
    borderRadius: 6,
    fontWeight: 600,
  },
  viewLink: {
    marginLeft: 'auto',
    fontSize: 13,
    fontWeight: 800,
    color: 'var(--accent-gold)',
  },
  cardDeleteBtn: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    color: '#ef4444',
    borderRadius: 8,
    padding: '4px 8px',
    fontSize: 13,
    cursor: 'pointer',
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
    transition: 'background 0.2s ease, transform 0.15s ease',
  },
  emptyCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    borderRadius: 18,
    padding: '56px 20px',
    textAlign: 'center',
    boxShadow: 'var(--card-shadow)',
  },
  btnPrimary: {
    display: 'inline-block',
    padding: '12px 24px',
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    border: 'none',
    borderRadius: 10,
    fontWeight: 800,
    fontSize: 14,
    textDecoration: 'none',
    cursor: 'pointer',
    boxShadow: 'var(--card-shadow)',
  },
  btnSecondary: {
    flex: 1,
    padding: '11px',
    background: 'var(--bg-subtle)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-card)',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
  btnDanger: {
    flex: 1,
    padding: '11px',
    background: '#dc2626',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(11, 19, 41, 0.8)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
  },
  modalCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    borderRadius: 16,
    padding: '28px 24px',
    maxWidth: 420,
    width: '100%',
    textAlign: 'center',
    boxShadow: 'var(--card-shadow)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 20,
    cursor: 'pointer',
  },
  codeInput: {
    width: '100%',
    padding: '12px 16px',
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-input)',
    borderRadius: 10,
    color: 'var(--text-primary)',
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: 3,
    textAlign: 'center',
    textTransform: 'uppercase',
    outline: 'none',
    boxSizing: 'border-box',
  },
};
