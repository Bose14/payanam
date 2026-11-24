import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { rideService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTripSessions, TripWithSession } from './useTripSessions';

interface Msg {
  id: string;
  user_id?: string;
  user_name?: string;
  message: string;
  message_type?: string;
  created_at: string;
}

function Thread({ trip, onBack }: { trip: TripWithSession; onBack: () => void }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const sessionId = trip.sessionId!;

  const load = useCallback(async () => {
    try {
      const d = await rideService.getMessages(sessionId);
      setMsgs((d?.messages ?? []) as Msg[]);
    } catch {
      /* keep what we have */
    }
  }, [sessionId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [msgs.length]);

  const send = async () => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError('');
    try {
      await rideService.sendMessage(sessionId, {
        message,
        messageType: 'chat',
        userName: user?.fullName || 'Rider',
      });
      setText('');
      await load();
    } catch {
      setError('Message not sent. Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="pz-row" style={{ marginBottom: 12 }}>
        <button className="pz-btn small" type="button" onClick={onBack}>← Chats</button>
        <div className="pz-grow">
          <b>{trip.title}</b>
          <div className="pz-note">Trip chat</div>
        </div>
      </div>
      <div>
        {!msgs.length && <p className="pz-note">No messages yet.</p>}
        {msgs.map((m) => {
          const mine = m.user_id === user?.id;
          return (
            <div key={m.id} className={`pz-bubble${mine ? ' me' : ''}`}>
              {!mine && <div className="who">{m.user_name || 'Rider'}</div>}
              {m.message}
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {error && <div className="pz-banner bad" role="alert">{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 10 }}>
        <input
          className="pz-input"
          placeholder="Write a message"
          aria-label="Write a message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="pz-btn primary" type="button" onClick={send} disabled={sending || !text.trim()}>Send</button>
      </div>
    </>
  );
}

export default function ChatTab() {
  const { items, loading, error } = useTripSessions();
  const [params, setParams] = useSearchParams();
  const openId = params.get('trip');
  const open = items.find((t) => t.id === openId && t.sessionId);

  if (open) {
    return <Thread trip={open} onBack={() => setParams({})} />;
  }

  return (
    <>
      <h1 className="pz-h1">Chat</h1>
      {error && <div className="pz-banner bad" role="alert">{error}</div>}
      {loading && <p className="pz-note">Loading…</p>}
      <div className="pz-card">
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={!t.sessionId}
            onClick={() => setParams({ trip: t.id })}
            style={{ all: 'unset', display: 'block', width: '100%', cursor: t.sessionId ? 'pointer' : 'default', boxSizing: 'border-box' }}
          >
            <div className="pz-row-item">
              <div className="pz-av" aria-hidden="true">{(t.title || 'T').charAt(0).toUpperCase()}</div>
              <div className="pz-grow">
                <b>{t.title}</b>
                <div className="pz-note">
                  {t.sessionId ? 'Trip chat · ride in progress' : 'Opens when the ride starts'}
                </div>
              </div>
              <span className="pz-tag">Trip</span>
            </div>
          </button>
        ))}
        {!loading && !items.length && <p className="pz-note">No trips yet. Trip chats appear here once you plan or join a trip.</p>}
      </div>
      <p className="pz-note">General chat stays on your usual apps. Trip chat is for stops, status and the itinerary.</p>
    </>
  );
}
