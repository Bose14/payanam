import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { tripService, rideService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import TripMap from '../components/TripMap';
import { geocodeBest } from '../hooks/usePlaceSearch';
import { listenTrip, notifyTrip } from '../lib/tripEvents';
import AddWaypointForm from '../components/AddWaypointForm';
import ExpenseTracker from '../components/ExpenseTracker';
import Navbar from '../components/Navbar';
import NavigationAppModal from '../components/NavigationAppModal';
import { NearbyHelpSheet } from '../components/NearbyHelpSheet';
import Icon from '../components/Icon';
import { apiMessage } from '../utils/apiMessage';
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
  fuel_stop: 'fuel',
  stay: 'bed',
  attraction: 'pin',
  meal: 'food',
  rest: 'coffee',
  stop: 'pin',
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
  from_lat?: number | null;
  from_lng?: number | null;
  to_lat?: number | null;
  to_lng?: number | null;
  days: number;
  bike_type: string;
  status: string;
  user_id: string;
  itinerary: Stop[];
  rooms?: Array<{ id: string; invite_code: string }>;
  isOwner?: boolean;
  max_members?: number | null;
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

const geocodePlace = geocodeBest;

function warmUpGeolocation(): void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return;
  try {
    navigator.geolocation.getCurrentPosition(
      () => {},
      () => {},
      { enableHighAccuracy: false, timeout: 3000, maximumAge: Infinity }
    );
  } catch {
    // silent
  }
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
  const [dismissCompletedBanner, setDismissCompletedBanner] = useState(false);
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
    setToast('Proposal submitted to Captain!');
    setTimeout(() => setToast(''), 3000);
  };

  const handleAcceptProposal = (prop: ItineraryProposal) => {
    if (!id) return;
    resolveProposal(id, prop.id, 'accepted', user?.fullName || 'Captain');
    setProposals((prev) =>
      prev.map((p) => (p.id === prop.id ? { ...p, status: 'accepted', resolvedBy: user?.fullName || 'Captain' } : p))
    );
    setToast(`Approved proposal from ${prop.proposerName}`);
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

  const handleToggleTripStatus = async () => {
    if (!trip || !id) return;
    const newStatus = trip.status === 'completed' ? 'planning' : 'completed';
    const confirmMsg = newStatus === 'completed'
      ? 'Mark this trip as completed? This will celebrate your expedition milestones.'
      : 'Reopen this trip for planning and live convoys?';
    if (!window.confirm(confirmMsg)) return;
    try {
      await tripService.updateTripStatus(id, newStatus);
      setTrip((prev) => (prev ? { ...prev, status: newStatus } : null));
      showToast(newStatus === 'completed' ? 'Expedition marked as completed!' : 'Trip reopened for planning');
    } catch {
      showToast('Failed to update trip status');
    }
  };

  const tripIdRef = useRef<string | null>(null);
  const daysRef = useRef<number | undefined>(undefined);
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

  // Incoming join requests (leader only). A rider who asks to join sends a realtime message, and
  // only then is the server asked. A slow check every 2 minutes covers a dropped connection.
  useEffect(() => {
    if (!id || !trip?.isOwner) return;
    let busy = false;
    let stopped = false;

    const check = () => {
      if (busy || stopped || document.visibilityState !== 'visible') return;
      busy = true;
      tripService.getPendingRequests(id)
        .then((d) => {
          const reqs = d.requests ?? [];
          setPendingRequests((prev) => {
            const same = prev.length === reqs.length && prev.every((r, i) => (r as { id?: string }).id === (reqs[i] as { id?: string }).id);
            if (same) return prev; // nothing new: no re-render
            if (reqs.length > prev.length) {
              playNotificationSound();
              const newest = reqs[reqs.length - 1];
              const name = newest?.users?.full_name || 'A rider';
              showToast(`${name} requested to join your convoy!`);
            }
            return reqs;
          });
        })
        .catch(() => {})
        .finally(() => { busy = false; });
    };

    const stopListening = listenTrip(id, (ev) => { if (ev === 'join-request') check(); });
    const timer = setInterval(check, 120000);
    document.addEventListener('visibilitychange', check);
    return () => { stopped = true; stopListening(); clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, [id, trip?.isOwner]);

  const doSave = useCallback(async (currentStops: Stop[], tid: string) => {
    setSaveStatus('saving');
    try {
      await tripService.updateItinerary(tid, currentStops, daysRef.current);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('unsaved');
      showToast('Auto-save failed');
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
      showToast('Invite link copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleCopyCode = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      showToast('Convoy code copied!');
    } catch {
      showToast('Failed to copy code');
    }
  };

  const handleWhatsAppShare = () => {
    if (!inviteCode || !trip || !shareUrl) return;
    const text = `Join our motorcycle convoy on Payanam!\n\nRoute: ${trip.from_place} to ${trip.to_place} (${trip.days} Days)\nConvoy Code: ${inviteCode}\n\nJoin our live convoy here:\n${shareUrl}`;
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
      showToast(`Removed ${memberName} from convoy`);
    } catch {
      showToast('Failed to remove member');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleRespond = async (memberId: string, action: 'approved' | 'rejected') => {
    if (!id) return;
    setRespondingId(memberId);
    try {
      await tripService.respondToRequest(id, memberId, action);
      notifyTrip(id, 'join-response');
      setPendingRequests(prev => prev.filter(m => m.id !== memberId));
      if (action === 'approved') {
        const approved = pendingRequests.find(m => m.id === memberId);
        if (approved) setApprovedMembers(prev => [...prev, approved]);
        showToast('Member approved');
      } else {
        showToast('Request declined');
      }
    } catch (err) {
      showToast(apiMessage(err, 'Action failed'));
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

  const addDay = () => {
    if (!trip || trip.days >= 30) return;
    const next = trip.days + 1;
    daysRef.current = next;
    userEditedRef.current = true;
    setTrip({ ...trip, days: next });
    setOpenDays(prev => new Set(prev).add(next));
    setAddingToDay(next);
    setAddForm({ place: '', item_type: 'attraction', description: '' });
    // Touch stops so the debounced auto-save persists the new day count.
    setStops(prev => [...prev]);
    showToast(`Day ${next} added`);
  };

  const removeLastDay = () => {
    if (!trip || trip.days <= 1) return;
    if (stops.some(s => s.day_number === trip.days)) return;
    const next = trip.days - 1;
    daysRef.current = next;
    userEditedRef.current = true;
    setTrip({ ...trip, days: next });
    setAddingToDay(null);
    setStops(prev => [...prev]);
    showToast(`Day ${trip.days} removed`);
  };

  const addStop = async (day: number) => {
    if (!addForm.place.trim()) return;
    setAddingStop(true);

    let lat = addForm.lat;
    let lng = addForm.lng;

    if (!lat || !lng) {
      const geo = await geocodePlace(addForm.place.trim());
      if (geo) { lat = geo.lat; lng = geo.lng; }
      else showToast(`Couldn't find "${addForm.place.trim()}" on the map. Added without a pin. Pick a suggestion to place it.`);
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
        <div style={{ fontSize: 44, marginBottom: 12 }}><Icon name="clock" /></div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 16, fontWeight: 700 }}>
          Loading expedition itinerary & convoy data...
        </p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div style={styles.centerPage}>
        <div style={{ fontSize: 44, marginBottom: 12 }}><Icon name="warning" /></div>
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
              <span style={{ fontSize: 24 }}><Icon name="alert" /></span>
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
                {respondingId === pendingRequests[0]?.id ? 'Approving...' : `Approve ${pendingRequests[0]?.users?.full_name?.split(' ')[0] || 'Rider'}`}
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
                {trip.bike_type}
              </span>
              <span style={styles.tripBadge}>
                {trip.days} Days
              </span>
              {trip?.isOwner && (
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: saveStatus === 'saved' ? '#34d399' : saveStatus === 'saving' ? '#fbbf24' : '#f87171',
                }}>
                  {saveStatus === 'saved' ? 'Auto-Saved' : saveStatus === 'saving' ? 'Saving...' : '● Unsaved changes'}
                </span>
              )}
            </div>

            {!(trip.title || '').toLowerCase().includes((trip.from_place || '').toLowerCase()) && (
              <h1 style={styles.heroTitle}>{trip.title}</h1>
            )}
            <div style={styles.routeStack}>
              <div style={styles.routeRow}>
                <span style={{ ...styles.routeDot, background: 'var(--pz-ok)' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={styles.routeLabel}>From</div>
                  <div style={styles.routePlace}>{trip.from_place}</div>
                </div>
              </div>
              <div style={styles.routeLine} />
              <div style={styles.routeRow}>
                <span style={{ ...styles.routeDot, background: 'var(--pz-bad)' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={styles.routeLabel}>To</div>
                  <div style={styles.routePlace}>{trip.to_place}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="responsive-hero-actions" style={styles.heroActions}>
            {activeSession ? (
              <button
                onClick={() => {
                  warmUpGeolocation();
                  navigate(`/ride/${activeSession.id}`);
                }}
                style={styles.btnActiveRide}
              >
                <span><Icon name="dot" /></span>
                <span>Join Live Convoy</span>
              </button>
            ) : trip?.isOwner ? (
              <button
                onClick={async () => {
                  if (!id) return;
                  warmUpGeolocation();
                  setStartingRide(true);
                  try {
                    const d = await rideService.startRide(id);
                    navigate(`/ride/${d.session.id}`);
                  } catch {
                    setStartingRide(false);
                    showToast('Failed to start ride');
                  }
                }}
                disabled={startingRide}
                style={styles.btnStartRide}
              >
                <span><Icon name="bike" /></span>
                <span>{startingRide ? 'Launching...' : 'Start Live Convoy'}</span>
              </button>
            ) : null}

          </div>
        </div>

        {/* Convoy Pass: invite only */}
        {inviteCode && (
          <div style={styles.convoyPassCard}>
            <div style={styles.passHeadRow}>
              <span style={styles.passTicketBadge}>CONVOY TRAVEL PASS</span>
              <span style={styles.passHintSmall}>{trip?.isOwner ? 'Join with code or link' : 'Share with riders'}</span>
            </div>

            <div style={styles.passCodeRow}>
              <button type="button" onClick={handleCopyCode} style={styles.passCodeBox} aria-label="Copy invite code" title="Copy invite code">
                <span style={styles.passCodeValue}>{inviteCode}</span>
                <span style={styles.passCodeCopy}><Icon name="list" /></span>
              </button>
              <button onClick={() => setShowQrModal(true)} style={styles.iconBtn} aria-label="QR boarding pass" title="QR boarding pass">
                <Icon name="ticket" />
              </button>
            </div>

            <div style={styles.iconRow}>
              <button onClick={handleWhatsAppShare} style={{ ...styles.iconBtn, ...styles.iconBtnWhatsApp, width: 'auto', flex: 1 }} aria-label="Invite on WhatsApp" title="Invite on WhatsApp">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
              </button>
              <button onClick={handleCopy} style={{ ...styles.iconBtn, width: 'auto', flex: 1, color: copied ? 'var(--pz-ok)' : 'var(--pz-ink)' }} aria-label="Copy link" title={copied ? 'Link copied' : 'Copy link'}>
                <Icon name={copied ? 'check' : 'link'} />
              </button>
              <button onClick={handleNativeShare} style={{ ...styles.iconBtn, width: 'auto', flex: 1 }} aria-label="Share" title="Share">
                <Icon name="arrowRight" />
              </button>
            </div>
          </div>
        )}

        {/* Trip tools */}
        {inviteCode && (
          <div style={styles.toolsCard}>
            <div style={styles.toolsTitle}>Trip tools</div>
            <div style={styles.toolsGrid}>
              <button onClick={() => setShowNearbyHelp(true)} style={styles.toolTile}>
                <Icon name="pin" /><span>Nearby help</span>
              </button>
              <button onClick={() => setShowMilestoneModal(true)} style={styles.toolTile}>
                <Icon name="trophy" /><span>Milestones</span>
              </button>
              {trip?.isOwner && (
                <button onClick={() => setShowPublishModal(true)} style={{ ...styles.toolTile, color: isTripPublished(trip.id) ? 'var(--pz-ok)' : 'var(--pz-ink)' }} title={isTripPublished(trip.id) ? 'Published in Discover. Tap to manage' : 'Publish this trip in Discover'}>
                  <Icon name="globe" /><span>{isTripPublished(trip.id) ? 'Published' : 'Publish'}</span>
                </button>
              )}
              {trip?.isOwner && (
                <button onClick={handleToggleTripStatus} style={{ ...styles.toolTile, color: trip.status === 'completed' ? 'var(--pz-ok)' : 'var(--pz-ink)' }}>
                  <Icon name={trip.status === 'completed' ? 'check' : 'flag'} /><span>{trip.status === 'completed' ? 'Reopen trip' : 'Finish trip'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Feature 2: Trip Completed Celebration & Milestones Banner (Only when trip is completed and not dismissed) */}
        {!dismissCompletedBanner && trip?.status === 'completed' && !activeSession && milestoneSummary && (
          <TripCompletedBanner
            fromPlace={trip.from_place}
            toPlace={trip.to_place}
            days={trip.days}
            distanceKm={milestoneSummary.totalDistanceKm}
            onShareMilestones={() => setShowMilestoneModal(true)}
            onDismiss={() => setDismissCompletedBanner(true)}
          />
        )}

        {/* Convoy Roster (Visible to both Leader and Co-riders) */}
        <div style={styles.ridersCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span><Icon name="users" /></span>
              <span>Convoy Roster ({approvedMembers.length + 1} Riders)</span>
            </h3>
            {trip?.isOwner ? (
              <span style={styles.leadPill}>You are Convoy Leader</span>
            ) : (
              <span style={styles.coRiderPill}>You are Co-Rider</span>
            )}
          </div>

          {/* Pending Requests (Leader Only) */}
          {trip?.isOwner && pendingRequests.length > 0 && (
            <div id="pending-requests-section" style={{ marginBottom: 20 }}>
              <p style={styles.subHeadingAmber}>
                Pending Join Requests ({pendingRequests.length})
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
                          <span style={styles.bloodBadge}>{m.profile.blood_group}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span>{m.users?.email}</span>
                        {m.profile?.bike_model && <span>• {m.profile.bike_model}</span>}
                        {m.profile?.city && <span>• {m.profile.city}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleRespond(m.id, 'approved')}
                        disabled={respondingId === m.id}
                        style={styles.btnApprove}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRespond(m.id, 'rejected')}
                        disabled={respondingId === m.id}
                        style={styles.btnDecline}
                      >
                        Decline
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
                <div style={styles.leaderAvatarCircle}><Icon name="crown" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
                      {trip?.isOwner ? (user?.fullName || 'You') : 'Convoy Leader'}
                    </span>
                    <span style={styles.leadBadge}>Lead</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Trip Organizer & Route Commander
                  </div>
                </div>
              </div>
            </div>

            {trip?.max_members ? (
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 8px' }}>
                {approvedMembers.length + 1} of {trip.max_members} riders{approvedMembers.length + 1 >= trip.max_members ? ' (trip is full)' : ''}
              </div>
            ) : null}

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
                        <span style={styles.coRiderBadge}>Rider</span>
                      </div>
                      {trip?.isOwner && (
                        <button
                          onClick={() => handleRemoveMember(m.id, m.users?.full_name || 'Rider')}
                          disabled={removingMemberId === m.id}
                          style={styles.btnRemoveRider}
                          title="Remove rider from convoy"
                        >
                          {removingMemberId === m.id ? 'Removing...' : 'Kick'}
                        </button>
                      )}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {m.profile?.bike_model && <span>{m.profile.bike_model}</span>}
                      {m.profile?.bike_reg_no && <span style={styles.plateBadge}>{m.profile.bike_reg_no}</span>}
                      {m.profile?.city && <span>{m.profile.city}</span>}
                    </div>

                    {/* Safety details: Blood group & Emergency Call */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      {m.profile?.blood_group && (
                        <span style={styles.bloodBadge}>
                          {m.profile.blood_group}
                        </span>
                      )}
                      {m.profile?.emergency_contact_phone && (
                        <a
                          href={`tel:${m.profile.emergency_contact_phone}`}
                          style={styles.emergencyCallBtn}
                          title="Call emergency contact"
                        >
                          SOS: {m.profile.emergency_contact_phone}
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
              <span><Icon name="info" /></span>
              <span>No co-riders have joined yet. Share the Convoy Travel Pass above to invite fellow riders!</span>
            </div>
          )}
        </div>

        {/* Co-rider view note */}
        {!trip?.isOwner && (
          <div style={styles.coRiderNotice}>
            <span></span>
            <span>You are viewing this trip as a confirmed co-rider. The convoy leader manages the route waypoints.</span>
          </div>
        )}

        {/* Interactive Map */}
        <div style={styles.mapFrame}>
          <div style={styles.mapHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}><Icon name="map" /></span>
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
                  backgroundColor: 'var(--accent-gold-bg)',
                  border: '1.5px solid var(--accent-gold)',
                  borderRadius: 10,
                  color: 'var(--accent-gold)',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span><Icon name="bulb" /></span> Propose Itinerary Edit
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

          {trip?.isOwner && Object.values(groupedByDay).every(d => !d || d.length === 0) && (
            <div style={{ padding: '14px 16px', marginBottom: 12, borderRadius: 12, border: '1px dashed var(--border-color, var(--pz-line))', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
              Your plan is empty. Open a day below and use Add Waypoint to search for places and add them one by one.
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
                                    <Icon name={typeIcons[stop.item_type] ?? 'pin'} />
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
                                      Nav
                                    </button>
                                    {trip?.isOwner && (
                                      <button
                                        onClick={() => removeStop(stop.day_number, stop.order_index)}
                                        style={styles.btnRemoveStop}
                                        title="Remove stop"
                                      >
                                        <Icon name="close" />
                                      </button>
                                    )}
                                  </div>

                                  {stop.description && (
                                    <p style={styles.stopDesc}>{stop.description}</p>
                                  )}

                                  <div style={styles.stopMetaRow}>
                                    {stop.estimated_km > 0 && <span>~{stop.estimated_km} km</span>}
                                    {stop.duration_hours > 0 && <span>~{stop.duration_hours} hr</span>}
                                  </div>

                                  {stop.tips && (
                                    <div style={styles.tipsBox}>
                                      <span style={{ fontSize: 14 }}><Icon name="bulb" /></span>
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
                            <AddWaypointForm
                              day={day}
                              draft={addForm}
                              onChange={(next) => setAddForm(next)}
                              onSubmit={() => addStop(day)}
                              onCancel={() => { setAddingToDay(null); setAddForm({ place: '', item_type: 'attraction', description: '' }); }}
                              submitting={addingStop}
                              route={{ from: trip.from_place, to: trip.to_place, fromLat: trip.from_lat, fromLng: trip.from_lng, toLat: trip.to_lat, toLng: trip.to_lng }}
                              existing={(trip.itinerary ?? []).map((st) => st.place)}
                            />
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

            {trip?.isOwner && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={addDay} disabled={trip.days >= 30} style={{ ...styles.btnAddStopTrigger, flex: 1, minHeight: 48 }}>
                  + Add Day {trip.days + 1}
                </button>
                {trip.days > 1 && !stops.some(s => s.day_number === trip.days) && (
                  <button type="button" onClick={removeLastDay} style={{ ...styles.btnCancelAdd, flex: '0 0 auto', padding: '8px 14px' }} aria-label={`Remove Day ${trip.days}`} title={`Remove Day ${trip.days}`}>
                    Remove Day {trip.days}
                  </button>
                )}
              </div>
            )}
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
                  Convoy Boarding Pass
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {trip.from_place} to {trip.to_place} ({trip.days}d)
                </p>
              </div>
              <button onClick={() => setShowQrModal(false)} style={styles.closeBtn}><Icon name="close" /></button>
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
                {copied ? 'Link Copied' : 'Copy Link'}
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
        userName={user?.fullName || 'Convoy Leader'}
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
            showToast(`Added ${item.name} to itinerary!`);
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
            setToast(`Published "${published.title}" publicly in Discover!`);
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
    padding: '24px 16px max(110px, calc(env(safe-area-inset-bottom, 0px) + 90px))',
  },
  toast: {
    position: 'fixed',
    top: 'max(16px, calc(env(safe-area-inset-top, 0px) + 12px))',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#059669',
    color: '#ffffff',
    padding: '12px 20px',
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 14,
    zIndex: 10000,
    boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
    maxWidth: 'calc(100vw - 32px)',
    textAlign: 'center',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    background: 'var(--pz-surface, var(--bg-card))',
    border: '1px solid var(--pz-line, var(--border-card))',
    borderRadius: 16,
    padding: '22px 20px',
    boxShadow: 'var(--card-shadow)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 16,
    color: 'var(--text-primary)',
  },
  tripBadge: {
    background: 'var(--pz-bg, var(--bg-subtle))',
    border: '1px solid var(--pz-line, var(--border-subtle))',
    borderRadius: 999,
    padding: '3px 10px',
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-primary)',
    textTransform: 'capitalize',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  heroTitle: {
    font: "700 clamp(24px, 5vw, 30px)/1.05 'Barlow Condensed', sans-serif",
    textTransform: 'uppercase',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '4px 0 8px',
    letterSpacing: '0.01em',
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
    gap: 8,
    flexWrap: 'wrap',
  },
  btnActiveRide: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '11px 20px',
    background: 'var(--pz-ok, #10b981)',
    color: 'var(--pz-on-ok, #ffffff)',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 15px var(--pz-ok-bg)',
  },
  btnStartRide: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '11px 20px',
    background: 'var(--pz-accent, var(--btn-primary-bg))',
    color: 'var(--pz-on-accent, var(--btn-primary-text))',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 2px 8px var(--pz-warn-bg)',
  },
  btnShare: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '11px 16px',
    background: 'var(--pz-surface, var(--bg-subtle))',
    border: '1px solid var(--pz-line, var(--border-card))',
    color: 'var(--text-primary)',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  convoyPassCard: {
    background: 'var(--pz-surface, var(--bg-card))',
    border: '1px solid var(--pz-line, var(--border-card))',
    borderRadius: 16,
    padding: '16px 20px',
    marginBottom: 16,
    boxShadow: 'var(--card-shadow)',
  },
  passHeadRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  passHintSmall: { fontSize: 12, whiteSpace: 'nowrap', color: 'var(--pz-muted, var(--text-secondary))' },
  passCodeBox: {
    flex: 1, minWidth: 0, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '0 14px', cursor: 'pointer', font: 'inherit',
    background: 'var(--pz-bg, var(--bg-subtle))', border: '1.5px dashed var(--pz-line, var(--border-subtle))', borderRadius: 12,
    color: 'var(--pz-ink, var(--text-primary))',
  },
  passCodeRow: { display: 'flex', gap: 8, marginBottom: 8 },
  iconRow: { display: 'flex', gap: 8 },
  iconBtn: {
    width: 52, height: 48, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    background: 'var(--pz-bg, var(--bg-subtle))', border: '1px solid var(--pz-line, var(--border-card))', borderRadius: 12,
    color: 'var(--pz-ink, var(--text-primary))', fontSize: 18,
  },
  iconBtnWhatsApp: { background: '#25D366', borderColor: '#25D366', color: '#ffffff' },
  passCodeValue: { fontSize: 22, fontWeight: 900, letterSpacing: 3, color: 'var(--accent-gold)', overflowWrap: 'anywhere' },
  passCodeCopy: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, flexShrink: 0 },
  tileGrid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))', gap: 8 },
  tile: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
    padding: '10px 4px', minHeight: 60, cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 700,
    background: 'var(--pz-bg, var(--bg-subtle))', border: '1px solid var(--pz-line, var(--border-card))', borderRadius: 12,
    color: 'var(--pz-ink, var(--text-primary))', textAlign: 'center', lineHeight: 1.1,
  },
  toolsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  toolTile: {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, minHeight: 48, padding: '10px 12px',
    cursor: 'pointer', font: 'inherit', fontSize: 14, fontWeight: 700, textAlign: 'left',
    background: 'var(--pz-bg, var(--bg-subtle))', border: '1px solid var(--pz-line, var(--border-card))', borderRadius: 12,
    color: 'var(--pz-ink, var(--text-primary))',
  },
  tileWhatsApp: { background: '#25D366', borderColor: '#25D366', color: '#ffffff', fontWeight: 800 },
  toolsCard: {
    background: 'var(--pz-surface, var(--bg-card))', border: '1px solid var(--pz-line, var(--border-card))',
    borderRadius: 16, padding: '12px 14px', marginBottom: 16, boxShadow: 'var(--card-shadow)',
  },
  toolsTitle: { fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--pz-muted, var(--text-muted))', marginBottom: 8 },
  routeStack: { display: 'flex', flexDirection: 'column', marginTop: 6 },
  routeRow: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  routeDot: { width: 12, height: 12, borderRadius: 999, marginTop: 5, flexShrink: 0, boxShadow: '0 0 0 4px var(--pz-bg, rgba(0,0,0,0.05))' },
  routeLine: { width: 2, height: 14, background: 'var(--pz-line, var(--border-card))', margin: '3px 0 3px 5px' },
  routeLabel: { fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--pz-muted, var(--text-muted))' },
  routePlace: { fontSize: 17, fontWeight: 800, color: 'var(--pz-ink, var(--text-primary))', overflowWrap: 'anywhere', textTransform: 'capitalize' },
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
    background: 'var(--pz-bad-bg)',
    border: '1px solid var(--pz-bad-bg)',
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
    background: 'var(--pz-bad-bg)',
    border: '1px solid var(--pz-bad-bg)',
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
    background: 'var(--pz-bad-bg)',
    color: '#ef4444',
    border: '1px solid var(--pz-bad-bg)',
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
    background: 'var(--pz-bad-bg)',
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
    padding: 16, boxSizing: 'border-box', minWidth: 0,
  },
  selectInput: {
    width: '100%', minWidth: 0, boxSizing: 'border-box', minHeight: 44, fontFamily: 'inherit',
    padding: '10px 12px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-input)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 16,
    outline: 'none',
  },
  textInput: {
    width: '100%', minWidth: 0, boxSizing: 'border-box', minHeight: 44, fontFamily: 'inherit',
    padding: '10px 12px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-input)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 16,
    outline: 'none',
  },
  btnConfirmAdd: {
    flex: 1, minHeight: 44,
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
    flex: 1, minHeight: 44,
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
