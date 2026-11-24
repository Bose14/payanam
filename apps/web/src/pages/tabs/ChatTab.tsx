import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChatConversation, ChatGroup, ChatMessage, chatService, tripService } from '../../services/api';

export const NOTIFY_KEY = 'payanam_chat_notify';
type Filter = 'All' | 'Trips' | 'Groups' | 'Direct';
type Notify = 'All' | 'Stops and alerts only';

function apiMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e?.response?.data?.error?.message || fallback;
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function useLivePolling(fn: () => void, ms: number) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    ref.current();
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function Composer({ onSend, disabled }: { onSend: (text: string) => Promise<void>; disabled?: boolean }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const t = text.trim();
    if (!t || busy || disabled) return;
    setBusy(true);
    try {
      await onSend(t);
      setText('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 10 }}>
      <input
        className="pz-input"
        placeholder="Write a message"
        aria-label="Write a message"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <button className="pz-btn primary" type="button" onClick={submit} disabled={disabled || busy || !text.trim()}>Send</button>
    </div>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  return (
    <div className={`pz-bubble${m.mine ? ' me' : ''}`}>
      <div className="who">{m.mine ? 'You' : m.senderName} · {clock(m.createdAt)}</div>
      {m.body}
    </div>
  );
}

/* ----------------------------- thread (trip / group / DM) ----------------------------- */

function Thread({
  conv, onBack, onOpenGroup, notify,
}: { conv: ChatConversation; onBack: () => void; onOpenGroup: (id: string) => void; notify: Notify }) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [isLead, setIsLead] = useState(false);
  const [dm, setDm] = useState<{ sentUnreplied: number; blocked: boolean; limit: number } | undefined>();
  const [error, setError] = useState('');
  const [itin, setItin] = useState<Array<{ id: string; place: string; day_number: number; description?: string }>>([]);
  const [sharing, setSharing] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const tripId = conv.type === 'trip' ? conv.key.slice(5) : null;

  const loadItin = useCallback(async () => {
    if (!tripId) return;
    try {
      const d = await tripService.getTripById(tripId);
      setItin((d?.trip?.itinerary ?? d?.itinerary ?? []) as typeof itin);
    } catch { /* keep what we have */ }
  }, [tripId]);

  const load = useCallback(async () => {
    try {
      const d = await chatService.messages(conv.key);
      setMsgs(d.messages);
      setIsLead(d.isLead);
      setDm(d.dm);
    } catch (e) {
      setError(apiMessage(e, 'Could not load messages.'));
    }
  }, [conv.key]);

  useLivePolling(load, 5000);
  useEffect(() => { loadItin(); }, [loadItin]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);

  const send = async (text: string) => {
    setError('');
    try {
      await chatService.send(conv.key, { body: text });
      await load();
    } catch (e) {
      setError(apiMessage(e, 'Message not sent. Try again.'));
      throw e;
    }
  };

  const shareLocation = () => {
    setError('');
    if (!('geolocation' in navigator)) {
      setError('This device cannot share a location.');
      return;
    }
    setShareBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await chatService.send(conv.key, {
            kind: 'location',
            place: placeName.trim() || 'My location',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setSharing(false);
          setPlaceName('');
          await load();
        } catch (e) {
          setError(apiMessage(e, 'Could not share your location.'));
        } finally {
          setShareBusy(false);
        }
      },
      () => {
        setShareBusy(false);
        setError('Location is blocked. Allow it in your browser settings to share where you are.');
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const confirm = async (id: string) => {
    setError('');
    try {
      await chatService.confirmStop(conv.key, id);
      await Promise.all([load(), loadItin()]);
    } catch (e) {
      setError(apiMessage(e, 'Could not confirm the stop.'));
    }
  };

  const kind = conv.type === 'trip' ? 'Trip chat' : conv.type === 'group' ? 'Group chat' : 'Direct message';

  return (
    <>
      <div className="pz-row">
        <button className="pz-btn small" type="button" onClick={onBack}>← Chats</button>
        <div className="pz-grow">
          <b>{conv.title}</b>
          <div className="pz-note">{conv.type === 'trip' ? `Notify me: ${notify.toLowerCase()}` : kind}</div>
        </div>
        {conv.type === 'group' && (
          <button className="pz-btn small" type="button" onClick={() => onOpenGroup(conv.key.slice(6))}>Group page</button>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        {!msgs.length && <p className="pz-note">No messages yet.</p>}
        {msgs.map((m) =>
          m.kind === 'location' && m.meta ? (
            <div key={m.id} className={`pz-bubble${m.mine ? ' me' : ''}`}>
              <div className="who">{m.mine ? 'You' : m.senderName} · {clock(m.createdAt)}</div>
              <div style={{ display: 'grid', gap: 6, justifyItems: 'start' }}>
                <b>{m.meta.place}</b>
                <div className="pz-note">Shared location</div>
                <a className="pz-btn small" href={`https://www.google.com/maps?q=${m.meta.lat},${m.meta.lng}`} target="_blank" rel="noreferrer">Open in maps</a>
                {m.meta.confirmed ? (
                  <span className="pz-pill ok">Confirmed. Added to the itinerary for everyone.</span>
                ) : isLead ? (
                  <button className="pz-btn small" type="button" onClick={() => confirm(m.id)}>Confirm as stop</button>
                ) : (
                  <span className="pz-pill stale">Waiting for the captain to confirm</span>
                )}
              </div>
            </div>
          ) : (
            <Bubble key={m.id} m={m} />
          ),
        )}
        <div ref={bottom} />
      </div>

      {error && <div className="pz-banner bad" role="alert">{error}</div>}

      {conv.type === 'trip' && (
        sharing ? (
          <div className="pz-card">
            <label className="pz-label" htmlFor="pz-place">Name this place</label>
            <input id="pz-place" className="pz-input" placeholder="e.g. Chai, Sagar Highway Dhaba" value={placeName} onChange={(e) => setPlaceName(e.target.value)} />
            <div className="pz-row" style={{ marginTop: 10 }}>
              <button className="pz-btn small primary" type="button" onClick={shareLocation} disabled={shareBusy}>{shareBusy ? 'Finding you…' : 'Share'}</button>
              <button className="pz-btn small" type="button" onClick={() => setSharing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="pz-btn block" type="button" onClick={() => setSharing(true)} style={{ marginTop: 8 }}>Share my location</button>
        )
      )}

      {conv.type === 'dm' && dm?.blocked && (
        <div className="pz-banner warn" role="status">
          Wait for {conv.title} to reply. You can send {dm.limit} messages before a reply is needed.
        </div>
      )}
      {conv.type === 'dm' && dm && !dm.blocked && dm.sentUnreplied > 0 && (
        <div className="pz-note">{dm.limit - dm.sentUnreplied} messages left before {conv.title} needs to reply.</div>
      )}

      <Composer onSend={send} disabled={conv.type === 'dm' && !!dm?.blocked} />

      {conv.type === 'trip' && (
        <>
          <div className="pz-label" style={{ marginTop: 16 }}>Itinerary</div>
          <div className="pz-card">
            {itin.length ? itin.map((i) => (
              <div className="pz-row-item" key={i.id}>
                <span className="pz-mono" style={{ width: 50, flex: 'none' }}>Day {i.day_number}</span>
                <div className="pz-grow">
                  {i.place}
                  {i.description === 'Added from trip chat' && <span className="pz-tag">from chat</span>}
                </div>
              </div>
            )) : <p className="pz-note">No stops yet.</p>}
          </div>
        </>
      )}
    </>
  );
}

/* ----------------------------------- group page ----------------------------------- */

function GroupPage({ id, onBack }: { id: string; onBack: () => void }) {
  const [g, setG] = useState<ChatGroup | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try { setG(await chatService.group(id)); } catch (e) { setError(apiMessage(e, 'Could not load the group.')); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const answer = async (userId: string, action: 'accept' | 'decline') => {
    setError('');
    try { await chatService.respondToGroupRequest(id, userId, action); await load(); }
    catch (e) { setError(apiMessage(e, 'Could not update the request.')); }
  };

  const copy = async () => {
    if (!g) return;
    try { await navigator.clipboard.writeText(g.inviteCode); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* shown on screen */ }
  };

  return (
    <>
      <div className="pz-row"><button className="pz-btn small" type="button" onClick={onBack}>← Group chat</button></div>
      {error && <div className="pz-banner bad" role="alert" style={{ marginTop: 10 }}>{error}</div>}
      {g && (
        <>
          <h1 className="pz-h1">{g.name}</h1>
          <div className="pz-note" style={{ marginBottom: 12 }}>{g.members.length} {g.members.length === 1 ? 'member' : 'members'}</div>
          <div className="pz-card">
            <div className="pz-label">Invite</div>
            <div className="pz-row">
              <div className="pz-grow">
                <div className="pz-h2">{g.inviteCode}</div>
                <div className="pz-note">Members join with this code. The admin approves requests.</div>
              </div>
              <button className="pz-btn small" type="button" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
          </div>
          {g.isAdmin && g.requests.length > 0 && (
            <div className="pz-card">
              <div className="pz-label">Join requests</div>
              {g.requests.map((r) => (
                <div className="pz-row-item" key={r.userId}>
                  <div className="pz-av" aria-hidden="true">{r.name.charAt(0)}</div>
                  <div className="pz-grow"><b>{r.name}</b><div className="pz-note">Wants to join</div></div>
                  <button className="pz-btn small primary" type="button" onClick={() => answer(r.userId, 'accept')}>Accept</button>
                  <button className="pz-btn small" type="button" onClick={() => answer(r.userId, 'decline')}>Decline</button>
                </div>
              ))}
            </div>
          )}
          <div className="pz-card">
            <div className="pz-label">Members</div>
            {g.members.map((m) => (
              <div className="pz-row-item" key={m.userId}>
                <div className="pz-av" aria-hidden="true">{m.name.charAt(0)}</div>
                <div className="pz-grow">{m.name}{m.you && <span className="pz-tag">You</span>}{m.role === 'admin' && <span className="pz-tag">Admin</span>}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* ------------------------------------ list view ------------------------------------ */

export default function ChatTab() {
  const [params, setParams] = useSearchParams();
  const [convs, setConvs] = useState<ChatConversation[]>([]);
  const [contacts, setContacts] = useState<Array<{ userId: string; name: string; city: string | null; key: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [notify, setNotify] = useState<Notify>(() =>
    localStorage.getItem(NOTIFY_KEY) === 'Stops and alerts only' ? 'Stops and alerts only' : 'All');
  const [groupName, setGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const openKey = params.get('c');
  const groupId = params.get('group');

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([chatService.conversations(), chatService.contacts().catch(() => [])]);
      setConvs(c);
      setContacts(p);
      setError('');
    } catch (e) {
      setError(apiMessage(e, 'Could not load your chats.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useLivePolling(load, 10000);

  // /chat?trip=<tripId> (links from other screens) opens that trip's chat.
  const legacyTrip = params.get('trip');
  useEffect(() => {
    if (legacyTrip) setParams({ c: `trip:${legacyTrip}` }, { replace: true });
  }, [legacyTrip, setParams]);

  const setNotifyPref = (n: Notify) => {
    setNotify(n);
    localStorage.setItem(NOTIFY_KEY, n);
    setNotice(`Trip notifications: ${n.toLowerCase()}`);
  };

  const createGroup = async () => {
    setBusy(true);
    setNotice('');
    try {
      const g = await chatService.createGroup(groupName);
      setGroupName('');
      setNotice(`Group ${g.name} created. Invite code ${g.inviteCode}.`);
      await load();
      setParams({ c: `group:${g.id}` });
    } catch (e) {
      setNotice(apiMessage(e, 'Could not create the group.'));
    } finally {
      setBusy(false);
    }
  };

  const joinGroup = async () => {
    setBusy(true);
    setNotice('');
    try {
      const r = await chatService.joinGroup(joinCode);
      setJoinCode('');
      setNotice(r.status === 'member' ? `You are already in ${r.name}.` : `Request sent to ${r.name}. The admin will approve you.`);
      await load();
    } catch (e) {
      setNotice(apiMessage(e, 'Could not send the request.'));
    } finally {
      setBusy(false);
    }
  };

  if (groupId) return <GroupPage id={groupId} onBack={() => setParams({ c: `group:${groupId}` })} />;

  const open = convs.find((c) => c.key === openKey) ??
    (openKey?.startsWith('dm:')
      ? (() => {
          const other = contacts.find((p) => p.key === openKey);
          return other ? { key: openKey, type: 'dm' as const, title: other.name, subtitle: 'Direct message', lastMessage: null, lastAt: null, unread: 0 } : undefined;
        })()
      : undefined);

  if (open) {
    return (
      <Thread
        conv={open}
        notify={notify}
        onBack={() => { setParams({}); load(); }}
        onOpenGroup={(id) => setParams({ group: id })}
      />
    );
  }

  const rows = convs.filter((c) =>
    filter === 'All' || (filter === 'Trips' && c.type === 'trip') || (filter === 'Groups' && c.type === 'group') || (filter === 'Direct' && c.type === 'dm'));
  const startable = contacts.filter((p) => !convs.some((c) => c.key === p.key));
  const tag = (t: ChatConversation['type']) => (t === 'trip' ? 'Trips' : t === 'group' ? 'Groups' : 'Direct');

  return (
    <>
      <h1 className="pz-h1">Chat</h1>

      <div className="pz-label">Trip notifications</div>
      <div className="pz-chips">
        {(['All', 'Stops and alerts only'] as Notify[]).map((n) => (
          <button key={n} type="button" aria-pressed={notify === n} onClick={() => setNotifyPref(n)}>{n}</button>
        ))}
      </div>
      <div className="pz-chips">
        {(['All', 'Trips', 'Groups', 'Direct'] as Filter[]).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      {error && <div className="pz-banner bad" role="alert">{error}</div>}
      {notice && <div className="pz-banner ok" role="status">{notice}</div>}
      {loading && <p className="pz-note">Loading…</p>}

      <div className="pz-card">
        {rows.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setParams({ c: c.key })}
            style={{ all: 'unset', display: 'block', width: '100%', cursor: 'pointer', boxSizing: 'border-box' }}
          >
            <div className="pz-row-item">
              <div className="pz-av" aria-hidden="true">{c.title.charAt(0).toUpperCase()}</div>
              <div className="pz-grow">
                <b>{c.title}</b>
                <div className="pz-note" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.lastMessage ?? c.subtitle}
                </div>
              </div>
              {c.unread > 0 && <span className="pz-pill bad">{c.unread}</span>}
              <span className="pz-tag">{tag(c.type)}</span>
            </div>
          </button>
        ))}
        {!loading && !rows.length && <p className="pz-note">Nothing here yet.</p>}
      </div>

      {(filter === 'All' || filter === 'Direct') && startable.length > 0 && (
        <>
          <div className="pz-label">Message a rider</div>
          <div className="pz-card">
            {startable.map((p) => (
              <button
                key={p.userId}
                type="button"
                onClick={() => setParams({ c: p.key })}
                style={{ all: 'unset', display: 'block', width: '100%', cursor: 'pointer', boxSizing: 'border-box' }}
              >
                <div className="pz-row-item">
                  <div className="pz-av" aria-hidden="true">{p.name.charAt(0).toUpperCase()}</div>
                  <div className="pz-grow"><b>{p.name}</b>{p.city && <div className="pz-note">{p.city}</div>}</div>
                  <span className="pz-tag">Direct</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {(filter === 'All' || filter === 'Groups') && (
        <>
          <div className="pz-label">Groups</div>
          <div className="pz-card">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <input className="pz-input" placeholder="New group name" aria-label="New group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
              <button className="pz-btn primary" type="button" onClick={createGroup} disabled={busy || groupName.trim().length < 2}>Create</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 10 }}>
              <input className="pz-input" placeholder="Group invite code" aria-label="Group invite code" value={joinCode} style={{ textTransform: 'uppercase' }} onChange={(e) => setJoinCode(e.target.value)} />
              <button className="pz-btn" type="button" onClick={joinGroup} disabled={busy || joinCode.trim().length < 4}>Join</button>
            </div>
          </div>
        </>
      )}

      <p className="pz-note">General chat stays on your usual apps. Trip chat is for stops, status and the itinerary.</p>
    </>
  );
}
