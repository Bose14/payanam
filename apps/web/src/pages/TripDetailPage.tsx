import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { tripService, rideService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import TripMap from '../components/TripMap';
import PlaceInput from '../components/PlaceInput';
import ExpenseTracker from '../components/ExpenseTracker';
import Navbar from '../components/Navbar';
import NavigationAppModal from '../components/NavigationAppModal';
import { NearbyHelpSheet } from '../components/NearbyHelpSheet';
import {
  ItineraryProposalCard,
  ProposeEditModal,
  getStoredProposals,
  addProposal,
  resolveProposal,
  ItineraryProposal,
  PublishItineraryModal,
  isTripPublished,
  ShareMilestoneModal,
  TripCompletedBanner,
  buildTripMilestoneSummary,
} from '../components';

const typeIcons: Record<string, string> = {
  fuel_stop: '⛽',
  stay: '🏨',
  attraction: '📍',
  meal: '🍽️',
  rest: '☕',
  stop: '📌',
};

const TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  fuel_stop: { color: '#d97706', bg: 'rgba(217, 119, 6, 0.15)' },
  stay: { color: '#0284c7', bg: 'rgba(2, 132, 199, 0.15)' },
  attraction: { color: '#059669', bg: 'rgba(5, 150, 105, 0.15)' },
  meal: { color: '#ea580c', bg: 'rgba(234, 88, 12, 0.15)' },
  rest: { color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.15)' },
  stop: { color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' },
};

interface Stop {
  id?: string;
  place: string;
  item_type: string;
  description: string;
  estimated_km: number;
  duration_hours: number;
  tips: string;
  day_number: number;
  order_index: number;
  lat?: number | null;
  lng?: number | null;
}

interface Trip {
  id: string;
  title: string;
  from_place: string;
  to_place: string;
  days: number;
  bike_type: string;
  status: string;
  user_id: string;
  itinerary: Stop[];
  rooms?: Array<{ id: string; invite_code: string }>;
  isOwner?: boolean;
}

interface MemberProfile {
  user_id?: string;
  phone?: string | null;
  blood_group?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relation?: string | null;
  bike_model?: string | null;
  bike_reg_no?: string | null;
  city?: string | null;
}

interface PendingMember {
  id: string;
  user_id: string;
  users: { full_name: string; email: string; avatar_url?: string | null } | null;
  profile?: MemberProfile | null;
}

interface AddStopForm {
  place: string;
  item_type: string;
  description: string;
  lat?: number;
  lng?: number;
}

function getInsertPosition(dayStops: Stop[], newLat: number, newLng: number): number {
  const withCoords = dayStops.filter(s => s.lat && s.lng);
  if (withCoords.length < 2) return dayStops.length;
  const first = withCoords[0];
  const last = withCoords[withCoords.length - 1];
  const dx = last.lng! - first.lng!;
  const dy = last.lat! - first.lat!;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dayStops.length;
  const newProj = ((newLng - first.lng!) * dx + (newLat - first.lat!) * dy) / len2;
  for (let i = 0; i < dayStops.length; i++) {
    const s = dayStops[i];
    if (!s.lat || !s.lng) continue;
    const proj = ((s.lng - first.lng!) * dx + (s.lat - first.lat!) * dy) / len2;
    if (newProj < proj) return i;
  }
  return dayStops.length;
}

async function geocodePlace(name: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1&countrycodes=in`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'Payanam-App' } }
    );
    const data = await res.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { /* silent */ }
  return null;
}

function requestLocationPermission(): Promise<boolean> {
  if (!navigator.geolocation) return Promise.resolve(false);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { timeout: 8000, maximumAge: 60000 },
    );
  });
}

function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch { /* silent */ }
}

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activeSession, setActiveSession] = useState<{ id: string } | null>(null);
  const [startingRide, setStartingRide] = useState(false);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [copied, setCopied] = useState(false);
  const [openDays, setOpenDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  const [addingToDay, setAddingToDay] = useState<number | null>(null);
  const [addForm, setAddForm] = useState<AddStopForm>({ place: '', item_type: 'attraction', description: '' });
  const [addingStop, setAddingStop] = useState(false);
  const [mapRevision, setMapRevision] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<PendingMember[]>([]);
  const [approvedMembers, setApprovedMembers] = useState<PendingMember[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [navTarget, setNavTarget] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [showNavModal, setShowNavModal] = useState(false);
  const [showNearbyHelp, setShowNearbyHelp] = useState(false);
  const [proposals, setProposals] = useState<ItineraryProposal[]>([]);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);

  const milestoneSummary = useMemo(() => {
    if (!trip) return null;
    return buildTripMilestoneSummary({
      trip,
      stops,
      coRiders: approvedMembers.map((m) => ({ name: m.users?.full_name || 'Rider' })),
      bikeModel: trip.bike_type,
    });
  }, [trip, stops, approvedMembers]);

  useEffect(() => {
    if (id) {
      setProposals(getStoredProposals(id));
    }
  }, [id]);

  const handleCreateProposal = (data: { title: string; description?: string }) => {
    if (!id) return;
    const newProp = addProposal(id, {
      tripId: id,
      proposerId: user?.id || 'anon',
      proposerName: user?.fullName || 'Rider',
      proposerInitials: (user?.fullName || 'Rider').slice(0, 2).toUpperCase(),
      title: data.title,
      description: data.description,
    });
    setProposals((prev) => [newProp, ...prev]);
    setToast('✓ Proposal submitted to Captain!');
    setTimeout(() => setToast(''), 3000);
  };

  const handleAcceptProposal = (prop: ItineraryProposal) => {
    if (!id) return;
    resolveProposal(id, prop.id, 'accepted', user?.fullName || 'Captain');
    setProposals((prev) =>
      prev.map((p) => (p.id === prop.id ? { ...p, status: 'accepted', resolvedBy: user?.fullName || 'Captain' } : p))
    );
    setToast(`✓ Approved proposal from ${prop.proposerName}`);
    setTimeout(() => setToast(''), 3000);
  };

  const handleDeclineProposal = (prop: ItineraryProposal) => {
    if (!id) return;
    resolveProposal(id, prop.id, 'declined', user?.fullName || 'Captain');
    setProposals((prev) =>
      prev.map((p) => (p.id === prop.id ? { ...p, status: 'declined', resolvedBy: user?.fullName || 'Captain' } : p))
    );
    setToast('Proposal declined');
    setTimeout(() => setToast(''), 2500);
  };

  const tripIdRef = useRef<string | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userEditedRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    tripService.getTripById(id).then((data) => {
      setTrip(data.trip);
      setStops(data.trip.itinerary ?? []);
      tripIdRef.current = data.trip.id;
      setTimeout(() => { userEditedRef.current = false; }, 0);

      tripService.getApprovedMembers(id).then((d) => setApprovedMembers(d.members ?? [])).catch(() => {});
      if (data.trip.isOwner) {
        tripService.getPendingRequests(id).then((d) => setPendingRequests(d.requests ?? [])).catch(() => {});
      }
      rideService.getActiveSession(data.trip.id)
        .then((d) => setActiveSession(d.session ?? null))
        .catch(() => {});
    }).catch((err) => {
      const msg = err?.response?.data?.message ?? err.message ?? 'Failed to load trip';
      if (msg === 'PENDING') setError('Your request to join this trip is pending approval from the leader.');
      else if (msg === 'REJECTED') setError('Your request to join this trip was declined.');
      else setError(msg);
    }).finally(() => setLoading(false));
  }, [id]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // Live real-time polling for incoming join requests (Leader Only)
  useEffect(() => {
    if (!id || !trip?.isOwner) return;

    const pollInterval = setInterval(() => {
      tripService.getPendingRequests(id)
        .then((d) => {
          const reqs = d.requests ?? [];
          setPendingRequests((prev) => {
            if (reqs.length > prev.length) {
              playNotificationSound();
              const newest = reqs[reqs.length - 1];
              const name = newest?.users?.full_name || 'A rider';
              showToast(`🔔 ${name} requested to join your convoy!`);
            }
            return reqs;
          });
        })
        .catch(() => {});
    }, 3500);

    return () => clearInterval(pollInterval);
  }, [id, trip?.isOwner]);

  const doSave = useCallback(async (currentStops: Stop[], tid: string) => {
    setSaveStatus('saving');
    try {
      await tripService.updateItinerary(tid, currentStops);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('unsaved');
      showToast('❌ Auto-save failed');
    }
  }, []);

  useEffect(() => {
    if (!userEditedRef.current || !tripIdRef.current) return;
    setSaveStatus('unsaved');
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      if (tripIdRef.current) doSave(stops, tripIdRef.current);
    }, 1500);
    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    };
  }, [stops, doSave]);

  const inviteCode = trip?.rooms?.[0]?.invite_code;
  const shareUrl = inviteCode ? `${window.location.origin}/join/${inviteCode}` : null;

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      showToast('✅ Invite link copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleCopyCode = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      showToast('📋 Convoy code copied!');
    } catch {
      showToast('Failed to copy code');
    }
  };

  const handleWhatsAppShare = () => {
    if (!inviteCode || !trip || !shareUrl) return;
    const text = `🏍️ Join our motorcycle convoy on Payanam!\n\n🗺️ Route: ${trip.from_place} ➔ ${trip.to_place} (${trip.days} Days)\n🎟️ Convoy Code: ${inviteCode}\n\nJoin our live convoy here:\n${shareUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleNativeShare = async () => {
    if (!shareUrl || !trip || !inviteCode) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Convoy: ${trip.title}`,
          text: `Join our motorcycle convoy from ${trip.from_place} to ${trip.to_place}! Code: ${inviteCode}`,
          url: shareUrl,
        });
        return;
      } catch { /* cancelled */ }
    }
    handleCopy();
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!id) return;
    if (!window.confirm(`Remove ${memberName} from the convoy?`)) return;
    setRemovingMemberId(memberId);
    try {
      await tripService.removeMember(id, memberId);
      setApprovedMembers(prev => prev.filter(m => m.id !== memberId));
      showToast(`✓ Removed ${memberName} from convoy`);
    } catch {
      showToast('❌ Failed to remove member');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleRespond = async (memberId: string, action: 'approved' | 'rejected') => {
    if (!id) return;
    setRespondingId(memberId);
    try {
      await tripService.respondToRequest(id, memberId, action);
      setPendingRequests(prev => prev.filter(m => m.id !== memberId));
      if (action === 'approved') {
        const approved = pendingRequests.find(m => m.id === memberId);
        if (approved) setApprovedMembers(prev => [...prev, approved]);
        showToast('✅ Member approved');
      } else {
        showToast('✕ Request declined');
      }
    } catch {
      showToast('❌ Action failed');
    } finally {
      setRespondingId(null);
    }
  };

  const removeStop = (day: number, orderIndex: number) => {
    userEditedRef.current = true;
    setMapRevision(r => r + 1);
    setStops(prev => {
      const filtered = prev.filter(s => !(s.day_number === day && s.order_index === orderIndex));
      const dayItems = filtered.filter(s => s.day_number === day).sort((a, b) => a.order_index - b.order_index);
      return filtered.map(s => s.day_number !== day ? s : { ...s, order_index: dayItems.indexOf(s) + 1 });
    });
  };

  const addStop = async (day: number) => {
    if (!addForm.place.trim()) return;
    setAddingStop(true);

    let lat = addForm.lat;
    let lng = addForm.lng;

    if (!lat || !lng) {
      const geo = await geocodePlace(addForm.place.trim());
      if (geo) { lat = geo.lat; lng = geo.lng; }
    }

    const dayStops = stops.filter(s => s.day_number === day).sort((a, b) => a.order_index - b.order_index);
    const insertPosition = (lat && lng) ? getInsertPosition(dayStops, lat, lng) : dayStops.length;

    const newStop: Stop = {
      place: addForm.place.trim(),
      item_type: addForm.item_type,
      description: addForm.description,
      estimated_km: 0,
      duration_hours: 1,
      tips: '',
      day_number: day,
      order_index: insertPosition + 1,
      lat,
      lng,
    };

    userEditedRef.current = true;
    setMapRevision(r => r + 1);
    setStops(prev => {
      const otherDays = prev.filter(s => s.day_number !== day);
      const thisDayStops = prev.filter(s => s.day_number === day).sort((a, b) => a.order_index - b.order_index);
      thisDayStops.splice(insertPosition, 0, newStop);
      const reindexed = thisDayStops.map((s, i) => ({ ...s, order_index: i + 1 }));
      return [...otherDays, ...reindexed];
    });

    setAddingStop(false);
    setAddingToDay(null);
    setAddForm({ place: '', item_type: 'attraction', description: '' });
  };

  const groupedByDay = stops.reduce<Record<number, Stop[]>>((acc, stop) => {
    if (!acc[stop.day_number]) acc[stop.day_number] = [];
    acc[stop.day_number].push(stop);
    return acc;
  }, {});

  if (loading) {
    return (
      <div style={styles.centerPage}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>⏳</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 16, fontWeight: 700 }}>
          Loading expedition itinerary & convoy data...
        </p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div style={styles.centerPage}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
        <p style={{ color: '#ef4444', fontSize: 16, marginBottom: 16, fontWeight: 700 }}>{error || 'Trip not found'}</p>
        <Link to="/dashboard" style={styles.btnSecondary}>← Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <Navbar />

      {/* Floating Toast */}
      {toast && (
        <div style={styles.toast}>
          {toast}
        </div>
      )}

      <main className="responsive-page-container" style={styles.main}>
        {/* Urgent Pending Join Requests Banner for Leader */}
        {trip?.isOwner && pendingRequests.length > 0 && (
          <div style={styles.topPendingBanner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1 }}>
              <span style={{ fontSize: 24 }}>🚨</span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#f59e0b' }}>
                  {pendingRequests.length} {pendingRequests.length === 1 ? 'Rider' : 'Riders'} Waiting to Join Convoy!
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {pendingRequests.map(m => m.users?.full_name || 'Rider').join(', ')} requested entry.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => {
                  const firstReq = pendingRequests[0];
                  if (firstReq) handleRespond(firstReq.id, 'approved');
                }}
                disabled={!!respondingId}
                style={styles.btnApprove}
              >
                {respondingId === pendingRequests[0]?.id ? '⏳ Approving...' : `✓ Approve ${pendingRequests[0]?.users?.full_name?.split(' ')[0] || 'Rider'}`}
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById('pending-requests-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                style={styles.btnReviewAll}
              >
                View Details ({pendingRequests.length}) ↓
              </button>
            </div>
          </div>
        )}

        {/* Hero Route Card */}
        <div className="responsive-hero" style={styles.heroCard}>
          <div style={{ flex: 1, minWidth: 'min(100%, 280px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={styles.tripBadge}>
                🏍️ {trip.bike_type}
              </span>
              <span style={styles.tripBadge}>
                📅 {trip.days} Days
              </span>
              {trip?.isOwner && (
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: saveStatus === 'saved' ? '#34d399' : saveStatus === 'saving' ? '#fbbf24' : '#f87171',
                }}>
                  {saveStatus === 'saved' ? '✓ Auto-Saved' : saveStatus === 'saving' ? '⏳ Saving...' : '● Unsaved changes'}
                </span>
              )}
            </div>

            <h1 style={styles.heroTitle}>{trip.title}</h1>
            <p style={styles.heroRoute}>
              <span style={{ color: '#34d399' }}>● {trip.from_place}</span>
              <span style={{ margin: '0 8px', color: '#f59e0b' }}>➔</span>
              <span style={{ color: '#f87171' }}>● {trip.to_place}</span>
            </p>
          </div>

          {/* Action CTAs */}
          <div className="responsive-hero-actions" style={styles.heroActions}>
            {activeSession ? (
              <button
                onClick={async () => {
                  const ok = await requestLocationPermission();
                  if (!ok) { showToast('📍 Enable location permission to join the ride.'); return; }
                  navigate(`/ride/${activeSession.id}`);
                }}
                style={styles.btnActiveRide}
              >
                <span>🟢</span>
                <span>Join Live Convoy</span>
              </button>
            ) : trip?.isOwner ? (
              <button
                onClick={async () => {
                  if (!id) return;
                  const ok = await requestLocationPermission();
                  if (!ok) { showToast('📍 Enable location permission to start the ride.'); return; }
                  setStartingRide(true);
                  try {
                    const d = await rideService.startRide(id);
                    navigate(`/ride/${d.session.id}`);
                  } catch {
                    setStartingRide(false);
                  }
                }}
                disabled={startingRide}
                style={styles.btnStartRide}
              >
                <span>🏍️</span>
                <span>{startingRide ? 'Launching...' : 'Start Live Convoy'}</span>
              </button>
            ) : null}

            {shareUrl && trip?.isOwner && (
              <button onClick={handleCopy} style={styles.btnShare}>
                <span>🔗</span>
                <span>{copied ? 'Copied!' : 'Share Convoy Link'}</span>
              </button>
            )}

            {trip?.isOwner && (
              <button
                onClick={() => setShowPublishModal(true)}
                style={{
                  ...styles.btnShare,
                  borderColor: isTripPublished(trip.id) ? '#10B981' : '#F0C23A',
                  color: isTripPublished(trip.id) ? '#10B981' : '#F0C23A',
                }}
                title="Feature 1B: Publish itinerary publicly to Discover"
              >
                <span>🌐</span>
                <span>{isTripPublished(trip.id) ? 'Public in Discover' : 'Publish Itinerary'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Convoy Pass & Sharing Hub */}
        {inviteCode && (
          <div style={styles.convoyPassCard}>
            <div style={styles.passTopRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={styles.passTicketBadge}>🎟️ CONVOY TRAVEL PASS</span>
                <div style={styles.passCodePill} onClick={handleCopyCode} title="Click to copy invite code">
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>CODE:</span>
                  <span style={{ fontWeight: 900, letterSpacing: 2, color: 'var(--accent-gold)', fontSize: 15 }}>{inviteCode}</span>
                  <span style={{ fontSize: 12 }}>📋</span>
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {trip?.isOwner ? 'Riders can join with this code or link' : 'Share this convoy pass with fellow riders'}
              </span>
            </div>

            <div style={styles.passActionsRow}>
              <button onClick={handleWhatsAppShare} style={styles.passBtnWhatsApp}>
                <span>💬</span>
                <span>WhatsApp Share</span>
              </button>
              <button onClick={() => setShowQrModal(true)} style={styles.passBtnAction}>
                <span>📱</span>
                <span>QR Boarding Pass</span>
              </button>
              <button onClick={handleCopy} style={styles.passBtnAction}>
                <span>🔗</span>
                <span>{copied ? '✅ Link Copied' : 'Copy Link'}</span>
              </button>
              <button onClick={() => setShowNearbyHelp(true)} style={styles.passBtnAction} title="Verified fuel, repair, food & rest along route">
                <span>🛠️</span>
                <span>Nearby Help</span>
              </button>
              <button onClick={handleNativeShare} style={styles.passBtnAction}>
                <span>↗️</span>
                <span>Share</span>
              </button>
              {trip?.isOwner && (
                <button
                  onClick={() => setShowPublishModal(true)}
                  style={{
                    ...styles.passBtnAction,
                    borderColor: isTripPublished(trip.id) ? '#10B981' : 'var(--border-subtle)',
                    color: isTripPublished(trip.id) ? '#10B981' : 'var(--text-primary)',
                  }}
                  title="Feature 1B: Publish itinerary publicly to Discover"
                >
                  <span>🌐</span>
                  <span>{isTripPublished(trip.id) ? 'Public in Discover' : 'Publish'}</span>
                </button>
              )}
              <button
                onClick={() => setShowMilestoneModal(true)}
                style={{
                  ...styles.passBtnAction,
                  borderColor: '#F0C23A',
                  color: '#F0C23A',
                }}
                title="Feature 2: Share trip completion milestones"
              >
                <span>🏆</span>
                <span>Milestones</span>
              </button>
            </div>
          </div>
        )}

        {/* Feature 2: Trip Completed Celebration & Milestones Banner */}
        {milestoneSummary && (
          <TripCompletedBanner
            fromPlace={trip.from_place}
            toPlace={trip.to_place}
            days={trip.days}
            distanceKm={milestoneSummary.totalDistanceKm}
            onShareMilestones={() => setShowMilestoneModal(true)}
          />
        )}

        {/* Convoy Roster (Visible to both Leader and Co-riders) */}
        <div style={styles.ridersCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>👥</span>
              <span>Convoy Roster ({approvedMembers.length + 1} Riders)</span>
            </h3>
            {trip?.isOwner ? (
              <span style={styles.leadPill}>👑 You are Convoy Leader</span>
            ) : (
              <span style={styles.coRiderPill}>🏍️ You are Co-Rider</span>
            )}
          </div>

          {/* Pending Requests (Leader Only) */}
          {trip?.isOwner && pendingRequests.length > 0 && (
            <div id="pending-requests-section" style={{ marginBottom: 20 }}>
              <p style={styles.subHeadingAmber}>
                🔔 Pending Join Requests ({pendingRequests.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingRequests.map(m => (
                  <div key={m.id} style={styles.pendingRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
                          {m.users?.full_name ?? 'Rider'}
                        </span>
                        {m.profile?.blood_group && (
                          <span style={styles.bloodBadge}>🩸 {m.profile.blood_group}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span>{m.users?.email}</span>
                        {m.profile?.bike_model && <span>• 🏍️ {m.profile.bike_model}</span>}
                        {m.profile?.city && <span>• 📍 {m.profile.city}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleRespond(m.id, 'approved')}
                        disabled={respondingId === m.id}
                        style={styles.btnApprove}
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleRespond(m.id, 'rejected')}
                        disabled={respondingId === m.id}
                        style={styles.btnDecline}
                      >
                        ✕ Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confirmed Co-Riders Grid */}
          <div style={styles.rosterGrid}>
            {/* Pinned Convoy Leader Card */}
            <div style={styles.rosterCard}>
              <div style={styles.rosterCardHeader}>
                <div style={styles.leaderAvatarCircle}>👑</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
                      {trip?.isOwner ? (user?.fullName || 'You') : 'Convoy Leader'}
                    </span>
                    <span style={styles.leadBadge}>👑 Lead</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Trip Organizer & Route Commander
                  </div>
                </div>
              </div>
            </div>

            {/* Approved Co-riders */}
            {approvedMembers.map(m => (
              <div key={m.id} style={styles.rosterCard}>
                <div style={styles.rosterCardHeader}>
                  <div style={styles.rosterAvatarCircle}>
                    {(m.users?.full_name ?? 'R')[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
                          {m.users?.full_name ?? 'Co-Rider'}
                        </span>
                        <span style={styles.coRiderBadge}>🏍️ Rider</span>
                      </div>
                      {trip?.isOwner && (
                        <button
                          onClick={() => handleRemoveMember(m.id, m.users?.full_name || 'Rider')}
                          disabled={removingMemberId === m.id}
                          style={styles.btnRemoveRider}
                          title="Remove rider from convoy"
                        >
                          {removingMemberId === m.id ? 'Removing...' : '✕ Kick'}
                        </button>
                      )}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {m.profile?.bike_model && <span>🏍️ {m.profile.bike_model}</span>}
                      {m.profile?.bike_reg_no && <span style={styles.plateBadge}>{m.profile.bike_reg_no}</span>}
                      {m.profile?.city && <span>📍 {m.profile.city}</span>}
                    </div>

                    {/* Safety details: Blood group & Emergency Call */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      {m.profile?.blood_group && (
                        <span style={styles.bloodBadge}>
                          🩸 {m.profile.blood_group}
                        </span>
                      )}
                      {m.profile?.emergency_contact_phone && (
                        <a
                          href={`tel:${m.profile.emergency_contact_phone}`}
                          style={styles.emergencyCallBtn}
                          title="Call emergency contact"
                        >
                          📞 SOS: {m.profile.emergency_contact_phone}
                          {m.profile.emergency_contact_relation ? ` (${m.profile.emergency_contact_relation})` : ''}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {approvedMembers.length === 0 && (
            <div style={styles.emptyRosterNotice}>
              <span>ℹ️</span>
              <span>No co-riders have joined yet. Share the Convoy Travel Pass above to invite fellow riders!</span>
            </div>
          )}
        </div>

        {/* Co-rider view note */}
        {!trip?.isOwner && (
          <div style={styles.coRiderNotice}>
            <span>👀</span>
            <span>You are viewing this trip as a confirmed co-rider. The convoy leader manages the route waypoints.</span>
          </div>
        )}

        {/* Interactive Map */}
        <div style={styles.mapFrame}>
          <div style={styles.mapHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🗺️</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Route & GPS Waypoint Map</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {stops.filter(s => s.lat && s.lng).length} mapped waypoints
            </span>
          </div>
          <div style={{ borderRadius: '0 0 16px 16px', overflow: 'hidden' }}>
            <TripMap
              key={mapRevision}
              stops={stops}
              fromPlace={trip.from_place}
              toPlace={trip.to_place}
            />
          </div>
        </div>

        {/* Day-by-Day Itinerary */}
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Day-by-Day Route Itinerary</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Fuel stops, food breaks, scenic lookouts, and night stays</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowProposeModal(true)}
                style={{
                  padding: '7px 14px',
                  backgroundColor: 'rgba(240, 194, 58, 0.15)',
                  border: '1.5px solid #F0C23A',
                  borderRadius: 10,
                  color: '#F0C23A',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span>💡</span> Propose Itinerary Edit
              </button>
              {trip?.isOwner && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Changes auto-save automatically</span>
              )}
            </div>
          </div>

          {/* Feature 1A Step 4: Proposed Itinerary Edits List */}
          {proposals.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {proposals.map((prop) => (
                <ItineraryProposalCard
                  key={prop.id}
                  proposal={prop}
                  isCaptain={Boolean(trip?.isOwner)}
                  onAccept={handleAcceptProposal}
                  onDecline={handleDeclineProposal}
                />
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: trip.days }, (_, i) => i + 1).map((day) => {
              const dayStops = (groupedByDay[day] ?? []).sort((a, b) => a.order_index - b.order_index);
              const isOpen = openDays.has(day);
              const toggleDay = () => setOpenDays(prev => {
                const n = new Set(prev);
                if (n.has(day)) n.delete(day); else n.add(day);
                return n;
              });

              return (
                <div key={day} style={styles.dayCard}>
                  {/* Day Header Toggle */}
                  <button onClick={toggleDay} style={styles.dayToggle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-cyan)' }}>Day {day}</span>
                      {dayStops.length > 0 && (
                        <span style={styles.stopCountBadge}>
                          {dayStops.length} waypoint{dayStops.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {/* Day Stops Timeline */}
                  {isOpen && (
                    <div style={{ padding: '0 20px 20px' }}>
                      {dayStops.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '12px 0' }}>No waypoints logged for Day {day}.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 12 }}>
                          {dayStops.map((stop, idx) => {
                            const badge = TYPE_COLORS[stop.item_type] ?? TYPE_COLORS.stop;

                            return (
                              <div key={`${stop.day_number}-${stop.order_index}-${idx}`} style={styles.timelineItem}>
                                {/* Left icon column */}
                                <div style={styles.timelineIconCol}>
                                  <div style={{ ...styles.stopIconCircle, background: badge.bg, color: badge.color }}>
                                    {typeIcons[stop.item_type] ?? '📌'}
                                  </div>
                                  {idx < dayStops.length - 1 && <div style={styles.timelineConnector} />}
                                </div>

                                {/* Right content */}
                                <div style={styles.timelineContent}>
                                  <div style={styles.stopHeader}>
                                    <span style={styles.stopPlace}>{stop.place}</span>
                                    <span style={{ ...styles.itemTypeBadge, background: badge.bg, color: badge.color }}>
                                      {stop.item_type.replace('_', ' ')}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        let targetLat = stop.lat;
                                        let targetLng = stop.lng;
                                        if (!targetLat || !targetLng) {
                                          showToast(`Finding GPS coordinates for ${stop.place}...`);
                                          const coords = await geocodePlace(stop.place);
                                          if (coords) {
                                            targetLat = coords.lat;
                                            targetLng = coords.lng;
                                          }
                                        }
                                        if (targetLat && targetLng) {
                                          setNavTarget({ name: stop.place, lat: targetLat, lng: targetLng });
                                          setShowNavModal(true);
                                        } else {
                                          showToast('Could not find GPS coordinates for this stop');
                                        }
                                      }}
                                      style={{
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        border: '1px solid rgba(59, 130, 246, 0.3)',
                                        color: '#60a5fa',
                                        borderRadius: 6,
                                        padding: '2px 8px',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        marginLeft: 'auto',
                                      }}
                                      title="Open in Maps"
                                    >
                                      🧭 Nav
                                    </button>
                                    {trip?.isOwner && (
                                      <button
                                        onClick={() => removeStop(stop.day_number, stop.order_index)}
                                        style={styles.btnRemoveStop}
                                        title="Remove stop"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>

                                  {stop.description && (
                                    <p style={styles.stopDesc}>{stop.description}</p>
                                  )}

                                  <div style={styles.stopMetaRow}>
                                    {stop.estimated_km > 0 && <span>🛣️ ~{stop.estimated_km} km</span>}
                                    {stop.duration_hours > 0 && <span>⏱️ ~{stop.duration_hours} hr</span>}
                                  </div>

                                  {stop.tips && (
                                    <div style={styles.tipsBox}>
                                      <span style={{ fontSize: 14 }}>💡</span>
                                      <span style={{ fontSize: 12, color: 'var(--accent-gold)' }}>{stop.tips}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add Stop to Day Form for Trip Leader */}
                      {trip?.isOwner && (
                        <div style={{ marginTop: 16 }}>
                          {addingToDay === day ? (
                            <div style={styles.addStopBox}>
                              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                                + Add Waypoint to Day {day}
                              </h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <PlaceInput
                                  value={addForm.place}
                                  onChange={v => setAddForm(f => ({ ...f, place: v, lat: undefined, lng: undefined }))}
                                  onSelect={(loc) => setAddForm(f => ({ ...f, place: loc.name, lat: loc.lat, lng: loc.lng }))}
                                  placeholder="Search location or landmark..."
                                />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                  <select
                                    value={addForm.item_type}
                                    onChange={e => setAddForm(f => ({ ...f, item_type: e.target.value }))}
                                    style={styles.selectInput}
                                  >
                                    <option value="fuel_stop">⛽ Fuel Stop</option>
                                    <option value="meal">🍽️ Food / Dhaba</option>
                                    <option value="attraction">📍 Attraction / Scenic</option>
                                    <option value="rest">☕ Tea / Rest Break</option>
                                    <option value="stay">🏨 Night Stay</option>
                                  </select>
                                  <input
                                    type="text"
                                    value={addForm.description}
                                    onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Brief note or stop description"
                                    style={styles.textInput}
                                  />
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                  <button
                                    onClick={() => addStop(day)}
                                    disabled={addingStop || !addForm.place.trim()}
                                    style={styles.btnConfirmAdd}
                                  >
                                    {addingStop ? 'Adding...' : 'Add Waypoint'}
                                  </button>
                                  <button
                                    onClick={() => { setAddingToDay(null); setAddForm({ place: '', item_type: 'attraction', description: '' }); }}
                                    style={styles.btnCancelAdd}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setAddingToDay(day); setAddForm({ place: '', item_type: 'attraction', description: '' }); }}
                              style={styles.btnAddStopTrigger}
                            >
                              + Add Waypoint to Day {day}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Integrated Expense Tracker */}
        <div style={{ marginTop: 36 }}>
          <ExpenseTracker
            tripId={trip.id}
            currentUserId={user!.id}
            tripTitle={`${trip.from_place} → ${trip.to_place}`}
          />
        </div>
      </main>

      {/* QR Code Pass Modal */}
      {showQrModal && shareUrl && (
        <div style={styles.modalOverlay} onClick={() => setShowQrModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--text-primary)' }}>
                  🎟️ Convoy Boarding Pass
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {trip.from_place} ➔ {trip.to_place} ({trip.days}d)
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
              <strong style={{ fontSize: 22, letterSpacing: 2, color: 'var(--accent-gold)' }}>{inviteCode}</strong>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '12px 0 16px', lineHeight: 1.4 }}>
              Riders can scan this QR code with any smartphone camera to open the expedition and request to join.
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleCopy} style={styles.btnPrimaryModal}>
                {copied ? '✅ Link Copied' : '📋 Copy Link'}
              </button>
              <button onClick={() => setShowQrModal(false)} style={styles.btnSecondaryModal}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* External Navigation Launcher Modal */}
      <NavigationAppModal
        isOpen={showNavModal}
        onClose={() => setShowNavModal(false)}
        target={navTarget}
      />

      {/* Route-Cached Verified Amenities ("Nearby help", Mockup Screen 3) */}
      <NearbyHelpSheet
        isOpen={showNearbyHelp}
        onClose={() => setShowNearbyHelp(false)}
        onNavigate={(target) => {
          setNavTarget(target);
          setShowNavModal(true);
        }}
        onPinAsStop={async (item) => {
          if (!trip?.id) return;
          try {
            await tripService.addStop(trip.id, {
              place: item.name,
              item_type: item.type,
              description: 'Verified nearby help stop',
              lat: item.lat,
              lng: item.lng,
            });
            showToast(`✓ Added ${item.name} to itinerary!`);
            // reload trip data
            tripService.getTripById(trip.id).then((data) => {
              setTrip(data.trip);
              setStops(data.trip.itinerary ?? []);
            }).catch(() => {});
          } catch (err) {
            console.warn(err);
          }
        }}
      />

      {/* Feature 1A: Propose Itinerary Edit Modal */}
      <ProposeEditModal
        isOpen={showProposeModal}
        onClose={() => setShowProposeModal(false)}
        onSubmitProposal={handleCreateProposal}
      />

      {/* Feature 1B: Publish Itinerary Publicly Modal */}
      {trip && (
        <PublishItineraryModal
          isOpen={showPublishModal}
          onClose={() => setShowPublishModal(false)}
          trip={trip}
          stops={stops}
          user={user}
          onPublishedSuccess={(published) => {
            setToast(`✓ Published "${published.title}" publicly in Discover!`);
            setTimeout(() => setToast(''), 3500);
          }}
          onUnpublishedSuccess={() => {
            setToast('Itinerary unpublished from Discover');
            setTimeout(() => setToast(''), 3000);
          }}
        />
      )}

      {/* Feature 2: Share Trip Milestones Modal */}
      {milestoneSummary && (
        <ShareMilestoneModal
          isOpen={showMilestoneModal}
          onClose={() => setShowMilestoneModal(false)}
          summary={milestoneSummary}
          onOpenPublishFlow={() => setShowPublishModal(true)}
          onNavigateToDiscover={() => navigate('/dashboard')}
        />
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
    transition: 'background-color 0.3s ease, color 0.3s ease',
  },
  centerPage: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-page)',
    color: 'var(--text-primary)',
  },
  main: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '32px 20px 80px',
  },
  toast: {
    position: 'fixed',
    top: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#059669',
    color: '#ffffff',
    padding: '12px 24px',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 14,
    zIndex: 10000,
    boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
    whiteSpace: 'nowrap',
  },
  heroCard: {
    background: 'var(--bg-hero)',
    border: '1px solid var(--border-card)',
    borderRadius: 20,
    padding: '28px 24px',
    boxShadow: 'var(--card-shadow)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 20,
    flexWrap: 'wrap',
    marginBottom: 20,
    color: '#ffffff',
  },
  tripBadge: {
    background: 'rgba(255, 255, 255, 0.12)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    padding: '3px 8px',
    fontSize: 12,
    fontWeight: 700,
    color: '#ffffff',
    textTransform: 'capitalize',
  },
  heroTitle: {
    fontSize: 'clamp(20px, 5vw, 26px)',
    fontWeight: 900,
    color: '#ffffff',
    margin: '0 0 8px',
    letterSpacing: -0.4,
  },
  heroRoute: {
    fontSize: 15,
    fontWeight: 700,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  heroActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  btnActiveRide: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
    background: '#10b981',
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
  },
  btnStartRide: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
    background: '#ffffff',
    color: '#0f172a',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.25)',
  },
  btnShare: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '11px 16px',
    background: 'rgba(255, 255, 255, 0.12)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    color: '#ffffff',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  convoyPassCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    borderRadius: 16,
    padding: '16px 20px',
    marginBottom: 20,
    boxShadow: 'var(--card-shadow)',
  },
  passTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  passTicketBadge: {
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
  passCodePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-subtle)',
    padding: '5px 12px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  passActionsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: 10,
  },
  passBtnWhatsApp: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 14px',
    background: '#25D366',
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },
  passBtnAction: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '10px 14px',
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-card)',
    borderRadius: 10,
    color: 'var(--text-primary)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  leadPill: {
    fontSize: 11,
    fontWeight: 800,
    background: 'var(--accent-gold-bg)',
    color: 'var(--accent-gold)',
    border: '1px solid var(--accent-gold)',
    borderRadius: 999,
    padding: '3px 10px',
  },
  coRiderPill: {
    fontSize: 11,
    fontWeight: 800,
    background: 'var(--accent-cyan-bg)',
    color: 'var(--accent-cyan)',
    border: '1px solid var(--accent-cyan)',
    borderRadius: 999,
    padding: '3px 10px',
  },
  rosterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 12,
  },
  rosterCard: {
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 14,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  rosterCardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  leaderAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: 'var(--accent-gold-bg)',
    border: '2px solid var(--accent-gold)',
    color: 'var(--accent-gold)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 900,
    flexShrink: 0,
  },
  rosterAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: 'var(--accent-green-bg)',
    border: '2px solid var(--accent-green)',
    color: 'var(--accent-green)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 900,
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
  coRiderBadge: {
    fontSize: 10,
    fontWeight: 800,
    background: 'var(--accent-cyan-bg)',
    color: 'var(--accent-cyan)',
    border: '1px solid var(--accent-cyan)',
    borderRadius: 6,
    padding: '1px 6px',
    textTransform: 'uppercase',
  },
  btnRemoveRider: {
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#ef4444',
    fontSize: 11,
    padding: '3px 8px',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 700,
    flexShrink: 0,
  },
  plateBadge: {
    fontSize: 11,
    fontWeight: 800,
    fontFamily: 'monospace',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    color: 'var(--text-primary)',
    padding: '1px 6px',
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  bloodBadge: {
    fontSize: 11,
    fontWeight: 800,
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#ef4444',
    padding: '2px 8px',
    borderRadius: 999,
  },
  emergencyCallBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 700,
    background: 'var(--accent-green-bg)',
    border: '1px solid var(--accent-green)',
    color: 'var(--accent-green)',
    padding: '3px 8px',
    borderRadius: 999,
    textDecoration: 'none',
  },
  emptyRosterNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--bg-subtle)',
    border: '1px dashed var(--border-card)',
    borderRadius: 12,
    padding: '14px 16px',
    color: 'var(--text-secondary)',
    fontSize: 13,
    marginTop: 12,
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
  btnPrimaryModal: {
    flex: 1,
    padding: '11px 16px',
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    border: 'none',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },
  btnSecondaryModal: {
    padding: '11px 18px',
    background: 'var(--bg-subtle)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-card)',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  ridersCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    borderRadius: 16,
    padding: '20px 22px',
    marginBottom: 20,
    boxShadow: 'var(--card-shadow)',
  },
  subHeadingAmber: {
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--accent-gold)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    margin: '0 0 8px',
  },
  subHeadingGreen: {
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--accent-green)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    margin: '0 0 8px',
  },
  pendingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    background: 'var(--bg-subtle)',
    borderRadius: 10,
    border: '1px solid var(--border-subtle)',
    gap: 12,
    flexWrap: 'wrap',
  },
  topPendingBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    background: 'rgba(245, 158, 11, 0.12)',
    border: '1.5px solid #f59e0b',
    borderRadius: 16,
    padding: '14px 18px',
    marginBottom: 20,
    boxShadow: '0 4px 16px rgba(245, 158, 11, 0.15)',
  },
  btnReviewAll: {
    padding: '7px 14px',
    background: 'var(--bg-subtle)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnApprove: {
    padding: '6px 14px',
    background: '#10b981',
    color: '#ffffff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
  },
  btnDecline: {
    padding: '6px 14px',
    background: 'rgba(239, 68, 68, 0.15)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
  },
  coRiderNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--accent-cyan-bg)',
    border: '1px solid var(--accent-cyan)',
    borderRadius: 10,
    padding: '12px 16px',
    color: 'var(--accent-cyan)',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 20,
  },
  mapFrame: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    borderRadius: 18,
    overflow: 'hidden',
    boxShadow: 'var(--card-shadow)',
  },
  mapHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 18px',
    background: 'var(--bg-subtle)',
    borderBottom: '1px solid var(--border-subtle)',
  },
  dayCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: 'var(--card-shadow)',
  },
  dayToggle: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  stopCountBadge: {
    background: 'var(--accent-cyan-bg)',
    color: 'var(--accent-cyan)',
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 999,
    fontWeight: 700,
  },
  timelineItem: {
    display: 'flex',
    gap: 14,
    marginBottom: 4,
  },
  timelineIconCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: 32,
    flexShrink: 0,
  },
  stopIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    marginTop: 2,
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    background: 'var(--border-subtle)',
    margin: '4px 0',
    minHeight: 20,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 16,
    borderBottom: '1px solid var(--border-subtle)',
  },
  stopHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  stopPlace: {
    fontWeight: 800,
    color: 'var(--text-primary)',
    fontSize: 15,
    flex: 1,
  },
  itemTypeBadge: {
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 999,
    textTransform: 'capitalize',
    fontWeight: 700,
  },
  btnRemoveStop: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: 'none',
    color: '#ef4444',
    fontSize: 12,
    padding: '2px 8px',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 700,
  },
  stopDesc: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    margin: '0 0 6px',
    lineHeight: 1.4,
  },
  stopMetaRow: {
    display: 'flex',
    gap: 12,
    fontSize: 12,
    color: 'var(--text-muted)',
    marginBottom: 6,
    fontWeight: 600,
  },
  tipsBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    background: 'var(--accent-gold-bg)',
    border: '1px solid var(--accent-gold)',
    borderRadius: 8,
    padding: '6px 10px',
  },
  addStopBox: {
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 12,
    padding: 16,
  },
  selectInput: {
    padding: '8px 12px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-input)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
  },
  textInput: {
    padding: '8px 12px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-input)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
  },
  btnConfirmAdd: {
    padding: '8px 16px',
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnCancelAdd: {
    padding: '8px 14px',
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-input)',
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer',
  },
  btnAddStopTrigger: {
    width: '100%',
    padding: '10px',
    background: 'var(--bg-subtle)',
    border: '1px dashed var(--accent-cyan)',
    borderRadius: 10,
    color: 'var(--accent-cyan)',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: '10px 18px',
    background: 'var(--bg-subtle)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-card)',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    textDecoration: 'none',
  },
};
