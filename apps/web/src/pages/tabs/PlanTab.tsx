import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tripService } from '../../services/api';
import { useTripSessions, TripWithSession } from './useTripSessions';

function statusPill(t: TripWithSession) {
  if (t.sessionId) return <span className="pz-pill ok">Live now</span>;
  if (t.status === 'completed') return <span className="pz-pill stale">Completed</span>;
  return <span className="pz-pill sys">{t.isOwner ? 'You lead' : 'Joined'}</span>;
}

export default function PlanTab() {
  const navigate = useNavigate();
  const { items, loading, error, reload } = useTripSessions();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [confirm, setConfirm] = useState<TripWithSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const join = () => {
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) {
      setCodeError('Enter the code your captain gave you.');
      return;
    }
    navigate(`/join/${encodeURIComponent(clean)}`);
  };

  const remove = async () => {
    if (!confirm) return;
    setBusy(true);
    setActionError('');
    try {
      await tripService.deleteTrip(confirm.id);
      setConfirm(null);
      await reload();
    } catch {
      setActionError('Could not delete the trip. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="pz-h1">Trips</h1>

      {error && <div className="pz-banner bad" role="alert">{error}</div>}
      {actionError && <div className="pz-banner bad" role="alert">{actionError}</div>}
      {loading && <p className="pz-note">Loading your trips…</p>}

      {items.map((t) => (
        <div className="pz-card" key={t.id}>
          {statusPill(t)}
          <div className="pz-h2" style={{ marginTop: 10 }}>{t.title}</div>
          <div className="pz-note">
            {t.from_place} → {t.to_place} · {t.days} {t.days === 1 ? 'day' : 'days'}
          </div>
          <div className="pz-row" style={{ marginTop: 12 }}>
            <Link className="pz-btn small primary" to={`/trips/${t.id}`}>Open trip</Link>
            {t.sessionId && <Link className="pz-btn small" to={`/ride/${t.sessionId}`}>Live ride</Link>}
            {t.isOwner && (
              <button className="pz-btn small" type="button" onClick={() => setConfirm(t)}>Delete</button>
            )}
          </div>
          {confirm?.id === t.id && (
            <div className="pz-banner bad" role="alertdialog" style={{ marginTop: 12 }}>
              <b>Delete this trip?</b>
              <div className="pz-note" style={{ margin: '4px 0 10px' }}>
                The route, itinerary and expense records are removed for everyone. This cannot be undone.
              </div>
              <div className="pz-row">
                <button className="pz-btn small" type="button" onClick={() => setConfirm(null)}>Keep trip</button>
                <button className="pz-btn small primary" type="button" onClick={remove} disabled={busy}>
                  {busy ? 'Deleting…' : 'Yes, delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {!loading && !items.length && !error && (
        <div className="pz-card">
          <div className="pz-h2">No trips yet</div>
          <p className="pz-note" style={{ margin: '4px 0 0' }}>Plan your first trip, or join one with an invite code.</p>
        </div>
      )}

      <Link className="pz-btn primary block" to="/trips/new">New trip</Link>

      <div className="pz-label" style={{ marginTop: 8 }}>Join with invite code</div>
      <div className="pz-card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
          <input
            className="pz-input"
            placeholder="e.g. KSD-7Q2"
            aria-label="Invite code"
            value={code}
            onChange={(e) => { setCode(e.target.value); setCodeError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && join()}
            style={{ textTransform: 'uppercase' }}
          />
          <button className="pz-btn primary" type="button" onClick={join}>Join</button>
        </div>
        {codeError && <p role="alert" style={{ color: 'var(--pz-bad)', fontSize: 13, margin: '8px 0 0' }}>{codeError}</p>}
        <p className="pz-note" style={{ margin: '8px 0 0' }}>Your captain approves each rider before they join.</p>
      </div>
    </>
  );
}
