import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { tripService, rideService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import TripMap from '../components/TripMap';
import PlaceInput, { PlaceLocation } from '../components/PlaceInput';
import ExpenseTracker from '../components/ExpenseTracker';

const typeIcons: Record<string, string> = {
  fuel_stop: '⛽', stay: '🏨', attraction: '📍', meal: '🍽️', rest: '☕', stop: '📌',
};
const TYPE_COLORS: Record<string, string> = {
  fuel_stop: '#f59e0b', stay: '#3b82f6', attraction: '#10b981', meal: '#f97316', rest: '#8b5cf6', stop: '#6b7280',
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
  id: string; title: string; from_place: string; to_place: string;
  days: number; bike_type: string; status: string; user_id: string;
  itinerary: Stop[];
  rooms?: Array<{ id: string; invite_code: string }>;
  isOwner?: boolean;
}

interface PendingMember {
  id: string;
  user_id: string;
  users: { full_name: string; email: string } | null;
}

interface AddStopForm {
  place: string; item_type: string; description: string;
  lat?: number; lng?: number;
}

// Project new stop onto route axis to find correct insert position
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

// Geocode a place name via Nominatim when no suggestion was selected
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

function TripDetailPage() {
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

  const tripIdRef = useRef<string | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // true while initial data is being set — prevents auto-save on first render
  const userEditedRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    tripService.getTripById(id).then((data) => {
      setTrip(data.trip);
      setStops(data.trip.itinerary ?? []);
      tripIdRef.current = data.trip.id;
      setTimeout(() => { userEditedRef.current = false; }, 0);

      if (data.trip.isOwner) {
        tripService.getPendingRequests(id).then((d) => setPendingRequests(d.requests ?? [])).catch(() => {});
        tripService.getApprovedMembers(id).then((d) => setApprovedMembers(d.members ?? [])).catch(() => {});
      }
      // Check for active ride session (anyone in the trip can join)
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

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

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

  // Auto-save 1.5s after a user-initiated change
  useEffect(() => {
    if (!userEditedRef.current || !tripIdRef.current) return;
    setSaveStatus('unsaved');
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    const tid = tripIdRef.current;
    const snapshot = stops;
    autoSaveRef.current = setTimeout(() => doSave(snapshot, tid), 1500);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [stops, doSave]);

  const inviteCode = trip?.rooms?.[0]?.invite_code;
  const shareUrl = inviteCode ? `${window.location.origin}/join/${inviteCode}` : null;

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleRespond = async (memberId: string, action: 'approved' | 'rejected') => {
    if (!id) return;
    setRespondingId(memberId);
    try {
      const approvedMember = pendingRequests.find(m => m.id === memberId);
      await tripService.respondToRequest(id, memberId, action);
      setPendingRequests(prev => prev.filter(m => m.id !== memberId));
      if (action === 'approved' && approvedMember) {
        setApprovedMembers(prev => [...prev, approvedMember]);
      }
      showToast(action === 'approved' ? '✅ Member approved' : '✅ Request declined');
    } catch {
      showToast('❌ Failed to update request');
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

    // Geocode if no coordinates (manual type without picking suggestion)
    if (!lat || !lng) {
      const geo = await geocodePlace(addForm.place.trim());
      if (geo) { lat = geo.lat; lng = geo.lng; }
    }

    const dayStops = stops.filter(s => s.day_number === day).sort((a, b) => a.order_index - b.order_index);

    // Auto-calculate insert position from coordinates, fallback to end
    const insertPosition = (lat && lng) ? getInsertPosition(dayStops, lat, lng) : dayStops.length;

    const newStop: Stop = {
      place: addForm.place.trim(), item_type: addForm.item_type,
      description: addForm.description, estimated_km: 0,
      duration_hours: 1, tips: '', day_number: day,
      order_index: insertPosition + 1, // temp, will be reindexed below
      lat, lng,
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

  if (loading) return (
    <div style={styles.center}><div style={{ fontSize: 40 }}>⏳</div><p style={{ color: '#6b7280' }}>Loading trip...</p></div>
  );
  if (error || !trip) return (
    <div style={styles.center}><p style={{ color: '#dc2626' }}>{error || 'Trip not found'}</p><Link to="/dashboard">← Back</Link></div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', fontFamily: 'system-ui, sans-serif' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: toast.startsWith('✅') ? '#166534' : '#991b1b', color: 'white', padding: '10px 24px', borderRadius: 8, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}

      <header style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🏍️</span>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>Payanam</span>
        </div>
        <Link to="/dashboard" style={{ color: '#cbd5e1', fontSize: 14, textDecoration: 'none' }}>← Dashboard</Link>
      </header>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '32px 16px' }}>
        {/* Trip header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>{trip.title}</h1>
            <p style={{ color: '#6b7280', fontSize: 15, margin: 0, textTransform: 'capitalize' }}>
              {trip.from_place} → {trip.to_place} · {trip.days} days · {trip.bike_type}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {trip?.isOwner && (
              <span style={{ fontSize: 13, color: saveStatus === 'saved' ? '#16a34a' : saveStatus === 'saving' ? '#d97706' : '#dc2626', fontWeight: 500 }}>
                {saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'saving' ? '⏳ Saving...' : '● Unsaved'}
              </span>
            )}
            {shareUrl && trip?.isOwner && (
              <button onClick={handleCopy} style={styles.btnSecondary}>{copied ? '✅ Copied!' : '🔗 Share Trip'}</button>
            )}
            {activeSession ? (
              <button
                onClick={async () => {
                  const ok = await requestLocationPermission();
                  if (!ok) { showToast('📍 Enable location permission to join the ride.'); return; }
                  navigate(`/ride/${activeSession.id}`);
                }}
                style={{ padding: '10px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                🟢 Join Ride
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
                  } catch { setStartingRide(false); }
                }}
                disabled={startingRide}
                style={{ padding: '10px 18px', background: 'linear-gradient(135deg, #1a1a2e, #0f3460)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: startingRide ? 0.7 : 1 }}
              >
                {startingRide ? '⏳ Starting...' : '🏍️ Start Ride'}
              </button>
            ) : null}
          </div>
        </div>

        {inviteCode && trip?.isOwner && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 8, fontSize: 14, color: '#1e40af' }}>
            <span>📨 Invite code: <strong>{inviteCode}</strong></span>
            <span style={{ color: '#60a5fa', fontSize: 13 }}>Share with fellow riders</span>
          </div>
        )}

        {/* Riders panel — owner sees pending requests + current members */}
        {trip?.isOwner && (pendingRequests.length > 0 || approvedMembers.length > 0) && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 14px' }}>👥 Riders</h3>

            {/* Pending requests */}
            {pendingRequests.length > 0 && (
              <div style={{ marginBottom: approvedMembers.length > 0 ? 16 : 0 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 8px' }}>
                  🔔 Pending Requests ({pendingRequests.length})
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pendingRequests.map((m) => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', background: '#fefce8', borderRadius: 8, border: '1px solid #fde68a', flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#111827' }}>{m.users?.full_name ?? 'Unknown'}</p>
                        <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{m.users?.email}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleRespond(m.id, 'approved')} disabled={respondingId === m.id}
                          style={{ padding: '7px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: respondingId === m.id ? 0.6 : 1 }}>
                          ✓ Approve
                        </button>
                        <button onClick={() => handleRespond(m.id, 'rejected')} disabled={respondingId === m.id}
                          style={{ padding: '7px 14px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: respondingId === m.id ? 0.6 : 1 }}>
                          ✕ Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approved co-riders */}
            {approvedMembers.length > 0 && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 8px' }}>
                  ✅ Co-Riders ({approvedMembers.length})
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {approvedMembers.map((m) => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                      <div style={{ width: 36, height: 36, background: '#16a34a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                        {(m.users?.full_name ?? '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#111827' }}>{m.users?.full_name ?? 'Unknown'}</p>
                        <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{m.users?.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Co-rider view — show who the trip leader is */}
        {!trip?.isOwner && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 24, fontSize: 14, color: '#1e40af' }}>
            👀 You're viewing this trip as a co-rider. Only the trip leader can edit the itinerary.
          </div>
        )}

        {/* Map — re-keyed when valid stops count changes so it re-mounts */}
        <div style={{ marginBottom: 28 }}>
          <TripMap
            key={mapRevision}
            stops={stops}
            fromPlace={trip.from_place}
            toPlace={trip.to_place}
          />
        </div>

        {/* Itinerary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: 0 }}>Itinerary</h2>
          {trip?.isOwner && <span style={{ fontSize: 13, color: '#9ca3af' }}>Changes auto-save after 1.5s</span>}
        </div>

        {Array.from({ length: trip.days }, (_, i) => i + 1).map((day) => {
          const dayStops = (groupedByDay[day] ?? []).sort((a, b) => a.order_index - b.order_index);
          const isOpen = openDays.has(day);
          const toggleDay = () => setOpenDays(prev => { const n = new Set(prev); if (n.has(day)) n.delete(day); else n.add(day); return n; });

          return (
            <div key={day} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 12, overflow: 'hidden' }}>
              <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', background: isOpen ? '#f8faff' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 15 }} onClick={toggleDay}>
                <span style={{ fontWeight: 700, color: '#1e40af', fontSize: 16, flex: 1 }}>Day {day}</span>
                {dayStops.length > 0 && <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: 12, padding: '2px 10px', borderRadius: 12, fontWeight: 500 }}>{dayStops.length} stops</span>}
                <span style={{ color: '#9ca3af', fontSize: 14 }}>{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div style={{ padding: '0 20px 20px' }}>
                  {dayStops.length === 0 && <p style={{ color: '#9ca3af', fontSize: 14 }}>No stops for this day</p>}

                  {dayStops.map((stop, idx) => (
                    <div key={`${stop.day_number}-${stop.order_index}-${idx}`} style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
                        <div style={{ fontSize: 20, lineHeight: 1, marginTop: 2 }}>{typeIcons[stop.item_type] ?? '📌'}</div>
                        {idx < dayStops.length - 1 && <div style={{ width: 2, flex: 1, background: '#e5e7eb', margin: '4px 0', minHeight: 16 }} />}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 16, borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: '#111827', fontSize: 15, flex: 1 }}>{stop.place}</span>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, textTransform: 'capitalize', background: (TYPE_COLORS[stop.item_type] ?? '#6b7280') + '20', color: TYPE_COLORS[stop.item_type] ?? '#6b7280' }}>
                            {stop.item_type.replace('_', ' ')}
                          </span>
                          {trip?.isOwner && (
                            <button onClick={() => removeStop(stop.day_number, stop.order_index)} style={{ background: '#fee2e2', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 12, padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                              ✕ Remove
                            </button>
                          )}
                        </div>
                        {stop.description && <p style={{ color: '#374151', fontSize: 14, margin: '0 0 6px' }}>{stop.description}</p>}
                        <div style={{ display: 'flex', gap: 12, fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
                          {stop.estimated_km > 0 && <span>🛣️ {stop.estimated_km}km</span>}
                          {stop.duration_hours > 0 && <span>⏱️ {stop.duration_hours}h</span>}
                        </div>
                        {stop.tips && <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#92400e' }}>💡 {stop.tips}</div>}
                      </div>
                    </div>
                  ))}

                  {/* Add stop form — owner only */}
                  {trip?.isOwner && addingToDay === day ? (
                    <div style={{ marginTop: 12, padding: 16, background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: '#111827', margin: '0 0 12px' }}>Add a stop to Day {day}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <PlaceInput
                          value={addForm.place}
                          onChange={(v) => setAddForm(f => ({ ...f, place: v, lat: undefined, lng: undefined }))}
                          onLocationSelect={(loc) => setAddForm(f => ({ ...f, place: loc.name, lat: loc.lat, lng: loc.lng }))}
                          placeholder="Place name (type to search or enter manually)"
                        />
                        <select
                          value={addForm.item_type}
                          onChange={(e) => setAddForm(f => ({ ...f, item_type: e.target.value }))}
                          style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
                        >
                          <option value="attraction">📍 Attraction</option>
                          <option value="meal">🍽️ Meal</option>
                          <option value="fuel_stop">⛽ Fuel Stop</option>
                          <option value="rest">☕ Rest</option>
                          <option value="stay">🏨 Stay</option>
                        </select>
                        <input
                          value={addForm.description}
                          onChange={(e) => setAddForm(f => ({ ...f, description: e.target.value }))}
                          placeholder="Description (optional)"
                          style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
                        />
                        <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>📍 Position will be auto-detected from the place's location on the route</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => addStop(day)} disabled={addingStop} style={{ ...styles.btnPrimary, opacity: addingStop ? 0.6 : 1 }}>
                            {addingStop ? '📍 Adding...' : '+ Add Stop'}
                          </button>
                          <button onClick={() => { setAddingToDay(null); setAddForm({ place: '', item_type: 'attraction', description: '' }); }} style={styles.btnSecondary}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : trip?.isOwner ? (
                    <button
                      onClick={() => setAddingToDay(day)}
                      style={{ marginTop: 12, padding: '10px 16px', background: '#eff6ff', border: '2px dashed #93c5fd', borderRadius: 8, cursor: 'pointer', color: '#1d4ed8', fontSize: 14, fontWeight: 600, width: '100%' }}
                    >
                      + Add Stop to Day {day}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
        {/* Expense Tracker */}
        <div style={{ marginTop: 24 }}>
          <ExpenseTracker tripId={trip.id} currentUserId={user!.id} />
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  center: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 },
  btnPrimary: { padding: '10px 18px', background: 'linear-gradient(135deg, #0f3460, #533483)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnSecondary: { padding: '10px 18px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
};

export default TripDetailPage;
