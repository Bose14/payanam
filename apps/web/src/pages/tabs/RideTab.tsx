import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { rideService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTripSessions } from './useTripSessions';

export default function RideTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { items, loading, error } = useTripSessions();
  const [starting, setStarting] = useState<string | null>(null);
  const [startError, setStartError] = useState('');

  const live = items.filter((t) => t.sessionId);
  const startable = items.filter((t) => !t.sessionId && t.isOwner && t.status !== 'completed');

  const start = async (tripId: string) => {
    setStarting(tripId);
    setStartError('');
    try {
      const d = await rideService.startRide(tripId);
      navigate(`/ride/${d.session.id}`);
    } catch {
      setStartError('Could not start the ride. Try again.');
      setStarting(null);
    }
  };

  const firstName = user?.fullName?.split(' ')[0];

  return (
    <>
      <h1 className="pz-h1">{firstName ? `Ride, ${firstName}` : 'Ride'}</h1>

      {error && <div className="pz-banner bad" role="alert">{error}</div>}
      {startError && <div className="pz-banner bad" role="alert">{startError}</div>}
      {loading && <p className="pz-note">Loading your trips…</p>}

      {live.map((t) => (
        <div className="pz-card" key={t.id}>
          <span className="pz-pill ok">Live now</span>
          <div className="pz-h2" style={{ marginTop: 10 }}>{t.title}</div>
          <div className="pz-note">{t.from_place} → {t.to_place} · {t.days} {t.days === 1 ? 'day' : 'days'}</div>
          <div className="pz-row" style={{ marginTop: 12 }}>
            <Link className="pz-btn small primary" to={`/ride/${t.sessionId}`}>Open live ride</Link>
            <Link className="pz-btn small" to={`/chat?trip=${t.id}`}>Trip chat</Link>
          </div>
        </div>
      ))}

      {!loading && !live.length && (
        <div className="pz-banner stale" role="status">No ride in progress. Start one from a trip you lead, or ask your captain to start.</div>
      )}

      {startable.length > 0 && (
        <>
          <div className="pz-label" style={{ marginTop: 8 }}>Start a ride</div>
          {startable.map((t) => (
            <div className="pz-card" key={t.id}>
              <div className="pz-row" style={{ justifyContent: 'space-between' }}>
                <div className="pz-grow">
                  <b>{t.title}</b>
                  <div className="pz-note">{t.from_place} → {t.to_place}</div>
                </div>
                <button className="pz-btn small primary" type="button" onClick={() => start(t.id)} disabled={starting === t.id}>
                  {starting === t.id ? 'Starting…' : 'Start ride'}
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {!loading && !items.length && (
        <div className="pz-card">
          <div className="pz-h2">No trips yet</div>
          <p className="pz-note" style={{ margin: '4px 0 12px' }}>Plan a trip or join one with an invite code to ride with a group.</p>
          <div className="pz-row">
            <Link className="pz-btn small primary" to="/trips/new">Plan a trip</Link>
            <Link className="pz-btn small" to="/discover">Discover trips</Link>
          </div>
        </div>
      )}
    </>
  );
}
